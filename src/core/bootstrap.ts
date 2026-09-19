import { placeBuilding, type ContentRegistry } from './buildings';
import { createInventory } from './inventory';
import { Grid, GRID_HEIGHT, GRID_WIDTH } from './grid';
import { refreshInventorySoftCap } from './warehouse';
import type { UpgradesConfig } from './upgrades';
import type { BuildingTypeId, GameState } from './types';
import { saveGame } from './save';
import type { StorageAdapter } from './storage';
import defaultUpgradesJson from '@/data/upgrades.json';

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

export const MAIN_HOUSE_ORIGIN = { x: 23, y: 23 };
export const WAREHOUSE_ORIGIN = { x: 20, y: 23 };

/**
 * New game: main house 3×3 near map center, warehouse 3×3 adjacent on the west.
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
    customBuildings: [],
  };

  const main = placeBuilding(
    state,
    registry,
    'main_house',
    MAIN_HOUSE_ORIGIN,
    () => 'main-1',
    upgrades,
  );
  if (!main.ok) {
    throw new Error(`failed to spawn main house: ${main.reason}`);
  }

  // Main 3×3 at (23,23)–(25,25); warehouse 3×3 at (20,23)–(22,25).
  const wh = placeBuilding(
    state,
    registry,
    'warehouse',
    WAREHOUSE_ORIGIN,
    () => 'warehouse-1',
    upgrades,
    { free: true },
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
    WAREHOUSE_ORIGIN,
    { x: 23, y: 20 },
    { x: 26, y: 23 },
    { x: 23, y: 26 },
    { x: 20, y: 20 },
    { x: 26, y: 20 },
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

export interface NewGameSession {
  state: GameState;
  selected: BuildingTypeId | null;
  selectedBuildingId: string | null;
}

/**
 * Replace the live session and persisted save with a fresh game.
 * In-place (no reload) so a pending autosave cannot resurrect the old save.
 */
export function resetToNewGame(
  session: NewGameSession,
  storage: StorageAdapter,
  registry: ContentRegistry,
  upgrades: UpgradesConfig = defaultUpgrades,
): GameState {
  session.state = createNewGame(registry, upgrades);
  session.selected = null;
  session.selectedBuildingId = null;
  saveGame(session.state, storage);
  return session.state;
}
