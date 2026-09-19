import { describe, it, expect } from 'vitest';
import {
  TILE_SIZE,
  ISO_TILE_W,
  ISO_TILE_H,
  tileToWorld,
  worldToTile,
  tileToScreen,
  screenToTile,
  screenToTileFloat,
  footprintScreenCorners,
} from '@/bridge/coords';
import {
  ISO_CAM_DISTANCE,
  syncThreeCameraFromPhaser,
} from '@/bridge/cameraSync';

describe('coords isometric screen', () => {
  it('tileToScreen uses classic 2:1 diamond mapping', () => {
    expect(tileToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileToScreen(1, 0)).toEqual({
      x: ISO_TILE_W / 2,
      y: ISO_TILE_H / 2,
    });
    expect(tileToScreen(0, 1)).toEqual({
      x: -ISO_TILE_W / 2,
      y: ISO_TILE_H / 2,
    });
    expect(tileToScreen(1, 1)).toEqual({ x: 0, y: ISO_TILE_H });
  });

  it('screenToTile floors the continuous inverse', () => {
    expect(screenToTile(0, 0)).toEqual({ x: 0, y: 0 });
    // Interior of tile diamonds — sample cell centers
    const mid00 = tileToScreen(0.5, 0.5);
    expect(screenToTile(mid00.x, mid00.y)).toEqual({ x: 0, y: 0 });
    const mid10 = tileToScreen(1.5, 0.5);
    expect(screenToTile(mid10.x, mid10.y)).toEqual({ x: 1, y: 0 });
  });

  it('round-trip tile → screen → tile', () => {
    for (const t of [
      { x: 0, y: 0 },
      { x: 5, y: 7 },
      { x: 19, y: 19 },
    ]) {
      // Sample interior of cell so floor returns same tile
      const s = tileToScreen(t.x + 0.5, t.y + 0.5);
      expect(screenToTile(s.x, s.y)).toEqual(t);
    }
  });

  it('footprintScreenCorners returns diamond in top-right-bottom-left order', () => {
    const c = footprintScreenCorners(0, 0, 1, 1);
    expect(c).toHaveLength(4);
    expect(c[0]).toEqual(tileToScreen(0, 0));
    expect(c[1]).toEqual(tileToScreen(1, 0));
    expect(c[2]).toEqual(tileToScreen(1, 1));
    expect(c[3]).toEqual(tileToScreen(0, 1));
  });
});

describe('coords 3D world', () => {
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
  it('places Three camera on isometric offset from look-at', () => {
    const lookAts: number[][] = [];
    const three = {
      position: { x: 0, y: 0, z: 0 },
      zoom: 1,
      lookAt(x: number, y: number, z: number) {
        lookAts.push([x, y, z]);
      },
      updateProjectionMatrix() {
        this.updated = true;
      },
      updated: false,
    };

    // Center of view at screen (0,0) → tile (0,0) continuous → world center of that mapping
    syncThreeCameraFromPhaser(
      { scrollX: -400, scrollY: -300, zoom: 2, width: 800, height: 600 },
      three,
    );

    const tile = screenToTileFloat(0, 0);
    const look = tileToWorld(tile.x, tile.y);
    const d = ISO_CAM_DISTANCE;

    expect(three.position.x).toBeCloseTo(look.x + d);
    expect(three.position.y).toBeCloseTo(d * 0.75);
    expect(three.position.z).toBeCloseTo(look.z + d);
    expect(lookAts[0][0]).toBeCloseTo(look.x);
    expect(lookAts[0][1]).toBeCloseTo(look.y);
    expect(lookAts[0][2]).toBeCloseTo(look.z);
    expect(three.zoom).toBe(2);
    expect(three.updated).toBe(true);
  });
});
