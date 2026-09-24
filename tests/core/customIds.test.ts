import { describe, it, expect } from 'vitest';
import {
  parseCustomSlot,
  sharedCustomTypeId,
  sharedResourceId,
  sharedUnitId,
  fallbackInventNames,
} from '@/core/customIds';

describe('custom ids', () => {
  it('builds stable shared ids from owner + slot', () => {
    expect(parseCustomSlot('custom-1')).toBe(1);
    expect(parseCustomSlot('farm')).toBeNull();
    expect(sharedCustomTypeId('zz', 1)).toBe('custom-zz-1');
    expect(sharedResourceId('zz', 1)).toBe('res-zz-1');
    expect(sharedUnitId('zz', 1)).toBe('unit-zz-1');
  });

  it('falls back to Ore / Troop names from the prompt', () => {
    expect(fallbackInventNames('crystal bakery')).toEqual({
      building: 'crystal bakery',
      resource: 'crystal bakery Ore',
      unit: 'crystal bakery Troop',
    });
  });
});
