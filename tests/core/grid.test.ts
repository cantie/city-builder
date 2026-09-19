import { describe, it, expect } from 'vitest';
import { Grid, GRID_WIDTH, GRID_HEIGHT } from '@/core/grid';

describe('Grid', () => {
  it('exposes fixed 50×50 size', () => {
    expect(GRID_WIDTH).toBe(50);
    expect(GRID_HEIGHT).toBe(50);
  });

  it('allows placing a 1×1 in bounds on empty cell', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 0, y: 0 }, { width: 1, height: 1 })).toBe(true);
  });

  it('rejects out-of-bounds footprint', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 49, y: 49 }, { width: 2, height: 2 })).toBe(false);
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

  it('canPlace can ignore a building so a move may overlap its old cells', () => {
    const g = new Grid();
    g.occupy('a', { x: 0, y: 0 }, { width: 2, height: 2 });
    expect(g.canPlace({ x: 1, y: 0 }, { width: 2, height: 2 })).toBe(false);
    expect(g.canPlace({ x: 1, y: 0 }, { width: 2, height: 2 }, 'a')).toBe(true);
    expect(g.canPlace({ x: 1, y: 0 }, { width: 2, height: 2 }, 'other')).toBe(
      false,
    );
  });
});
