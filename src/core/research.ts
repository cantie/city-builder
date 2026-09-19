import { trySpend } from './inventory';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export type StartResearchResult =
  | { ok: true }
  | { ok: false; reason: string };

export function hasResearchInstitute(state: GameState): boolean {
  return state.buildings.some((b) => b.typeId === 'research_institute');
}

export function startResearch(
  state: GameState,
  registry: ContentRegistry,
  researchId: string,
): StartResearchResult {
  if (!hasResearchInstitute(state)) {
    return { ok: false, reason: 'need research institute' };
  }
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

function grantResearchUnlocks(
  state: GameState,
  registry: ContentRegistry,
  researchId: string,
): boolean {
  const def = registry.research.get(researchId);
  if (!def) return false;
  let changed = false;
  for (const bp of def.unlocksBlueprints) {
    if (!state.unlockedBlueprints.includes(bp)) {
      state.unlockedBlueprints.push(bp);
      changed = true;
    }
  }
  for (const recipeId of def.unlocksRecipes) {
    if (!state.unlockedRecipes.includes(recipeId)) {
      state.unlockedRecipes.push(recipeId);
      changed = true;
    }
  }
  for (const next of def.unlocksResearch) {
    if (
      !state.availableResearch.includes(next) &&
      !state.completedResearch.includes(next)
    ) {
      state.availableResearch.push(next);
      changed = true;
    }
  }
  return changed;
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
  grantResearchUnlocks(state, registry, researchId);
  // softCapBonus ignored: inventory softCap is the sum of warehouse capacities.
}

/** Re-apply unlocks for already-completed nodes (content added after the save). */
export function syncCompletedResearchUnlocks(
  state: GameState,
  registry: ContentRegistry,
): boolean {
  let changed = false;
  for (const id of state.completedResearch) {
    if (grantResearchUnlocks(state, registry, id)) changed = true;
  }
  return changed;
}

export function advanceResearch(state: GameState, registry: ContentRegistry): void {
  if (!state.activeResearch) return;
  state.activeResearch.remainingTicks -= 1;
  if (state.activeResearch.remainingTicks > 0) return;
  const id = state.activeResearch.researchId;
  state.activeResearch = null;
  applyCompletion(state, registry, id);
}
