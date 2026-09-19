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

// 2.5D Phaser sprites own rendering — hide unused Three canvas (meshes off).
const threeRoot = document.getElementById('three-root');
if (threeRoot) {
  threeRoot.style.display = 'none';
}

const game = createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => {
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
  const scene = game.scene.getScene('Game') as Phaser.Scene & {
    refreshHud?: () => void;
  };
  scene.refreshHud?.();
}, 1000);
