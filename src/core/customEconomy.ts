import { parseCustomSlot } from './customIds';
import { trySpend } from './inventory';
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

export function addArmy(state: GameState, unitId: string, n: number): void {
  if (!state.army) state.army = {};
  state.army[unitId] = (state.army[unitId] ?? 0) + n;
}

export function trainAtOrigin(
  state: GameState,
  buildingId: string,
): { ok: true } | { ok: false; reason: string } {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };
  const rec = (state.customBuildings ?? []).find((c) => c.id === building.typeId);
  if (!rec) return { ok: false, reason: 'need origin' };
  pullUniqueToStock(building, TRAIN_UNIQUE_COST);
  if ((building.exportStock ?? 0) < TRAIN_UNIQUE_COST) {
    return { ok: false, reason: 'out of stock' };
  }
  if (!trySpend(state.inventory, { food: TRAIN_FOOD_COST })) {
    return { ok: false, reason: 'cannot afford' };
  }
  building.exportStock = (building.exportStock ?? 0) - TRAIN_UNIQUE_COST;
  addArmy(state, rec.unitId, 1);
  return { ok: true };
}

export function spendSellerForReplica(
  seller: GameState,
  slot: string,
  uniqueNeed: number,
): { ok: true; exportPrice: number } | { ok: false; reason: string } {
  const rec = (seller.customBuildings ?? []).find((c) => c.id === slot);
  if (!rec) return { ok: false, reason: 'abandoned' };
  if (!rec.exportEnabled) return { ok: false, reason: 'export disabled' };
  const origins = seller.buildings.filter((b) => b.typeId === slot);
  if (origins.length === 0) return { ok: false, reason: 'need origin' };
  let available = 0;
  for (const o of origins) {
    available += (o.exportStock ?? 0) + (o.uniquePending ?? 0);
  }
  if (available < uniqueNeed) return { ok: false, reason: 'out of stock' };
  let remaining = uniqueNeed;
  for (const o of origins) {
    pullUniqueToStock(o, remaining);
    const have = o.exportStock ?? 0;
    const take = Math.min(have, remaining);
    o.exportStock = have - take;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return { ok: true, exportPrice: rec.exportPrice };
}
