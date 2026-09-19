import { describe, it, expect } from 'vitest';
import { loadContentFromData } from '@/core/loadContent';
import buildings from '@/data/buildings.json';
import recipes from '@/data/recipes.json';
import research from '@/data/research.json';

describe('loadContentFromData', () => {
  it('loads building types including warehouse and tiered research', () => {
    const registry = loadContentFromData(buildings, recipes, research);
    expect(registry.buildings.get('main_house')?.footprint).toEqual({
      width: 3,
      height: 3,
    });
    expect(registry.buildings.get('farm')?.footprint).toEqual({
      width: 2,
      height: 2,
    });
    expect(registry.buildings.get('research_institute')?.footprint).toEqual({
      width: 3,
      height: 3,
    });
    expect(registry.buildings.get('warehouse')?.footprint).toEqual({
      width: 3,
      height: 3,
    });
    expect(registry.buildings.get('lumber_yard')?.footprint).toEqual({
      width: 2,
      height: 2,
    });
    expect(registry.buildings.get('quarry')?.footprint).toEqual({
      width: 2,
      height: 2,
    });
    expect(registry.buildings.get('warehouse')?.sprite).toBe(
      '/assets/buildings/warehouse.png',
    );
    expect(registry.buildings.get('quarry')?.defaultRecipeId).toBe('stone_farm');
    expect(registry.research.get('tier2_stone')?.unlocksBlueprints).toContain(
      'quarry',
    );
    expect(registry.recipes.has('basic_food')).toBe(true);
    expect(registry.research.size).toBeGreaterThanOrEqual(3);
    const tiers = [...registry.research.values()].map((r) => r.tier);
    expect(tiers).toEqual(expect.arrayContaining([1, 2, 3]));
  });
});
