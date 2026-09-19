import type {
  BuildingDef,
  BuildingTypeId,
  RecipeDef,
  ResearchDef,
} from './types';

export interface ContentRegistry {
  buildings: Map<BuildingTypeId, BuildingDef>;
  recipes: Map<string, RecipeDef>;
  research: Map<string, ResearchDef>;
}

export function createRegistry(
  buildings: BuildingDef[],
  recipes: RecipeDef[],
  research: ResearchDef[],
): ContentRegistry {
  return {
    buildings: new Map(buildings.map((b) => [b.id, b])),
    recipes: new Map(recipes.map((r) => [r.id, r])),
    research: new Map(research.map((r) => [r.id, r])),
  };
}
