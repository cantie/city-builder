import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { produceFarms } from '@/core/farm';
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
  it('adds recipe outputs each call', () => {
    const { state, registry } = stateWithFarm();
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(2);
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(4);
  });

  it('skips production when inventory cannot accept output', () => {
    const { state, registry } = stateWithFarm(3);
    state.inventory.amounts.food = 2;
    state.inventory.amounts.wood = 1;
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(2);
  });

  it('advanceTick increments tick and produces', () => {
    const { state, registry } = stateWithFarm();
    advanceTick(state, registry);
    expect(state.tick).toBe(1);
    expect(state.inventory.amounts.food).toBe(2);
  });
});
