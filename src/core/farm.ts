import { add } from './inventory';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export function produceFarms(state: GameState, registry: ContentRegistry): void {
  for (const b of state.buildings) {
    if (!b.recipeId) continue;
    if (!state.unlockedRecipes.includes(b.recipeId)) continue;
    const recipe = registry.recipes.get(b.recipeId);
    if (!recipe) continue;
    add(state.inventory, recipe.outputs);
  }
}
