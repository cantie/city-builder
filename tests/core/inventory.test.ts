import { describe, it, expect } from 'vitest';
import { createInventory, totalAmount, canAdd, add, trySpend } from '@/core/inventory';

describe('inventory', () => {
  it('starts with coin 0 and given soft cap', () => {
    const inv = createInventory(100, { food: 10, wood: 5, stone: 2 });
    expect(inv.softCap).toBe(100);
    expect(inv.amounts.coin).toBe(0);
    expect(inv.amounts.food).toBe(10);
    expect(totalAmount(inv)).toBe(17);
  });

  it('canAdd is false when one resource would exceed its own cap', () => {
    const inv = createInventory(10, { food: 8, wood: 10 });
    expect(canAdd(inv, { food: 3 })).toBe(false);
    expect(canAdd(inv, { food: 2 })).toBe(true);
    expect(canAdd(inv, { wood: 1 })).toBe(false);
  });

  it('canAdd allows another resource when one type is already at cap', () => {
    const inv = createInventory(5, { food: 5 });
    expect(canAdd(inv, { wood: 1 })).toBe(true);
  });

  it('add skips (returns false, no mutation) when that resource is full', () => {
    const inv = createInventory(5, { food: 5 });
    expect(add(inv, { food: 1 })).toBe(false);
    expect(inv.amounts.food).toBe(5);
    expect(add(inv, { wood: 1 })).toBe(true);
    expect(inv.amounts.wood).toBe(1);
  });

  it('add mutates when under cap', () => {
    const inv = createInventory(10, { food: 1 });
    expect(add(inv, { food: 2, wood: 1 })).toBe(true);
    expect(inv.amounts.food).toBe(3);
    expect(inv.amounts.wood).toBe(1);
  });

  it('trySpend deducts only when all costs affordable', () => {
    const inv = createInventory(100, { food: 5, wood: 1 });
    expect(trySpend(inv, { food: 6 })).toBe(false);
    expect(inv.amounts.food).toBe(5);
    expect(trySpend(inv, { food: 3, wood: 1 })).toBe(true);
    expect(inv.amounts.food).toBe(2);
    expect(inv.amounts.wood).toBe(0);
  });
});
