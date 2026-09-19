import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { produceFarms, harvestBuilding, PENDING_SOFT_CAP } from '@/core/farm';
import { advanceTick } from '@/core/tick';
import type { BuildingDef, GameState, RecipeDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 0, food: 0 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 2 } },
];

function stateWithFarm(softCap = 100): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, []);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(softCap, { food: 0, wood: 10, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
  placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
  return { state, registry };
}

describe('produceFarms', () => {
  it('accumulates recipe outputs into pending, not inventory', () => {
    const { state, registry } = stateWithFarm();
    const farm = state.buildings.find((b) => b.id === 'farm-1')!;
    expect(farm.pending).toEqual({});
    produceFarms(state, registry);
    expect(farm.pending).toEqual({ food: 2 });
    expect(state.inventory.amounts.food).toBe(0);
    produceFarms(state, registry);
    expect(farm.pending).toEqual({ food: 4 });
    expect(state.inventory.amounts.food).toBe(0);
  });

  it('skips production when pending soft-cap would be exceeded', () => {
    const { state, registry } = stateWithFarm();
    const farm = state.buildings.find((b) => b.id === 'farm-1')!;
    farm.pending = { food: PENDING_SOFT_CAP - 1 };
    produceFarms(state, registry);
    // +2 would exceed 50, so skip
    expect(farm.pending).toEqual({ food: PENDING_SOFT_CAP - 1 });
  });

  it('advanceTick increments tick and accumulates pending', () => {
    const { state, registry } = stateWithFarm();
    advanceTick(state, registry);
    expect(state.tick).toBe(1);
    expect(state.inventory.amounts.food).toBe(0);
    const farm = state.buildings.find((b) => b.id === 'farm-1')!;
    expect(farm.pending).toEqual({ food: 2 });
  });
});

describe('harvestBuilding', () => {
  it('moves pending into inventory and clears pending', () => {
    const { state, registry } = stateWithFarm();
    produceFarms(state, registry);
    produceFarms(state, registry);
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(true);
    expect(state.inventory.amounts.food).toBe(4);
    const farm = state.buildings.find((b) => b.id === 'farm-1')!;
    expect(farm.pending).toEqual({});
  });

  it('fails with inventory full and leaves pending unchanged', () => {
    const { state, registry } = stateWithFarm(3);
    state.inventory.amounts.food = 2;
    state.inventory.amounts.wood = 1;
    produceFarms(state, registry); // pending food: 2
    const farm = state.buildings.find((b) => b.id === 'farm-1')!;
    expect(farm.pending).toEqual({ food: 2 });
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inventory full');
    expect(farm.pending).toEqual({ food: 2 });
    expect(state.inventory.amounts.food).toBe(2);
  });

  it('fails when nothing to harvest', () => {
    const { state } = stateWithFarm();
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nothing to harvest');
  });

  it('fails when building not found', () => {
    const { state } = stateWithFarm();
    const result = harvestBuilding(state, 'missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not found');
  });

  it('fails with no warehouse when softCap is 0', () => {
    const { state, registry } = stateWithFarm(0);
    produceFarms(state, registry);
    const result = harvestBuilding(state, 'farm-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no warehouse');
  });
});
