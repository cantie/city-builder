import { describe, it, expect } from 'vitest';
import { Grid, GRID_WIDTH, GRID_HEIGHT } from '@/core/grid';

describe('Grid', () => {
  it('exposes fixed 20×20 size', () => {
    expect(GRID_WIDTH).toBe(20);
    expect(GRID_HEIGHT).toBe(20);
  });

  it('allows placing a 1×1 in bounds on empty cell', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 0, y: 0 }, { width: 1, height: 1 })).toBe(true);
  });

  it('rejects out-of-bounds footprint', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 19, y: 19 }, { width: 2, height: 2 })).toBe(false);
    expect(g.canPlace({ x: -1, y: 0 }, { width: 1, height: 1 })).toBe(false);
  });

  it('rejects overlap after occupy', () => {
    const g = new Grid();
    g.occupy('a', { x: 5, y: 5 }, { width: 2, height: 2 });
    expect(g.canPlace({ x: 6, y: 6 }, { width: 1, height: 1 })).toBe(false);
    expect(g.getOccupant({ x: 5, y: 5 })).toBe('a');
  });

  it('vacate frees cells for new place', () => {
    const g = new Grid();
    g.occupy('a', { x: 2, y: 2 }, { width: 2, height: 2 });
    g.vacate({ x: 2, y: 2 }, { width: 2, height: 2 });
    expect(g.canPlace({ x: 2, y: 2 }, { width: 2, height: 2 })).toBe(true);
    expect(g.getOccupant({ x: 2, y: 2 })).toBeNull();
  });
});
