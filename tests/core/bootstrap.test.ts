import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import type { BuildingDef, RecipeDef, ResearchDef } from '@/core/types';

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
    cost: { wood: 5, food: 2 },
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: [],
  },
];

describe('createNewGame', () => {
  it('pre-spawns non-demolishable main house and starting kit', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state = createNewGame(registry);
    expect(state.buildings.some((b) => b.typeId === 'main_house')).toBe(true);
    expect(state.grid.getOccupant({ x: 9, y: 9 })).toBeTruthy();
    expect(state.inventory.amounts.coin).toBe(0);
    expect(state.inventory.amounts.food).toBeGreaterThanOrEqual(10);
    expect(state.unlockedBlueprints).toEqual(
      expect.arrayContaining(['main_house', 'farm', 'research_institute']),
    );
    expect(state.availableResearch).toContain('tier1_wood');
  });
});
