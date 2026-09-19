import { add, canAdd } from './inventory';
import type { ContentRegistry } from './registry';
import type { GameState, ResourceId } from './types';

/** Soft-cap on total pending resources per building (skip tick if exceeded). */
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

/**
 * Move all pending resources from a building into city inventory.
 * Clears pending only on success. If inventory cannot accept the full
 * pending transfer, fails with reason and leaves pending unchanged.
 */
export function harvestBuilding(
  state: GameState,
  buildingId: string,
): HarvestResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };

  const pending = building.pending ?? {};
  if (pendingTotal(pending) === 0) {
    return { ok: false, reason: 'nothing to harvest' };
  }

  if (!canAdd(state.inventory, pending)) {
    return { ok: false, reason: 'inventory full' };
  }

  add(state.inventory, pending);
  building.pending = {};
  return { ok: true };
}
