import { placeBuilding, type ContentRegistry } from './buildings';
import { createInventory } from './inventory';
import { Grid } from './grid';
import type { GameState } from './types';

export function createNewGame(registry: ContentRegistry): GameState {
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, {
      food: 20,
      wood: 30,
      stone: 20,
      coin: 0,
    }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [...registry.research.keys()].filter((id) => {
      const def = registry.research.get(id)!;
      return def.tier === 1;
    }),
    activeResearch: null,
  };

  const result = placeBuilding(
    state,
    registry,
    'main_house',
    { x: 9, y: 9 },
    () => 'main-1',
  );
  if (!result.ok) {
    throw new Error(`failed to spawn main house: ${result.reason}`);
  }
  return state;
}
