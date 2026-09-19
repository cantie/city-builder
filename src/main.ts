import buildingsJson from '@/data/buildings.json';
import recipesJson from '@/data/recipes.json';
import researchJson from '@/data/research.json';
import { loadContentFromData } from '@/core/loadContent';
import { createNewGame } from '@/core/bootstrap';
import { advanceTick } from '@/core/tick';
import {
  LocalStorageAdapter,
  loadGame,
  saveGame,
  SAVE_KEY,
} from '@/core/save';
import { createGame } from '@/phaser/createGame';
import { BuildingRenderer } from '@/three/BuildingRenderer';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';
import type { BuildingTypeId } from '@/core/types';
import type Phaser from 'phaser';

const registry = loadContentFromData(buildingsJson, recipesJson, researchJson);
const storage = new LocalStorageAdapter();
const hadSave = storage.getItem(SAVE_KEY) != null;
let state = loadGame(storage, registry);
if (!state) {
  if (hadSave) {
    console.warn('Corrupt save — starting new game');
  }
  state = createNewGame(registry);
}

let selected: BuildingTypeId | null = 'farm';

const canvas = document.getElementById('three-root') as HTMLCanvasElement;
const buildings3d = new BuildingRenderer(canvas);
buildings3d.setSize(640, 640);
buildings3d.sync(state.buildings, registry);

const game = createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => {
    buildings3d.sync(state.buildings, registry);
    saveGame(state, storage);
  },
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});

setInterval(() => {
  advanceTick(state, registry);
  saveGame(state, storage);
  buildings3d.sync(state.buildings, registry);
  const scene = game.scene.getScene('Game') as Phaser.Scene & {
    refreshHud?: () => void;
  };
  scene.refreshHud?.();
}, 1000);

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
