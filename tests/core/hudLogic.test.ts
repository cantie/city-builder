import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry } from '@/core/buildings';
import {
  unlockedBuildOptions,
  researchStartDisabledReason,
  nextSidebarPanel,
} from '@/phaser/hud/hudLogic';
import type { BuildingDef, GameState, ResearchDef } from '@/core/types';

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
    cost: { wood: 5 },
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8 },
    meshColor: 1,
    meshHeight: 1,
  },
];

const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 50 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

function state(): GameState {
  return {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, { food: 0, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['r1'],
    activeResearch: null,
  };
}

describe('hudLogic', () => {
  it('lists only unlocked placeable blueprints (no main house)', () => {
    const registry = createRegistry(buildings, [], researchDefs);
    const s = state();
    s.unlockedBlueprints = ['main_house', 'farm'];
    const opts = unlockedBuildOptions(s, registry);
    expect(opts.map((o) => o.id)).toEqual(['farm']);
  });

  it('disables research start without a research institute', () => {
    const registry = createRegistry(buildings, [], researchDefs);
    const s = state();
    s.inventory.amounts.food = 50;
    expect(researchStartDisabledReason(s, registry, 'r1')).toMatch(/institute/i);
  });

  it('disables research start when cannot afford or queue busy', () => {
    const registry = createRegistry(buildings, [], researchDefs);
    const s = state();
    s.buildings = [
      {
        id: 'ri-1',
        typeId: 'research_institute',
        origin: { x: 0, y: 0 },
        level: 1,
      },
    ];
    expect(researchStartDisabledReason(s, registry, 'r1')).toMatch(/afford/i);
    s.inventory.amounts.food = 50;
    s.activeResearch = { researchId: 'r1', remainingTicks: 1 };
    expect(researchStartDisabledReason(s, registry, 'r1')).toMatch(/busy/i);
  });

  it('keeps sidebar panels exclusive and follows selection', () => {
    expect(
      nextSidebarPanel({
        current: 'inspect',
        action: 'toggle-build',
        selectedTypeId: null,
      }),
    ).toBe('build');
    expect(
      nextSidebarPanel({
        current: 'build',
        action: 'toggle-build',
        selectedTypeId: null,
      }),
    ).toBe('inspect');
    expect(
      nextSidebarPanel({
        current: 'build',
        action: 'toggle-research',
        selectedTypeId: null,
      }),
    ).toBe('research');
    expect(
      nextSidebarPanel({
        current: 'build',
        action: 'sync-selection',
        selectedTypeId: 'research_institute',
      }),
    ).toBe('research');
    expect(
      nextSidebarPanel({
        current: 'research',
        action: 'sync-selection',
        selectedTypeId: 'farm',
      }),
    ).toBe('inspect');
    expect(
      nextSidebarPanel({
        current: 'build',
        action: 'sync-selection',
        selectedTypeId: null,
      }),
    ).toBe('build');
  });
});
