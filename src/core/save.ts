import { uniquifyBuildingIds } from './buildings';
import { Grid, findPlaceableOrigin } from './grid';
import { normalizeCustomBuildings, withCustomBuildings } from './customBuilding';
import type { ContentRegistry } from './registry';
import type {
  ActiveResearch,
  BuildingInstance,
  BuildingLicense,
  BuildingTypeId,
  CustomBuilding,
  GameState,
  InventoryState,
} from './types';
import {
  MemoryStorage,
  LocalStorageAdapter,
  type StorageAdapter,
} from './storage';
import { refreshInventorySoftCap, warehouseCapacityForLevel } from './warehouse';
import type { UpgradesConfig } from './upgrades';
import defaultUpgradesJson from '@/data/upgrades.json';

export { MemoryStorage, LocalStorageAdapter };
export type { StorageAdapter };

const defaultUpgrades = defaultUpgradesJson as UpgradesConfig;

export const SAVE_KEY = 'city-builder-save-v1';

export interface SerializedGame {
  version: 1;
  tick: number;
  buildings: BuildingInstance[];
  inventory: InventoryState;
  unlockedBlueprints: BuildingTypeId[];
  unlockedRecipes: string[];
  completedResearch: string[];
  availableResearch: string[];
  activeResearch: ActiveResearch | null;
  customBuildings?: CustomBuilding[];
  army?: Record<string, number>;
  licenses?: BuildingLicense[];
}

export function serializeGame(state: GameState): SerializedGame {
  return {
    version: 1,
    tick: state.tick,
    buildings: state.buildings.map((b) => {
      const out: BuildingInstance = {
        id: b.id,
        typeId: b.typeId,
        origin: { ...b.origin },
        level: b.level ?? 1,
        recipeId: b.recipeId,
      };
      if (b.pending !== undefined || b.recipeId) {
        out.pending = { ...(b.pending ?? {}) };
      }
      if (b.capacity !== undefined) {
        out.capacity = b.capacity;
      }
      if (b.uniquePending !== undefined) out.uniquePending = b.uniquePending;
      if (b.exportStock !== undefined) out.exportStock = b.exportStock;
      return out;
    }),
    inventory: {
      softCap: state.inventory.softCap,
      amounts: { ...state.inventory.amounts },
    },
    unlockedBlueprints: [...state.unlockedBlueprints],
    unlockedRecipes: [...state.unlockedRecipes],
    completedResearch: [...state.completedResearch],
    availableResearch: [...state.availableResearch],
    activeResearch: state.activeResearch
      ? { ...state.activeResearch }
      : null,
    customBuildings: (state.customBuildings ?? []).map((b) => ({
      id: b.id,
      label: b.label,
      prompt: b.prompt,
      footprint: { ...b.footprint },
      sprite: b.sprite,
      resourceId: b.resourceId,
      resourceLabel: b.resourceLabel,
      unitId: b.unitId,
      unitLabel: b.unitLabel,
      exportPrice: b.exportPrice,
      exportEnabled: b.exportEnabled,
    })),
    army: { ...(state.army ?? {}) },
    licenses: (state.licenses ?? []).map((l) => ({ ...l })),
  };
}

export function deserializeGame(
  data: unknown,
  registry: ContentRegistry,
  upgrades: UpgradesConfig = defaultUpgrades,
  owner = 'local',
): GameState | null {
  try {
    const parsed =
      typeof data === 'string' ? (JSON.parse(data) as unknown) : data;
    if (!parsed || typeof parsed !== 'object') return null;
    const s = parsed as Partial<SerializedGame>;
    if (s.version !== 1) return null;
    if (typeof s.tick !== 'number' || !Array.isArray(s.buildings)) return null;
    if (!s.inventory?.amounts || typeof s.inventory.softCap !== 'number') {
      return null;
    }

    const customs = normalizeCustomBuildings(s.customBuildings, owner);
    const registryWithCustom = withCustomBuildings(registry, customs);
    const grid = new Grid();
    const buildings: BuildingInstance[] = (s.buildings as BuildingInstance[]).map(
      (b) => {
        const pending =
          b.pending !== undefined
            ? { ...b.pending }
            : b.recipeId
              ? {}
              : undefined;
        const level = typeof b.level === 'number' && b.level >= 1 ? b.level : 1;
        const out: BuildingInstance = {
          id: b.id,
          typeId: b.typeId,
          origin: { ...b.origin },
          level,
          recipeId: b.recipeId,
          ...(pending !== undefined ? { pending } : {}),
        };
        if (b.typeId === 'warehouse') {
          out.capacity =
            typeof b.capacity === 'number'
              ? b.capacity
              : warehouseCapacityForLevel(level, upgrades);
        } else if (typeof b.capacity === 'number') {
          out.capacity = b.capacity;
        }
        if (typeof b.uniquePending === 'number') {
          out.uniquePending = b.uniquePending;
        }
        if (typeof b.exportStock === 'number') {
          out.exportStock = b.exportStock;
        }
        return out;
      },
    );
    uniquifyBuildingIds(buildings);
    for (const b of [
      ...buildings.filter((x) => x.typeId === 'main_house'),
      ...buildings.filter((x) => x.typeId !== 'main_house'),
    ]) {
      const def = registryWithCustom.buildings.get(b.typeId);
      if (!def) return null;
      if (!grid.canPlace(b.origin, def.footprint)) {
        if (b.typeId === 'main_house') return null;
        const next = findPlaceableOrigin(grid, def.footprint, [
          { x: 20, y: 23 },
          { x: 23, y: 20 },
          { x: 26, y: 23 },
          { x: 23, y: 26 },
        ]);
        if (!next) return null;
        b.origin = { ...next };
      }
      grid.occupy(b.id, b.origin, def.footprint);
    }

    const state: GameState = {
      tick: s.tick,
      grid,
      buildings,
      inventory: {
        softCap: s.inventory.softCap,
        amounts: { ...s.inventory.amounts },
      },
      unlockedBlueprints: [...(s.unlockedBlueprints ?? [])],
      unlockedRecipes: [...(s.unlockedRecipes ?? [])],
      completedResearch: [...(s.completedResearch ?? [])],
      availableResearch: [...(s.availableResearch ?? [])],
      activeResearch: s.activeResearch ? { ...s.activeResearch } : null,
      customBuildings: customs,
      army: { ...(s.army ?? {}) },
      licenses: Array.isArray(s.licenses)
        ? s.licenses.map((l) => ({ ...l }))
        : [],
    };

    // Always recompute softCap from warehouses so saves stay consistent.
    refreshInventorySoftCap(state, upgrades);
    return state;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, storage: StorageAdapter): void {
  storage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
}

export function loadGame(
  storage: StorageAdapter,
  registry: ContentRegistry,
  upgrades: UpgradesConfig = defaultUpgrades,
): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw == null) return null;
  return deserializeGame(raw, registry, upgrades);
}
