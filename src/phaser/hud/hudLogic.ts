import type { ContentRegistry } from '@/core/registry';
import { hasResearchInstitute } from '@/core/research';
import { INVENT_COST, MAX_CUSTOM_BUILDINGS } from '@/core/customBuilding';
import type { BuildingDef, GameState, ResourceId } from '@/core/types';

export function unlockedBuildOptions(
  state: GameState,
  registry: ContentRegistry,
): BuildingDef[] {
  return state.unlockedBlueprints
    .map((id) => registry.buildings.get(id))
    .filter((d): d is BuildingDef => !!d && d.id !== 'main_house');
}

export function researchStartDisabledReason(
  state: GameState,
  registry: ContentRegistry,
  researchId: string,
): string | null {
  if (!hasResearchInstitute(state)) return 'need research institute';
  if (state.activeResearch) return 'research queue busy';
  if (!state.availableResearch.includes(researchId)) return 'not available';
  const def = registry.research.get(researchId);
  if (!def) return 'unknown research';
  for (const key of Object.keys(def.cost) as ResourceId[]) {
    const need = def.cost[key] ?? 0;
    if (state.inventory.amounts[key] < need) return 'cannot afford';
  }
  return null;
}

export function inventDisabledReason(state: GameState): string | null {
  if (!hasResearchInstitute(state)) return 'need research institute';
  if ((state.customBuildings ?? []).length >= MAX_CUSTOM_BUILDINGS) {
    return 'custom building limit';
  }
  for (const key of Object.keys(INVENT_COST) as ResourceId[]) {
    const need = INVENT_COST[key] ?? 0;
    if (state.inventory.amounts[key] < need) return 'cannot afford';
  }
  return null;
}
