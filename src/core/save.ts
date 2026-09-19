import { Grid } from './grid';
import type { ContentRegistry } from './registry';
import type {
  ActiveResearch,
  BuildingInstance,
  BuildingTypeId,
  GameState,
  InventoryState,
} from './types';
import {
  MemoryStorage,
  LocalStorageAdapter,
  type StorageAdapter,
} from './storage';

export { MemoryStorage, LocalStorageAdapter };
export type { StorageAdapter };

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
        recipeId: b.recipeId,
      };
      if (b.pending !== undefined || b.recipeId) {
        out.pending = { ...(b.pending ?? {}) };
      }
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
  };
}

export function deserializeGame(
  data: unknown,
  registry: ContentRegistry,
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

    const grid = new Grid();
    const buildings: BuildingInstance[] = (s.buildings as BuildingInstance[]).map(
      (b) => {
        const pending =
          b.pending !== undefined
            ? { ...b.pending }
            : b.recipeId
              ? {}
              : undefined;
        return {
          id: b.id,
          typeId: b.typeId,
          origin: { ...b.origin },
          recipeId: b.recipeId,
          ...(pending !== undefined ? { pending } : {}),
        };
      },
    );
    for (const b of buildings) {
      const def = registry.buildings.get(b.typeId);
      if (!def) return null;
      if (!grid.canPlace(b.origin, def.footprint)) return null;
      grid.occupy(b.id, b.origin, def.footprint);
    }

    return {
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
    };
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
): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw == null) return null;
  return deserializeGame(raw, registry);
}
