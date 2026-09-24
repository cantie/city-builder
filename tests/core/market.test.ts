import { describe, it, expect } from 'vitest';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { applyInventedBuilding } from '@/core/customBuilding';
import { applyBuy, validateList, type MarketListing } from '@/core/market';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import type { BuildingDef, GameState } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];

function inventorState(): GameState {
  const registry = createRegistry(buildings, [], []);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(200, { food: 0, wood: 30, stone: 20, coin: 0 }),
    unlockedBlueprints: ['main_house'],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
    customBuildings: [],
    army: {},
    licenses: [],
  };
  applyInventedBuilding(state, registry, {
    id: 'custom-1',
    prompt: 'crystal bakery',
    footprint: { width: 3, height: 3 },
    sprite: '/api/sprites/custom-1',
    owner: 'ada',
  });
  placeBuilding(state, registry, 'custom-1', { x: 0, y: 0 }, () => 'c-1');
  return state;
}

function buyerState(): GameState {
  return {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(200, { food: 0, wood: 30, stone: 20, coin: 20 }),
    unlockedBlueprints: ['main_house'],
    unlockedRecipes: [],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
    customBuildings: [],
    army: {},
    licenses: [],
  };
}

describe('validateList', () => {
  it('rejects listing price outside 10–200 and own missing origin', () => {
    const state = inventorState();
    expect(validateList(state, 'custom-1', 5).ok).toBe(false);
    expect(validateList(state, 'custom-1', 20).ok).toBe(true);
    state.buildings = state.buildings.filter((b) => b.typeId !== 'custom-1');
    expect(validateList(state, 'custom-1', 20).ok).toBe(false);
  });
});

describe('applyBuy', () => {
  it('buy spends coin and adds a license, not an origin slot', () => {
    const listing: MarketListing = {
      typeId: 'custom-ada-1',
      owner: 'ada',
      slot: 'custom-1',
      price: 20,
      listedAt: 1,
      label: 'Crystal Bakery',
      resourceLabel: 'Crystal Ore',
      unitLabel: 'Crystal Troop',
      sprite: '/api/market/sprites/custom-ada-1',
    };
    const buyer = buyerState();
    expect(applyBuy(buyer, listing, 'bob').ok).toBe(true);
    expect(buyer.licenses?.[0]?.typeId).toBe('custom-ada-1');
    expect(buyer.customBuildings ?? []).toHaveLength(0);
    expect(buyer.unlockedBlueprints).toContain('custom-ada-1');
    expect(buyer.inventory.amounts.coin).toBe(0);

    const again = applyBuy(buyer, listing, 'bob');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('already licensed');

    const own = applyBuy(buyerState(), listing, 'ada');
    expect(own.ok).toBe(false);
    if (!own.ok) expect(own.reason).toBe('own listing');
  });
});
