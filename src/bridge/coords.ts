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

/** Axis-aligned bounds of the isometric map in Phaser world/screen space. */
export function isoMapBounds(
  gridWidth: number,
  gridHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
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
