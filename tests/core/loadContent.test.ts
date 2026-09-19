import { describe, it, expect } from 'vitest';
import { loadContentFromData } from '@/core/loadContent';
import buildings from '@/data/buildings.json';
import recipes from '@/data/recipes.json';
import research from '@/data/research.json';

describe('loadContentFromData', () => {
  it('loads three building types and tiered research', () => {
    const registry = loadContentFromData(buildings, recipes, research);
    expect(registry.buildings.get('main_house')?.footprint).toEqual({
      width: 2,
      height: 2,
    });
    expect(registry.buildings.get('farm')?.footprint).toEqual({
      width: 1,
      height: 1,
    });
    expect(registry.buildings.get('research_institute')?.footprint).toEqual({
      width: 1,
      height: 1,
    });
    expect(registry.recipes.has('basic_food')).toBe(true);
    expect(registry.research.size).toBeGreaterThanOrEqual(3);
    const tiers = [...registry.research.values()].map((r) => r.tier);
    expect(tiers).toEqual(expect.arrayContaining([1, 2, 3]));
  });
});
