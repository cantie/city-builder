import type { BuildingTypeId, Cell } from './types';

/** Layout copied from player `zzz` — one reserved origin per building type. */
export const DEFAULT_BUILDING_ORIGINS: Record<string, Cell> = {
  main_house: { x: 17, y: 2 },
  warehouse: { x: 12, y: 1 },
  research_institute: { x: 14, y: 8 },
  farm: { x: 1, y: 16 },
  lumber_yard: { x: 7, y: 19 },
  quarry: { x: 5, y: 8 },
  'custom-1': { x: 14, y: 18 },
  'custom-2': { x: 22, y: 1 },
  'custom-3': { x: 22, y: 8 },
};

export function defaultOriginFor(typeId: BuildingTypeId): Cell | null {
  const origin = DEFAULT_BUILDING_ORIGINS[typeId];
  return origin ? { ...origin } : null;
}

export function tileInFootprint(
  tile: Cell,
  origin: Cell,
  footprint: { width: number; height: number },
): boolean {
  return (
    tile.x >= origin.x &&
    tile.x < origin.x + footprint.width &&
    tile.y >= origin.y &&
    tile.y < origin.y + footprint.height
  );
}

/**
 * Where a build-mode click should place.
 * Reserved types always use their slot; others place at the pointer tile.
 */
export function clickPlacesAt(
  typeId: BuildingTypeId,
  click: Cell,
  _footprint: { width: number; height: number },
): Cell | null {
  const origin = defaultOriginFor(typeId);
  if (!origin) return { ...click };
  return origin;
}
