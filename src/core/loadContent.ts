import { createRegistry, type ContentRegistry } from './buildings';
import type { BuildingDef, RecipeDef, ResearchDef } from './types';

export function loadContentFromData(
  buildingsJson: unknown,
  recipesJson: unknown,
  researchJson: unknown,
): ContentRegistry {
  return createRegistry(
    buildingsJson as BuildingDef[],
    recipesJson as RecipeDef[],
    researchJson as ResearchDef[],
  );
}
