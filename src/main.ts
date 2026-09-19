import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import { createGame } from '@/phaser/createGame';
import type {
  BuildingDef,
  BuildingTypeId,
  RecipeDef,
  ResearchDef,
} from '@/core/types';

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
    cost: { wood: 5, food: 2 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'Research Institute',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
];

const research: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood Farming',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: ['tier2_stone'],
  },
];

const registry = createRegistry(buildings, recipes, research);
const state = createNewGame(registry);
let selected: BuildingTypeId | null = 'farm';

createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => {},
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});
