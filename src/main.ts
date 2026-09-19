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
import { createGame, type GameContext } from '@/phaser/createGame';
import { Sidebar } from '@/ui/Sidebar';
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

let selected: BuildingTypeId | null = null;
let selectedBuildingId: string | null = null;

// 2.5D Phaser sprites own rendering — hide unused Three canvas (meshes off).
const threeRoot = document.getElementById('three-root');
if (threeRoot) {
  threeRoot.style.display = 'none';
}

function refreshScene(): void {
  const scene = game.scene.getScene('Game') as Phaser.Scene & {
    redrawBuildings?: () => void;
    refreshHud?: () => void;
  };
  scene.redrawBuildings?.();
  scene.refreshHud?.();
}

function notifyUi(): void {
  sidebar.refresh();
  refreshScene();
}

const ctx: GameContext = {
  state,
  registry,
  onStateChange: () => {
    saveGame(state, storage);
    notifyUi();
  },
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
    notifyUi();
  },
  get selectedBuildingId() {
    return selectedBuildingId;
  },
  set selectedBuildingId(id: string | null) {
    selectedBuildingId = id;
  },
  getSelectedBuildingId: () => selectedBuildingId,
  setSelectedBuildingId: (id) => {
    selectedBuildingId = id;
    notifyUi();
  },
};

const game = createGame('phaser-root', ctx);

const sidebar = new Sidebar({
  getState: () => state,
  registry,
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
    notifyUi();
  },
  getSelectedBuildingId: () => selectedBuildingId,
  setSelectedBuildingId: (id) => {
    selectedBuildingId = id;
    notifyUi();
  },
  onStateChange: () => {
    saveGame(state, storage);
    notifyUi();
  },
});

sidebar.refresh();

setInterval(() => {
  advanceTick(state, registry);
  saveGame(state, storage);
  notifyUi();
}, 1000);
