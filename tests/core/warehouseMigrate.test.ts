import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createInventory } from '@/core/inventory';
import { Grid } from '@/core/grid';
import { ensureWarehouseMigrated } from '@/core/bootstrap';
import type { BuildingDef, GameState } from '@/core/types';
import type { UpgradesConfig } from '@/core/upgrades';
import upgradesJson from '@/data/upgrades.json';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 3, height: 3 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'warehouse',
    label: 'WH',
    footprint: { width: 3, height: 3 },
    demolishable: true,
    cost: { wood: 5 },
    meshColor: 1,
    meshHeight: 1,
  },
];

describe('ensureWarehouseMigrated', () => {
  it('spawns a free warehouse on old saves without one', () => {
    const registry = createRegistry(buildings, [], []);
    const upgrades = upgradesJson as UpgradesConfig;
    const state: GameState = {
      tick: 3,
      grid: new Grid(),
      buildings: [],
      inventory: createInventory(50, { food: 5, wood: 5, stone: 0, coin: 0 }),
      unlockedBlueprints: ['main_house', 'farm'],
      unlockedRecipes: ['basic_food'],
      completedResearch: [],
      availableResearch: [],
      activeResearch: null,
    };
    // place main only via occupy manually
    state.grid.occupy('main-1', { x: 9, y: 9 }, { width: 3, height: 3 });
    state.buildings.push({
      id: 'main-1',
      typeId: 'main_house',
      origin: { x: 9, y: 9 },
      level: 1,
    });

    const changed = ensureWarehouseMigrated(state, registry, upgrades);
    expect(changed).toBe(true);
    expect(state.buildings.some((b) => b.typeId === 'warehouse')).toBe(true);
    expect(state.unlockedBlueprints).toContain('warehouse');
    expect(state.inventory.softCap).toBeGreaterThan(0);
    expect(state.inventory.amounts.wood).toBe(5); // free spawn did not spend
  });
});
