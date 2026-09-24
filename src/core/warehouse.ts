import type { UpgradesConfig } from './upgrades';
import type { BuildingInstance, GameState } from './types';

/** Default capacity for a level-1 warehouse when config is missing. */
export const DEFAULT_WAREHOUSE_CAPACITY = 100;

/**
 * Capacity for a warehouse instance from upgrades config by level.
 * Prefer warehouseCapacityByLevel; fall back to stored capacity or default.
 */
export function warehouseCapacityForLevel(
  level: number,
  upgrades: UpgradesConfig,
  stored?: number,
): number {
  const key = String(level);
  const fromTable = upgrades.warehouseCapacityByLevel[key];
  if (typeof fromTable === 'number') return fromTable;
  if (typeof stored === 'number') return stored;
  return DEFAULT_WAREHOUSE_CAPACITY;
}

/**
 * Per-resource inventory cap = sum of warehouse capacities on the map.
 * Each type (food/wood/stone/coin) uses that cap independently.
 * Zero warehouses → softCap 0 (harvest fails / no warehouse).
 */
export function computeWarehouseSoftCap(
  buildings: BuildingInstance[],
  upgrades: UpgradesConfig,
): number {
  let total = 0;
  for (const b of buildings) {
    if (b.typeId !== 'warehouse') continue;
    total += warehouseCapacityForLevel(b.level ?? 1, upgrades, b.capacity);
  }
  return total;
}

/** Recalculate and assign state.inventory.softCap from warehouses on the map. */
export function refreshInventorySoftCap(
  state: GameState,
  upgrades: UpgradesConfig,
): void {
  state.inventory.softCap = computeWarehouseSoftCap(state.buildings, upgrades);
}
