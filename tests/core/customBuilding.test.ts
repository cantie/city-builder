import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createInventory } from '@/core/inventory';
import { Grid } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import {
  MAX_CUSTOM_BUILDINGS,
  SYSTEM_ART_STYLE,
  applyInventedBuilding,
  composeInventPrompt,
  forgetCustomBuilding,
  nextCustomBuildingId,
  toCustomBuildingDef,
  validateInventInput,
} from '@/core/customBuilding';
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
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 2, height: 2 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];

function emptyState(): GameState {
  return {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(200, { food: 20, wood: 30, stone: 20, coin: 0 }),
    unlockedBlueprints: ['main_house', 'research_institute'],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
    customBuildings: [],
  };
}

describe('validateInventInput', () => {
  it('accepts a short prompt and 2x2 or 3x3', () => {
    expect(validateInventInput('crystal bakery', 2, 2).ok).toBe(true);
    expect(validateInventInput('stone windmill', 3, 3).ok).toBe(true);
  });

  it('rejects short, long, or mixed footprints', () => {
    expect(validateInventInput('ab', 2, 2).ok).toBe(false);
    expect(validateInventInput('x'.repeat(81), 2, 2).ok).toBe(false);
    expect(validateInventInput('crystal bakery', 2, 3).ok).toBe(false);
    expect(validateInventInput('crystal bakery', 1, 1).ok).toBe(false);
  });
});

describe('composeInventPrompt', () => {
  it('joins system style, footprint, and player text', () => {
    const text = composeInventPrompt('a cozy noodle stall', { width: 2, height: 2 });
    expect(text).toContain(SYSTEM_ART_STYLE);
    expect(text).toContain('2x2 footprint');
    expect(text).toContain('a cozy noodle stall');
  });
});

describe('nextCustomBuildingId', () => {
  it('fills custom-1 then custom-2 up to the cap', () => {
    expect(nextCustomBuildingId([])).toBe('custom-1');
    expect(nextCustomBuildingId([{ id: 'custom-1' }])).toBe('custom-2');
    expect(
      nextCustomBuildingId([
        { id: 'custom-1' },
        { id: 'custom-2' },
        { id: 'custom-3' },
      ]),
    ).toBeNull();
    expect(MAX_CUSTOM_BUILDINGS).toBe(3);
  });
});

describe('applyInventedBuilding / forgetCustomBuilding', () => {
  it('unlocks a placeable custom blueprint without a recipe', () => {
    const registry = createRegistry(buildings, [], []);
    const state = emptyState();
    const rec = applyInventedBuilding(state, registry, {
      id: 'custom-1',
      prompt: 'crystal bakery',
      footprint: { width: 2, height: 2 },
      sprite: '/api/sprites/custom-1',
    });
    expect(rec.id).toBe('custom-1');
    expect(rec.label).toBe('crystal bakery');
    expect(state.unlockedBlueprints).toContain('custom-1');
    expect(state.customBuildings).toHaveLength(1);
    const def = toCustomBuildingDef(rec);
    expect(def.defaultRecipeId).toBeUndefined();
    expect(def.footprint).toEqual({ width: 2, height: 2 });
    expect(registry.buildings.get('custom-1')?.sprite).toBe(
      '/api/sprites/custom-1',
    );
    const placed = placeBuilding(
      state,
      registry,
      'custom-1',
      { x: 0, y: 0 },
      () => 'c-1',
    );
    expect(placed.ok).toBe(true);
  });

  it('forget removes blueprint, instances, and frees the slot', () => {
    const registry = createRegistry(buildings, [], []);
    const state = emptyState();
    applyInventedBuilding(state, registry, {
      id: 'custom-1',
      prompt: 'crystal bakery',
      footprint: { width: 2, height: 2 },
      sprite: '/api/sprites/custom-1',
    });
    placeBuilding(state, registry, 'custom-1', { x: 0, y: 0 }, () => 'c-1');
    const result = forgetCustomBuilding(state, registry, 'custom-1');
    expect(result.ok).toBe(true);
    expect(state.customBuildings).toHaveLength(0);
    expect(state.unlockedBlueprints).not.toContain('custom-1');
    expect(state.buildings.some((b) => b.typeId === 'custom-1')).toBe(false);
    expect(state.grid.getOccupant({ x: 0, y: 0 })).toBeNull();
    expect(nextCustomBuildingId(state.customBuildings ?? [])).toBe('custom-1');
  });
});
