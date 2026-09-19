import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry } from '@/core/buildings';
import {
  TICK_INTERVAL_MS,
  MAX_CATCH_UP_TICKS,
  catchUpTicks,
} from '@/core/catchUp';
import type { BuildingDef, GameState, RecipeDef } from '@/core/types';

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
const recipes: RecipeDef[] = [];

function emptyState(): GameState {
  return {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(0, { food: 0, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house'],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
}

describe('catchUpTicks', () => {
  const registry = createRegistry(buildings, recipes, []);

  it('applies no ticks when no time has passed', () => {
    const state = emptyState();
    const t0 = 1_000_000;
    const result = catchUpTicks(state, registry, t0, t0);
    expect(result.applied).toBe(0);
    expect(result.lastTickAt).toBe(t0);
    expect(state.tick).toBe(0);
  });

  it('applies floor elapsed / interval and keeps leftover ms', () => {
    const state = emptyState();
    const t0 = 1_000_000;
    const result = catchUpTicks(
      state,
      registry,
      t0,
      t0 + TICK_INTERVAL_MS * 2 + 250,
    );
    expect(result.applied).toBe(2);
    expect(result.lastTickAt).toBe(t0 + TICK_INTERVAL_MS * 2);
    expect(state.tick).toBe(2);
  });

  it('caps at MAX_CATCH_UP_TICKS and jumps lastTickAt to now', () => {
    const state = emptyState();
    const t0 = 1_000_000;
    const now = t0 + TICK_INTERVAL_MS * (MAX_CATCH_UP_TICKS + 500);
    const result = catchUpTicks(state, registry, t0, now);
    expect(result.applied).toBe(MAX_CATCH_UP_TICKS);
    expect(result.lastTickAt).toBe(now);
    expect(state.tick).toBe(MAX_CATCH_UP_TICKS);
  });
});
