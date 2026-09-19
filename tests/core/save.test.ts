import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch } from '@/core/research';
import { advanceTick } from '@/core/tick';
import {
  MemoryStorage,
  serializeGame,
  deserializeGame,
  saveGame,
  loadGame,
  SAVE_KEY,
} from '@/core/save';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

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
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 0 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

function sampleState(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, researchDefs);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(40, { food: 3, wood: 4, stone: 1, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['r1'],
    activeResearch: null,
  };
  placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  placeBuilding(state, registry, 'farm', { x: 1, y: 1 }, () => 'farm-1');
  startResearch(state, registry, 'r1');
  advanceTick(state, registry);
  return { state, registry };
}

describe('save/load', () => {
  it('round-trips serialize/deserialize', () => {
    const { state, registry } = sampleState();
    const raw = serializeGame(state);
    const loaded = deserializeGame(raw, registry);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(state.tick);
    expect(loaded!.buildings).toEqual(state.buildings);
    expect(loaded!.inventory).toEqual(state.inventory);
    expect(loaded!.activeResearch).toEqual(state.activeResearch);
    expect(loaded!.grid.getOccupant({ x: 9, y: 9 })).toBe('main-1');
    expect(loaded!.grid.getOccupant({ x: 1, y: 1 })).toBe('farm-1');
  });

  it('MemoryStorage saveGame/loadGame round-trip', () => {
    const { state, registry } = sampleState();
    const storage = new MemoryStorage();
    saveGame(state, storage);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = loadGame(storage, registry);
    expect(loaded?.buildings.map((b) => b.id).sort()).toEqual(
      state.buildings.map((b) => b.id).sort(),
    );
  });

  it('corrupt payload returns null', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    expect(deserializeGame(null, registry)).toBeNull();
    expect(deserializeGame({ version: 99 }, registry)).toBeNull();
    expect(deserializeGame('{not-json', registry)).toBeNull();
  });
});
