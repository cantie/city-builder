export const TILE_SIZE = 32;

/** Classic 2:1 isometric tile size in Phaser screen space. */
export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Tile → Phaser isometric screen (diamond top vertex convention via corner math). */
export function tileToScreen(tx: number, ty: number): Vec2 {
  return {
    x: (tx - ty) * (ISO_TILE_W / 2),
    y: (tx + ty) * (ISO_TILE_H / 2),
  };
}

/** Continuous inverse of tileToScreen (no floor). */
export function screenToTileFloat(sx: number, sy: number): Vec2 {
  const tx = (sx / (ISO_TILE_W / 2) + sy / (ISO_TILE_H / 2)) / 2;
  const ty = (sy / (ISO_TILE_H / 2) - sx / (ISO_TILE_W / 2)) / 2;
  return { x: tx, y: ty };
}

/** Screen → tile indices (floor). */
export function screenToTile(sx: number, sy: number): Vec2 {
  const t = screenToTileFloat(sx, sy);
  return { x: Math.floor(t.x), y: Math.floor(t.y) };
}

/**
 * Tile → Three.js Cartesian ground plane (X/Z).
 * Cell centers sit at (tx+0.5, 0, ty+0.5) * TILE_SIZE.
 */
export function tileToWorld(
  tileX: number,
  tileY: number,
  tileSize: number = TILE_SIZE,
): Vec3 {
  return {
    x: tileX * tileSize + tileSize / 2,
    y: 0,
    z: tileY * tileSize + tileSize / 2,
  };
}

export function worldToTile(
  worldX: number,
  worldZ: number,
  tileSize: number = TILE_SIZE,
): Vec2 {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldZ / tileSize),
  };
}

/**
 * Screen-space diamond corners for a footprint covering
 * [ox, ox+w) × [oy, oy+h) in tile space.
 * Order: top, right, bottom, left.
 */
export function footprintScreenCorners(
  ox: number,
  oy: number,
  width: number,
  height: number,
): Vec2[] {
  return [
    tileToScreen(ox, oy),
    tileToScreen(ox + width, oy),
    tileToScreen(ox + width, oy + height),
    tileToScreen(ox, oy + height),
  ];
}

/** Single-cell diamond corners in screen space. */
export function tileDiamondCorners(tx: number, ty: number): Vec2[] {
  return footprintScreenCorners(tx, ty, 1, 1);
}

/** Straight isometric grid lines along every tile edge. */
export function isoGridLines(
  gridWidth: number,
  gridHeight: number,
): Array<{ from: Vec2; to: Vec2 }> {
  const lines: Array<{ from: Vec2; to: Vec2 }> = [];
  for (let tx = 0; tx <= gridWidth; tx++) {
    lines.push({
      from: tileToScreen(tx, 0),
      to: tileToScreen(tx, gridHeight),
    });
  }
  for (let ty = 0; ty <= gridHeight; ty++) {
    lines.push({
      from: tileToScreen(0, ty),
      to: tileToScreen(gridWidth, ty),
    });
  }
  return lines;
}

/** Geometric center of the isometric map diamond (also the AABB midpoint). */
export function isoMapCenter(gridWidth: number, gridHeight: number): Vec2 {
  return tileToScreen(gridWidth / 2, gridHeight / 2);
}

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Axis-aligned bounds of the isometric map in Phaser world/screen space. */
export function isoMapBounds(
  gridWidth: number,
  gridHeight: number,
): WorldRect {
  const corners = [
    tileToScreen(0, 0),
    tileToScreen(gridWidth, 0),
    tileToScreen(0, gridHeight),
    tileToScreen(gridWidth, gridHeight),
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxX: Math.max(...corners.map((c) => c.x)),
    maxY: Math.max(...corners.map((c) => c.y)),
  };
}

/**
 * Pad around the map AABB so a min-zoom viewport never shows past the fill.
 * The terrain image itself stays at AABB size (see groundImageRect).
 */
export function groundCoverRect(
  mapBounds: WorldRect,
  viewWidth: number,
  viewHeight: number,
  minZoom: number,
): WorldRect & { width: number; height: number } {
  const z = minZoom <= 0 ? 1 : minZoom;
  const padX = viewWidth / (2 * z);
  const padY = viewHeight / (2 * z);
  const minX = mapBounds.minX - padX;
  const minY = mapBounds.minY - padY;
  const maxX = mapBounds.maxX + padX;
  const maxY = mapBounds.maxY + padY;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Display size of the terrain image — same as the isometric map AABB. */
export function groundImageRect(
  mapBounds: WorldRect,
): WorldRect & { width: number; height: number } {
  return {
    ...mapBounds,
    width: mapBounds.maxX - mapBounds.minX,
    height: mapBounds.maxY - mapBounds.minY,
  };
}

/**
 * Camera world bounds: the map when zoomed in, or a viewport-sized rect
 * centered on the map when zoomed out so the island stays in view.
 */
export function cameraBoundsForView(
  mapBounds: WorldRect,
  viewWidth: number,
  viewHeight: number,
  zoom: number,
): WorldRect & { width: number; height: number } {
  const z = zoom <= 0 ? 1 : zoom;
  const viewWorldW = viewWidth / z;
  const viewWorldH = viewHeight / z;
  const mapW = mapBounds.maxX - mapBounds.minX;
  const mapH = mapBounds.maxY - mapBounds.minY;
  const cx = (mapBounds.minX + mapBounds.maxX) / 2;
  const cy = (mapBounds.minY + mapBounds.maxY) / 2;
  const width = Math.max(mapW, viewWorldW);
  const height = Math.max(mapH, viewWorldH);
  const minX = cx - width / 2;
  const minY = cy - height / 2;
  return { minX, minY, maxX: minX + width, maxY: minY + height, width, height };
}
