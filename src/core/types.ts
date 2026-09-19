export type ResourceId = 'food' | 'wood' | 'stone' | 'coin';

export type BuildingTypeId = 'main_house' | 'farm' | 'research_institute' | 'lumber_yard';

export interface Cell {
  x: number;
  y: number;
}

export interface Footprint {
  width: number;
  height: number;
}

export interface BuildingDef {
  id: BuildingTypeId;
  label: string;
  footprint: Footprint;
  demolishable: boolean;
  cost: Partial<Record<ResourceId, number>>;
  meshColor: number;
  meshHeight: number;
  defaultRecipeId?: string;
}

export interface RecipeDef {
  id: string;
  label: string;
  outputs: Partial<Record<ResourceId, number>>;
}

export interface ResearchDef {
  id: string;
  label: string;
  tier: 1 | 2 | 3;
  cost: Partial<Record<ResourceId, number>>;
  durationTicks: number;
  unlocksBlueprints: BuildingTypeId[];
  unlocksRecipes: string[];
  unlocksResearch: string[];
  softCapBonus?: number;
}

export interface BuildingInstance {
  id: string;
  typeId: BuildingTypeId;
  origin: Cell;
  recipeId?: string;
}

export interface InventoryState {
  amounts: Record<ResourceId, number>;
  softCap: number;
}

export interface ActiveResearch {
  researchId: string;
  remainingTicks: number;
}

export interface GameState {
  tick: number;
  grid: import('./grid').Grid;
  buildings: BuildingInstance[];
  inventory: InventoryState;
  unlockedBlueprints: BuildingTypeId[];
  unlockedRecipes: string[];
  completedResearch: string[];
  availableResearch: string[];
  activeResearch: ActiveResearch | null;
}
