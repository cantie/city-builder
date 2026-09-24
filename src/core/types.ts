export type ResourceId = 'food' | 'wood' | 'stone' | 'coin';

export type BuildingTypeId = string;

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
  /** Public URL path to isometric sprite (Vite serves public/ at /). */
  sprite?: string;
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
  /** @deprecated Capacity is warehouse-driven; field kept for old content. */
  softCapBonus?: number;
}

export interface BuildingInstance {
  id: string;
  typeId: BuildingTypeId;
  origin: Cell;
  /** Building level; starts at 1 on place. Cannot exceed main house level (except main house). */
  level: number;
  recipeId?: string;
  /** Accumulated recipe outputs awaiting manual harvest. */
  pending?: Partial<Record<ResourceId, number>>;
  /** Warehouse capacity for this instance (from upgrades config by level). */
  capacity?: number;
  /** Unique resource waiting to be stocked on an origin custom building. */
  uniquePending?: number;
  /** Unique resource ready to train or export. */
  exportStock?: number;
}

export interface InventoryState {
  amounts: Record<ResourceId, number>;
  softCap: number;
}

export interface CustomBuilding {
  id: BuildingTypeId;
  label: string;
  prompt: string;
  footprint: Footprint;
  sprite: string;
  resourceId: string;
  resourceLabel: string;
  unitId: string;
  unitLabel: string;
  exportPrice: number;
  exportEnabled: boolean;
}

export interface BuildingLicense {
  typeId: BuildingTypeId;
  owner: string;
  slot: 'custom-1' | 'custom-2' | 'custom-3';
  label: string;
  resourceId: string;
  resourceLabel: string;
  unitId: string;
  unitLabel: string;
  sprite: string;
}

export interface ActiveResearch {
  researchId: string;
  remainingTicks: number;
}

export interface ReplicaStatus {
  typeId: BuildingTypeId;
  exportEnabled: boolean;
  stock: number;
  exportPrice: number;
  abandoned: boolean;
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
  customBuildings?: CustomBuilding[];
  army?: Record<string, number>;
  licenses?: BuildingLicense[];
  replicaStatus?: ReplicaStatus[];
}
