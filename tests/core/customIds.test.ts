import { describe, it, expect } from 'vitest';
import {
  MAX_CUSTOM_BUILDINGS,
  parseCustomSlot,
  sharedCustomTypeId,
  sharedResourceId,
  sharedUnitId,
  fallbackInventNames,
} from '@/core/customIds';

describe('custom ids', () => {
  it('builds stable shared ids from owner + slot', () => {
    expect(parseCustomSlot('custom-1')).toBe(1);
    expect(parseCustomSlot('custom-10')).toBe(10);
    expect(parseCustomSlot('custom-11')).toBeNull();
    expect(parseCustomSlot('farm')).toBeNull();
    expect(sharedCustomTypeId('zz', 1)).toBe('custom-zz-1');
    expect(sharedCustomTypeId('zz', 10)).toBe('custom-zz-10');
    expect(sharedResourceId('zz', 1)).toBe('res-zz-1');
    expect(sharedUnitId('zz', 1)).toBe('unit-zz-1');
    expect(MAX_CUSTOM_BUILDINGS).toBe(10);
  });

  it('falls back to Ore / Troop names from the prompt', () => {
    expect(fallbackInventNames('crystal bakery')).toEqual({
      building: 'crystal bakery',
      resource: 'crystal bakery Ore',
      unit: 'crystal bakery Troop',
    });
  });
});
