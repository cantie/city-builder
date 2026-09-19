import { placeBuilding, type ContentRegistry } from './buildings';
import { createInventory } from './inventory';
import { Grid } from './grid';
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
