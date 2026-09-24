import { describe, it, expect } from 'vitest';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { applyInventedBuilding } from '@/core/customBuilding';
import {
  produceCustomOrigins,
  harvestUnique,
  trainAtOrigin,
} from '@/core/customEconomy';
import { harvestBuilding } from '@/core/farm';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import type { BuildingDef, GameState } from '@/core/types';

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
];

function originState(): GameState {
  const registry = createRegistry(buildings, [], []);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(200, { food: 0, wood: 30, stone: 20, coin: 0 }),
    unlockedBlueprints: ['main_house'],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
    customBuildings: [],
    army: {},
    licenses: [],
  };
  applyInventedBuilding(state, registry, {
    id: 'custom-1',
    prompt: 'crystal bakery',
    footprint: { width: 3, height: 3 },
    sprite: '/api/sprites/custom-1',
    owner: 'ada',
  });
  placeBuilding(state, registry, 'custom-1', { x: 0, y: 0 }, () => 'c-1');
  return state;
}

describe('produceCustomOrigins', () => {
  it('origins gain 1 unique pending per tick up to 50, not city inventory', () => {
    const state = originState();
    const startFood = state.inventory.amounts.food;
    produceCustomOrigins(state);
    const b = state.buildings.find((x) => x.typeId === 'custom-1')!;
    expect(b.uniquePending).toBe(1);
    expect(state.inventory.amounts.food).toBe(startFood);
    for (let i = 0; i < 60; i++) produceCustomOrigins(state);
    expect(b.uniquePending).toBe(50);
    expect(state.inventory.amounts.food).toBe(startFood);
    expect(state.inventory.amounts.wood).toBe(24);
  });
});

describe('harvestUnique', () => {
  it('harvestUnique moves pending into exportStock and never warehouse', () => {
    const state = originState();
    const b = state.buildings.find((x) => x.typeId === 'custom-1')!;
    const startFood = state.inventory.amounts.food;
    b.uniquePending = 8;
    expect(harvestUnique(state, b.id).ok).toBe(true);
    expect(b.uniquePending).toBe(0);
    expect(b.exportStock).toBe(8);
    expect(state.inventory.amounts.food).toBe(startFood);
  });

  it('harvestBuilding on an origin uses unique harvest', () => {
    const state = originState();
    const b = state.buildings.find((x) => x.typeId === 'custom-1')!;
    b.uniquePending = 3;
    expect(harvestBuilding(state, b.id).ok).toBe(true);
    expect(b.exportStock).toBe(3);
    expect(state.inventory.amounts.food).toBe(0);
  });
});
