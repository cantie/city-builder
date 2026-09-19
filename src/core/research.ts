import { trySpend } from './inventory';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export type StartResearchResult =
  | { ok: true }
  | { ok: false; reason: string };

export function startResearch(
  state: GameState,
  registry: ContentRegistry,
  researchId: string,
): StartResearchResult {
  if (state.activeResearch) {
    return { ok: false, reason: 'research queue busy' };
  }
  if (!state.availableResearch.includes(researchId)) {
    return { ok: false, reason: 'research not available' };
  }
  if (state.completedResearch.includes(researchId)) {
    return { ok: false, reason: 'already completed' };
  }
  const def = registry.research.get(researchId);
  if (!def) return { ok: false, reason: 'unknown research' };
  if (!trySpend(state.inventory, def.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }
  state.activeResearch = {
    researchId,
    remainingTicks: def.durationTicks,
  };
  return { ok: true };
}

function applyCompletion(
  state: GameState,
  registry: ContentRegistry,
  researchId: string,
): void {
  const def = registry.research.get(researchId);
  if (!def) return;
  state.completedResearch.push(researchId);
  state.availableResearch = state.availableResearch.filter((id) => id !== researchId);
  for (const bp of def.unlocksBlueprints) {
    if (!state.unlockedBlueprints.includes(bp)) state.unlockedBlueprints.push(bp);
  }
  for (const recipeId of def.unlocksRecipes) {
    if (!state.unlockedRecipes.includes(recipeId)) state.unlockedRecipes.push(recipeId);
  }
  for (const next of def.unlocksResearch) {
    if (
      !state.availableResearch.includes(next) &&
      !state.completedResearch.includes(next)
    ) {
      state.availableResearch.push(next);
    }
  }
  if (def.softCapBonus) {
    state.inventory.softCap += def.softCapBonus;
  }
}

export function advanceResearch(state: GameState, registry: ContentRegistry): void {
  if (!state.activeResearch) return;
  state.activeResearch.remainingTicks -= 1;
  if (state.activeResearch.remainingTicks > 0) return;
  const id = state.activeResearch.researchId;
  state.activeResearch = null;
  applyCompletion(state, registry, id);
}
