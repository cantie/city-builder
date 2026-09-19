import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch } from '@/core/research';
import { advanceTick } from '@/core/tick';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

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

describe('advanceTick', () => {
  it('runs farms then research and increments tick', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state: GameState = {
      tick: 0,
      grid: new Grid(),
      buildings: [],
      inventory: createInventory(50, { food: 0, wood: 5, stone: 0, coin: 0 }),
      unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
      unlockedRecipes: ['basic_food'],
      completedResearch: [],
      availableResearch: ['r1'],
      activeResearch: null,
    };
    placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'f1');
    placeBuilding(state, registry, 'research_institute', { x: 2, y: 0 }, () => 'ri-1');
    startResearch(state, registry, 'r1');
    advanceTick(state, registry);
    // Manual harvest: tick accumulates pending, not inventory food
    expect(state.inventory.amounts.food).toBe(0);
    const farm = state.buildings.find((b) => b.id === 'f1')!;
    expect(farm.pending).toEqual({ food: 1 });
    expect(state.activeResearch?.remainingTicks).toBe(1);
    expect(state.tick).toBe(1);
    advanceTick(state, registry);
    expect(farm.pending).toEqual({ food: 2 });
    expect(state.inventory.amounts.food).toBe(0);
    expect(state.activeResearch).toBeNull();
    expect(state.completedResearch).toContain('r1');
    expect(state.tick).toBe(2);
  });
});
