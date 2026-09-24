import { trySpend } from './inventory';
import { createRegistry } from './registry';
import {
  refreshInventorySoftCap,
  warehouseCapacityForLevel,
} from './warehouse';
import type { UpgradesConfig } from './upgrades';
import type {
  BuildingInstance,
  BuildingTypeId,
  Cell,
  GameState,
} from './types';
import type { ContentRegistry } from './registry';
import defaultUpgradesJson from '@/data/upgrades.json';

export { createRegistry };
export type { ContentRegistry };

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

export type PlaceResult =
  | { ok: true; building: BuildingInstance }
  | { ok: false; reason: string };

export type DemolishResult = { ok: true } | { ok: false; reason: string };
export type MoveResult = { ok: true } | { ok: false; reason: string };

export function nextBuildingId(existingIds: Iterable<string>): string {
  let max = 0;
  for (const id of existingIds) {
    const m = /^b-(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `b-${max + 1}`;
}

export function uniquifyBuildingIds(buildings: { id: string }[]): void {
  const seen = new Set<string>();
  for (const b of buildings) {
    if (!b.id || seen.has(b.id)) {
      b.id = nextBuildingId(seen);
    }
    seen.add(b.id);
  }
}

export function placeBuilding(
  state: GameState,
  registry: ContentRegistry,
  typeId: BuildingTypeId,
  origin: Cell,
  idFactory?: () => string,
  upgrades: UpgradesConfig = defaultUpgrades,
  options: { free?: boolean } = {},
): PlaceResult {
  if (!state.unlockedBlueprints.includes(typeId)) {
    return { ok: false, reason: 'blueprint not unlocked' };
  }
  const def = registry.buildings.get(typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!state.grid.canPlace(origin, def.footprint)) {
    return { ok: false, reason: 'invalid placement' };
  }
  if (!options.free && !trySpend(state.inventory, def.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }
  const building: BuildingInstance = {
    id: idFactory?.() ?? nextBuildingId(state.buildings.map((b) => b.id)),
    typeId,
    origin: { ...origin },
    level: 1,
    recipeId: def.defaultRecipeId,
    ...(def.defaultRecipeId ? { pending: {} } : {}),
  };
  if (typeId === 'warehouse') {
    building.capacity = warehouseCapacityForLevel(1, upgrades);
  }
  state.grid.occupy(building.id, origin, def.footprint);
  state.buildings.push(building);
  if (typeId === 'warehouse') {
    refreshInventorySoftCap(state, upgrades);
  }
  return { ok: true, building };
}

export function demolishBuilding(
  state: GameState,
  registry: ContentRegistry,
  buildingId: string,
  upgrades: UpgradesConfig = defaultUpgrades,
): DemolishResult {
  const idx = state.buildings.findIndex((b) => b.id === buildingId);
  if (idx < 0) return { ok: false, reason: 'not found' };
  const building = state.buildings[idx];
  const def = registry.buildings.get(building.typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!def.demolishable || building.typeId === 'main_house') {
    return { ok: false, reason: 'cannot demolish' };
  }
  const wasWarehouse = building.typeId === 'warehouse';
  state.grid.vacate(building.origin, def.footprint);
  state.buildings.splice(idx, 1);
  if (wasWarehouse) {
    refreshInventorySoftCap(state, upgrades);
  }
  return { ok: true };
}

export function originFromGrab(dropTile: Cell, grabOffset: Cell): Cell {
  return { x: dropTile.x - grabOffset.x, y: dropTile.y - grabOffset.y };
}

export function moveBuilding(
  state: GameState,
  registry: ContentRegistry,
  buildingId: string,
  origin: Cell,
): MoveResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };
  const def = registry.buildings.get(building.typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (building.origin.x === origin.x && building.origin.y === origin.y) {
    return { ok: true };
  }
  state.grid.vacate(building.origin, def.footprint);
  if (!state.grid.canPlace(origin, def.footprint)) {
    state.grid.occupy(building.id, building.origin, def.footprint);
    return { ok: false, reason: 'invalid placement' };
  }
  building.origin = { ...origin };
  state.grid.occupy(building.id, origin, def.footprint);
  return { ok: true };
}
