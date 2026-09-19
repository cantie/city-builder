import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import {
  createRegistry,
  placeBuilding,
  demolishBuilding,
} from '@/core/buildings';
import { produceFarms, harvestBuilding } from '@/core/farm';
import { upgradeBuilding } from '@/core/upgrades';
import {
  computeWarehouseSoftCap,
  refreshInventorySoftCap,
} from '@/core/warehouse';
import type { BuildingDef, GameState, RecipeDef } from '@/core/types';
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
    id: 'warehouse',
    label: 'Warehouse',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
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
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 2 } },
];

function fresh(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, []);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(0, { food: 0, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: [
      'main_house',
      'farm',
      'warehouse',
      'research_institute',
    ],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [],
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
  return { state, registry };
}

describe('warehouse softCap', () => {
  it('softCap is 0 with no warehouses', () => {
    const { state } = fresh();
    expect(computeWarehouseSoftCap(state.buildings, upgrades)).toBe(0);
    expect(state.inventory.softCap).toBe(0);
  });

  it('softCap equals sum of warehouse capacities on place', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 0, y: 0 },
      () => 'wh-1',
      upgrades,
    );
    expect(state.inventory.softCap).toBe(100);
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 1, y: 0 },
      () => 'wh-2',
      upgrades,
    );
    expect(state.inventory.softCap).toBe(200);
  });

  it('softCap drops when warehouse demolished', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 0, y: 0 },
      () => 'wh-1',
      upgrades,
    );
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 1, y: 0 },
      () => 'wh-2',
      upgrades,
    );
    demolishBuilding(state, registry, 'wh-1', upgrades);
    expect(state.inventory.softCap).toBe(100);
  });
});

describe('upgradeBuilding', () => {
  it('blocks upgrade above main house level', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'farm',
      { x: 0, y: 0 },
      () => 'farm-1',
      upgrades,
    );
    // main is level 1; farm cannot go to 2
    const result = upgradeBuilding(state, registry, 'farm-1', upgrades);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/main house/i);
  });

  it('spends inventory and increases level/capacity for warehouse', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 0, y: 0 },
      () => 'wh-1',
      upgrades,
    );
    // Upgrade main house first so warehouse can go to 2
    state.inventory.amounts.wood = 100;
    state.inventory.amounts.stone = 100;
    const mainUp = upgradeBuilding(state, registry, 'main-1', upgrades);
    expect(mainUp.ok).toBe(true);
    expect(state.buildings.find((b) => b.id === 'main-1')!.level).toBe(2);

    const beforeWood = state.inventory.amounts.wood;
    const beforeStone = state.inventory.amounts.stone;
    const result = upgradeBuilding(state, registry, 'wh-1', upgrades);
    expect(result.ok).toBe(true);
    const wh = state.buildings.find((b) => b.id === 'wh-1')!;
    expect(wh.level).toBe(2);
    expect(wh.capacity).toBe(150);
    expect(state.inventory.softCap).toBe(150);
    expect(state.inventory.amounts.wood).toBe(beforeWood - 15);
    expect(state.inventory.amounts.stone).toBe(beforeStone - 15);
  });

  it('main house can always upgrade when config has next level', () => {
    const { state, registry } = fresh();
    state.inventory.amounts.wood = 100;
    state.inventory.amounts.stone = 100;
    const r = upgradeBuilding(state, registry, 'main-1', upgrades);
    expect(r.ok).toBe(true);
    expect(state.buildings.find((b) => b.id === 'main-1')!.level).toBe(2);
  });
});

describe('harvest with warehouse cap', () => {
  it('harvest fails clearly with no warehouse', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'farm',
      { x: 0, y: 0 },
      () => 'farm-1',
      upgrades,
    );
    produceFarms(state, registry);
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no warehouse');
  });

  it('harvest works when warehouse provides capacity', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 0, y: 0 },
      () => 'wh-1',
      upgrades,
    );
    placeBuilding(
      state,
      registry,
      'farm',
      { x: 1, y: 0 },
      () => 'farm-1',
      upgrades,
    );
    produceFarms(state, registry);
    produceFarms(state, registry);
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(true);
    expect(state.inventory.amounts.food).toBe(4);
  });

  it('refreshInventorySoftCap recomputes from buildings', () => {
    const { state, registry } = fresh();
    placeBuilding(
      state,
      registry,
      'warehouse',
      { x: 0, y: 0 },
      () => 'wh-1',
      upgrades,
    );
    state.inventory.softCap = 999;
    refreshInventorySoftCap(state, upgrades);
    expect(state.inventory.softCap).toBe(100);
  });
});
