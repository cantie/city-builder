export const TILE_SIZE = 32;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

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
