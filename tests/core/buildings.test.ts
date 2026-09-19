import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding, demolishBuilding } from '@/core/buildings';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

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
    cost: { wood: 5, food: 2 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'Research Institute',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
];
const research: ResearchDef[] = [];

function freshState(): GameState {
  const grid = new Grid();
  const registry = createRegistry(buildings, recipes, research);
  const state: GameState = {
    tick: 0,
    grid,
    buildings: [],
    inventory: createInventory(100, { food: 20, wood: 20, stone: 20, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
  const main = placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  expect(main.ok).toBe(true);
  return state;
}

describe('placeBuilding / demolishBuilding', () => {
  it('places farm on empty cell and spends cost', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const beforeWood = state.inventory.amounts.wood;
    const result = placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.building.typeId).toBe('farm');
      expect(result.building.recipeId).toBe('basic_food');
    }
    expect(state.inventory.amounts.wood).toBe(beforeWood - 5);
    expect(state.grid.getOccupant({ x: 0, y: 0 })).toBe('farm-1');
  });

  it('rejects place overlapping main house', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const result = placeBuilding(state, registry, 'farm', { x: 9, y: 9 }, () => 'farm-x');
    expect(result.ok).toBe(false);
  });

  it('rejects locked blueprint', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    state.unlockedBlueprints = ['main_house'];
    const result = placeBuilding(state, registry, 'farm', { x: 1, y: 1 }, () => 'farm-x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unlock/i);
  });

  it('cannot demolish main house', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const result = demolishBuilding(state, registry, 'main-1');
    expect(result.ok).toBe(false);
    expect(state.buildings.some((b) => b.id === 'main-1')).toBe(true);
  });

  it('demolishes farm and vacates cell', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
    const result = demolishBuilding(state, registry, 'farm-1');
    expect(result.ok).toBe(true);
    expect(state.grid.getOccupant({ x: 0, y: 0 })).toBeNull();
    expect(state.buildings.find((b) => b.id === 'farm-1')).toBeUndefined();
  });
});
