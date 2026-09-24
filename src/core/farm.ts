import { harvestUnique, isOriginCustom } from './customEconomy';
import { add } from './inventory';
import type { ContentRegistry } from './registry';
import type { GameState, ResourceId } from './types';

/**
 * Soft-cap on total pending resources per building (skip tick if exceeded).
 * MVP: fixed at 50; upgrades.json may define pendingCapBonus effects later
 * but they are not applied here yet — pending stays at 50 regardless of level.
 */
export const PENDING_SOFT_CAP = 50;

export type HarvestResult =
  | { ok: true }
  | { ok: false; reason: string };

function pendingTotal(pending: Partial<Record<ResourceId, number>>): number {
  let sum = 0;
  for (const id of Object.keys(pending) as ResourceId[]) {
    sum += pending[id] ?? 0;
  }
  return sum;
}

function outputTotal(outputs: Partial<Record<ResourceId, number>>): number {
  let sum = 0;
  for (const id of Object.keys(outputs) as ResourceId[]) {
    sum += outputs[id] ?? 0;
  }
  return sum;
}

/**
 * Each tick, buildings with an unlocked recipe accumulate outputs into
 * `building.pending`. Does NOT add to city inventory.
 */
export function produceFarms(state: GameState, registry: ContentRegistry): void {
  for (const b of state.buildings) {
    if (!b.recipeId) continue;
    if (!state.unlockedRecipes.includes(b.recipeId)) continue;
    const recipe = registry.recipes.get(b.recipeId);
    if (!recipe) continue;

    if (!b.pending) b.pending = {};

    const nextTotal = pendingTotal(b.pending) + outputTotal(recipe.outputs);
    if (nextTotal > PENDING_SOFT_CAP) continue;

    for (const id of Object.keys(recipe.outputs) as ResourceId[]) {
      const amount = recipe.outputs[id] ?? 0;
      if (amount === 0) continue;
      b.pending[id] = (b.pending[id] ?? 0) + amount;
    }
  }
}

/** How much of `pending` still fits under each resource's warehouse cap. */
function takeUpToCap(
  inv: GameState['inventory'],
  pending: Partial<Record<ResourceId, number>>,
): Partial<Record<ResourceId, number>> {
  const taken: Partial<Record<ResourceId, number>> = {};
  for (const id of Object.keys(pending) as ResourceId[]) {
    const want = pending[id] ?? 0;
    if (want <= 0) continue;
    const room = Math.max(0, inv.softCap - inv.amounts[id]);
    const take = Math.min(want, room);
    if (take > 0) taken[id] = take;
  }
  return taken;
}

/**
 * Move pending resources from a building into city inventory (warehouse stock).
 * Each resource is capped independently at warehouse softCap: only the amount
 * that still fits is taken; leftover stays on the building. Zero warehouses
 * → harvest fails (no warehouse). Already at cap → inventory full.
 */
export function harvestBuilding(
  state: GameState,
  buildingId: string,
): HarvestResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };
  if (isOriginCustom(state, building)) {
    return harvestUnique(state, buildingId);
  }

  const pending = building.pending ?? {};
  if (pendingTotal(pending) === 0) {
    return { ok: false, reason: 'nothing to harvest' };
  }

  if (state.inventory.softCap <= 0) {
    return { ok: false, reason: 'no warehouse' };
  }

  const taken = takeUpToCap(state.inventory, pending);
  if (pendingTotal(taken) === 0) {
    return { ok: false, reason: 'inventory full' };
  }

  add(state.inventory, taken);
  const leftover: Partial<Record<ResourceId, number>> = {};
  for (const id of Object.keys(pending) as ResourceId[]) {
    const remain = (pending[id] ?? 0) - (taken[id] ?? 0);
    if (remain > 0) leftover[id] = remain;
  }
  building.pending = leftover;
  return { ok: true };
}
