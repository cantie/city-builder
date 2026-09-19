import type { Cell, Footprint } from './types';

export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 20;

export class Grid {
  private cells: (string | null)[][];

  constructor() {
    this.cells = Array.from({ length: GRID_HEIGHT }, () =>
      Array.from({ length: GRID_WIDTH }, () => null),
    );
  }

  cellsFor(origin: Cell, footprint: Footprint): Cell[] {
    const out: Cell[] = [];
    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) {
        out.push({ x: origin.x + dx, y: origin.y + dy });
      }
    }
    return out;
  }

  canPlace(origin: Cell, footprint: Footprint): boolean {
    for (const c of this.cellsFor(origin, footprint)) {
      if (c.x < 0 || c.y < 0 || c.x >= GRID_WIDTH || c.y >= GRID_HEIGHT) {
        return false;
      }
      if (this.cells[c.y][c.x] !== null) return false;
    }
    return true;
  }

  occupy(buildingId: string, origin: Cell, footprint: Footprint): void {
    if (!this.canPlace(origin, footprint)) {
      throw new Error('cannot occupy: invalid placement');
    }
    for (const c of this.cellsFor(origin, footprint)) {
      this.cells[c.y][c.x] = buildingId;
    }
  }

  vacate(origin: Cell, footprint: Footprint): void {
    for (const c of this.cellsFor(origin, footprint)) {
      if (c.x < 0 || c.y < 0 || c.x >= GRID_WIDTH || c.y >= GRID_HEIGHT) continue;
      this.cells[c.y][c.x] = null;
    }
  }

  getOccupant(cell: Cell): string | null {
    if (cell.x < 0 || cell.y < 0 || cell.x >= GRID_WIDTH || cell.y >= GRID_HEIGHT) {
      return null;
    }
    return this.cells[cell.y][cell.x];
  }
}
