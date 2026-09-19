import { describe, it, expect } from 'vitest';
import { layoutBuildingMesh } from '@/three/BuildingRenderer';
import { TILE_SIZE } from '@/bridge/coords';

describe('layoutBuildingMesh', () => {
  it('positions box at tile center with footprint scale', () => {
    const layout = layoutBuildingMesh(
      { x: 2, y: 1 },
      { width: 2, height: 1 },
      1.5,
    );
    expect(layout.position).toEqual({
      x: 2 * TILE_SIZE + TILE_SIZE,
      y: 1.5 / 2,
      z: 1 * TILE_SIZE + TILE_SIZE / 2,
    });
    expect(layout.scale).toEqual({
      x: 2 * TILE_SIZE * 0.9,
      y: 1.5,
      z: 1 * TILE_SIZE * 0.9,
    });
  });
});
