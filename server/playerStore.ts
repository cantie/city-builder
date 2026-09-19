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
  INVENT_COST,
  applyInventedBuilding,
  composeInventPrompt,
  forgetCustomBuilding,
  nextCustomBuildingId,
  validateInventInput,
  withCustomBuildings,
} from '../src/core/customBuilding';
import { harvestBuilding } from '../src/core/farm';
import { trySpend } from '../src/core/inventory';
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
import type { BuildingTypeId, GameState } from '../src/core/types';
import {
  generateImagePixflux,
  type GenerateImage,
} from './pixellab';

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
  | { op: 'forget-building'; typeId: BuildingTypeId };

export class PlayerStore {
  private locks = new Map<string, Promise<void>>();

  constructor(
    private dir: string,
    private registry: ContentRegistry,
    private upgrades: UpgradesConfig,
    private now: () => number = () => Date.now(),
    private generateImage: GenerateImage = generateImagePixflux,
  ) {}

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
      return { ok: true as const, game: serializeGame(state) };
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
        return { ok: false as const, reason: parsed.reason, game: serializeGame(state) };
      }
      if (!hasResearchInstitute(state)) {
        return {
          ok: false as const,
          reason: 'need research institute',
          game: serializeGame(state),
        };
      }
      const id = nextCustomBuildingId(state.customBuildings ?? []);
      if (!id) {
        return {
          ok: false as const,
          reason: 'custom building limit',
          game: serializeGame(state),
        };
      }
      for (const resId of Object.keys(INVENT_COST) as (keyof typeof INVENT_COST)[]) {
        if (state.inventory.amounts[resId] < (INVENT_COST[resId] ?? 0)) {
          return {
            ok: false as const,
            reason: 'cannot afford',
            game: serializeGame(state),
          };
        }
      }
      let png: Buffer;
      try {
        png = await this.generateImage(
          composeInventPrompt(parsed.prompt, parsed.footprint),
        );
      } catch (err) {
        const reason =
          err instanceof Error && err.message === 'missing pixellab key'
            ? 'missing pixellab key'
            : 'pixellab failed';
        return { ok: false as const, reason, game: serializeGame(state) };
      }
      if (!trySpend(state.inventory, INVENT_COST)) {
        return {
          ok: false as const,
          reason: 'cannot afford',
          game: serializeGame(state),
        };
      }
      const live = withCustomBuildings(this.registry, state.customBuildings);
      applyInventedBuilding(state, live, {
        id,
        prompt: parsed.prompt,
        footprint: parsed.footprint,
        sprite: `/api/sprites/${id}`,
      });
      await this.writeSprite(key, id, png);
      await this.write(key, rec, state);
      return { ok: true as const, game: serializeGame(state) };
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
    return this.withLock(key, async () => {
      const rec = await this.readOrCreate(key);
      const state = this.hydrate(rec);
      this.catchUpAndMigrate(state, rec);
      const result = this.runAction(state, action);
      if (action.op === 'forget-building' && result.ok) {
        await this.deleteSprite(key, action.typeId);
      }
      await this.write(key, rec, state);
      if (!result.ok) {
        return { ok: false, reason: result.reason, game: serializeGame(state) };
      }
      return { ok: true, game: serializeGame(state) };
    });
  }

  private liveRegistry(state: GameState): ContentRegistry {
    return withCustomBuildings(this.registry, state.customBuildings);
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
    const state = deserializeGame(rec.game, this.registry, this.upgrades);
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
        game: serializeGame(state),
      };
    }
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
}
