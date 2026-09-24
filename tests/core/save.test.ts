import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch } from '@/core/research';
import { advanceTick } from '@/core/tick';
import {
  MemoryStorage,
  serializeGame,
  deserializeGame,
  saveGame,
  loadGame,
  SAVE_KEY,
} from '@/core/save';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';
import upgradesJson from '@/data/upgrades.json';
import type { UpgradesConfig } from '@/core/upgrades';

const upgrades = upgradesJson as UpgradesConfig;

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 0 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

function sampleState(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, researchDefs);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(0, { food: 3, wood: 4, stone: 1, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'warehouse', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['r1'],
    activeResearch: null,
  };
  placeBuilding(
    state,
    registry,
    'main_house',
    { x: 9, y: 9 },
    () => 'main-1',
    upgrades,
  );
  placeBuilding(
    state,
    registry,
    'warehouse',
    { x: 8, y: 9 },
    () => 'warehouse-1',
    upgrades,
  );
  placeBuilding(
    state,
    registry,
    'farm',
    { x: 1, y: 1 },
    () => 'farm-1',
    upgrades,
  );
  placeBuilding(
    state,
    registry,
    'research_institute',
    { x: 0, y: 0 },
    () => 'ri-1',
    upgrades,
  );
  startResearch(state, registry, 'r1');
  advanceTick(state, registry);
  return { state, registry };
}

describe('save/load', () => {
  it('round-trips serialize/deserialize including level and softCap', () => {
    const { state, registry } = sampleState();
    const raw = serializeGame(state);
    const loaded = deserializeGame(raw, registry, upgrades);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(state.tick);
    expect(loaded!.buildings).toEqual(state.buildings);
    expect(loaded!.inventory.softCap).toBe(100);
    expect(loaded!.inventory.amounts).toEqual(state.inventory.amounts);
    expect(loaded!.activeResearch).toEqual(state.activeResearch);
    expect(loaded!.grid.getOccupant({ x: 9, y: 9 })).toBe('main-1');
    expect(loaded!.grid.getOccupant({ x: 1, y: 1 })).toBe('farm-1');
    expect(loaded!.buildings.find((b) => b.id === 'farm-1')!.level).toBe(1);
    expect(loaded!.buildings.find((b) => b.id === 'warehouse-1')!.capacity).toBe(
      100,
    );
  });

  it('MemoryStorage saveGame/loadGame round-trip', () => {
    const { state, registry } = sampleState();
    const storage = new MemoryStorage();
    saveGame(state, storage);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = loadGame(storage, registry, upgrades);
    expect(loaded?.buildings.map((b) => b.id).sort()).toEqual(
      state.buildings.map((b) => b.id).sort(),
    );
  });

  it('defaults missing pending to {} and level to 1 for old saves', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const raw = {
      version: 1 as const,
      tick: 0,
      buildings: [
        {
          id: 'farm-1',
          typeId: 'farm' as const,
          origin: { x: 0, y: 0 },
          recipeId: 'basic_food',
          // no pending / level — old save
        },
      ],
      inventory: createInventory(40, { food: 0, wood: 0, stone: 0, coin: 0 }),
      unlockedBlueprints: ['farm' as const],
      unlockedRecipes: ['basic_food'],
      completedResearch: [],
      availableResearch: [],
      activeResearch: null,
    };
    const loaded = deserializeGame(raw, registry, upgrades);
    expect(loaded).not.toBeNull();
    expect(loaded!.buildings[0].pending).toEqual({});
    expect(loaded!.buildings[0].level).toBe(1);
    expect(loaded!.inventory.softCap).toBe(0);
  });

  it('relocates a 2x2-era warehouse that no longer fits 3x3 at its origin', () => {
    const registry = createRegistry(
      buildings.map((b) =>
        b.id === 'warehouse'
          ? { ...b, footprint: { width: 3, height: 3 } }
          : b,
      ),
      recipes,
      researchDefs,
    );
    const raw = {
      version: 1 as const,
      tick: 4,
      buildings: [
        {
          id: 'main-1',
          typeId: 'main_house' as const,
          origin: { x: 9, y: 9 },
          level: 1,
        },
        {
          id: 'warehouse-1',
          typeId: 'warehouse' as const,
          origin: { x: 8, y: 9 },
          level: 1,
          capacity: 100,
        },
      ],
      inventory: createInventory(100, { food: 3, wood: 4, stone: 1, coin: 0 }),
      unlockedBlueprints: ['main_house' as const, 'warehouse' as const],
      unlockedRecipes: ['basic_food'],
      completedResearch: [],
      availableResearch: [],
      activeResearch: null,
    };
    const loaded = deserializeGame(raw, registry, upgrades);
    expect(loaded).not.toBeNull();
    const wh = loaded!.buildings.find((b) => b.id === 'warehouse-1')!;
    expect(wh.origin).not.toEqual({ x: 8, y: 9 });
    expect(loaded!.grid.getOccupant(wh.origin)).toBe('warehouse-1');
    expect(loaded!.grid.getOccupant({ x: 9, y: 9 })).toBe('main-1');
  });

  it('migrates saved 2x2 custom buildings to 3x3', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const loaded = deserializeGame(
      {
        version: 1 as const,
        tick: 0,
        buildings: [
          {
            id: 'c-1',
            typeId: 'custom-1' as const,
            origin: { x: 0, y: 0 },
            level: 1,
          },
        ],
        inventory: createInventory(40, { food: 0, wood: 0, stone: 0, coin: 0 }),
        unlockedBlueprints: ['custom-1' as const],
        unlockedRecipes: [],
        completedResearch: [],
        availableResearch: [],
        activeResearch: null,
        customBuildings: [
          {
            id: 'custom-1' as const,
            label: 'Hut',
            prompt: 'a cozy hut',
            footprint: { width: 2, height: 2 },
            sprite: '/api/sprites/custom-1',
          },
        ],
      },
      registry,
      upgrades,
    );
    expect(loaded).not.toBeNull();
    expect(loaded!.customBuildings?.[0]?.footprint).toEqual({
      width: 3,
      height: 3,
    });
    expect(loaded!.grid.getOccupant({ x: 0, y: 0 })).toBe('c-1');
    expect(loaded!.grid.getOccupant({ x: 2, y: 2 })).toBe('c-1');
  });

  it('round-trips army, licenses, and unique stock', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const loaded = deserializeGame(
      {
        version: 1 as const,
        tick: 1,
        buildings: [
          {
            id: 'c-1',
            typeId: 'custom-1' as const,
            origin: { x: 0, y: 0 },
            level: 1,
            uniquePending: 2,
            exportStock: 4,
          },
        ],
        inventory: createInventory(40, { food: 0, wood: 0, stone: 0, coin: 0 }),
        unlockedBlueprints: ['custom-1' as const],
        unlockedRecipes: [],
        completedResearch: [],
        availableResearch: [],
        activeResearch: null,
        army: { 'unit-ada-1': 3 },
        licenses: [],
        customBuildings: [
          {
            id: 'custom-1' as const,
            label: 'Hut',
            prompt: 'a cozy hut',
            footprint: { width: 3, height: 3 },
            sprite: '/api/sprites/custom-1',
            resourceId: 'res-ada-1',
            resourceLabel: 'Hut Ore',
            unitId: 'unit-ada-1',
            unitLabel: 'Hut Troop',
            exportPrice: 2,
            exportEnabled: true,
          },
        ],
      },
      registry,
      upgrades,
    );
    expect(loaded).not.toBeNull();
    expect(loaded!.army).toEqual({ 'unit-ada-1': 3 });
    expect(loaded!.licenses).toEqual([]);
    expect(loaded!.buildings[0]?.uniquePending).toBe(2);
    expect(loaded!.buildings[0]?.exportStock).toBe(4);
    const again = deserializeGame(serializeGame(loaded!), registry, upgrades);
    expect(again!.army).toEqual({ 'unit-ada-1': 3 });
    expect(again!.buildings[0]?.exportStock).toBe(4);
  });

  it('repairs duplicate building ids so grid selection hits the right instance', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const loaded = deserializeGame(
      {
        version: 1 as const,
        tick: 0,
        buildings: [
          {
            id: 'b-1',
            typeId: 'farm' as const,
            origin: { x: 0, y: 0 },
            level: 1,
            recipeId: 'basic_food',
          },
          {
            id: 'b-1',
            typeId: 'research_institute' as const,
            origin: { x: 3, y: 3 },
            level: 1,
          },
        ],
        inventory: createInventory(40, { food: 0, wood: 0, stone: 0, coin: 0 }),
        unlockedBlueprints: ['farm' as const, 'research_institute' as const],
        unlockedRecipes: ['basic_food'],
        completedResearch: [],
        availableResearch: [],
        activeResearch: null,
      },
      registry,
      upgrades,
    );
    expect(loaded).not.toBeNull();
    const ids = loaded!.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(2);
    const farm = loaded!.buildings.find((b) => b.typeId === 'farm')!;
    const ri = loaded!.buildings.find((b) => b.typeId === 'research_institute')!;
    expect(loaded!.grid.getOccupant({ x: 0, y: 0 })).toBe(farm.id);
    expect(loaded!.grid.getOccupant({ x: 3, y: 3 })).toBe(ri.id);
    expect(loaded!.buildings.find((b) => b.id === farm.id)?.typeId).toBe('farm');
  });

  it('corrupt payload returns null', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    expect(deserializeGame(null, registry)).toBeNull();
    expect(deserializeGame({ version: 99 }, registry)).toBeNull();
    expect(deserializeGame('{not-json', registry)).toBeNull();
  });
});
