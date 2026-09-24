import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContentFromData } from '@/core/loadContent';
import buildings from '@/data/buildings.json';
import recipes from '@/data/recipes.json';
import research from '@/data/research.json';
import upgradesJson from '@/data/upgrades.json';
import type { UpgradesConfig } from '@/core/upgrades';
import { MAX_CATCH_UP_TICKS, TICK_INTERVAL_MS } from '@/core/catchUp';
import { PlayerStore } from '../../server/playerStore';

const registry = loadContentFromData(buildings, recipes, research);
const upgrades = upgradesJson as UpgradesConfig;

describe('PlayerStore', () => {
  it('creates a named save and persists a placed farm', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-save-'));
    try {
      const store = new PlayerStore(dir, registry, upgrades, () => 1_000);
      const login = await store.login('Ada');
      expect(login.ok).toBe(true);
      expect(login.game.buildings.some((b) => b.typeId === 'main_house')).toBe(
        true,
      );
      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'farm',
        x: 0,
        y: 0,
      });
      expect(placed.ok).toBe(true);
      if (placed.ok) {
        expect(placed.game.buildings.some((b) => b.typeId === 'farm')).toBe(
          true,
        );
      }
      const again = new PlayerStore(dir, registry, upgrades, () => 1_000);
      const loaded = await again.login('ada');
      expect(loaded.game.buildings.some((b) => b.typeId === 'farm')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('catches up ticks from lastTickAt on login', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-tick-'));
    try {
      let now = 5_000;
      const store = new PlayerStore(dir, registry, upgrades, () => now);
      await store.login('bob');
      now = 5_000 + TICK_INTERVAL_MS * 3;
      const snap = await store.snapshot('bob');
      expect(snap.game.tick).toBe(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not exceed MAX_CATCH_UP_TICKS', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-cap-'));
    try {
      let now = 0;
      const store = new PlayerStore(dir, registry, upgrades, () => now);
      await store.login('cap');
      now = TICK_INTERVAL_MS * (MAX_CATCH_UP_TICKS + 80);
      const snap = await store.snapshot('cap');
      expect(snap.game.tick).toBe(MAX_CATCH_UP_TICKS);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  it('invents a custom building after image gen and does not spend if generate fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-invent-'));
    try {
      let calls = 0;
      const store = new PlayerStore(
        dir,
        registry,
        upgrades,
        () => 1_000,
        async () => {
          calls += 1;
          if (calls === 1) throw new Error('image generation failed');
          return TINY_PNG;
        },
        async () => ({
          building: 'Crystal Bakery',
          resource: 'Crystal Ore',
          unit: 'Crystal Troop',
        }),
      );
      await store.login('Ada');
      await store.apply('Ada', {
        op: 'place',
        typeId: 'research_institute',
        x: 0,
        y: 0,
      });
      const woodBefore = (await store.snapshot('Ada')).game.inventory.amounts.wood;
      const failed = await store.invent('Ada', 'crystal bakery', 2, 2);
      expect(failed.ok).toBe(false);
      expect((await store.snapshot('Ada')).game.inventory.amounts.wood).toBe(
        woodBefore,
      );

      const ok = await store.invent('Ada', 'crystal bakery', 2, 2);
      expect(ok.ok).toBe(true);
      expect(ok.game.customBuildings?.some((b) => b.id === 'custom-1')).toBe(
        true,
      );
      const rec = ok.game.customBuildings!.find((b) => b.id === 'custom-1')!;
      expect(rec.label).toBe('Crystal Bakery');
      expect(rec.resourceLabel).toBe('Crystal Ore');
      expect(rec.unitLabel).toBe('Crystal Troop');
      expect(ok.game.unlockedBlueprints).toContain('custom-1');
      const png = await store.readSprite('Ada', 'custom-1');
      expect(png?.equals(TINY_PNG)).toBe(true);

      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'custom-1',
        x: 10,
        y: 10,
      });
      expect(placed.ok).toBe(true);

      const forgotten = await store.apply('Ada', {
        op: 'forget-building',
        typeId: 'custom-1',
      });
      expect(forgotten.ok).toBe(true);
      expect(forgotten.game.customBuildings ?? []).toHaveLength(0);
      expect(
        forgotten.game.buildings.some((b) => b.typeId === 'custom-1'),
      ).toBe(false);
      expect(await store.readSprite('Ada', 'custom-1')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invents a trio then harvests and trains on the origin after catch-up', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-train-'));
    try {
      let now = 1_000;
      const store = new PlayerStore(
        dir,
        registry,
        upgrades,
        () => now,
        async () => TINY_PNG,
        async () => ({
          building: 'Crystal Bakery',
          resource: 'Crystal Ore',
          unit: 'Crystal Troop',
        }),
      );
      await store.login('Ada');
      await store.apply('Ada', {
        op: 'place',
        typeId: 'research_institute',
        x: 0,
        y: 0,
      });
      const invented = await store.invent('Ada', 'crystal bakery', 3, 3);
      expect(invented.ok).toBe(true);
      const rec = invented.game.customBuildings!.find((b) => b.id === 'custom-1')!;
      expect(rec.unitLabel).toBe('Crystal Troop');
      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'custom-1',
        x: 10,
        y: 10,
      });
      expect(placed.ok).toBe(true);
      const origin = placed.game.buildings.find((b) => b.typeId === 'custom-1')!;
      now = 1_000 + TICK_INTERVAL_MS * 5;
      const snap = await store.snapshot('Ada');
      expect(
        snap.game.buildings.find((b) => b.id === origin.id)?.uniquePending,
      ).toBe(5);
      const harvested = await store.apply('Ada', {
        op: 'harvest',
        buildingId: origin.id,
      });
      expect(harvested.ok).toBe(true);
      expect(
        harvested.game.buildings.find((b) => b.id === origin.id)?.exportStock,
      ).toBe(5);
      const trained = await store.apply('Ada', {
        op: 'train',
        buildingId: origin.id,
      });
      expect(trained.ok).toBe(true);
      expect(trained.game.army?.[rec.unitId]).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lists a blueprint so another player can buy and place a replica', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-market-'));
    try {
      const store = new PlayerStore(
        dir,
        registry,
        upgrades,
        () => 1_000,
        async () => TINY_PNG,
        async () => ({
          building: 'Crystal Bakery',
          resource: 'Crystal Ore',
          unit: 'Crystal Troop',
        }),
      );
      await store.login('Ada');
      await store.apply('Ada', {
        op: 'place',
        typeId: 'research_institute',
        x: 0,
        y: 0,
      });
      await store.invent('Ada', 'crystal bakery', 3, 3);
      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'custom-1',
        x: 10,
        y: 10,
      });
      expect(placed.ok).toBe(true);
      const listed = await store.listOnMarket('Ada', 'custom-1', 20);
      expect(listed.ok).toBe(true);

      await store.login('Bob');
      const catalog = await store.catalog();
      expect(catalog.some((l) => l.typeId === 'custom-ada-1')).toBe(true);

      const bobPath = join(dir, 'bob.json');
      const { readFile, writeFile } = await import('node:fs/promises');
      const rec = JSON.parse(await readFile(bobPath, 'utf8')) as {
        game: { inventory: { amounts: { coin: number } } };
      };
      rec.game.inventory.amounts.coin = 20;
      await writeFile(bobPath, JSON.stringify(rec));

      const bought = await store.buyListing('Bob', 'custom-ada-1');
      expect(bought.ok).toBe(true);
      expect(bought.game.licenses?.some((l) => l.typeId === 'custom-ada-1')).toBe(
        true,
      );
      expect(bought.game.customBuildings ?? []).toHaveLength(0);
      expect(bought.game.unlockedBlueprints).toContain('custom-ada-1');

      const replica = await store.apply('Bob', {
        op: 'place',
        typeId: 'custom-ada-1',
        x: 10,
        y: 10,
      });
      expect(replica.ok).toBe(true);
      expect(
        replica.game.buildings.some((b) => b.typeId === 'custom-ada-1'),
      ).toBe(true);
      const ada = await store.snapshot('Ada');
      expect(ada.game.buildings.some((b) => b.typeId === 'custom-1')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('replica train pays seller and deducts unique stock', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-replica-'));
    try {
      let now = 1_000;
      const store = new PlayerStore(
        dir,
        registry,
        upgrades,
        () => now,
        async () => TINY_PNG,
        async () => ({
          building: 'Crystal Bakery',
          resource: 'Crystal Ore',
          unit: 'Crystal Troop',
        }),
      );
      await store.login('Ada');
      await store.apply('Ada', {
        op: 'place',
        typeId: 'research_institute',
        x: 0,
        y: 0,
      });
      const invented = await store.invent('Ada', 'crystal bakery', 3, 3);
      const rec = invented.game.customBuildings!.find((b) => b.id === 'custom-1')!;
      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'custom-1',
        x: 10,
        y: 10,
      });
      const origin = placed.game.buildings.find((b) => b.typeId === 'custom-1')!;
      await store.listOnMarket('Ada', 'custom-1', 20);
      now = 1_000 + TICK_INTERVAL_MS * 5;
      await store.snapshot('Ada');
      await store.apply('Ada', { op: 'harvest', buildingId: origin.id });

      await store.login('Bob');
      const { readFile, writeFile } = await import('node:fs/promises');
      const bobPath = join(dir, 'bob.json');
      const bobRec = JSON.parse(await readFile(bobPath, 'utf8')) as {
        game: { inventory: { amounts: { coin: number; food: number } } };
      };
      bobRec.game.inventory.amounts.coin = 40;
      bobRec.game.inventory.amounts.food = 20;
      await writeFile(bobPath, JSON.stringify(bobRec));
      await store.buyListing('Bob', 'custom-ada-1');
      const replica = await store.apply('Bob', {
        op: 'place',
        typeId: 'custom-ada-1',
        x: 10,
        y: 10,
      });
      expect(replica.ok).toBe(true);
      const replicaId = replica.game.buildings.find(
        (b) => b.typeId === 'custom-ada-1',
      )!.id;
      const trained = await store.apply('Bob', {
        op: 'train',
        buildingId: replicaId,
      });
      expect(trained.ok).toBe(true);
      expect(trained.game.army?.[rec.unitId]).toBe(1);
      const ada = await store.snapshot('Ada');
      expect(ada.game.inventory.amounts.coin).toBeGreaterThan(0);
      expect(
        ada.game.buildings.find((b) => b.id === origin.id)?.exportStock,
      ).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('replica train fails when export disabled or no stock', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-export-off-'));
    try {
      let now = 1_000;
      const store = new PlayerStore(
        dir,
        registry,
        upgrades,
        () => now,
        async () => TINY_PNG,
        async () => ({
          building: 'Crystal Bakery',
          resource: 'Crystal Ore',
          unit: 'Crystal Troop',
        }),
      );
      await store.login('Ada');
      await store.apply('Ada', {
        op: 'place',
        typeId: 'research_institute',
        x: 0,
        y: 0,
      });
      await store.invent('Ada', 'crystal bakery', 3, 3);
      const placed = await store.apply('Ada', {
        op: 'place',
        typeId: 'custom-1',
        x: 10,
        y: 10,
      });
      const origin = placed.game.buildings.find((b) => b.typeId === 'custom-1')!;
      await store.listOnMarket('Ada', 'custom-1', 20);
      now = 1_000 + TICK_INTERVAL_MS * 5;
      await store.snapshot('Ada');
      await store.apply('Ada', { op: 'harvest', buildingId: origin.id });
      await store.setExport('Ada', 'custom-1', false);

      await store.login('Bob');
      const { readFile, writeFile } = await import('node:fs/promises');
      const bobPath = join(dir, 'bob.json');
      const bobRec = JSON.parse(await readFile(bobPath, 'utf8')) as {
        game: { inventory: { amounts: { coin: number; food: number } } };
      };
      bobRec.game.inventory.amounts.coin = 40;
      bobRec.game.inventory.amounts.food = 20;
      await writeFile(bobPath, JSON.stringify(bobRec));
      await store.buyListing('Bob', 'custom-ada-1');
      const replica = await store.apply('Bob', {
        op: 'place',
        typeId: 'custom-ada-1',
        x: 10,
        y: 10,
      });
      const replicaId = replica.game.buildings.find(
        (b) => b.typeId === 'custom-ada-1',
      )!.id;
      const r = await store.apply('Bob', { op: 'train', buildingId: replicaId });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('export disabled');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
