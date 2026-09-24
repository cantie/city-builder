import type { InventoryState, ResourceId } from './types';

const ZERO: Record<ResourceId, number> = {
  food: 0,
  wood: 0,
  stone: 0,
  coin: 0,
};

export function createInventory(
  softCap: number,
  amounts: Partial<Record<ResourceId, number>> = {},
): InventoryState {
  return {
    softCap,
    amounts: { ...ZERO, ...amounts, coin: amounts.coin ?? 0 },
  };
}

export function totalAmount(inv: InventoryState): number {
  return (Object.keys(ZERO) as ResourceId[]).reduce(
    (sum, id) => sum + inv.amounts[id],
    0,
  );
}

export function canAdd(
  inv: InventoryState,
  delta: Partial<Record<ResourceId, number>>,
): boolean {
  for (const id of Object.keys(delta) as ResourceId[]) {
    const extra = delta[id] ?? 0;
    if (extra < 0) return false;
    if (inv.amounts[id] + extra > inv.softCap) return false;
  }
  return true;
}

export function add(
  inv: InventoryState,
  delta: Partial<Record<ResourceId, number>>,
): boolean {
  if (!canAdd(inv, delta)) return false;
  for (const id of Object.keys(delta) as ResourceId[]) {
    inv.amounts[id] += delta[id] ?? 0;
  }
  return true;
}

export function trySpend(
  inv: InventoryState,
  cost: Partial<Record<ResourceId, number>>,
): boolean {
  for (const id of Object.keys(cost) as ResourceId[]) {
    if (inv.amounts[id] < (cost[id] ?? 0)) return false;
  }
  for (const id of Object.keys(cost) as ResourceId[]) {
    inv.amounts[id] -= cost[id] ?? 0;
  }
  return true;
}
