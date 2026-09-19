import { demolishBuilding } from '@/core/buildings';
import { harvestBuilding } from '@/core/farm';
import { startResearch } from '@/core/research';
import {
  getUpgradeDef,
  upgradeBuilding,
  upgradeDisabledReason,
  type UpgradesConfig,
} from '@/core/upgrades';
import {
  researchStartDisabledReason,
  unlockedBuildOptions,
} from '@/phaser/hud/hudLogic';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingTypeId, GameState, ResourceId } from '@/core/types';
import defaultUpgradesJson from '@/data/upgrades.json';

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

export interface SidebarDeps {
  getState: () => GameState;
  registry: ContentRegistry;
  upgrades?: UpgradesConfig;
  getSelectedBlueprint: () => BuildingTypeId | null;
  setSelectedBlueprint: (id: BuildingTypeId | null) => void;
  getSelectedBuildingId: () => string | null;
  setSelectedBuildingId: (id: string | null) => void;
  onStateChange: () => void;
  /** Optional toast / status line under sections. */
  setStatus?: (msg: string) => void;
}

function formatCost(cost: Partial<Record<ResourceId, number>>): string {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
}

function formatOutputs(outputs: Partial<Record<ResourceId, number>>): string {
  return Object.entries(outputs)
    .map(([k, v]) => `+${v} ${k}/tick`)
    .join(', ');
}

export class Sidebar {
  private resourcesBody: HTMLElement;
  private buildBody: HTMLElement;
  private researchBody: HTMLElement;
  private selectionBody: HTMLElement;
  private cancelBuildBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private upgrades: UpgradesConfig;

  constructor(private deps: SidebarDeps) {
    this.upgrades = deps.upgrades ?? defaultUpgrades;
    this.resourcesBody = document.getElementById('resources-body')!;
    this.buildBody = document.getElementById('build-body')!;
    this.researchBody = document.getElementById('research-body')!;
    this.selectionBody = document.getElementById('selection-body')!;
    this.cancelBuildBtn = document.getElementById(
      'cancel-build',
    ) as HTMLButtonElement;
    this.statusEl = document.getElementById('sidebar-status')!;

    this.cancelBuildBtn.addEventListener('click', () => {
      this.deps.setSelectedBlueprint(null);
      this.refresh();
    });
  }

  flashStatus(msg: string): void {
    this.statusEl.textContent = msg;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      this.statusEl.textContent = '';
      this.statusTimer = null;
    }, 1200);
    this.deps.setStatus?.(msg);
  }

  refresh(): void {
    const state = this.deps.getState();
    this.renderResources(state);
    this.renderBuild(state);
    this.renderResearch(state);
    this.renderSelection(state);
  }

  private renderResources(state: GameState): void {
    const a = state.inventory.amounts;
    const cap = state.inventory.softCap;
    const capNote =
      cap <= 0
        ? 'Warehouse cap 0 — place a warehouse to store harvests'
        : `Warehouse cap ${cap}`;
    this.resourcesBody.innerHTML = `
      <div>Food <strong>${a.food}</strong></div>
      <div>Wood <strong>${a.wood}</strong></div>
      <div>Stone <strong>${a.stone}</strong></div>
      <div>Coin <strong>${a.coin}</strong></div>
      <div class="muted" style="margin-top:6px">Tick ${state.tick} · ${capNote}</div>
    `;
  }

  private renderBuild(state: GameState): void {
    const selected = this.deps.getSelectedBlueprint();
    this.cancelBuildBtn.hidden = selected == null;
    this.buildBody.replaceChildren();

    const opts = unlockedBuildOptions(state, this.deps.registry);
    if (opts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No blueprints unlocked';
      this.buildBody.appendChild(empty);
      return;
    }

    for (const def of opts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const cost = formatCost(def.cost);
      btn.textContent = cost ? `${def.label} (${cost})` : def.label;
      if (selected === def.id) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (this.deps.getSelectedBlueprint() === def.id) {
          this.deps.setSelectedBlueprint(null);
        } else {
          this.deps.setSelectedBlueprint(def.id as BuildingTypeId);
          this.deps.setSelectedBuildingId(null);
        }
        this.refresh();
      });
      this.buildBody.appendChild(btn);
    }
  }

  private renderResearch(state: GameState): void {
    this.researchBody.replaceChildren();

    const active = state.activeResearch;
    if (active) {
      const line = document.createElement('div');
      const def = this.deps.registry.research.get(active.researchId);
      line.textContent = `In progress: ${def?.label ?? active.researchId} (${active.remainingTicks} ticks)`;
      this.researchBody.appendChild(line);
    }

    if (state.availableResearch.length === 0 && !active) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Nothing available';
      this.researchBody.appendChild(empty);
      return;
    }

    for (const id of state.availableResearch) {
      const def = this.deps.registry.research.get(id);
      if (!def) continue;
      const reason = researchStartDisabledReason(
        state,
        this.deps.registry,
        id,
      );
      const cost = formatCost(def.cost);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.disabled = !!reason;
      btn.textContent = reason
        ? `${def.label} — ${reason}`
        : `${def.label} [${cost}] ${def.durationTicks}t`;
      if (!reason) {
        btn.addEventListener('click', () => {
          const result = startResearch(state, this.deps.registry, id);
          if (!result.ok) {
            this.flashStatus(result.reason);
            return;
          }
          this.deps.onStateChange();
          this.refresh();
        });
      }
      this.researchBody.appendChild(btn);
    }
  }

  private renderSelection(state: GameState): void {
    const id = this.deps.getSelectedBuildingId();
    this.selectionBody.replaceChildren();

    if (!id) {
      this.selectionBody.className = 'muted';
      this.selectionBody.textContent = 'Click a building on the map';
      return;
    }

    const building = state.buildings.find((b) => b.id === id);
    if (!building) {
      this.deps.setSelectedBuildingId(null);
      this.selectionBody.className = 'muted';
      this.selectionBody.textContent = 'Click a building on the map';
      return;
    }

    const def = this.deps.registry.buildings.get(building.typeId);
    if (!def) {
      this.selectionBody.className = 'muted';
      this.selectionBody.textContent = 'Unknown building';
      return;
    }

    this.selectionBody.className = '';
    const level = building.level ?? 1;
    const parts: string[] = [];
    parts.push(`<div><strong>${def.label}</strong> · Lv ${level}</div>`);
    parts.push(`<div class="muted">type: ${building.typeId}</div>`);
    parts.push(
      `<div class="muted">origin: (${building.origin.x}, ${building.origin.y})</div>`,
    );
    parts.push(
      `<div class="muted">footprint: ${def.footprint.width}×${def.footprint.height}</div>`,
    );

    if (building.typeId === 'warehouse') {
      const cap = building.capacity ?? 100;
      parts.push(
        `<div style="margin-top:6px">Capacity: <strong>${cap}</strong></div>`,
      );
    }

    if (building.recipeId) {
      const recipe = this.deps.registry.recipes.get(building.recipeId);
      if (recipe) {
        parts.push(
          `<div style="margin-top:6px">Recipe: ${recipe.label}</div>`,
        );
        parts.push(
          `<div class="muted">${formatOutputs(recipe.outputs)}</div>`,
        );
      } else {
        parts.push(
          `<div style="margin-top:6px" class="muted">Recipe: ${building.recipeId}</div>`,
        );
      }

      const pending = building.pending ?? {};
      const pendingEntries = Object.entries(pending).filter(
        ([, v]) => (v ?? 0) > 0,
      );
      if (pendingEntries.length > 0) {
        const pendingText = pendingEntries
          .map(([k, v]) => `${v} ${k}`)
          .join(', ');
        parts.push(
          `<div style="margin-top:6px">Pending: <strong>${pendingText}</strong></div>`,
        );
      } else {
        parts.push(
          `<div style="margin-top:6px" class="muted">Pending: empty</div>`,
        );
      }
    }

    if (building.typeId === 'main_house') {
      parts.push(
        `<div style="margin-top:8px" class="muted">City HQ — cannot demolish. Other buildings cannot exceed this level.</div>`,
      );
    }

    this.selectionBody.innerHTML = parts.join('');

    // Upgrade button when next level exists in config
    const nextLevel = level + 1;
    const upgradeDef = getUpgradeDef(this.upgrades, building.typeId, nextLevel);
    if (upgradeDef) {
      const reason = upgradeDisabledReason(
        state,
        building.id,
        this.upgrades,
      );
      const costText = formatCost(upgradeDef.cost);
      const upgradeBtn = document.createElement('button');
      upgradeBtn.type = 'button';
      upgradeBtn.style.marginTop = '8px';
      upgradeBtn.disabled = !!reason;
      upgradeBtn.textContent = reason
        ? `Upgrade to Lv ${nextLevel} — ${reason}`
        : `Upgrade to Lv ${nextLevel} (${costText})`;
      if (!reason) {
        upgradeBtn.addEventListener('click', () => {
          const result = upgradeBuilding(
            state,
            this.deps.registry,
            building.id,
            this.upgrades,
          );
          if (!result.ok) {
            this.flashStatus(result.reason);
            return;
          }
          this.deps.onStateChange();
          this.refresh();
        });
      }
      this.selectionBody.appendChild(upgradeBtn);
    }

    if (building.recipeId) {
      const pending = building.pending ?? {};
      const hasPending = Object.values(pending).some((v) => (v ?? 0) > 0);
      const harvestBtn = document.createElement('button');
      harvestBtn.type = 'button';
      harvestBtn.textContent = 'Harvest';
      harvestBtn.disabled = !hasPending;
      harvestBtn.style.marginTop = '8px';
      harvestBtn.addEventListener('click', () => {
        const result = harvestBuilding(state, building.id);
        if (!result.ok) {
          this.flashStatus(result.reason);
          return;
        }
        this.deps.onStateChange();
        this.refresh();
      });
      this.selectionBody.appendChild(harvestBtn);
    }

    if (building.typeId === 'research_institute') {
      const heading = document.createElement('div');
      heading.style.marginTop = '8px';
      heading.textContent = 'Start research:';
      this.selectionBody.appendChild(heading);

      for (const rid of state.availableResearch) {
        const rdef = this.deps.registry.research.get(rid);
        if (!rdef) continue;
        const reason = researchStartDisabledReason(
          state,
          this.deps.registry,
          rid,
        );
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = !!reason;
        const cost = formatCost(rdef.cost);
        btn.textContent = reason
          ? `${rdef.label} — ${reason}`
          : `${rdef.label} [${cost}]`;
        if (!reason) {
          btn.addEventListener('click', () => {
            const result = startResearch(state, this.deps.registry, rid);
            if (!result.ok) {
              this.flashStatus(result.reason);
              return;
            }
            this.deps.onStateChange();
            this.refresh();
          });
        }
        this.selectionBody.appendChild(btn);
      }
    }

    if (def.demolishable && building.typeId !== 'main_house') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Demolish';
      btn.style.color = '#ff8888';
      btn.style.marginTop = '8px';
      btn.addEventListener('click', () => {
        const result = demolishBuilding(
          state,
          this.deps.registry,
          building.id,
          this.upgrades,
        );
        if (!result.ok) {
          this.flashStatus(result.reason);
          return;
        }
        this.deps.setSelectedBuildingId(null);
        this.deps.onStateChange();
        this.refresh();
      });
      this.selectionBody.appendChild(btn);
    }
  }
}
