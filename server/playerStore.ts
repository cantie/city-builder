import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catchUpTicks } from '../src/core/catchUp';
import {
  createNewGame,
  ensureWarehouseMigrated,
} from '../src/core/bootstrap';
import {
  demolishBuilding,
  moveBuilding,
  placeBuilding,
} from '../src/core/buildings';
import {
  DEFAULT_EXPORT_PRICE,
  INVENT_COST,
  applyInventedBuilding,
  composeInventPrompt,
  forgetCustomBuilding,
  nextCustomBuildingId,
  validateInventInput,
  withCustomBuildings,
} from '../src/core/customBuilding';
import {
  TRAIN_FOOD_COST,
  TRAIN_UNIQUE_COST,
  addArmy,
  isOriginCustom,
  spendSellerForReplica,
  trainAtOrigin,
} from '../src/core/customEconomy';
import { trySpend } from '../src/core/inventory';
import { parseCustomSlot, sharedCustomTypeId } from '../src/core/customIds';
import { harvestBuilding } from '../src/core/farm';
import { withLicenses } from '../src/core/licenses';
import { applyBuy, validateList } from '../src/core/market';
import { nameInventTrio, type InventTrio } from './nameBuilding';
import { MarketStore } from './marketStore';
import {
  hasResearchInstitute,
  startResearch,
  syncCompletedResearchUnlocks,
} from '../src/core/research';
import { upgradeBuilding, type UpgradesConfig } from '../src/core/upgrades';
import {
  deserializeGame,
  serializeGame,
  type SerializedGame,
} from '../src/core/save';
import { normalizePlayerName } from '../src/core/playerName';
import type { ContentRegistry } from '../src/core/registry';
import type { BuildingTypeId, GameState, ReplicaStatus } from '../src/core/types';
import {
  IMAGE_GEN_FAILED,
  MISSING_IMAGE_KEY,
  createImageGenerator,
  type GenerateImage,
} from './imageGen';

export interface PlayerRecord {
  name: string;
  lastTickAt: number;
  game: SerializedGame;
}

export type CommandResult =
  | { ok: true; game: SerializedGame }
  | { ok: false; reason: string; game: SerializedGame };

export type PlayerAction =
  | { op: 'place'; typeId: BuildingTypeId; x: number; y: number }
  | { op: 'move'; buildingId: string; x: number; y: number }
  | { op: 'demolish'; buildingId: string }
  | { op: 'harvest'; buildingId: string }
  | { op: 'research'; researchId: string }
  | { op: 'upgrade'; buildingId: string }
  | { op: 'new-game' }
  | { op: 'forget-building'; typeId: BuildingTypeId }
  | { op: 'train'; buildingId: string };

export class PlayerStore {
  private locks = new Map<string, Promise<void>>();
  private market: MarketStore;

  constructor(
    private dir: string,
    private registry: ContentRegistry,
    private upgrades: UpgradesConfig,
    private now: () => number = () => Date.now(),
    private generateImage: GenerateImage = createImageGenerator(),
    private nameTrio: (prompt: string) => Promise<InventTrio> = nameInventTrio,
  ) {
    this.market = new MarketStore(join(this.dir, '..', 'market'));
  }

  async login(name: string): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      await this.write(key, rec, state);
      return { ok: true as const, game: await this.dump(state) };
    });
  }

  async snapshot(name: string): Promise<CommandResult> {
    return this.login(name);
  }

  async invent(
    name: string,
    prompt: string,
    width: number,
    height: number,
  ): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const parsed = validateInventInput(prompt, width, height);
      if (!parsed.ok) {
        return { ok: false as const, reason: parsed.reason, game: await this.dump(state) };
      }
      if (!hasResearchInstitute(state)) {
        return {
          ok: false as const,
          reason: 'need research institute',
          game: await this.dump(state),
        };
      }
      const id = nextCustomBuildingId(state.customBuildings ?? []);
      if (!id) {
        return {
          ok: false as const,
          reason: 'custom building limit',
          game: await this.dump(state),
        };
      }
      for (const resId of Object.keys(INVENT_COST) as (keyof typeof INVENT_COST)[]) {
        if (state.inventory.amounts[resId] < (INVENT_COST[resId] ?? 0)) {
          return {
            ok: false as const,
            reason: 'cannot afford',
            game: await this.dump(state),
          };
        }
      }
      let png: Buffer;
      let names: InventTrio;
      try {
        [png, names] = await Promise.all([
          this.generateImage(
            composeInventPrompt(parsed.prompt, parsed.footprint),
          ),
          this.nameTrio(parsed.prompt),
        ]);
      } catch (err) {
        const reason =
          err instanceof Error && err.message === MISSING_IMAGE_KEY
            ? MISSING_IMAGE_KEY
            : IMAGE_GEN_FAILED;
        return { ok: false as const, reason, game: await this.dump(state) };
      }
      if (!trySpend(state.inventory, INVENT_COST)) {
        return {
          ok: false as const,
          reason: 'cannot afford',
          game: await this.dump(state),
        };
      }
      const live = withCustomBuildings(this.registry, state.customBuildings);
      applyInventedBuilding(state, live, {
        id,
        prompt: parsed.prompt,
        footprint: parsed.footprint,
        sprite: `/api/sprites/${id}`,
        owner: key,
        names,
      });
      await this.writeSprite(key, id, png);
      await this.write(key, rec, state);
      return { ok: true as const, game: await this.dump(state) };
    });
  }

  async readSprite(name: string, id: string): Promise<Buffer | null> {
    const key = normalizePlayerName(name);
    if (!key || !/^custom-[123]$/.test(id)) return null;
    try {
      return await readFile(this.spritePath(key, id));
    } catch {
      return null;
    }
  }

  async apply(name: string, action: PlayerAction): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    if (action.op === 'train') {
      return this.train(name, action.buildingId);
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const result = this.runAction(state, action);
      if (action.op === 'forget-building' && result.ok) {
        await this.deleteSprite(key, action.typeId);
        await this.market.removeOwnerSlot(key, String(action.typeId));
      }
      if (action.op === 'new-game' && result.ok) {
        await this.market.removeOwnerAll(key);
      }
      await this.write(key, rec, state);
      if (!result.ok) {
        return { ok: false, reason: result.reason, game: await this.dump(state) };
      }
      return { ok: true, game: await this.dump(state) };
    });
  }

  private liveRegistry(state: GameState): ContentRegistry {
    return withLicenses(
      withCustomBuildings(this.registry, state.customBuildings),
      state.licenses,
    );
  }

  async catalog() {
    return this.market.all();
  }

  async listOnMarket(
    name: string,
    typeId: BuildingTypeId,
    price: number,
  ): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const checked = validateList(state, typeId, price);
      if (!checked.ok) {
        return { ok: false as const, reason: checked.reason, game: await this.dump(state) };
      }
      const slot = parseCustomSlot(String(typeId));
      const custom = (state.customBuildings ?? []).find((c) => c.id === typeId);
      if (!slot || !custom) {
        return { ok: false as const, reason: 'need origin', game: await this.dump(state) };
      }
      const shared = sharedCustomTypeId(key, slot);
      await this.market.upsert({
        typeId: shared,
        owner: key,
        slot: `custom-${slot}`,
        price,
        listedAt: this.now(),
        label: custom.label,
        resourceLabel: custom.resourceLabel,
        unitLabel: custom.unitLabel,
        sprite: `/api/market/sprites/${shared}`,
      });
      await this.write(key, rec, state);
      return { ok: true as const, game: await this.dump(state) };
    });
  }

  async unlistFromMarket(
    name: string,
    typeId: BuildingTypeId,
  ): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const slot = parseCustomSlot(String(typeId));
      if (slot) {
        await this.market.removeOwnerSlot(key, `custom-${slot}`);
      } else {
        await this.market.unlist(String(typeId));
      }
      await this.write(key, rec, state);
      return { ok: true as const, game: await this.dump(state) };
    });
  }

  async buyListing(name: string, typeId: string): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const listing = await this.market.get(typeId);
      if (!listing) {
        return { ok: false as const, reason: 'not listed', game: await this.dump(state) };
      }
      const result = applyBuy(state, listing, key);
      await this.write(key, rec, state);
      return result.ok
        ? { ok: true as const, game: await this.dump(state) }
        : { ok: false as const, reason: result.reason, game: await this.dump(state) };
    });
  }

  async setExport(
    name: string,
    typeId: BuildingTypeId,
    enabled: boolean,
    price?: number,
  ): Promise<CommandResult> {
    const key = normalizePlayerName(name);
    if (!key) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const custom = (state.customBuildings ?? []).find((c) => c.id === typeId);
      if (!custom) {
        return { ok: false as const, reason: 'need origin', game: await this.dump(state) };
      }
      custom.exportEnabled = enabled;
      if (typeof price === 'number') {
        custom.exportPrice = Math.min(20, Math.max(1, Math.round(price)));
      } else if (typeof custom.exportPrice !== 'number') {
        custom.exportPrice = DEFAULT_EXPORT_PRICE;
      }
      await this.write(key, rec, state);
      return { ok: true as const, game: await this.dump(state) };
    });
  }

  async readMarketSprite(typeId: string): Promise<Buffer | null> {
    const m = /^custom-([a-z0-9_-]+)-([123])$/.exec(typeId);
    if (!m) return null;
    return this.readSprite(m[1]!, `custom-${m[2]!}`);
  }

  private runAction(
    state: GameState,
    action: PlayerAction,
  ): { ok: true } | { ok: false; reason: string } {
    const registry = this.liveRegistry(state);
    switch (action.op) {
      case 'new-game': {
        const fresh = createNewGame(this.registry, this.upgrades);
        state.tick = fresh.tick;
        state.grid = fresh.grid;
        state.buildings = fresh.buildings;
        state.inventory = fresh.inventory;
        state.unlockedBlueprints = fresh.unlockedBlueprints;
        state.unlockedRecipes = fresh.unlockedRecipes;
        state.completedResearch = fresh.completedResearch;
        state.availableResearch = fresh.availableResearch;
        state.activeResearch = fresh.activeResearch;
        state.customBuildings = fresh.customBuildings ?? [];
        state.army = {};
        state.licenses = [];
        return { ok: true };
      }
      case 'place':
        return placeBuilding(
          state,
          registry,
          action.typeId,
          { x: action.x, y: action.y },
          undefined,
          this.upgrades,
        );
      case 'move':
        return moveBuilding(state, registry, action.buildingId, {
          x: action.x,
          y: action.y,
        });
      case 'demolish':
        return demolishBuilding(
          state,
          registry,
          action.buildingId,
          this.upgrades,
        );
      case 'harvest':
        return harvestBuilding(state, action.buildingId);
      case 'research':
        return startResearch(state, registry, action.researchId);
      case 'upgrade':
        return upgradeBuilding(
          state,
          registry,
          action.buildingId,
          this.upgrades,
        );
      case 'forget-building':
        return forgetCustomBuilding(state, registry, action.typeId);
      default:
        return { ok: false, reason: 'unknown action' };
    }
  }

  private hydrate(rec: PlayerRecord): GameState {
    const state = deserializeGame(
      rec.game,
      this.registry,
      this.upgrades,
      rec.name,
    );
    if (!state) {
      return createNewGame(this.registry, this.upgrades);
    }
    return state;
  }

  private catchUpAndMigrate(state: GameState, rec: PlayerRecord): void {
    const registry = this.liveRegistry(state);
    if (ensureWarehouseMigrated(state, registry, this.upgrades)) {
      /* persist via caller */
    }
    syncCompletedResearchUnlocks(state, registry);
    const now = this.now();
    const caught = catchUpTicks(state, this.registry, rec.lastTickAt, now);
    rec.lastTickAt = caught.lastTickAt;
  }

  private filePath(name: string): string {
    return join(this.dir, `${name}.json`);
  }

  private spritePath(name: string, id: string): string {
    return join(this.dir, name, 'sprites', `${id}.png`);
  }

  private async writeSprite(name: string, id: string, png: Buffer): Promise<void> {
    const path = this.spritePath(name, id);
    await mkdir(join(this.dir, name, 'sprites'), { recursive: true });
    await writeFile(path, png);
  }

  private async deleteSprite(name: string, id: string): Promise<void> {
    try {
      await unlink(this.spritePath(name, id));
    } catch {
      /* missing file */
    }
  }

  private async readOrCreate(name: string): Promise<PlayerRecord> {
    await mkdir(this.dir, { recursive: true });
    try {
      const raw = await readFile(this.filePath(name), 'utf8');
      const parsed = JSON.parse(raw) as PlayerRecord;
      if (!parsed?.game || typeof parsed.lastTickAt !== 'number') {
        throw new Error('invalid');
      }
      return parsed;
    } catch {
      const state = createNewGame(this.registry, this.upgrades);
      return {
        name,
        lastTickAt: this.now(),
        game: await this.dump(state),
      };
    }
  }

  private async dump(state: GameState): Promise<SerializedGame> {
    const game = serializeGame(state);
    const statuses: ReplicaStatus[] = [];
    for (const lic of state.licenses ?? []) {
      const sellerRec = await this.readOrCreate(lic.owner);
      const seller = this.hydrate(sellerRec);
      const rec = (seller.customBuildings ?? []).find((c) => c.id === lic.slot);
      const origins = seller.buildings.filter((b) => b.typeId === lic.slot);
      const stock = origins.reduce(
        (sum, b) => sum + (b.exportStock ?? 0) + (b.uniquePending ?? 0),
        0,
      );
      statuses.push({
        typeId: lic.typeId,
        exportEnabled: !!rec && rec.exportEnabled !== false,
        stock,
        exportPrice: rec?.exportPrice ?? 2,
        abandoned: !rec,
      });
    }
    game.replicaStatus = statuses;
    return game;
  }

  private async write(
    name: string,
    rec: PlayerRecord,
    state: GameState,
  ): Promise<void> {
    rec.name = name;
    rec.game = serializeGame(state);
    const path = this.filePath(name);
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(rec), 'utf8');
    await rename(tmp, path);
  }

  private async withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(name) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    this.locks.set(
      name,
      prev.then(() => gate),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async withLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    const uniq = [...new Set(keys)].sort();
    const run = async (i: number): Promise<T> =>
      i >= uniq.length ? fn() : this.withLock(uniq[i]!, () => run(i + 1));
    return run(0);
  }

  async train(name: string, buildingId: string): Promise<CommandResult> {
    const buyerKey = normalizePlayerName(name);
    if (!buyerKey) {
      return {
        ok: false,
        reason: 'invalid player name',
        game: serializeGame(createNewGame(this.registry, this.upgrades)),
      };
    }
    const peekRec = await this.readOrCreate(buyerKey);
    const peek = this.hydrate(peekRec);
    const peekBuilding = peek.buildings.find((b) => b.id === buildingId);
    const license = (peek.licenses ?? []).find(
      (l) => l.typeId === peekBuilding?.typeId,
    );
    const keys = license ? [buyerKey, license.owner] : [buyerKey];
    return this.withLocks(keys, async () => {
      const buyerRec = await this.readOrCreate(buyerKey);
      const buyer = this.hydrate(buyerRec);
      this.catchUpAndMigrate(buyer, buyerRec);
      const building = buyer.buildings.find((b) => b.id === buildingId);
      if (!building) {
        return {
          ok: false as const,
          reason: 'not found',
          game: serializeGame(buyer),
        };
      }
      if (isOriginCustom(buyer, building)) {
        const result = trainAtOrigin(buyer, buildingId);
        await this.write(buyerKey, buyerRec, buyer);
        return result.ok
          ? { ok: true as const, game: serializeGame(buyer) }
          : { ok: false as const, reason: result.reason, game: serializeGame(buyer) };
      }
      const lic = (buyer.licenses ?? []).find((l) => l.typeId === building.typeId);
      if (!lic) {
        return {
          ok: false as const,
          reason: 'abandoned',
          game: serializeGame(buyer),
        };
      }
      const sellerKey = lic.owner;
      const sellerRec = await this.readOrCreate(sellerKey);
      const seller = this.hydrate(sellerRec);
      this.catchUpAndMigrate(seller, sellerRec);
      await this.write(sellerKey, sellerRec, seller);
      const originRec = (seller.customBuildings ?? []).find(
        (c) => c.id === lic.slot,
      );
      if (!originRec) {
        return {
          ok: false as const,
          reason: 'abandoned',
          game: serializeGame(buyer),
        };
      }
      const coinCost = originRec.exportPrice * TRAIN_UNIQUE_COST;
      if (
        buyer.inventory.amounts.food < TRAIN_FOOD_COST ||
        buyer.inventory.amounts.coin < coinCost
      ) {
        return {
          ok: false as const,
          reason: 'cannot afford',
          game: serializeGame(buyer),
        };
      }
      const spent = spendSellerForReplica(seller, lic.slot, TRAIN_UNIQUE_COST);
      if (!spent.ok) {
        return {
          ok: false as const,
          reason: spent.reason,
          game: serializeGame(buyer),
        };
      }
      trySpend(buyer.inventory, { food: TRAIN_FOOD_COST, coin: coinCost });
      seller.inventory.amounts.coin += coinCost;
      addArmy(buyer, lic.unitId, 1);
      await this.write(sellerKey, sellerRec, seller);
      await this.write(buyerKey, buyerRec, buyer);
      return { ok: true as const, game: serializeGame(buyer) };
    });
  }
}
