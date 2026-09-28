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
  isoGridLines,
  isoMapBounds,
  isoMapCenter,
  groundCoverRect,
  groundImageRect,
  cameraBoundsForView,
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

  it('isoGridLines traces every tile edge on the isometric map', () => {
    const lines = isoGridLines(2, 2);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toEqual({
      from: tileToScreen(0, 0),
      to: tileToScreen(0, 2),
    });
    expect(lines[2]).toEqual({
      from: tileToScreen(2, 0),
      to: tileToScreen(2, 2),
    });
    expect(lines[3]).toEqual({
      from: tileToScreen(0, 0),
      to: tileToScreen(2, 0),
    });
    expect(lines[5]).toEqual({
      from: tileToScreen(0, 2),
      to: tileToScreen(2, 2),
    });
  });

  it('isoMapCenter is the diamond centroid and AABB midpoint', () => {
    const center = isoMapCenter(25, 25);
    expect(center).toEqual(tileToScreen(12.5, 12.5));
    const bounds = isoMapBounds(25, 25);
    expect(center.x).toBe((bounds.minX + bounds.maxX) / 2);
    expect(center.y).toBe((bounds.minY + bounds.maxY) / 2);
  });

  it('groundImageRect matches the isometric AABB so buildings stay on the illustration', () => {
    const map = isoMapBounds(25, 25);
    const image = groundImageRect(map);
    expect(image.width).toBe(map.maxX - map.minX);
    expect(image.height).toBe(map.maxY - map.minY);
    expect(image.minX).toBe(map.minX);
    expect(image.minY).toBe(map.minY);
    const cover = groundCoverRect(map, 800, 600, 0.4);
    expect(image.width).toBeLessThan(cover.width);
    expect(image.height).toBeLessThan(cover.height);
  });

  it('cameraBoundsForView stays on the map AABB when the view is smaller', () => {
    const map = { minX: -800, minY: 0, maxX: 800, maxY: 800 };
    const b = cameraBoundsForView(map, 800, 600, 1);
    expect(b.width).toBe(1600);
    expect(b.height).toBe(800);
    expect(b.minX).toBe(-800);
    expect(b.minY).toBe(0);
  });

  it('cameraBoundsForView grows to the viewport and stays centered when zoomed out past the map', () => {
    const map = { minX: -800, minY: 0, maxX: 800, maxY: 800 };
    const b = cameraBoundsForView(map, 800, 600, 0.4);
    expect(b.width).toBe(2000);
    expect(b.height).toBe(1500);
    expect((b.minX + b.maxX) / 2).toBe(0);
    expect((b.minY + b.maxY) / 2).toBe(400);
  });

  it('groundCoverRect expands the map AABB so min-zoom viewport never leaves the pad', () => {
    const map = { minX: -800, minY: 0, maxX: 800, maxY: 800 };
    const viewWidth = 800;
    const viewHeight = 600;
    const minZoom = 0.4;
    const cover = groundCoverRect(map, viewWidth, viewHeight, minZoom);
    const viewWorldW = viewWidth / minZoom;
    const viewWorldH = viewHeight / minZoom;
    expect(cover.width).toBe(map.maxX - map.minX + viewWorldW);
    expect(cover.height).toBe(map.maxY - map.minY + viewWorldH);
    expect(cover.minX).toBe(map.minX - viewWorldW / 2);
    expect(cover.minY).toBe(map.minY - viewWorldH / 2);
    expect(cover.maxX).toBe(map.maxX + viewWorldW / 2);
    expect(cover.maxY).toBe(map.maxY + viewWorldH / 2);
    expect(cover.width).toBeGreaterThanOrEqual(viewWorldW);
    expect(cover.height).toBeGreaterThanOrEqual(viewWorldH);
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
    expect(worldToTile(TILE_SIZE / 2, TILE_SIZE / 2)).toEqual({ x: 0, y: 0 });
    expect(worldToTile(TILE_SIZE, TILE_SIZE * 2)).toEqual({ x: 1, y: 2 });
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
