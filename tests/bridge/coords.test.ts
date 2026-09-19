import { describe, it, expect } from 'vitest';
import { TILE_SIZE, tileToWorld, worldToTile } from '@/bridge/coords';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';

describe('coords', () => {
  it('tileToWorld centers on cell using TILE_SIZE', () => {
    const w = tileToWorld(0, 0);
    expect(w).toEqual({ x: TILE_SIZE / 2, y: 0, z: TILE_SIZE / 2 });
    const w2 = tileToWorld(2, 3, 10);
    expect(w2).toEqual({ x: 25, y: 0, z: 35 });
  });

  it('worldToTile is inverse floor mapping', () => {
    expect(worldToTile(16, 16)).toEqual({ x: 0, y: 0 });
    expect(worldToTile(32, 64)).toEqual({ x: 1, y: 2 });
    expect(worldToTile(25, 35, 10)).toEqual({ x: 2, y: 3 });
  });

  it('round-trip tile → world → tile', () => {
    for (const t of [
      { x: 0, y: 0 },
      { x: 5, y: 7 },
      { x: 19, y: 19 },
    ]) {
      const w = tileToWorld(t.x, t.y);
      expect(worldToTile(w.x, w.z)).toEqual(t);
    }
  });
});

describe('syncThreeCameraFromPhaser', () => {
  it('copies scroll/zoom into three orthographic camera', () => {
    const three = {
      position: { x: 0, y: 100, z: 0 },
      zoom: 1,
      updateProjectionMatrix() {
        this.updated = true;
      },
      updated: false,
    };
    syncThreeCameraFromPhaser(
      { scrollX: 64, scrollY: 96, zoom: 2, width: 800, height: 600 },
      three,
    );
    expect(three.position.x).toBe(64 + 800 / 2);
    expect(three.position.z).toBe(96 + 600 / 2);
    expect(three.zoom).toBe(2);
    expect(three.updated).toBe(true);
  });
});
