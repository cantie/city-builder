import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createInventory } from '@/core/inventory';
import { Grid } from '@/core/grid';
import { MAX_CATCH_UP_TICKS } from '@/core/catchUp';
import { tryAdvanceLocalDisplay } from '@/core/displayTick';
import type { BuildingDef, GameState, RecipeDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 1, height: 1 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [];

function emptyState(): GameState {
  return {
    tick: 10,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(0, { food: 0, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: [],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
}

describe('tryAdvanceLocalDisplay', () => {
  it('ticks locally without needing a server round-trip', () => {
    const registry = createRegistry(buildings, recipes, []);
    const state = emptyState();
    expect(tryAdvanceLocalDisplay(state, registry, 10)).toBe(true);
    expect(state.tick).toBe(11);
  });

  it('stops once local ticks reach the catch-up cap vs last server tick', () => {
    const registry = createRegistry(buildings, recipes, []);
    const state = emptyState();
    state.tick = 10 + MAX_CATCH_UP_TICKS;
    expect(tryAdvanceLocalDisplay(state, registry, 10)).toBe(false);
    expect(state.tick).toBe(10 + MAX_CATCH_UP_TICKS);
  });
});
