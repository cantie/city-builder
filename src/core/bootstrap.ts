import { placeBuilding, type ContentRegistry } from './buildings';
import { createInventory } from './inventory';
import { Grid, GRID_HEIGHT, GRID_WIDTH } from './grid';
import { refreshInventorySoftCap } from './warehouse';
import type { UpgradesConfig } from './upgrades';
import type { GameState } from './types';
import defaultUpgradesJson from '@/data/upgrades.json';

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

/**
 * New game: main house at (9,9), warehouse adjacent so harvest works out of the box.
 * softCap starts at 0 and is set from the placed warehouse (capacity 100 at level 1).
 */
export function createNewGame(
  registry: ContentRegistry,
  upgrades: UpgradesConfig = defaultUpgrades,
): GameState {
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(0, {
      food: 20,
      wood: 30,
      stone: 20,
      coin: 0,
    }),
    unlockedBlueprints: [
      'main_house',
      'farm',
      'research_institute',
      'warehouse',
    ],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [...registry.research.keys()].filter((id) => {
      const def = registry.research.get(id)!;
      return def.tier === 1;
    }),
    activeResearch: null,
  };

  const main = placeBuilding(
    state,
    registry,
    'main_house',
    { x: 9, y: 9 },
    () => 'main-1',
    upgrades,
  );
  if (!main.ok) {
    throw new Error(`failed to spawn main house: ${main.reason}`);
  }

  // Adjacent to main house 2×2 at (9,9)–(10,10): cell (8,9) is free.
  const wh = placeBuilding(
    state,
    registry,
    'warehouse',
    { x: 8, y: 9 },
    () => 'warehouse-1',
    upgrades,
  );
  if (!wh.ok) {
    throw new Error(`failed to spawn warehouse: ${wh.reason}`);
  }

  refreshInventorySoftCap(state, upgrades);
  return state;
}

/**
 * Older saves lack warehouses. Unlock blueprint and spawn one for free if missing.
 * Returns true if state was mutated.
 */
export function ensureWarehouseMigrated(
  state: GameState,
  registry: ContentRegistry,
  upgrades: UpgradesConfig = defaultUpgrades,
): boolean {
  let changed = false;
  if (!state.unlockedBlueprints.includes('warehouse')) {
    state.unlockedBlueprints.push('warehouse');
    changed = true;
  }
  if (state.buildings.some((b) => b.typeId === 'warehouse')) {
    refreshInventorySoftCap(state, upgrades);
    return changed;
  }

  const preferred = [
    { x: 8, y: 9 },
    { x: 8, y: 8 },
    { x: 8, y: 10 },
    { x: 11, y: 9 },
    { x: 11, y: 8 },
    { x: 7, y: 9 },
  ];
  const scan = Array.from({ length: GRID_HEIGHT * GRID_WIDTH }, (_, i) => ({
    x: i % GRID_WIDTH,
    y: Math.floor(i / GRID_WIDTH),
  }));

  for (const origin of [...preferred, ...scan]) {
    const result = placeBuilding(
      state,
      registry,
      'warehouse',
      origin,
      () => 'warehouse-migrated',
      upgrades,
      { free: true },
    );
    if (result.ok) {
      refreshInventorySoftCap(state, upgrades);
      return true;
    }
  }
  return changed;
}
