import {
  getUpgradeDef,
  upgradeDisabledReason,
  type UpgradesConfig,
} from '@/core/upgrades';
import { hasResearchInstitute } from '@/core/research';
import {
  researchStartDisabledReason,
  unlockedBuildOptions,
  inventDisabledReason,
  nextSidebarPanel,
  selectedBuildingTypeId,
  showNewGameButton,
  trainDisabledReason,
  type SidebarPanel,
} from '@/phaser/hud/hudLogic';
import { INVENT_COST } from '@/core/customBuilding';
import { isOriginCustom } from '@/core/customEconomy';
import { DEFAULT_LISTING_PRICE, type MarketListing } from '@/core/market';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingTypeId, GameState, ResourceId } from '@/core/types';
import defaultUpgradesJson from '@/data/upgrades.json';

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

export interface SidebarCommandResult {
  ok: boolean;
  reason?: string;
}

export interface SidebarDeps {
  getState: () => GameState;
  registry: ContentRegistry;
  upgrades?: UpgradesConfig;
  getSelectedBlueprint: () => BuildingTypeId | null;
  setSelectedBlueprint: (id: BuildingTypeId | null) => void;
  getSelectedBuildingId: () => string | null;
  setSelectedBuildingId: (id: string | null) => void;
  commands: {
    harvest: (buildingId: string) => Promise<SidebarCommandResult>;
    train: (buildingId: string) => Promise<SidebarCommandResult>;
    setExport: (
      typeId: BuildingTypeId,
      enabled: boolean,
      price?: number,
    ) => Promise<SidebarCommandResult>;
    listOnMarket: (
      typeId: BuildingTypeId,
      price: number,
    ) => Promise<SidebarCommandResult>;
    unlistFromMarket: (typeId: BuildingTypeId) => Promise<SidebarCommandResult>;
    buyListing: (typeId: string) => Promise<SidebarCommandResult>;
    marketCatalog: () => Promise<{ ok: boolean; listings: MarketListing[] }>;
    research: (researchId: string) => Promise<SidebarCommandResult>;
    upgrade: (buildingId: string) => Promise<SidebarCommandResult>;
    demolish: (buildingId: string) => Promise<SidebarCommandResult>;
    invent: (
      prompt: string,
      width: number,
      height: number,
    ) => Promise<SidebarCommandResult>;
    forgetBuilding: (typeId: BuildingTypeId) => Promise<SidebarCommandResult>;
  };
  /** Optional toast / status line under sections. */
  setStatus?: (msg: string) => void;
  /** Wipe save and reload. */
  onNewGame?: () => void;
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

const RESOURCE_ICONS: Record<ResourceId, string> = {
  food: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#e07070" d="M8 2c2 2 5 3 5 7a5 5 0 1 1-10 0c0-4 3-5 5-7z"/><path fill="#6bb36b" d="M8 2c0 2-2 3-4 3 1-2 3-3 4-3z"/></svg>`,
  wood: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#c4894a" d="M2 7h12l-1 6H3z"/><path fill="#8a5a2b" d="M3 6h10v2H3z"/><path fill="#d4a36a" d="M4 9h8v1H4z"/></svg>`,
  stone: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#9a9aaa" d="M3 11 6 4h4l3 7-2 2H5z"/><path fill="#6f6f80" d="M5 13h6l2-2H3z"/></svg>`,
  coin: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#e6c34a"/><circle cx="8" cy="8" r="4" fill="none" stroke="#9a7a18" stroke-width="1.4"/></svg>`,
};

function spriteUrl(def: { id: string; sprite?: string }): string {
  return def.sprite ?? `/assets/buildings/${def.id}.png`;
}

export class Sidebar {
  private resourcesBody: HTMLElement;
  private buildBody: HTMLElement;
  private researchBody: HTMLElement;
  private selectionBody: HTMLElement;
  private cancelBuildBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private inventPrompt: HTMLTextAreaElement;
  private inventBtn: HTMLButtonElement;
  private inventCount: HTMLElement;
  private inventHint: HTMLElement;
  private inventBusy = false;
  private panel: SidebarPanel = 'inspect';
  private upgrades: UpgradesConfig;
  private buildSection: HTMLElement;
  private researchSection: HTMLElement;
  private selectionSection: HTMLElement;
  private metaSection: HTMLElement;
  private actionBuildBtn: HTMLButtonElement;
  private actionResearchBtn: HTMLButtonElement;
  private actionMarketBtn: HTMLButtonElement;
  private marketSection: HTMLElement;
  private marketBody: HTMLElement;
  private listings: MarketListing[] = [];

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
    this.inventPrompt = document.getElementById(
      'invent-prompt',
    ) as HTMLTextAreaElement;
    this.inventBtn = document.getElementById(
      'invent-submit',
    ) as HTMLButtonElement;
    this.inventCount = document.getElementById('invent-count')!;
    this.inventHint = document.getElementById('invent-hint')!;
    this.buildSection = document.getElementById('sidebar-build')!;
    this.researchSection = document.getElementById('sidebar-research')!;
    this.selectionSection = document.getElementById('sidebar-selection')!;
    this.metaSection = document.getElementById('sidebar-meta')!;
    this.actionBuildBtn = document.getElementById(
      'action-build',
    ) as HTMLButtonElement;
    this.actionResearchBtn = document.getElementById(
      'action-research',
    ) as HTMLButtonElement;
    this.actionMarketBtn = document.getElementById(
      'action-market',
    ) as HTMLButtonElement;
    this.marketSection = document.getElementById('sidebar-market')!;
    this.marketBody = document.getElementById('market-body')!;

    this.actionBuildBtn.addEventListener('click', () => {
      this.applyPanel(
        nextSidebarPanel({
          current: this.panel,
          action: 'toggle-build',
          selectedTypeId: null,
        }),
      );
    });

    this.actionMarketBtn.addEventListener('click', () => {
      this.applyPanel(
        nextSidebarPanel({
          current: this.panel,
          action: 'toggle-market',
          selectedTypeId: null,
        }),
      );
    });

    this.actionResearchBtn.addEventListener('click', () => {
      const state = this.deps.getState();
      if (!hasResearchInstitute(state)) {
        this.flashStatus('need research institute');
        return;
      }
      this.applyPanel(
        nextSidebarPanel({
          current: this.panel,
          action: 'toggle-research',
          selectedTypeId: null,
        }),
      );
    });

    this.inventBtn.addEventListener('click', () => {
      const n = 3;
      const state = this.deps.getState();
      const blocked = inventDisabledReason(state);
      if (blocked) {
        this.flashStatus(blocked);
        return;
      }
      this.inventBusy = true;
      this.inventBtn.disabled = true;
      this.inventBtn.textContent = 'Đang tạo ảnh…';
      void this.deps.commands
        .invent(this.inventPrompt.value, n, n)
        .then((result) => {
          this.inventBusy = false;
          this.inventBtn.textContent = 'Nghiên cứu & tạo ảnh';
          if (!result.ok) this.flashStatus(result.reason ?? '');
          else this.inventPrompt.value = '';
          this.refresh();
        });
    });

    this.cancelBuildBtn.addEventListener('click', () => {
      this.deps.setSelectedBlueprint(null);
      this.refresh();
    });

    const newGameBtn = document.getElementById('new-game');
    newGameBtn?.addEventListener('click', () => {
      if (!this.deps.onNewGame) return;
      if (window.confirm('Start a new game? Current save will be wiped.')) {
        this.deps.onNewGame();
      }
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
    this.panel = nextSidebarPanel({
      current: this.panel,
      action: 'sync-selection',
      selectedTypeId: selectedBuildingTypeId(
        state,
        this.deps.getSelectedBuildingId(),
      ),
    });
    this.renderResources(state);
    this.renderBuild(state);
    this.renderResearch(state);
    this.renderMarket(state);
    this.renderSelection(state);
  }

  private applyPanel(panel: SidebarPanel): void {
    this.panel = panel;
    if (panel !== 'build') this.deps.setSelectedBlueprint(null);
    if (panel === 'build' || panel === 'market') {
      this.deps.setSelectedBuildingId(null);
      this.refresh();
      return;
    }
    if (panel === 'research') {
      const ri = this.deps
        .getState()
        .buildings.find((b) => b.typeId === 'research_institute');
      if (ri && this.deps.getSelectedBuildingId() !== ri.id) {
        this.deps.setSelectedBuildingId(ri.id);
        return;
      }
    }
    if (panel === 'inspect') {
      const typeId = selectedBuildingTypeId(
        this.deps.getState(),
        this.deps.getSelectedBuildingId(),
      );
      if (typeId === 'research_institute') {
        this.deps.setSelectedBuildingId(null);
        return;
      }
    }
    this.refresh();
  }

  private renderResources(state: GameState): void {
    const a = state.inventory.amounts;
    const cap = state.inventory.softCap;
    const capNote =
      cap <= 0
        ? 'Warehouse cap 0 — place a warehouse to store harvests'
        : `${cap} each`;
    const ids: ResourceId[] = ['food', 'wood', 'stone', 'coin'];
    const cells = ids
      .map(
        (id) => `
      <div class="resource" title="${id}: ${a[id]}/${cap}">
        ${RESOURCE_ICONS[id]}
        <strong>${a[id]}</strong><span class="muted">/${cap}</span>
      </div>`,
      )
      .join('');
    const armyBits = Object.entries(state.army ?? {})
      .filter(([, n]) => n > 0)
      .map(([unitId, n]) => {
        const fromOrigin = (state.customBuildings ?? []).find(
          (c) => c.unitId === unitId,
        );
        const fromLicense = (state.licenses ?? []).find((l) => l.unitId === unitId);
        const label = fromOrigin?.unitLabel ?? fromLicense?.unitLabel ?? unitId;
        return `${label} × ${n}`;
      });
    const armyLine =
      armyBits.length > 0
        ? `<div style="margin-top:6px">Army: <strong>${armyBits.join(', ')}</strong></div>`
        : '';
    this.resourcesBody.innerHTML = `
      <div class="resource-row">${cells}</div>
      <div class="muted" style="margin-top:6px">Tick ${state.tick} · ${capNote}</div>
      ${armyLine}
    `;
  }

  private renderMarket(state: GameState): void {
    const show = this.panel === 'market';
    this.marketSection.hidden = !show;
    this.actionMarketBtn.classList.toggle('active', show);
    this.actionMarketBtn.setAttribute('aria-pressed', String(show));
    if (!show) return;
    void this.deps.commands.marketCatalog().then((result) => {
      if (this.panel !== 'market') return;
      this.listings = result.listings;
      this.marketBody.replaceChildren();
      if (!result.ok || this.listings.length === 0) {
        this.marketBody.className = 'muted';
        this.marketBody.textContent = 'No listings yet';
        return;
      }
      this.marketBody.className = '';
      for (const listing of this.listings) {
        const row = document.createElement('div');
        row.style.marginBottom = '10px';
        const img = document.createElement('img');
        img.src = listing.sprite;
        img.alt = listing.label;
        img.width = 48;
        img.height = 48;
        const licensed = (state.licenses ?? []).some(
          (l) => l.typeId === listing.typeId,
        );
        row.innerHTML = `
          <div><strong>${listing.label}</strong> — ${listing.price} coin</div>
          <div class="muted">${listing.resourceLabel} · ${listing.unitLabel} · ${listing.owner}</div>
        `;
        row.prepend(img);
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.textContent = licensed ? 'Owned' : 'Buy';
        buy.disabled =
          licensed || state.inventory.amounts.coin < listing.price;
        if (!buy.disabled) {
          buy.addEventListener('click', () => {
            void this.deps.commands.buyListing(listing.typeId).then((r) => {
              if (!r.ok) this.flashStatus(r.reason ?? '');
              this.refresh();
            });
          });
        }
        row.appendChild(buy);
        this.marketBody.appendChild(row);
      }
    });
  }

  private renderBuild(state: GameState): void {
    const selected = this.deps.getSelectedBlueprint();
    const show = this.panel === 'build';
    this.buildSection.hidden = !show;
    this.actionBuildBtn.classList.toggle('active', show);
    this.actionBuildBtn.setAttribute('aria-pressed', String(show));
    this.cancelBuildBtn.hidden = !show || selected == null;
    this.buildBody.replaceChildren();
    if (!show) return;

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
      btn.className = 'build-tile';
      const cost = formatCost(def.cost);
      btn.title = cost ? `${def.label} (${cost})` : def.label;
      if (selected === def.id) btn.classList.add('active');
      const img = document.createElement('img');
      img.src = spriteUrl(def);
      img.alt = def.label;
      const label = document.createElement('span');
      label.className = 'build-tile-label';
      label.textContent = def.label;
      btn.append(img, label);
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
    const show = this.panel === 'research';
    this.researchSection.hidden = !show;
    this.actionResearchBtn.classList.toggle('active', show);
    this.actionResearchBtn.setAttribute('aria-pressed', String(show));
    this.actionResearchBtn.disabled = !hasResearchInstitute(state);
    this.researchBody.replaceChildren();
    if (!show) return;


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
      empty.textContent = 'No tech research available';
      this.researchBody.appendChild(empty);
    } else {
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
            void this.deps.commands.research(id).then((result) => {
              if (!result.ok) this.flashStatus(result.reason ?? '');
              this.refresh();
            });
          });
        }
        this.researchBody.appendChild(btn);
      }
    }

    this.renderInvent(state);
  }

  private renderInvent(state: GameState): void {
    const n = (state.customBuildings ?? []).length;
    this.inventCount.textContent = `(${n}/3)`;
    const reason = inventDisabledReason(state);
    this.inventHint.textContent = reason
      ? reason
      : `Chi phí: ${formatCost(INVENT_COST)}`;
    if (!this.inventBusy) {
      this.inventBtn.disabled = false;
      this.inventBtn.textContent = 'Nghiên cứu & tạo ảnh';
    }
  }

  private renderSelection(state: GameState): void {
    const show = this.panel === 'inspect';
    this.selectionSection.hidden = !show;
    const id = this.deps.getSelectedBuildingId();
    this.metaSection.hidden = !showNewGameButton({
      panel: this.panel,
      selectedTypeId: selectedBuildingTypeId(state, id),
    });
    this.selectionBody.replaceChildren();
    if (!show) return;

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
        `<div style="margin-top:6px">Capacity: <strong>${cap}</strong> each resource</div>`,
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

    const originRec = (state.customBuildings ?? []).find(
      (c) => c.id === building.typeId,
    );
    if (originRec) {
      parts.push(
        `<div style="margin-top:8px">Resource: <strong>${originRec.resourceLabel}</strong></div>`,
      );
      parts.push(`<div>Unit: <strong>${originRec.unitLabel}</strong></div>`);
      parts.push(
        `<div style="margin-top:6px">Unique pending: <strong>${originRec.resourceLabel} × ${building.uniquePending ?? 0}</strong></div>`,
      );
      parts.push(
        `<div>Export stock: <strong>${originRec.resourceLabel} × ${building.exportStock ?? 0}</strong></div>`,
      );
    }

    const license = (state.licenses ?? []).find((l) => l.typeId === building.typeId);
    const replica = (state.replicaStatus ?? []).find(
      (s) => s.typeId === building.typeId,
    );
    if (license && !originRec) {
      parts.push(
        `<div style="margin-top:8px" class="muted">Imported from ${license.owner}</div>`,
      );
      parts.push(`<div>Resource: <strong>${license.resourceLabel}</strong></div>`);
      parts.push(`<div>Unit: <strong>${license.unitLabel}</strong></div>`);
      if (replica?.abandoned) {
        parts.push(`<div class="muted">Origin forgotten</div>`);
      } else if (replica) {
        parts.push(
          `<div>Seller stock: <strong>${license.resourceLabel} × ${replica.stock}</strong></div>`,
        );
        parts.push(
          `<div class="muted">${replica.exportEnabled ? `Export ${replica.exportPrice} coin / unit` : 'Export disabled'}</div>`,
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
          void this.deps.commands.upgrade(building.id).then((result) => {
            if (!result.ok) this.flashStatus(result.reason ?? '');
            this.refresh();
          });
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
        void this.deps.commands.harvest(building.id).then((result) => {
          if (!result.ok) this.flashStatus(result.reason ?? '');
          this.refresh();
        });
      });
      this.selectionBody.appendChild(harvestBtn);
    }

    if (isOriginCustom(state, building)) {
      const harvestBtn = document.createElement('button');
      harvestBtn.type = 'button';
      harvestBtn.textContent = 'Harvest';
      harvestBtn.disabled = (building.uniquePending ?? 0) <= 0;
      harvestBtn.style.marginTop = '8px';
      harvestBtn.addEventListener('click', () => {
        void this.deps.commands.harvest(building.id).then((result) => {
          if (!result.ok) this.flashStatus(result.reason ?? '');
          this.refresh();
        });
      });
      this.selectionBody.appendChild(harvestBtn);

      const originReason = trainDisabledReason({
        kind: 'origin',
        exportEnabled: true,
        stock: (building.exportStock ?? 0) + (building.uniquePending ?? 0),
        food: state.inventory.amounts.food,
        coin: state.inventory.amounts.coin,
        price: originRec?.exportPrice ?? 2,
      });
      const trainBtn = document.createElement('button');
      trainBtn.type = 'button';
      trainBtn.textContent = originReason
        ? `Train ${originRec?.unitLabel ?? 'unit'} — ${originReason}`
        : `Train ${originRec?.unitLabel ?? 'unit'}`;
      trainBtn.disabled = !!originReason;
      trainBtn.style.marginTop = '8px';
      if (!originReason) {
        trainBtn.addEventListener('click', () => {
          void this.deps.commands.train(building.id).then((result) => {
            if (!result.ok) this.flashStatus(result.reason ?? '');
            this.refresh();
          });
        });
      }
      this.selectionBody.appendChild(trainBtn);

      const exportRow = document.createElement('label');
      exportRow.style.display = 'block';
      exportRow.style.marginTop = '8px';
      const exportBox = document.createElement('input');
      exportBox.type = 'checkbox';
      exportBox.checked = originRec?.exportEnabled !== false;
      exportBox.addEventListener('change', () => {
        void this.deps.commands
          .setExport(building.typeId, exportBox.checked)
          .then((result) => {
            if (!result.ok) this.flashStatus(result.reason ?? '');
            this.refresh();
          });
      });
      exportRow.append(exportBox, ' Export unique resource');
      this.selectionBody.appendChild(exportRow);

      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '1';
      priceInput.max = '20';
      priceInput.value = String(originRec?.exportPrice ?? 2);
      priceInput.style.width = '64px';
      priceInput.style.marginTop = '6px';
      priceInput.addEventListener('change', () => {
        const price = Number(priceInput.value);
        void this.deps.commands
          .setExport(building.typeId, exportBox.checked, price)
          .then((result) => {
            if (!result.ok) this.flashStatus(result.reason ?? '');
            this.refresh();
          });
      });
      this.selectionBody.appendChild(priceInput);

      const listed = this.listings.some((l) => l.slot === building.typeId);
      const listBtn = document.createElement('button');
      listBtn.type = 'button';
      listBtn.style.marginTop = '8px';
      listBtn.textContent = listed ? 'Unlist from market' : `List for ${DEFAULT_LISTING_PRICE} coin`;
      listBtn.addEventListener('click', () => {
        const op = listed
          ? this.deps.commands.unlistFromMarket(building.typeId)
          : this.deps.commands.listOnMarket(building.typeId, DEFAULT_LISTING_PRICE);
        void op.then((result) => {
          if (!result.ok) this.flashStatus(result.reason ?? '');
          void this.deps.commands.marketCatalog().then((cat) => {
            this.listings = cat.listings;
            this.refresh();
          });
        });
      });
      this.selectionBody.appendChild(listBtn);
    }

    if (license && !originRec) {
      const replicaReason = trainDisabledReason({
        kind: 'replica',
        exportEnabled: replica ? replica.exportEnabled && !replica.abandoned : true,
        stock: replica?.stock ?? 0,
        food: state.inventory.amounts.food,
        coin: state.inventory.amounts.coin,
        price: replica?.exportPrice ?? 2,
      });
      const abandoned = replica?.abandoned;
      const trainBtn = document.createElement('button');
      trainBtn.type = 'button';
      trainBtn.style.marginTop = '8px';
      trainBtn.textContent = abandoned
        ? `Train ${license.unitLabel} — origin forgotten`
        : replicaReason
          ? `Train ${license.unitLabel} — ${replicaReason}`
          : `Train ${license.unitLabel}`;
      trainBtn.disabled = !!abandoned || !!replicaReason;
      if (!trainBtn.disabled) {
        trainBtn.addEventListener('click', () => {
          void this.deps.commands.train(building.id).then((result) => {
            if (!result.ok) this.flashStatus(result.reason ?? '');
            this.refresh();
          });
        });
      }
      this.selectionBody.appendChild(trainBtn);
    }

    if (def.demolishable && building.typeId !== 'main_house') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Demolish';
      btn.style.color = '#ff8888';
      btn.style.marginTop = '8px';
      btn.addEventListener('click', () => {
        void this.deps.commands.demolish(building.id).then((result) => {
          if (!result.ok) {
            this.flashStatus(result.reason ?? '');
            this.refresh();
            return;
          }
          this.deps.setSelectedBuildingId(null);
          this.refresh();
        });
      });
      this.selectionBody.appendChild(btn);
    }

    if (String(building.typeId).startsWith('custom-')) {
      const forget = document.createElement('button');
      forget.type = 'button';
      forget.textContent = 'Forget this design';
      forget.style.color = '#ff8888';
      forget.style.marginTop = '8px';
      forget.addEventListener('click', () => {
        void this.deps.commands.forgetBuilding(building.typeId).then((result) => {
          if (!result.ok) this.flashStatus(result.reason ?? '');
          this.deps.setSelectedBuildingId(null);
          this.refresh();
        });
      });
      this.selectionBody.appendChild(forget);
    }
  }
}
