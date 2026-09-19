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

let autoId = 0;
function defaultId(): string {
  autoId += 1;
  return `b-${autoId}`;
}

export function placeBuilding(
  state: GameState,
  registry: ContentRegistry,
  typeId: BuildingTypeId,
  origin: Cell,
  idFactory: () => string = defaultId,
  upgrades: UpgradesConfig = defaultUpgrades,
): PlaceResult {
  if (!state.unlockedBlueprints.includes(typeId)) {
    return { ok: false, reason: 'blueprint not unlocked' };
  }
  const def = registry.buildings.get(typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!state.grid.canPlace(origin, def.footprint)) {
    return { ok: false, reason: 'invalid placement' };
  }
  if (!trySpend(state.inventory, def.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }
  const building: BuildingInstance = {
    id: idFactory(),
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
