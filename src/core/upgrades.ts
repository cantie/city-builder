import { trySpend } from './inventory';
import { refreshInventorySoftCap, warehouseCapacityForLevel } from './warehouse';
import type { ContentRegistry } from './registry';
import type {
  BuildingTypeId,
  GameState,
  ResourceId,
} from './types';

export interface UpgradeLevelDef {
  cost: Partial<Record<ResourceId, number>>;
  effects?: {
    capacity?: number;
    pendingCapBonus?: number;
  };
}

export interface UpgradesConfig {
  maxLevel: number;
  buildings: Partial<
    Record<BuildingTypeId, Record<string, UpgradeLevelDef>>
  >;
  warehouseCapacityByLevel: Record<string, number>;
}

export type UpgradeResult =
  | { ok: true }
  | { ok: false; reason: string };

export function getMainHouseLevel(state: GameState): number {
  const main = state.buildings.find((b) => b.typeId === 'main_house');
  return main?.level ?? 1;
}

export function getUpgradeDef(
  upgrades: UpgradesConfig,
  typeId: BuildingTypeId,
  nextLevel: number,
): UpgradeLevelDef | undefined {
  return upgrades.buildings[typeId]?.[String(nextLevel)];
}

/**
 * Upgrade a building by one level.
 * Non-main buildings cannot exceed main house level.
 * Cost spent from warehouse stock (state.inventory) via trySpend.
 * Warehouse upgrades bump capacity and refresh softCap.
 */
export function upgradeBuilding(
  state: GameState,
  _registry: ContentRegistry,
  buildingId: string,
  upgradesConfig: UpgradesConfig,
): UpgradeResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };

  const nextLevel = (building.level ?? 1) + 1;
  if (nextLevel > upgradesConfig.maxLevel) {
    return { ok: false, reason: 'max level' };
  }

  const def = getUpgradeDef(upgradesConfig, building.typeId, nextLevel);
  if (!def) {
    return { ok: false, reason: 'max level' };
  }

  const isMain = building.typeId === 'main_house';
  if (!isMain) {
    const mainLevel = getMainHouseLevel(state);
    if (nextLevel > mainLevel) {
      return { ok: false, reason: 'capped by main house level' };
    }
  }

  if (!trySpend(state.inventory, def.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }

  building.level = nextLevel;

  if (building.typeId === 'warehouse') {
    const capacity =
      def.effects?.capacity ??
      warehouseCapacityForLevel(nextLevel, upgradesConfig, building.capacity);
    building.capacity = capacity;
    refreshInventorySoftCap(state, upgradesConfig);
  }

  return { ok: true };
}

/** Reason the Upgrade button should be disabled, or null if upgradeable. */
export function upgradeDisabledReason(
  state: GameState,
  buildingId: string,
  upgradesConfig: UpgradesConfig,
): string | null {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return 'not found';

  const nextLevel = (building.level ?? 1) + 1;
  if (nextLevel > upgradesConfig.maxLevel) return 'max level';

  const def = getUpgradeDef(upgradesConfig, building.typeId, nextLevel);
  if (!def) return 'max level';

  const isMain = building.typeId === 'main_house';
  if (!isMain) {
    const mainLevel = getMainHouseLevel(state);
    if (nextLevel > mainLevel) {
      return 'capped by main house level';
    }
  }

  for (const id of Object.keys(def.cost) as ResourceId[]) {
    if (state.inventory.amounts[id] < (def.cost[id] ?? 0)) {
      return 'cannot afford';
    }
  }
  return null;
}
