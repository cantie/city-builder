export const ZOOM_LEVELS = [0.4, 0.65, 1.0, 1.5] as const;
export const DEFAULT_ZOOM_INDEX = 2;
export const DEFAULT_ZOOM = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];

export type ZoomDirection = 1 | -1;

const EPS = 1e-6;

/** Step one rung on the discrete zoom ladder. +1 zooms in, −1 zooms out. */
export function stepZoom(
  currentZoom: number,
  direction: ZoomDirection,
  levels: readonly number[] = ZOOM_LEVELS,
): number {
  if (direction > 0) {
    return levels.find((z) => z > currentZoom + EPS) ?? levels[levels.length - 1];
  }
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i] < currentZoom - EPS) return levels[i];
  }
  return levels[0];
}

export interface BuildingLookAt {
  typeId: string;
  origin: { x: number; y: number };
}

/** Tile the camera should look at so starting buildings share the viewport. */
export function lookAtTileFromBuildings(
  buildings: BuildingLookAt[],
): { x: number; y: number } {
  const main = buildings.find((b) => b.typeId === 'main_house');
  const warehouse = buildings.find((b) => b.typeId === 'warehouse');
  if (main && warehouse) {
    return {
      x: (main.origin.x + warehouse.origin.x) / 2,
      y: (main.origin.y + warehouse.origin.y) / 2,
    };
  }
  if (main) return { ...main.origin };
  return { x: 25, y: 25 };
}
