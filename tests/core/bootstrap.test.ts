import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import type { BuildingDef, RecipeDef, ResearchDef } from '@/core/types';
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
  {
    id: 'warehouse',
    label: 'Warehouse',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 8, stone: 5 },
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
  it('pre-spawns main house, adjacent warehouse, and starting kit', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state = createNewGame(registry, upgrades);
    expect(state.buildings.some((b) => b.typeId === 'main_house')).toBe(true);
    expect(state.buildings.some((b) => b.typeId === 'warehouse')).toBe(true);
    expect(state.grid.getOccupant({ x: 9, y: 9 })).toBeTruthy();
    expect(state.grid.getOccupant({ x: 8, y: 9 })).toBe('warehouse-1');
    expect(state.inventory.softCap).toBe(100);
    expect(state.inventory.amounts.coin).toBe(0);
    expect(state.inventory.amounts.food).toBeGreaterThanOrEqual(10);
    expect(state.unlockedBlueprints).toEqual(
      expect.arrayContaining([
        'main_house',
        'farm',
        'research_institute',
        'warehouse',
      ]),
    );
    expect(state.availableResearch).toContain('tier1_wood');
    const main = state.buildings.find((b) => b.typeId === 'main_house')!;
    expect(main.level).toBe(1);
  });
});
