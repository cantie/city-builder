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

export type SidebarPanel = 'inspect' | 'build' | 'research' | 'market';

export function selectedBuildingTypeId(
  state: GameState,
  selectedBuildingId: string | null,
): string | null {
  if (!selectedBuildingId) return null;
  return state.buildings.find((b) => b.id === selectedBuildingId)?.typeId ?? null;
}

export function nextSidebarPanel(input: {
  current: SidebarPanel;
  action: 'toggle-build' | 'toggle-research' | 'toggle-market' | 'sync-selection';
  selectedTypeId: string | null;
}): SidebarPanel {
  if (input.action === 'toggle-build') {
    return input.current === 'build' ? 'inspect' : 'build';
  }
  if (input.action === 'toggle-research') {
    return input.current === 'research' ? 'inspect' : 'research';
  }
  if (input.action === 'toggle-market') {
    return input.current === 'market' ? 'inspect' : 'market';
  }
  if (input.selectedTypeId === 'research_institute') return 'research';
  if (input.selectedTypeId) return 'inspect';
  return input.current;
}

export function trainDisabledReason(input: {
  kind: 'origin' | 'replica';
  exportEnabled: boolean;
  stock: number;
  food: number;
  coin: number;
  price: number;
}): string | null {
  if (input.kind === 'replica' && !input.exportEnabled) return 'export disabled';
  if (input.stock < 5) return 'out of stock';
  if (input.kind === 'replica') {
    if (input.food < 2 || input.coin < input.price * 5) return 'cannot afford';
    return null;
  }
  if (input.food < 2) return 'cannot afford';
  return null;
}

export function showNewGameButton(input: {
  panel: SidebarPanel;
  selectedTypeId: string | null;
}): boolean {
  return input.panel === 'inspect' && input.selectedTypeId === 'main_house';
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
