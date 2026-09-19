import { trySpend } from './inventory';
import { createRegistry } from './registry';
import type {
  BuildingInstance,
  BuildingTypeId,
  Cell,
  GameState,
} from './types';
import type { ContentRegistry } from './registry';

export { createRegistry };
export type { ContentRegistry };

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
    recipeId: def.defaultRecipeId,
    ...(def.defaultRecipeId ? { pending: {} } : {}),
  };
  state.grid.occupy(building.id, origin, def.footprint);
  state.buildings.push(building);
  return { ok: true, building };
}

export function demolishBuilding(
  state: GameState,
  registry: ContentRegistry,
  buildingId: string,
): DemolishResult {
  const idx = state.buildings.findIndex((b) => b.id === buildingId);
  if (idx < 0) return { ok: false, reason: 'not found' };
  const building = state.buildings[idx];
  const def = registry.buildings.get(building.typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!def.demolishable || building.typeId === 'main_house') {
    return { ok: false, reason: 'cannot demolish' };
  }
  state.grid.vacate(building.origin, def.footprint);
  state.buildings.splice(idx, 1);
  return { ok: true };
}
