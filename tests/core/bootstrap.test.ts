import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createNewGame, ensureStartingCoin, resetToNewGame } from '@/core/bootstrap';
import {
  MemoryStorage,
  loadGame,
  saveGame,
} from '@/core/save';
import type { BuildingDef, RecipeDef, ResearchDef } from '@/core/types';
import upgradesJson from '@/data/upgrades.json';
import type { UpgradesConfig } from '@/core/upgrades';

const upgrades = upgradesJson as UpgradesConfig;

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
    id: 'farm',
    label: 'Farm',
    footprint: { width: 2, height: 2 },
    demolishable: true,
    cost: { wood: 5, food: 2 },
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 3, height: 3 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    footprint: { width: 3, height: 3 },
    demolishable: true,
    cost: { wood: 8, stone: 5 },
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: [],
  },
];

describe('createNewGame', () => {
  it('pre-spawns main house, adjacent warehouse, and starting kit', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state = createNewGame(registry, upgrades);
    expect(state.buildings.some((b) => b.typeId === 'main_house')).toBe(true);
    expect(state.buildings.some((b) => b.typeId === 'warehouse')).toBe(true);
    expect(state.grid.getOccupant({ x: 23, y: 23 })).toBe('main-1');
    expect(state.grid.getOccupant({ x: 25, y: 25 })).toBe('main-1');
    expect(state.grid.getOccupant({ x: 20, y: 23 })).toBe('warehouse-1');
    expect(state.grid.getOccupant({ x: 22, y: 25 })).toBe('warehouse-1');
    expect(state.inventory.softCap).toBe(100);
    expect(state.inventory.amounts.coin).toBe(100);
    expect(state.inventory.amounts.food).toBeGreaterThanOrEqual(10);
    expect(state.unlockedBlueprints).toEqual(
      expect.arrayContaining([
        'main_house',
        'farm',
        'research_institute',
        'warehouse',
      ]),
    );
    expect(state.availableResearch).toContain('tier1_wood');
    const main = state.buildings.find((b) => b.typeId === 'main_house')!;
    expect(main.level).toBe(1);
  });
});

describe('ensureStartingCoin', () => {
  it('grants 100 coin only when the save still has none', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const empty = createNewGame(registry, upgrades);
    empty.inventory.amounts.coin = 0;
    expect(ensureStartingCoin(empty)).toBe(true);
    expect(empty.inventory.amounts.coin).toBe(100);
    expect(ensureStartingCoin(empty)).toBe(false);
    expect(empty.inventory.amounts.coin).toBe(100);
    empty.inventory.amounts.coin = 15;
    expect(ensureStartingCoin(empty)).toBe(false);
    expect(empty.inventory.amounts.coin).toBe(15);
  });
});

describe('resetToNewGame', () => {
  it('replaces a played session and save with a fresh game', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const storage = new MemoryStorage();
    const played = createNewGame(registry, upgrades);
    played.tick = 42;
    played.inventory.amounts.food = 999;
    saveGame(played, storage);

    const session = {
      state: played,
      selected: 'farm' as const,
      selectedBuildingId: 'farm-1',
    };

    resetToNewGame(session, storage, registry, upgrades);

    expect(session.state).not.toBe(played);
    expect(session.state.tick).toBe(0);
    expect(session.state.inventory.amounts.food).not.toBe(999);
    expect(session.selected).toBeNull();
    expect(session.selectedBuildingId).toBeNull();

    const loaded = loadGame(storage, registry, upgrades)!;
    expect(loaded.tick).toBe(0);
    expect(loaded.inventory.amounts.food).not.toBe(999);
  });
});
