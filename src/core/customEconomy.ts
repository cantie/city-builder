import { parseCustomSlot } from './customIds';
import type { BuildingInstance, GameState } from './types';

export const UNIQUE_PENDING_CAP = 50;
export const UNIQUE_STOCK_CAP = 50;
export const UNIQUE_PER_TICK = 1;
export const TRAIN_UNIQUE_COST = 5;
export const TRAIN_FOOD_COST = 2;

export function isOriginCustom(
  state: GameState,
  building: BuildingInstance,
): boolean {
  if (!parseCustomSlot(String(building.typeId))) return false;
  return (state.customBuildings ?? []).some((c) => c.id === building.typeId);
}

export function produceCustomOrigins(state: GameState): void {
  for (const b of state.buildings) {
    if (!isOriginCustom(state, b)) continue;
    const next = (b.uniquePending ?? 0) + UNIQUE_PER_TICK;
    b.uniquePending = Math.min(UNIQUE_PENDING_CAP, next);
  }
}

export function pullUniqueToStock(building: BuildingInstance, need: number): void {
  if (need <= 0) return;
  const pending = building.uniquePending ?? 0;
  const stock = building.exportStock ?? 0;
  const room = Math.max(0, UNIQUE_STOCK_CAP - stock);
  const move = Math.min(need, pending, room);
  if (move <= 0) return;
  building.uniquePending = pending - move;
  building.exportStock = stock + move;
}

export function harvestUnique(
  state: GameState,
  buildingId: string,
): { ok: true } | { ok: false; reason: string } {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };
  if (!isOriginCustom(state, building)) {
    return { ok: false, reason: 'need origin' };
  }
  const pending = building.uniquePending ?? 0;
  if (pending <= 0) return { ok: false, reason: 'nothing to harvest' };
  const stock = building.exportStock ?? 0;
  const room = Math.max(0, UNIQUE_STOCK_CAP - stock);
  if (room <= 0) return { ok: false, reason: 'stock full' };
  const take = Math.min(pending, room);
  building.uniquePending = pending - take;
  building.exportStock = stock + take;
  return { ok: true };
}
