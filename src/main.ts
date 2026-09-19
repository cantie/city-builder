import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import { createGame } from '@/phaser/createGame';
import { BuildingRenderer } from '@/three/BuildingRenderer';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';
import type {
  BuildingDef,
  BuildingTypeId,
  RecipeDef,
  ResearchDef,
} from '@/core/types';
import type Phaser from 'phaser';

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

const canvas = document.getElementById('three-root') as HTMLCanvasElement;
const buildings3d = new BuildingRenderer(canvas);
buildings3d.setSize(640, 640);
buildings3d.sync(state.buildings, registry);

const game = createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => buildings3d.sync(state.buildings, registry),
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});

function frame() {
  const scene = game.scene.getScene('Game') as Phaser.Scene | null;
  if (scene?.cameras?.main) {
    const cam = scene.cameras.main;
    syncThreeCameraFromPhaser(
      {
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
        width: cam.width,
        height: cam.height,
      },
      buildings3d.getCamera(),
    );
  }
  buildings3d.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
