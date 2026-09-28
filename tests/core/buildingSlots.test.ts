import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BUILDING_ORIGINS,
  clickPlacesAt,
  defaultOriginFor,
  tileInFootprint,
} from '@/core/buildingSlots';

describe('default building slots (zzz layout)', () => {
  it('pins each stock and custom slot to the zzz city coordinates', () => {
    expect(DEFAULT_BUILDING_ORIGINS).toEqual({
      main_house: { x: 17, y: 2 },
      warehouse: { x: 12, y: 1 },
      research_institute: { x: 14, y: 8 },
      farm: { x: 1, y: 16 },
      lumber_yard: { x: 7, y: 19 },
      quarry: { x: 5, y: 8 },
      'custom-1': { x: 14, y: 18 },
      'custom-2': { x: 22, y: 1 },
      'custom-3': { x: 22, y: 8 },
    });
  });

  it('looks up a type and ignores unknown blueprints', () => {
    expect(defaultOriginFor('farm')).toEqual({ x: 1, y: 16 });
    expect(defaultOriginFor('custom-9')).toBeNull();
  });
});

describe('clickPlacesAt', () => {
  it('places on the reserved slot for a click anywhere in build mode', () => {
    const farm = { width: 3, height: 3 };
    expect(clickPlacesAt('farm', { x: 1, y: 16 }, farm)).toEqual({ x: 1, y: 16 });
    expect(clickPlacesAt('farm', { x: 4, y: 16 }, farm)).toEqual({ x: 1, y: 16 });
    expect(tileInFootprint({ x: 2, y: 17 }, { x: 1, y: 16 }, farm)).toBe(true);
  });

  it('falls back to the pointer tile when the type has no reserved slot', () => {
    expect(
      clickPlacesAt('custom-9', { x: 4, y: 5 }, { width: 3, height: 3 }),
    ).toEqual({ x: 4, y: 5 });
  });
});
