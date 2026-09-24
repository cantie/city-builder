import buildingsJson from '@/data/buildings.json';
import recipesJson from '@/data/recipes.json';
import researchJson from '@/data/research.json';
import upgradesJson from '@/data/upgrades.json';
import { loadContentFromData } from '@/core/loadContent';
import type { NewGameSession } from '@/core/bootstrap';
import { deserializeGame } from '@/core/save';
import { tryAdvanceLocalDisplay } from '@/core/displayTick';
import { TICK_INTERVAL_MS } from '@/core/catchUp';
import { GameApi, type ApiResult } from '@/api/client';
import { createGame, type GameContext } from '@/phaser/createGame';
import { Sidebar } from '@/ui/Sidebar';
import type { UpgradesConfig } from '@/core/upgrades';
import type { GameState } from '@/core/types';
import type Phaser from 'phaser';

const registry = loadContentFromData(buildingsJson, recipesJson, researchJson);
const upgrades = upgradesJson as UpgradesConfig;
const api = new GameApi(registry, upgrades);

const session: NewGameSession = {
  state: deserializeGame(
    {
      version: 1,
      tick: 0,
      buildings: [],
      inventory: { softCap: 0, amounts: { food: 0, wood: 0, stone: 0, coin: 0 } },
      unlockedBlueprints: [],
      unlockedRecipes: [],
      completedResearch: [],
      availableResearch: [],
      activeResearch: null,
    },
    registry,
    upgrades,
  )!,
  selected: null,
  selectedBuildingId: null,
};

const threeRoot = document.getElementById('three-root');
if (threeRoot) threeRoot.style.display = 'none';

let game: Phaser.Game | undefined;
let sidebar: Sidebar | undefined;
/** Last tick confirmed by a command/login snapshot — not by local display ticks. */
let lastAuthoritativeTick = 0;

function refreshScene(): void {
  if (!game) return;
  const scene = game.scene.getScene('Game') as Phaser.Scene & {
    redrawBuildings?: () => void;
    refreshHud?: () => void;
  };
  scene.redrawBuildings?.();
  scene.refreshHud?.();
}

function notifyUi(): void {
  sidebar?.refresh();
  refreshScene();
}

async function loadCustomSprites(
  game: Phaser.Game | undefined,
  state: GameState,
): Promise<void> {
  if (!game) return;
  const scene = game.scene.getScene('Game') as Phaser.Scene | undefined;
  if (!scene?.load || !scene.textures) return;
  for (const rec of state.customBuildings ?? []) {
    if (scene.textures.exists(rec.id)) continue;
    const res = await fetch(rec.sprite, { credentials: 'include' });
    if (!res.ok) continue;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      scene.load.once('complete', () => resolve());
      scene.load.image(rec.id, url);
      scene.load.start();
    });
  }
}

async function applyResult(result: ApiResult): Promise<ApiResult> {
  if (result.state) {
    session.state = result.state;
    lastAuthoritativeTick = result.state.tick;
    await loadCustomSprites(game, session.state);
  }
  notifyUi();
  return result;
}

function boot(initial: GameState): void {
  session.state = initial;
  lastAuthoritativeTick = initial.tick;
  session.selected = null;
  session.selectedBuildingId = null;

  const ctx: GameContext = {
    get state() {
      return session.state;
    },
    registry,
    onStateChange: () => notifyUi(),
    getSelectedBlueprint: () => session.selected,
    setSelectedBlueprint: (id) => {
      session.selected = id;
      notifyUi();
    },
    get selectedBuildingId() {
      return session.selectedBuildingId;
    },
    set selectedBuildingId(id: string | null) {
      session.selectedBuildingId = id;
    },
    getSelectedBuildingId: () => session.selectedBuildingId,
    setSelectedBuildingId: (id) => {
      session.selectedBuildingId = id;
      notifyUi();
    },
    submitPlace: async (typeId, origin) =>
      applyResult(await api.place(typeId, origin.x, origin.y)),
    submitMove: async (buildingId, origin) =>
      applyResult(await api.move(buildingId, origin.x, origin.y)),
  };

  game = createGame('phaser-root', ctx);
  void loadCustomSprites(game, session.state);
  sidebar = new Sidebar({
    getState: () => session.state,
    registry,
    upgrades,
    getSelectedBlueprint: () => session.selected,
    setSelectedBlueprint: (id) => {
      session.selected = id;
      notifyUi();
    },
    getSelectedBuildingId: () => session.selectedBuildingId,
    setSelectedBuildingId: (id) => {
      session.selectedBuildingId = id;
      notifyUi();
    },
    commands: {
      harvest: async (id) => applyResult(await api.harvest(id)),
      train: async (id) => applyResult(await api.train(id)),
      research: async (id) => applyResult(await api.research(id)),
      upgrade: async (id) => applyResult(await api.upgrade(id)),
      demolish: async (id) => applyResult(await api.demolish(id)),
      invent: async (prompt, width, height) =>
        applyResult(await api.invent(prompt, width, height)),
      forgetBuilding: async (typeId) =>
        applyResult(await api.forgetBuilding(typeId)),
    },
    onNewGame: () => {
      void api.newGame().then(applyResult);
    },
  });
  sidebar.refresh();

  setInterval(() => {
    tryAdvanceLocalDisplay(session.state, registry, lastAuthoritativeTick);
    sidebar?.refresh();
  }, TICK_INTERVAL_MS);
}

const loginEl = document.getElementById('login')!;
const form = document.getElementById('login-form') as HTMLFormElement;
const nameInput = document.getElementById('player-name') as HTMLInputElement;
const loginError = document.getElementById('login-error')!;
nameInput.value = api.rememberedName();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.textContent = '';
  void api.login(nameInput.value).then((result) => {
    if (!result.ok) {
      loginError.textContent = result.reason;
      return;
    }
    loginEl.hidden = true;
    boot(result.state);
  });
});
