import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch, advanceResearch, syncCompletedResearchUnlocks } from '@/core/research';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
  { id: 'wood_farm', label: 'Wood Farm', outputs: { wood: 1 } },
];

const researchDefs: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood Farming',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: ['tier2_market_prep'],
  },
  {
    id: 'tier2_market_prep',
    label: 'Market Prep',
    tier: 2,
    cost: { wood: 10 },
    durationTicks: 5,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
    softCapBonus: 20,
  },
];

function baseState(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, researchDefs);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, { food: 10, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['tier1_wood'],
    activeResearch: null,
  };
  placeBuilding(state, registry, 'research_institute', { x: 0, y: 0 }, () => 'ri-1');
  return { state, registry };
}

describe('research queue', () => {
  it('starts research, spends cost, rejects second start', () => {
    const { state, registry } = baseState();
    const ok = startResearch(state, registry, 'tier1_wood');
    expect(ok).toEqual({ ok: true });
    expect(state.inventory.amounts.food).toBe(5);
    expect(state.activeResearch).toEqual({
      researchId: 'tier1_wood',
      remainingTicks: 3,
    });
    const busy = startResearch(state, registry, 'tier1_wood');
    expect(busy.ok).toBe(false);
  });

  it('completes after durationTicks and unlocks recipes + next nodes', () => {
    const { state, registry } = baseState();
    startResearch(state, registry, 'tier1_wood');
    advanceResearch(state, registry);
    advanceResearch(state, registry);
    expect(state.activeResearch).not.toBeNull();
    advanceResearch(state, registry);
    expect(state.activeResearch).toBeNull();
    expect(state.completedResearch).toContain('tier1_wood');
    expect(state.unlockedRecipes).toContain('wood_farm');
    expect(state.availableResearch).toContain('tier2_market_prep');
  });

  it('rejects start when no research institute is built', () => {
    const { state, registry } = baseState();
    state.buildings = state.buildings.filter(
      (b) => b.typeId !== 'research_institute',
    );
    const result = startResearch(state, registry, 'tier1_wood');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/institute/i);
    expect(state.activeResearch).toBeNull();
    expect(state.inventory.amounts.food).toBe(10);
  });

  it('syncCompletedResearchUnlocks grants missing unlocks from finished nodes', () => {
    const { state, registry } = baseState();
    state.completedResearch = ['tier1_wood'];
    state.unlockedRecipes = ['basic_food'];
    const changed = syncCompletedResearchUnlocks(state, registry);
    expect(changed).toBe(true);
    expect(state.unlockedRecipes).toContain('wood_farm');
  });

  it('does not apply softCapBonus (capacity is warehouse-driven)', () => {
    const { state, registry } = baseState();
    state.inventory.amounts.food = 0;
    state.inventory.amounts.wood = 10;
    state.availableResearch = ['tier2_market_prep'];
    const cap = state.inventory.softCap;
    startResearch(state, registry, 'tier2_market_prep');
    for (let i = 0; i < 5; i++) advanceResearch(state, registry);
    expect(state.inventory.softCap).toBe(cap);
  });
});
