import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createInventory } from '@/core/inventory';
import { Grid } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import {
  MAX_CUSTOM_BUILDINGS,
  SYSTEM_ART_STYLE,
  CUSTOM_FOOTPRINT,
  applyInventedBuilding,
  composeInventPrompt,
  customBuildingLabel,
  forgetCustomBuilding,
  nextCustomBuildingId,
  normalizeCustomBuildings,
  sanitizeBuildingName,
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
  it('accepts a short prompt and always uses a 3x3 footprint', () => {
    const two = validateInventInput('crystal bakery', 2, 2);
    expect(two.ok).toBe(true);
    if (two.ok) expect(two.footprint).toEqual(CUSTOM_FOOTPRINT);
    const three = validateInventInput('stone windmill', 3, 3);
    expect(three.ok).toBe(true);
    if (three.ok) expect(three.footprint).toEqual({ width: 3, height: 3 });
  });

  it('rejects short or long prompts', () => {
    expect(validateInventInput('ab', 2, 2).ok).toBe(false);
    expect(validateInventInput('x'.repeat(161), 2, 2).ok).toBe(false);
    expect(validateInventInput('x'.repeat(160), 2, 2).ok).toBe(true);
  });
});

describe('composeInventPrompt', () => {
  it('leads with player brief, then soft constraints and footprint', () => {
    const player = 'a cozy noodle stall';
    const text = composeInventPrompt(player, CUSTOM_FOOTPRINT);
    expect(text.indexOf(player)).toBeLessThan(text.indexOf('Soft constraints'));
    expect(text.startsWith('Creative isometric pixel-art building:')).toBe(true);
    expect(text).toContain(player);
    expect(text).toMatch(/3[×x]3 footprint/);
    expect(text).toContain('transparent background');
    expect(text).toContain('no UI no text no characters');
    expect(text).toContain('unique silhouette');
    // SYSTEM_ART_STYLE remains exported for stability
    expect(SYSTEM_ART_STYLE).toContain('isometric pixel-art');
  });
});

describe('sanitizeBuildingName / customBuildingLabel', () => {
  it('keeps a short LLM name and strips quotes', () => {
    expect(sanitizeBuildingName('"Crystal Bakery"')).toBe('Crystal Bakery');
    expect(sanitizeBuildingName('  Noodle Stall.  ')).toBe('Noodle Stall');
    expect(customBuildingLabel('a cozy noodle stall with lanterns', 'Noodle Stall')).toBe(
      'Noodle Stall',
    );
  });

  it('falls back to a clipped prompt when the LLM name is empty', () => {
    expect(sanitizeBuildingName('   ')).toBeNull();
    expect(sanitizeBuildingName('""')).toBeNull();
    expect(customBuildingLabel('a cozy noodle stall with lanterns')).toBe(
      'a cozy noodle stall wit…',
    );
    expect(customBuildingLabel('crystal bakery')).toBe('crystal bakery');
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

describe('normalizeCustomBuildings', () => {
  it('upgrades saved 2x2 customs to 3x3', () => {
    const out = normalizeCustomBuildings([
      {
        id: 'custom-1',
        label: 'Slide House',
        prompt: 'slide house',
        footprint: { width: 2, height: 2 },
        sprite: '/api/sprites/custom-1',
      },
    ]);
    expect(out[0]?.footprint).toEqual(CUSTOM_FOOTPRINT);
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

    const named = applyInventedBuilding(state, registry, {
      id: 'custom-2',
      prompt: 'a cozy noodle stall with lanterns',
      footprint: { width: 2, height: 2 },
      sprite: '/api/sprites/custom-2',
      label: 'Noodle Stall',
    });
    expect(named.label).toBe('Noodle Stall');
    expect(state.unlockedBlueprints).toContain('custom-1');
    expect(state.customBuildings).toHaveLength(2);
    const def = toCustomBuildingDef(rec);
    expect(def.defaultRecipeId).toBeUndefined();
    expect(def.footprint).toEqual(CUSTOM_FOOTPRINT);
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

  it('fills unique resource and unit fields from owner + slot', () => {
    const registry = createRegistry(buildings, [], []);
    const state = emptyState();
    const rec = applyInventedBuilding(state, registry, {
      id: 'custom-1',
      prompt: 'crystal bakery',
      footprint: { width: 3, height: 3 },
      sprite: '/api/sprites/custom-1',
      owner: 'ada',
    });
    expect(rec.resourceId).toBe('res-ada-1');
    expect(rec.unitId).toBe('unit-ada-1');
    expect(rec.unitLabel).toBe('crystal bakery Troop');
    expect(rec.exportPrice).toBe(2);
    expect(rec.exportEnabled).toBe(true);
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
