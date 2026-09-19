# City Builder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser sandbox city builder where a player places farms on a fixed 20×20 grid, produces resources on ticks, unlocks blueprints via a single research queue, and reloads progress from localStorage — with Phaser leading UI/input and Three.js rendering building meshes only.

**Architecture:** Pure TypeScript `core/` owns grid, inventory, buildings, farms, research, tick, and save/load. `phaser/` owns tilemap, camera, placement ghost, and HUD. `three/` owns colored box meshes synced from the building list. `bridge/` converts tile↔world and copies Phaser camera into Three each frame. Data-driven JSON defines buildings, recipes, and a shallow three-tier research tree. Market is a `TradeService` interface stub only.

**Tech Stack:** Vite, TypeScript, Phaser 3, three.js, Vitest

## Global Constraints
- Grid fixed 20×20; sandbox no win condition
- Phaser leads input/UI/tilemap; Three.js only building meshes; pure TS core
- Solo MVP only; market is TradeService stub interface at most, no network
- Resources: food, wood, stone, coin (coin starts 0)
- Main house 2×2 pre-spawned non-demolishable; farm & research 1×1
- Single research queue; farms skip tick when inventory full
- Save via localStorage JSON
- TDD: write failing test → run → implement → run → commit each task

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `package.json` | Scripts (`dev`, `build`, `test`) and deps (phaser, three, vitest, vite, typescript) |
| `tsconfig.json` | Strict TS; path alias `@/` → `src/` |
| `tsconfig.node.json` | Config for Vite/Vitest Node tooling |
| `vite.config.ts` | Vite + path alias; Vitest `test` block with `environment: 'node'` for core |
| `index.html` | Single-page shell; mounts `#app` with Phaser + Three layers |
| `src/main.ts` | Boots Phaser + Three; wires tick loop and auto-save |
| `src/vite-env.d.ts` | Vite client types + JSON module declarations |
| `src/core/types.ts` | Shared IDs, cells, footprints, building/recipe/research types, `GameState` |
| `src/core/grid.ts` | `GRID_WIDTH`/`HEIGHT`, occupancy, `canPlace` / `occupy` / `vacate` / `getOccupant` |
| `src/core/inventory.ts` | Soft-cap totals, `canAdd`, `add`, `trySpend`, `createInventory` |
| `src/core/buildings.ts` | Registry re-exports, `placeBuilding`, `demolishBuilding` (main protected) |
| `src/core/registry.ts` | `createRegistry` → lookup maps for buildings/recipes/research |
| `src/core/farm.ts` | Per-tick farm production; skip when inventory cannot accept output |
| `src/core/research.ts` | Single queue: `startResearch`, `advanceResearch`, unlock blueprints |
| `src/core/tick.ts` | `advanceTick(state)` — farms then research; increments `tick` |
| `src/core/save.ts` | `serializeGame` / `deserializeGame`; `saveGame` / `loadGame` |
| `src/core/storage.ts` | `StorageAdapter`; `MemoryStorage`; `LocalStorageAdapter` |
| `src/core/trade.ts` | `TradeService` stub interface — no network |
| `src/core/bootstrap.ts` | `createNewGame()` — main house at (9,9), starting kit |
| `src/core/loadContent.ts` | Build `ContentRegistry` from JSON data modules |
| `src/bridge/coords.ts` | `tileToWorld`, `worldToTile`, `TILE_SIZE` |
| `src/bridge/cameraSync.ts` | `syncThreeCameraFromPhaser` |
| `src/phaser/createGame.ts` | Phaser.Game factory with Boot + Game scenes |
| `src/phaser/scenes/BootScene.ts` | Boot → start Game |
| `src/phaser/scenes/GameScene.ts` | Grid draw, ghost placement, wire core place |
| `src/phaser/hud/hudLogic.ts` | Pure helpers for unlocked builds + research disable reasons |
| `src/phaser/hud/ResourceBar.ts` | Always-on food/wood/stone/coin display |
| `src/phaser/hud/BuildMenu.ts` | Buttons for unlocked blueprints only |
| `src/phaser/hud/ResearchPanel.ts` | Node list, cost/time, Start |
| `src/three/BuildingRenderer.ts` | Sync meshes from building list; colored boxes |
| `src/data/buildings.json` | main_house, farm, research_institute, lumber_yard (research-gated) |
| `src/data/recipes.json` | basic_food + unlockable recipes |
| `src/data/research.json` | Three-tier shallow tree |
| `tests/core/grid.test.ts` | Placement bounds/overlap |
| `tests/core/inventory.test.ts` | Soft cap + skip-when-full |
| `tests/core/buildings.test.ts` | place/demolish + main protected |
| `tests/core/farm.test.ts` | Production tick + skip when full |
| `tests/core/research.test.ts` | Queue, complete, unlock |
| `tests/core/tick.test.ts` | Farms + research on tick |
| `tests/core/save.test.ts` | Round-trip via MemoryStorage |
| `tests/core/bootstrap.test.ts` | New game invariants |
| `tests/core/hudLogic.test.ts` | Menu filter / research disable |
| `tests/core/loadContent.test.ts` | JSON → registry |
| `tests/bridge/coords.test.ts` | tile↔world + camera sync math |
| `tests/three/buildingLayout.test.ts` | Mesh layout math |
| `tests/smoke.test.ts` | Scaffold sanity |


### Task 1: Scaffold Vite + TypeScript + Vitest + Phaser + three

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/vite-env.d.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: none
- Produces: runnable `npm test` / `npm run dev`; path alias `@/*` → `src/*`

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
cd /workspace/city-builder
cat > package.json << 'EOF'
{
  "name": "city-builder",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
EOF
npm install
npm install phaser three
npm install -D vite typescript vitest @types/three
```

- [ ] **Step 2: Write tsconfig + Vite/Vitest config with `@/` alias**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write index.html, main stub, vite-env, and smoke test**

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>City Builder</title>
    <style>
      html, body, #app { margin: 0; height: 100%; overflow: hidden; background: #1a1a2e; }
      #app { position: relative; }
      #phaser-root, #three-root { position: absolute; inset: 0; }
      #three-root { pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="app">
      <div id="phaser-root"></div>
      <canvas id="three-root"></canvas>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}
```

```typescript
// src/main.ts
console.log('city-builder boot');
```

```typescript
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run smoke test to verify Vitest works**

Run: `npm test -- tests/smoke.test.ts`

Expected: PASS with `✓ tests/smoke.test.ts` and `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.ts src/vite-env.d.ts tests/smoke.test.ts
git commit -m "chore: scaffold Vite + TS + Vitest + Phaser + three"
```

---

### Task 2: Core types + Grid occupancy + placement rules

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/grid.ts`
- Create: `tests/core/grid.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export type ResourceId = 'food' | 'wood' | 'stone' | 'coin'`
  - `export type BuildingTypeId = 'main_house' | 'farm' | 'research_institute'`
  - `export interface Cell { x: number; y: number }`
  - `export interface Footprint { width: number; height: number }`
  - `export const GRID_WIDTH = 20`, `export const GRID_HEIGHT = 20`
  - `export class Grid { constructor(); canPlace(origin: Cell, footprint: Footprint): boolean; occupy(buildingId: string, origin: Cell, footprint: Footprint): void; vacate(origin: Cell, footprint: Footprint): void; getOccupant(cell: Cell): string | null; cellsFor(origin: Cell, footprint: Footprint): Cell[] }`

- [ ] **Step 1: Write the failing grid tests**

```typescript
// tests/core/grid.test.ts
import { describe, it, expect } from 'vitest';
import { Grid, GRID_WIDTH, GRID_HEIGHT } from '@/core/grid';

describe('Grid', () => {
  it('exposes fixed 20×20 size', () => {
    expect(GRID_WIDTH).toBe(20);
    expect(GRID_HEIGHT).toBe(20);
  });

  it('allows placing a 1×1 in bounds on empty cell', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 0, y: 0 }, { width: 1, height: 1 })).toBe(true);
  });

  it('rejects out-of-bounds footprint', () => {
    const g = new Grid();
    expect(g.canPlace({ x: 19, y: 19 }, { width: 2, height: 2 })).toBe(false);
    expect(g.canPlace({ x: -1, y: 0 }, { width: 1, height: 1 })).toBe(false);
  });

  it('rejects overlap after occupy', () => {
    const g = new Grid();
    g.occupy('a', { x: 5, y: 5 }, { width: 2, height: 2 });
    expect(g.canPlace({ x: 6, y: 6 }, { width: 1, height: 1 })).toBe(false);
    expect(g.getOccupant({ x: 5, y: 5 })).toBe('a');
  });

  it('vacate frees cells for new place', () => {
    const g = new Grid();
    g.occupy('a', { x: 2, y: 2 }, { width: 2, height: 2 });
    g.vacate({ x: 2, y: 2 }, { width: 2, height: 2 });
    expect(g.canPlace({ x: 2, y: 2 }, { width: 2, height: 2 })).toBe(true);
    expect(g.getOccupant({ x: 2, y: 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/grid.test.ts`

Expected: FAIL with message containing `Cannot find module '@/core/grid'` or `Failed to resolve import`

- [ ] **Step 3: Write types + Grid implementation**

```typescript
// src/core/types.ts
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
```

```typescript
// src/core/grid.ts
import type { Cell, Footprint } from './types';

export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 20;

export class Grid {
  private cells: (string | null)[][];

  constructor() {
    this.cells = Array.from({ length: GRID_HEIGHT }, () =>
      Array.from({ length: GRID_WIDTH }, () => null),
    );
  }

  cellsFor(origin: Cell, footprint: Footprint): Cell[] {
    const out: Cell[] = [];
    for (let dy = 0; dy < footprint.height; dy++) {
      for (let dx = 0; dx < footprint.width; dx++) {
        out.push({ x: origin.x + dx, y: origin.y + dy });
      }
    }
    return out;
  }

  canPlace(origin: Cell, footprint: Footprint): boolean {
    for (const c of this.cellsFor(origin, footprint)) {
      if (c.x < 0 || c.y < 0 || c.x >= GRID_WIDTH || c.y >= GRID_HEIGHT) {
        return false;
      }
      if (this.cells[c.y][c.x] !== null) return false;
    }
    return true;
  }

  occupy(buildingId: string, origin: Cell, footprint: Footprint): void {
    if (!this.canPlace(origin, footprint)) {
      throw new Error('cannot occupy: invalid placement');
    }
    for (const c of this.cellsFor(origin, footprint)) {
      this.cells[c.y][c.x] = buildingId;
    }
  }

  vacate(origin: Cell, footprint: Footprint): void {
    for (const c of this.cellsFor(origin, footprint)) {
      if (c.x < 0 || c.y < 0 || c.x >= GRID_WIDTH || c.y >= GRID_HEIGHT) continue;
      this.cells[c.y][c.x] = null;
    }
  }

  getOccupant(cell: Cell): string | null {
    if (cell.x < 0 || cell.y < 0 || cell.x >= GRID_WIDTH || cell.y >= GRID_HEIGHT) {
      return null;
    }
    return this.cells[cell.y][cell.x];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/grid.test.ts`

Expected: PASS with `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/grid.ts tests/core/grid.test.ts
git commit -m "feat(core): add types and 20x20 grid occupancy rules"
```

---

### Task 3: Inventory soft cap + skip-when-full semantics

**Files:**
- Create: `src/core/inventory.ts`
- Create: `tests/core/inventory.test.ts`

**Interfaces:**
- Consumes: `ResourceId`, `InventoryState` from `@/core/types`
- Produces:
  - `export function createInventory(softCap: number, amounts?: Partial<Record<ResourceId, number>>): InventoryState`
  - `export function totalAmount(inv: InventoryState): number`
  - `export function canAdd(inv: InventoryState, delta: Partial<Record<ResourceId, number>>): boolean`
  - `export function add(inv: InventoryState, delta: Partial<Record<ResourceId, number>>): boolean` — mutates if `canAdd`, else returns false (skip semantics)
  - `export function trySpend(inv: InventoryState, cost: Partial<Record<ResourceId, number>>): boolean`

- [ ] **Step 1: Write the failing inventory tests**

```typescript
// tests/core/inventory.test.ts
import { describe, it, expect } from 'vitest';
import { createInventory, totalAmount, canAdd, add, trySpend } from '@/core/inventory';

describe('inventory', () => {
  it('starts with coin 0 and given soft cap', () => {
    const inv = createInventory(100, { food: 10, wood: 5, stone: 2 });
    expect(inv.softCap).toBe(100);
    expect(inv.amounts.coin).toBe(0);
    expect(inv.amounts.food).toBe(10);
    expect(totalAmount(inv)).toBe(17);
  });

  it('canAdd is false when delta would exceed soft cap', () => {
    const inv = createInventory(10, { food: 8 });
    expect(canAdd(inv, { food: 3 })).toBe(false);
    expect(canAdd(inv, { food: 2 })).toBe(true);
  });

  it('add skips (returns false, no mutation) when full', () => {
    const inv = createInventory(5, { food: 5 });
    expect(add(inv, { wood: 1 })).toBe(false);
    expect(inv.amounts.food).toBe(5);
    expect(inv.amounts.wood).toBe(0);
  });

  it('add mutates when under cap', () => {
    const inv = createInventory(10, { food: 1 });
    expect(add(inv, { food: 2, wood: 1 })).toBe(true);
    expect(inv.amounts.food).toBe(3);
    expect(inv.amounts.wood).toBe(1);
  });

  it('trySpend deducts only when all costs affordable', () => {
    const inv = createInventory(100, { food: 5, wood: 1 });
    expect(trySpend(inv, { food: 6 })).toBe(false);
    expect(inv.amounts.food).toBe(5);
    expect(trySpend(inv, { food: 3, wood: 1 })).toBe(true);
    expect(inv.amounts.food).toBe(2);
    expect(inv.amounts.wood).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/inventory.test.ts`

Expected: FAIL with `Cannot find module '@/core/inventory'` or similar resolve error

- [ ] **Step 3: Write inventory implementation**

```typescript
// src/core/inventory.ts
import type { InventoryState, ResourceId } from './types';

const ZERO: Record<ResourceId, number> = {
  food: 0,
  wood: 0,
  stone: 0,
  coin: 0,
};

export function createInventory(
  softCap: number,
  amounts: Partial<Record<ResourceId, number>> = {},
): InventoryState {
  return {
    softCap,
    amounts: { ...ZERO, ...amounts, coin: amounts.coin ?? 0 },
  };
}

export function totalAmount(inv: InventoryState): number {
  return (Object.keys(ZERO) as ResourceId[]).reduce(
    (sum, id) => sum + inv.amounts[id],
    0,
  );
}

export function canAdd(
  inv: InventoryState,
  delta: Partial<Record<ResourceId, number>>,
): boolean {
  const addTotal = (Object.keys(delta) as ResourceId[]).reduce(
    (sum, id) => sum + (delta[id] ?? 0),
    0,
  );
  if (addTotal < 0) return false;
  return totalAmount(inv) + addTotal <= inv.softCap;
}

export function add(
  inv: InventoryState,
  delta: Partial<Record<ResourceId, number>>,
): boolean {
  if (!canAdd(inv, delta)) return false;
  for (const id of Object.keys(delta) as ResourceId[]) {
    inv.amounts[id] += delta[id] ?? 0;
  }
  return true;
}

export function trySpend(
  inv: InventoryState,
  cost: Partial<Record<ResourceId, number>>,
): boolean {
  for (const id of Object.keys(cost) as ResourceId[]) {
    if (inv.amounts[id] < (cost[id] ?? 0)) return false;
  }
  for (const id of Object.keys(cost) as ResourceId[]) {
    inv.amounts[id] -= cost[id] ?? 0;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/inventory.test.ts`

Expected: PASS with `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/inventory.ts tests/core/inventory.test.ts
git commit -m "feat(core): inventory soft cap with skip-when-full add"
```

---

### Task 4: Building registry + placeBuilding / demolish

**Files:**
- Create: `src/core/registry.ts`
- Create: `src/core/buildings.ts`
- Create: `src/core/trade.ts`
- Create: `tests/core/buildings.test.ts`

**Interfaces:**
- Consumes: `Grid`, `BuildingDef`, `BuildingInstance`, `GameState`, `trySpend`, `createInventory`
- Produces:
  - `export interface ContentRegistry { buildings: Map<BuildingTypeId, BuildingDef>; recipes: Map<string, RecipeDef>; research: Map<string, ResearchDef>; }`
  - `export function createRegistry(buildings: BuildingDef[], recipes: RecipeDef[], research: ResearchDef[]): ContentRegistry`
  - `export type PlaceResult = { ok: true; building: BuildingInstance } | { ok: false; reason: string }`
  - `export function placeBuilding(state: GameState, registry: ContentRegistry, typeId: BuildingTypeId, origin: Cell, idFactory?: () => string): PlaceResult`
  - `export type DemolishResult = { ok: true } | { ok: false; reason: string }`
  - `export function demolishBuilding(state: GameState, registry: ContentRegistry, buildingId: string): DemolishResult`
  - `export interface TradeService { reserve(resource: ResourceId, amount: number): string | null; commit(reservationId: string): boolean; cancel(reservationId: string): void; }`

- [ ] **Step 1: Write the failing building tests**

```typescript
// tests/core/buildings.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding, demolishBuilding } from '@/core/buildings';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 5, food: 2 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'Research Institute',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
];
const research: ResearchDef[] = [];

function freshState(): GameState {
  const grid = new Grid();
  const registry = createRegistry(buildings, recipes, research);
  const state: GameState = {
    tick: 0,
    grid,
    buildings: [],
    inventory: createInventory(100, { food: 20, wood: 20, stone: 20, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
  const main = placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  expect(main.ok).toBe(true);
  return state;
}

describe('placeBuilding / demolishBuilding', () => {
  it('places farm on empty cell and spends cost', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const beforeWood = state.inventory.amounts.wood;
    const result = placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.building.typeId).toBe('farm');
      expect(result.building.recipeId).toBe('basic_food');
    }
    expect(state.inventory.amounts.wood).toBe(beforeWood - 5);
    expect(state.grid.getOccupant({ x: 0, y: 0 })).toBe('farm-1');
  });

  it('rejects place overlapping main house', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const result = placeBuilding(state, registry, 'farm', { x: 9, y: 9 }, () => 'farm-x');
    expect(result.ok).toBe(false);
  });

  it('rejects locked blueprint', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    state.unlockedBlueprints = ['main_house'];
    const result = placeBuilding(state, registry, 'farm', { x: 1, y: 1 }, () => 'farm-x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unlock/i);
  });

  it('cannot demolish main house', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    const result = demolishBuilding(state, registry, 'main-1');
    expect(result.ok).toBe(false);
    expect(state.buildings.some((b) => b.id === 'main-1')).toBe(true);
  });

  it('demolishes farm and vacates cell', () => {
    const registry = createRegistry(buildings, recipes, research);
    const state = freshState();
    placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
    const result = demolishBuilding(state, registry, 'farm-1');
    expect(result.ok).toBe(true);
    expect(state.grid.getOccupant({ x: 0, y: 0 })).toBeNull();
    expect(state.buildings.find((b) => b.id === 'farm-1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/buildings.test.ts`

Expected: FAIL with `Cannot find module '@/core/buildings'`

- [ ] **Step 3: Write registry, trade stub, and buildings module**

```typescript
// src/core/trade.ts
import type { ResourceId } from './types';

/** Phase-2 seam only — no network in MVP. */
export interface TradeService {
  reserve(resource: ResourceId, amount: number): string | null;
  commit(reservationId: string): boolean;
  cancel(reservationId: string): void;
}

export class NoopTradeService implements TradeService {
  reserve(): string | null {
    return null;
  }
  commit(): boolean {
    return false;
  }
  cancel(): void {}
}
```

```typescript
// src/core/registry.ts
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
```

```typescript
// src/core/buildings.ts
import { trySpend } from './inventory';
import { createRegistry } from './registry';
import type {
  BuildingInstance,
  BuildingTypeId,
  Cell,
  GameState,
} from './types';
import type { ContentRegistry } from './registry';

export { createRegistry };
export type { ContentRegistry };

export type PlaceResult =
  | { ok: true; building: BuildingInstance }
  | { ok: false; reason: string };

export type DemolishResult = { ok: true } | { ok: false; reason: string };

let autoId = 0;
function defaultId(): string {
  autoId += 1;
  return `b-${autoId}`;
}

export function placeBuilding(
  state: GameState,
  registry: ContentRegistry,
  typeId: BuildingTypeId,
  origin: Cell,
  idFactory: () => string = defaultId,
): PlaceResult {
  if (!state.unlockedBlueprints.includes(typeId)) {
    return { ok: false, reason: 'blueprint not unlocked' };
  }
  const def = registry.buildings.get(typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!state.grid.canPlace(origin, def.footprint)) {
    return { ok: false, reason: 'invalid placement' };
  }
  if (!trySpend(state.inventory, def.cost)) {
    return { ok: false, reason: 'cannot afford' };
  }
  const building: BuildingInstance = {
    id: idFactory(),
    typeId,
    origin: { ...origin },
    recipeId: def.defaultRecipeId,
  };
  state.grid.occupy(building.id, origin, def.footprint);
  state.buildings.push(building);
  return { ok: true, building };
}

export function demolishBuilding(
  state: GameState,
  registry: ContentRegistry,
  buildingId: string,
): DemolishResult {
  const idx = state.buildings.findIndex((b) => b.id === buildingId);
  if (idx < 0) return { ok: false, reason: 'not found' };
  const building = state.buildings[idx];
  const def = registry.buildings.get(building.typeId);
  if (!def) return { ok: false, reason: 'unknown building type' };
  if (!def.demolishable || building.typeId === 'main_house') {
    return { ok: false, reason: 'cannot demolish' };
  }
  state.grid.vacate(building.origin, def.footprint);
  state.buildings.splice(idx, 1);
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/buildings.test.ts`

Expected: PASS with `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts src/core/buildings.ts src/core/trade.ts tests/core/buildings.test.ts
git commit -m "feat(core): place/demolish buildings with TradeService stub"
```

---

### Task 5: Farm production on tick

**Files:**
- Create: `src/core/farm.ts`
- Create: `src/core/tick.ts`
- Create: `tests/core/farm.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ContentRegistry`, `add` from inventory, building `recipeId`
- Produces:
  - `export function produceFarms(state: GameState, registry: ContentRegistry): void`
  - `export function advanceTick(state: GameState, registry: ContentRegistry): void` — temporarily in `farm.ts`; Task 6 moves orchestration to `tick.ts`

- [ ] **Step 1: Write the failing farm tests**

```typescript
// tests/core/farm.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { produceFarms, advanceTick } from '@/core/farm';
import type { BuildingDef, GameState, RecipeDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 0, food: 0 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 2 } },
];

function stateWithFarm(softCap = 100): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, []);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(softCap, { food: 0, wood: 10, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [],
    activeResearch: null,
  };
  placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'farm-1');
  return { state, registry };
}

describe('produceFarms', () => {
  it('adds recipe outputs each call', () => {
    const { state, registry } = stateWithFarm();
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(2);
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(4);
  });

  it('skips production when inventory cannot accept output', () => {
    const { state, registry } = stateWithFarm(3);
    state.inventory.amounts.food = 2;
    state.inventory.amounts.wood = 1;
    produceFarms(state, registry);
    expect(state.inventory.amounts.food).toBe(2);
  });

  it('advanceTick increments tick and produces', () => {
    const { state, registry } = stateWithFarm();
    advanceTick(state, registry);
    expect(state.tick).toBe(1);
    expect(state.inventory.amounts.food).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/farm.test.ts`

Expected: FAIL with `Cannot find module '@/core/farm'`

- [ ] **Step 3: Write farm + tick stub**

```typescript
// src/core/farm.ts
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

export function advanceTick(state: GameState, registry: ContentRegistry): void {
  produceFarms(state, registry);
  state.tick += 1;
}
```

```typescript
// src/core/tick.ts
export { advanceTick, produceFarms } from './farm';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/farm.test.ts`

Expected: PASS with `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/farm.ts src/core/tick.ts tests/core/farm.test.ts
git commit -m "feat(core): farm production tick skips when inventory full"
```

---

### Task 6: Research queue unlock blueprints

**Files:**
- Create: `src/core/research.ts`
- Modify: `src/core/tick.ts`
- Modify: `src/core/farm.ts` (keep `produceFarms` only; remove `advanceTick`)
- Modify: `tests/core/farm.test.ts` (import `advanceTick` from `@/core/tick`)
- Create: `tests/core/research.test.ts`
- Create: `tests/core/tick.test.ts`

**Interfaces:**
- Consumes: `trySpend`, `GameState`, `ContentRegistry`, `produceFarms`
- Produces:
  - `export type StartResearchResult = { ok: true } | { ok: false; reason: string }`
  - `export function startResearch(state: GameState, registry: ContentRegistry, researchId: string): StartResearchResult`
  - `export function advanceResearch(state: GameState, registry: ContentRegistry): void`
  - `export function advanceTick(state: GameState, registry: ContentRegistry): void` — produceFarms → advanceResearch → tick++

- [ ] **Step 1: Write the failing research + tick tests**

```typescript
// tests/core/research.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry } from '@/core/buildings';
import { startResearch, advanceResearch } from '@/core/research';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
  { id: 'wood_farm', label: 'Wood Farm', outputs: { wood: 1 } },
];

const researchDefs: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood Farming',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: ['tier2_market_prep'],
  },
  {
    id: 'tier2_market_prep',
    label: 'Market Prep',
    tier: 2,
    cost: { wood: 10 },
    durationTicks: 5,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
    softCapBonus: 20,
  },
];

function baseState(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, researchDefs);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, { food: 10, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['tier1_wood'],
    activeResearch: null,
  };
  return { state, registry };
}

describe('research queue', () => {
  it('starts research, spends cost, rejects second start', () => {
    const { state, registry } = baseState();
    const ok = startResearch(state, registry, 'tier1_wood');
    expect(ok).toEqual({ ok: true });
    expect(state.inventory.amounts.food).toBe(5);
    expect(state.activeResearch).toEqual({
      researchId: 'tier1_wood',
      remainingTicks: 3,
    });
    const busy = startResearch(state, registry, 'tier1_wood');
    expect(busy.ok).toBe(false);
  });

  it('completes after durationTicks and unlocks recipes + next nodes', () => {
    const { state, registry } = baseState();
    startResearch(state, registry, 'tier1_wood');
    advanceResearch(state, registry);
    advanceResearch(state, registry);
    expect(state.activeResearch).not.toBeNull();
    advanceResearch(state, registry);
    expect(state.activeResearch).toBeNull();
    expect(state.completedResearch).toContain('tier1_wood');
    expect(state.unlockedRecipes).toContain('wood_farm');
    expect(state.availableResearch).toContain('tier2_market_prep');
  });

  it('applies softCapBonus on complete', () => {
    const { state, registry } = baseState();
    state.inventory.amounts.food = 0;
    state.inventory.amounts.wood = 10;
    state.availableResearch = ['tier2_market_prep'];
    const cap = state.inventory.softCap;
    startResearch(state, registry, 'tier2_market_prep');
    for (let i = 0; i < 5; i++) advanceResearch(state, registry);
    expect(state.inventory.softCap).toBe(cap + 20);
  });
});
```

```typescript
// tests/core/tick.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch } from '@/core/research';
import { advanceTick } from '@/core/tick';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 0 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

describe('advanceTick', () => {
  it('runs farms then research and increments tick', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state: GameState = {
      tick: 0,
      grid: new Grid(),
      buildings: [],
      inventory: createInventory(50, { food: 0, wood: 5, stone: 0, coin: 0 }),
      unlockedBlueprints: ['main_house', 'farm'],
      unlockedRecipes: ['basic_food'],
      completedResearch: [],
      availableResearch: ['r1'],
      activeResearch: null,
    };
    placeBuilding(state, registry, 'farm', { x: 0, y: 0 }, () => 'f1');
    startResearch(state, registry, 'r1');
    advanceTick(state, registry);
    expect(state.inventory.amounts.food).toBe(1);
    expect(state.activeResearch?.remainingTicks).toBe(1);
    expect(state.tick).toBe(1);
    advanceTick(state, registry);
    expect(state.activeResearch).toBeNull();
    expect(state.completedResearch).toContain('r1');
    expect(state.tick).toBe(2);
  });
});
```

Also change `tests/core/farm.test.ts` import of `advanceTick` to:

```typescript
import { produceFarms } from '@/core/farm';
import { advanceTick } from '@/core/tick';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/core/research.test.ts tests/core/tick.test.ts`

Expected: FAIL with `Cannot find module '@/core/research'`

- [ ] **Step 3: Implement research and move advanceTick to tick.ts**

```typescript
// src/core/research.ts
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
```

```typescript
// src/core/farm.ts
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
```

```typescript
// src/core/tick.ts
import { produceFarms } from './farm';
import { advanceResearch } from './research';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export function advanceTick(state: GameState, registry: ContentRegistry): void {
  produceFarms(state, registry);
  advanceResearch(state, registry);
  state.tick += 1;
}

export { produceFarms };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/core/research.test.ts tests/core/tick.test.ts tests/core/farm.test.ts`

Expected: PASS (all research, tick, and farm tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/research.ts src/core/tick.ts src/core/farm.ts tests/core/research.test.ts tests/core/tick.test.ts tests/core/farm.test.ts
git commit -m "feat(core): single research queue unlocks blueprints and recipes"
```

---

### Task 7: Save/load round-trip with storage adapter

**Files:**
- Create: `src/core/storage.ts`
- Create: `src/core/save.ts`
- Create: `tests/core/save.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Grid`, `ContentRegistry`
- Produces:
  - `export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }`
  - `export class MemoryStorage implements StorageAdapter`
  - `export class LocalStorageAdapter implements StorageAdapter`
  - `export const SAVE_KEY = 'city-builder-save-v1'`
  - `export interface SerializedGame { version: 1; tick: number; buildings: BuildingInstance[]; inventory: InventoryState; unlockedBlueprints: BuildingTypeId[]; unlockedRecipes: string[]; completedResearch: string[]; availableResearch: string[]; activeResearch: ActiveResearch | null }`
  - `export function serializeGame(state: GameState): SerializedGame`
  - `export function deserializeGame(data: unknown, registry: ContentRegistry): GameState | null`
  - `export function saveGame(state: GameState, storage: StorageAdapter): void`
  - `export function loadGame(storage: StorageAdapter, registry: ContentRegistry): GameState | null`

- [ ] **Step 1: Write the failing save tests**

```typescript
// tests/core/save.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry, placeBuilding } from '@/core/buildings';
import { startResearch } from '@/core/research';
import { advanceTick } from '@/core/tick';
import {
  MemoryStorage,
  serializeGame,
  deserializeGame,
  saveGame,
  loadGame,
  SAVE_KEY,
} from '@/core/save';
import type { BuildingDef, GameState, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 0 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

function sampleState(): {
  state: GameState;
  registry: ReturnType<typeof createRegistry>;
} {
  const registry = createRegistry(buildings, recipes, researchDefs);
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(40, { food: 3, wood: 4, stone: 1, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['r1'],
    activeResearch: null,
  };
  placeBuilding(state, registry, 'main_house', { x: 9, y: 9 }, () => 'main-1');
  placeBuilding(state, registry, 'farm', { x: 1, y: 1 }, () => 'farm-1');
  startResearch(state, registry, 'r1');
  advanceTick(state, registry);
  return { state, registry };
}

describe('save/load', () => {
  it('round-trips serialize/deserialize', () => {
    const { state, registry } = sampleState();
    const raw = serializeGame(state);
    const loaded = deserializeGame(raw, registry);
    expect(loaded).not.toBeNull();
    expect(loaded!.tick).toBe(state.tick);
    expect(loaded!.buildings).toEqual(state.buildings);
    expect(loaded!.inventory).toEqual(state.inventory);
    expect(loaded!.activeResearch).toEqual(state.activeResearch);
    expect(loaded!.grid.getOccupant({ x: 9, y: 9 })).toBe('main-1');
    expect(loaded!.grid.getOccupant({ x: 1, y: 1 })).toBe('farm-1');
  });

  it('MemoryStorage saveGame/loadGame round-trip', () => {
    const { state, registry } = sampleState();
    const storage = new MemoryStorage();
    saveGame(state, storage);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = loadGame(storage, registry);
    expect(loaded?.buildings.map((b) => b.id).sort()).toEqual(
      state.buildings.map((b) => b.id).sort(),
    );
  });

  it('corrupt payload returns null', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    expect(deserializeGame(null, registry)).toBeNull();
    expect(deserializeGame({ version: 99 }, registry)).toBeNull();
    expect(deserializeGame('{not-json', registry)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/save.test.ts`

Expected: FAIL with `Cannot find module '@/core/save'`

- [ ] **Step 3: Write storage + save modules**

```typescript
// src/core/storage.ts
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    return globalThis.localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    globalThis.localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    globalThis.localStorage.removeItem(key);
  }
}
```

```typescript
// src/core/save.ts
import { Grid } from './grid';
import type { ContentRegistry } from './registry';
import type {
  ActiveResearch,
  BuildingInstance,
  BuildingTypeId,
  GameState,
  InventoryState,
} from './types';
import {
  MemoryStorage,
  LocalStorageAdapter,
  type StorageAdapter,
} from './storage';

export { MemoryStorage, LocalStorageAdapter };
export type { StorageAdapter };

export const SAVE_KEY = 'city-builder-save-v1';

export interface SerializedGame {
  version: 1;
  tick: number;
  buildings: BuildingInstance[];
  inventory: InventoryState;
  unlockedBlueprints: BuildingTypeId[];
  unlockedRecipes: string[];
  completedResearch: string[];
  availableResearch: string[];
  activeResearch: ActiveResearch | null;
}

export function serializeGame(state: GameState): SerializedGame {
  return {
    version: 1,
    tick: state.tick,
    buildings: state.buildings.map((b) => ({
      id: b.id,
      typeId: b.typeId,
      origin: { ...b.origin },
      recipeId: b.recipeId,
    })),
    inventory: {
      softCap: state.inventory.softCap,
      amounts: { ...state.inventory.amounts },
    },
    unlockedBlueprints: [...state.unlockedBlueprints],
    unlockedRecipes: [...state.unlockedRecipes],
    completedResearch: [...state.completedResearch],
    availableResearch: [...state.availableResearch],
    activeResearch: state.activeResearch
      ? { ...state.activeResearch }
      : null,
  };
}

export function deserializeGame(
  data: unknown,
  registry: ContentRegistry,
): GameState | null {
  try {
    const parsed =
      typeof data === 'string' ? (JSON.parse(data) as unknown) : data;
    if (!parsed || typeof parsed !== 'object') return null;
    const s = parsed as Partial<SerializedGame>;
    if (s.version !== 1) return null;
    if (typeof s.tick !== 'number' || !Array.isArray(s.buildings)) return null;
    if (!s.inventory?.amounts || typeof s.inventory.softCap !== 'number') {
      return null;
    }

    const grid = new Grid();
    const buildings = s.buildings as BuildingInstance[];
    for (const b of buildings) {
      const def = registry.buildings.get(b.typeId);
      if (!def) return null;
      if (!grid.canPlace(b.origin, def.footprint)) return null;
      grid.occupy(b.id, b.origin, def.footprint);
    }

    return {
      tick: s.tick,
      grid,
      buildings,
      inventory: {
        softCap: s.inventory.softCap,
        amounts: { ...s.inventory.amounts },
      },
      unlockedBlueprints: [...(s.unlockedBlueprints ?? [])],
      unlockedRecipes: [...(s.unlockedRecipes ?? [])],
      completedResearch: [...(s.completedResearch ?? [])],
      availableResearch: [...(s.availableResearch ?? [])],
      activeResearch: s.activeResearch ? { ...s.activeResearch } : null,
    };
  } catch {
    return null;
  }
}

export function saveGame(state: GameState, storage: StorageAdapter): void {
  storage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
}

export function loadGame(
  storage: StorageAdapter,
  registry: ContentRegistry,
): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw == null) return null;
  return deserializeGame(raw, registry);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/save.test.ts`

Expected: PASS with `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts src/core/save.ts tests/core/save.test.ts
git commit -m "feat(core): save/load JSON round-trip with storage adapter"
```

---

### Task 8: Bridge tile↔world + camera sync helpers

**Files:**
- Create: `src/bridge/coords.ts`
- Create: `src/bridge/cameraSync.ts`
- Create: `tests/bridge/coords.test.ts`

**Interfaces:**
- Consumes: none (pure math)
- Produces:
  - `export const TILE_SIZE = 32`
  - `export interface Vec2 { x: number; y: number }`
  - `export interface Vec3 { x: number; y: number; z: number }`
  - `export function tileToWorld(tileX: number, tileY: number, tileSize?: number): Vec3`
  - `export function worldToTile(worldX: number, worldZ: number, tileSize?: number): Vec2`
  - `export interface PhaserCamLike { scrollX: number; scrollY: number; zoom: number; width: number; height: number }`
  - `export interface ThreeCamLike { position: { x: number; y: number; z: number }; zoom: number; updateProjectionMatrix(): void }`
  - `export function syncThreeCameraFromPhaser(phaser: PhaserCamLike, three: ThreeCamLike): void`

- [ ] **Step 1: Write the failing coord tests**

```typescript
// tests/bridge/coords.test.ts
import { describe, it, expect } from 'vitest';
import { TILE_SIZE, tileToWorld, worldToTile } from '@/bridge/coords';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';

describe('coords', () => {
  it('tileToWorld centers on cell using TILE_SIZE', () => {
    const w = tileToWorld(0, 0);
    expect(w).toEqual({ x: TILE_SIZE / 2, y: 0, z: TILE_SIZE / 2 });
    const w2 = tileToWorld(2, 3, 10);
    expect(w2).toEqual({ x: 25, y: 0, z: 35 });
  });

  it('worldToTile is inverse floor mapping', () => {
    expect(worldToTile(16, 16)).toEqual({ x: 0, y: 0 });
    expect(worldToTile(32, 64)).toEqual({ x: 1, y: 2 });
    expect(worldToTile(25, 35, 10)).toEqual({ x: 2, y: 3 });
  });

  it('round-trip tile → world → tile', () => {
    for (const t of [
      { x: 0, y: 0 },
      { x: 5, y: 7 },
      { x: 19, y: 19 },
    ]) {
      const w = tileToWorld(t.x, t.y);
      expect(worldToTile(w.x, w.z)).toEqual(t);
    }
  });
});

describe('syncThreeCameraFromPhaser', () => {
  it('copies scroll/zoom into three orthographic camera', () => {
    const three = {
      position: { x: 0, y: 100, z: 0 },
      zoom: 1,
      updateProjectionMatrix() {
        this.updated = true;
      },
      updated: false,
    };
    syncThreeCameraFromPhaser(
      { scrollX: 64, scrollY: 96, zoom: 2, width: 800, height: 600 },
      three,
    );
    expect(three.position.x).toBe(64 + 800 / 2);
    expect(three.position.z).toBe(96 + 600 / 2);
    expect(three.zoom).toBe(2);
    expect(three.updated).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/bridge/coords.test.ts`

Expected: FAIL with `Cannot find module '@/bridge/coords'`

- [ ] **Step 3: Write coords + cameraSync**

```typescript
// src/bridge/coords.ts
export const TILE_SIZE = 32;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function tileToWorld(
  tileX: number,
  tileY: number,
  tileSize: number = TILE_SIZE,
): Vec3 {
  return {
    x: tileX * tileSize + tileSize / 2,
    y: 0,
    z: tileY * tileSize + tileSize / 2,
  };
}

export function worldToTile(
  worldX: number,
  worldZ: number,
  tileSize: number = TILE_SIZE,
): Vec2 {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldZ / tileSize),
  };
}
```

```typescript
// src/bridge/cameraSync.ts
export interface PhaserCamLike {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface ThreeCamLike {
  position: { x: number; y: number; z: number };
  zoom: number;
  updateProjectionMatrix(): void;
}

export function syncThreeCameraFromPhaser(
  phaser: PhaserCamLike,
  three: ThreeCamLike,
): void {
  three.position.x = phaser.scrollX + phaser.width / 2;
  three.position.z = phaser.scrollY + phaser.height / 2;
  three.zoom = phaser.zoom;
  three.updateProjectionMatrix();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/bridge/coords.test.ts`

Expected: PASS with `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/bridge/coords.ts src/bridge/cameraSync.ts tests/bridge/coords.test.ts
git commit -m "feat(bridge): tile/world conversion and Phaser→Three camera sync"
```

---

### Task 9: Phaser Boot + Game scene (grid, ghost, wire core)

**Files:**
- Create: `src/phaser/createGame.ts`
- Create: `src/phaser/scenes/BootScene.ts`
- Create: `src/phaser/scenes/GameScene.ts`
- Create: `src/core/bootstrap.ts`
- Create: `tests/core/bootstrap.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `createRegistry`, `placeBuilding`, `GameState`, `TILE_SIZE`, `GRID_WIDTH`/`HEIGHT`
- Produces:
  - `export function createNewGame(registry: ContentRegistry): GameState`
  - `export function createGame(parent: string, ctx: GameContext): Phaser.Game`
  - `export interface GameContext { state: GameState; registry: ContentRegistry; onStateChange: () => void; getSelectedBlueprint: () => BuildingTypeId | null; setSelectedBlueprint: (id: BuildingTypeId | null) => void }`

- [ ] **Step 1: Write failing bootstrap test**

```typescript
// tests/core/bootstrap.test.ts
import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import type { BuildingDef, RecipeDef, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 5, food: 2 },
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 1,
    meshHeight: 1,
  },
];
const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Food', outputs: { food: 1 } },
];
const researchDefs: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: [],
  },
];

describe('createNewGame', () => {
  it('pre-spawns non-demolishable main house and starting kit', () => {
    const registry = createRegistry(buildings, recipes, researchDefs);
    const state = createNewGame(registry);
    expect(state.buildings.some((b) => b.typeId === 'main_house')).toBe(true);
    expect(state.grid.getOccupant({ x: 9, y: 9 })).toBeTruthy();
    expect(state.inventory.amounts.coin).toBe(0);
    expect(state.inventory.amounts.food).toBeGreaterThanOrEqual(10);
    expect(state.unlockedBlueprints).toEqual(
      expect.arrayContaining(['main_house', 'farm', 'research_institute']),
    );
    expect(state.availableResearch).toContain('tier1_wood');
  });
});
```

- [ ] **Step 2: Run bootstrap test to verify it fails**

Run: `npm test -- tests/core/bootstrap.test.ts`

Expected: FAIL with `Cannot find module '@/core/bootstrap'`

- [ ] **Step 3: Implement bootstrap + Phaser scenes + main stub**

```typescript
// src/core/bootstrap.ts
import { placeBuilding, type ContentRegistry } from './buildings';
import { createInventory } from './inventory';
import { Grid } from './grid';
import type { GameState } from './types';

export function createNewGame(registry: ContentRegistry): GameState {
  const state: GameState = {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, {
      food: 20,
      wood: 30,
      stone: 20,
      coin: 0,
    }),
    unlockedBlueprints: ['main_house', 'farm', 'research_institute'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: [...registry.research.keys()].filter((id) => {
      const def = registry.research.get(id)!;
      return def.tier === 1;
    }),
    activeResearch: null,
  };

  const result = placeBuilding(
    state,
    registry,
    'main_house',
    { x: 9, y: 9 },
    () => 'main-1',
  );
  if (!result.ok) {
    throw new Error(`failed to spawn main house: ${result.reason}`);
  }
  return state;
}
```

```typescript
// src/phaser/createGame.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingTypeId, GameState } from '@/core/types';

export interface GameContext {
  state: GameState;
  registry: ContentRegistry;
  onStateChange: () => void;
  getSelectedBlueprint: () => BuildingTypeId | null;
  setSelectedBlueprint: (id: BuildingTypeId | null) => void;
}

export function createGame(parent: string, ctx: GameContext): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 640,
    backgroundColor: '#2d6a4f',
    scene: [new BootScene(ctx), new GameScene(ctx)],
  });
}
```

```typescript
// src/phaser/scenes/BootScene.ts
import Phaser from 'phaser';
import type { GameContext } from '../createGame';

export class BootScene extends Phaser.Scene {
  constructor(private ctx: GameContext) {
    super('Boot');
  }

  preload(): void {
    // Content comes from ctx.registry (JSON wired in Task 12).
  }

  create(): void {
    this.scene.start('Game');
  }
}
```

```typescript
// src/phaser/scenes/GameScene.ts
import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import { TILE_SIZE } from '@/bridge/coords';
import type { GameContext } from '../createGame';

export class GameScene extends Phaser.Scene {
  private ghost?: Phaser.GameObjects.Rectangle;
  private toastText?: Phaser.GameObjects.Text;

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.25);
    for (let x = 0; x <= GRID_WIDTH; x++) {
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      g.lineBetween(0, y * TILE_SIZE, GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }

    this.cameras.main.setBounds(
      0,
      0,
      GRID_WIDTH * TILE_SIZE,
      GRID_HEIGHT * TILE_SIZE,
    );
    this.cameras.main.centerOn(
      (GRID_WIDTH * TILE_SIZE) / 2,
      (GRID_HEIGHT * TILE_SIZE) / 2,
    );

    this.ghost = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0x00ff00, 0.35)
      .setOrigin(0)
      .setVisible(false);

    this.toastText = this.add
      .text(8, 8, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));

    this.redrawBuildings();
  }

  private tileFromPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return {
      x: Math.floor(world.x / TILE_SIZE),
      y: Math.floor(world.y / TILE_SIZE),
    };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId || !this.ghost) {
      this.ghost?.setVisible(false);
      return;
    }
    const def = this.ctx.registry.buildings.get(typeId);
    if (!def) return;
    const tile = this.tileFromPointer(p);
    const ok = this.ctx.state.grid.canPlace(tile, def.footprint);
    this.ghost
      .setSize(def.footprint.width * TILE_SIZE, def.footprint.height * TILE_SIZE)
      .setPosition(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
      .setFillStyle(ok ? 0x00ff00 : 0xff0000, 0.35)
      .setVisible(true);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId) return;
    const tile = this.tileFromPointer(p);
    const result = placeBuilding(this.ctx.state, this.ctx.registry, typeId, tile);
    if (!result.ok) {
      this.flash(result.reason);
      return;
    }
    this.redrawBuildings();
    this.ctx.onStateChange();
  }

  private flash(msg: string): void {
    if (!this.toastText) return;
    this.toastText.setText(msg);
    this.time.delayedCall(1200, () => this.toastText?.setText(''));
  }

  redrawBuildings(): void {
    const existing = this.children.list.filter(
      (c) => (c as Phaser.GameObjects.Rectangle).name === 'building-foot',
    );
    for (const c of existing) c.destroy();

    for (const b of this.ctx.state.buildings) {
      const def = this.ctx.registry.buildings.get(b.typeId);
      if (!def) continue;
      this.add
        .rectangle(
          b.origin.x * TILE_SIZE,
          b.origin.y * TILE_SIZE,
          def.footprint.width * TILE_SIZE,
          def.footprint.height * TILE_SIZE,
          def.meshColor,
          0.85,
        )
        .setOrigin(0)
        .setName('building-foot')
        .setDepth(1);
    }
  }

  refreshHud(): void {
    // Filled in Task 11
  }
}
```

```typescript
// src/main.ts
import { createRegistry } from '@/core/buildings';
import { createNewGame } from '@/core/bootstrap';
import { createGame } from '@/phaser/createGame';
import type {
  BuildingDef,
  BuildingTypeId,
  RecipeDef,
  ResearchDef,
} from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'Main House',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 0x8b4513,
    meshHeight: 1.5,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 5, food: 2 },
    meshColor: 0x228b22,
    meshHeight: 0.6,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'Research Institute',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8, wood: 4 },
    meshColor: 0x4169e1,
    meshHeight: 1.2,
  },
];

const recipes: RecipeDef[] = [
  { id: 'basic_food', label: 'Basic Food', outputs: { food: 1 } },
];

const research: ResearchDef[] = [
  {
    id: 'tier1_wood',
    label: 'Wood Farming',
    tier: 1,
    cost: { food: 5 },
    durationTicks: 3,
    unlocksBlueprints: [],
    unlocksRecipes: ['wood_farm'],
    unlocksResearch: ['tier2_stone'],
  },
];

const registry = createRegistry(buildings, recipes, research);
const state = createNewGame(registry);
let selected: BuildingTypeId | null = 'farm';

createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => {},
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});
```

- [ ] **Step 4: Run bootstrap test to verify it passes**

Run: `npm test -- tests/core/bootstrap.test.ts`

Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/core/bootstrap.ts src/phaser/createGame.ts src/phaser/scenes/BootScene.ts src/phaser/scenes/GameScene.ts src/main.ts tests/core/bootstrap.test.ts
git commit -m "feat(phaser): Boot/Game scenes with grid ghost placement wired to core"
```

---

### Task 10: Three BuildingRenderer sync meshes from building list

**Files:**
- Create: `src/three/BuildingRenderer.ts`
- Create: `tests/three/buildingLayout.test.ts`
- Modify: `src/main.ts` — create Three canvas; sync meshes + camera each frame

**Interfaces:**
- Consumes: `BuildingInstance[]`, `ContentRegistry`, `tileToWorld`, `syncThreeCameraFromPhaser`
- Produces:
  - `export function layoutBuildingMesh(origin: Cell, footprint: Footprint, meshHeight: number): { position: {x,y,z}; scale: {x,y,z} }`
  - `export class BuildingRenderer { constructor(canvas: HTMLCanvasElement); setSize(w: number, h: number): void; sync(buildings: BuildingInstance[], registry: ContentRegistry): void; render(): void; getCamera(): THREE.OrthographicCamera }`

- [ ] **Step 1: Write failing layout test**

```typescript
// tests/three/buildingLayout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutBuildingMesh } from '@/three/BuildingRenderer';
import { TILE_SIZE } from '@/bridge/coords';

describe('layoutBuildingMesh', () => {
  it('positions box at tile center with footprint scale', () => {
    const layout = layoutBuildingMesh(
      { x: 2, y: 1 },
      { width: 2, height: 1 },
      1.5,
    );
    expect(layout.position).toEqual({
      x: 2 * TILE_SIZE + TILE_SIZE,
      y: 1.5 / 2,
      z: 1 * TILE_SIZE + TILE_SIZE / 2,
    });
    expect(layout.scale).toEqual({
      x: 2 * TILE_SIZE * 0.9,
      y: 1.5,
      z: 1 * TILE_SIZE * 0.9,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/three/buildingLayout.test.ts`

Expected: FAIL with `Cannot find module '@/three/BuildingRenderer'`

- [ ] **Step 3: Implement BuildingRenderer + wire main.ts**

```typescript
// src/three/BuildingRenderer.ts
import * as THREE from 'three';
import { TILE_SIZE, tileToWorld } from '@/bridge/coords';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingInstance, Cell, Footprint } from '@/core/types';

export function layoutBuildingMesh(
  origin: Cell,
  footprint: Footprint,
  meshHeight: number,
): {
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
} {
  const center = tileToWorld(
    origin.x + (footprint.width - 1) / 2,
    origin.y + (footprint.height - 1) / 2,
  );
  return {
    position: { x: center.x, y: meshHeight / 2, z: center.z },
    scale: {
      x: footprint.width * TILE_SIZE * 0.9,
      y: meshHeight,
      z: footprint.height * TILE_SIZE * 0.9,
    },
  };
}

export class BuildingRenderer {
  readonly scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private root = new THREE.Group();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    const frustum = 320;
    this.camera = new THREE.OrthographicCamera(
      -frustum,
      frustum,
      frustum,
      -frustum,
      0.1,
      2000,
    );
    this.camera.position.set(320, 400, 320);
    this.camera.lookAt(320, 0, 320);
    this.scene.add(this.root);
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(5, 10, 3);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const frustum = 320;
    const aspect = w / h;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
  }

  sync(buildings: BuildingInstance[], registry: ContentRegistry): void {
    while (this.root.children.length) {
      const child = this.root.children[0];
      this.root.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    for (const b of buildings) {
      const def = registry.buildings.get(b.typeId);
      if (!def) continue;
      const layout = layoutBuildingMesh(b.origin, def.footprint, def.meshHeight);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: def.meshColor }),
      );
      mesh.position.set(layout.position.x, layout.position.y, layout.position.z);
      mesh.scale.set(layout.scale.x, layout.scale.y, layout.scale.z);
      this.root.add(mesh);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
```

Replace `src/main.ts` body after registry/state setup with:

```typescript
import { BuildingRenderer } from '@/three/BuildingRenderer';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';
import type Phaser from 'phaser';

const canvas = document.getElementById('three-root') as HTMLCanvasElement;
const buildings3d = new BuildingRenderer(canvas);
buildings3d.setSize(640, 640);
buildings3d.sync(state.buildings, registry);

const game = createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => buildings3d.sync(state.buildings, registry),
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});

function frame() {
  const scene = game.scene.getScene('Game') as Phaser.Scene | null;
  if (scene?.cameras?.main) {
    const cam = scene.cameras.main;
    syncThreeCameraFromPhaser(
      {
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
        width: cam.width,
        height: cam.height,
      },
      buildings3d.getCamera(),
    );
  }
  buildings3d.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Keep the inline `buildings` / `recipes` / `research` arrays from Task 9 until Task 12 replaces them with JSON imports.

- [ ] **Step 4: Run layout test to verify it passes**

Run: `npm test -- tests/three/buildingLayout.test.ts`

Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/three/BuildingRenderer.ts src/main.ts tests/three/buildingLayout.test.ts
git commit -m "feat(three): BuildingRenderer syncs colored box meshes from buildings"
```

---

### Task 11: HUD — resources, build menu (unlocked only), research panel

**Files:**
- Create: `src/phaser/hud/hudLogic.ts`
- Create: `src/phaser/hud/ResourceBar.ts`
- Create: `src/phaser/hud/BuildMenu.ts`
- Create: `src/phaser/hud/ResearchPanel.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Create: `tests/core/hudLogic.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ContentRegistry`, `startResearch`, `setSelectedBlueprint`
- Produces:
  - `export function unlockedBuildOptions(state: GameState, registry: ContentRegistry): BuildingDef[]`
  - `export function researchStartDisabledReason(state: GameState, registry: ContentRegistry, researchId: string): string | null`
  - Phaser HUD classes using those helpers

- [ ] **Step 1: Write failing HUD logic tests**

```typescript
// tests/core/hudLogic.test.ts
import { describe, it, expect } from 'vitest';
import { Grid } from '@/core/grid';
import { createInventory } from '@/core/inventory';
import { createRegistry } from '@/core/buildings';
import {
  unlockedBuildOptions,
  researchStartDisabledReason,
} from '@/phaser/hud/hudLogic';
import type { BuildingDef, GameState, ResearchDef } from '@/core/types';

const buildings: BuildingDef[] = [
  {
    id: 'main_house',
    label: 'MH',
    footprint: { width: 2, height: 2 },
    demolishable: false,
    cost: {},
    meshColor: 1,
    meshHeight: 1,
  },
  {
    id: 'farm',
    label: 'Farm',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { wood: 5 },
    meshColor: 1,
    meshHeight: 1,
    defaultRecipeId: 'basic_food',
  },
  {
    id: 'research_institute',
    label: 'RI',
    footprint: { width: 1, height: 1 },
    demolishable: true,
    cost: { stone: 8 },
    meshColor: 1,
    meshHeight: 1,
  },
];

const researchDefs: ResearchDef[] = [
  {
    id: 'r1',
    label: 'R1',
    tier: 1,
    cost: { food: 50 },
    durationTicks: 2,
    unlocksBlueprints: [],
    unlocksRecipes: [],
    unlocksResearch: [],
  },
];

function state(): GameState {
  return {
    tick: 0,
    grid: new Grid(),
    buildings: [],
    inventory: createInventory(100, { food: 0, wood: 0, stone: 0, coin: 0 }),
    unlockedBlueprints: ['main_house', 'farm'],
    unlockedRecipes: ['basic_food'],
    completedResearch: [],
    availableResearch: ['r1'],
    activeResearch: null,
  };
}

describe('hudLogic', () => {
  it('lists only unlocked placeable blueprints (no main house)', () => {
    const registry = createRegistry(buildings, [], researchDefs);
    const opts = unlockedBuildOptions(state(), registry);
    expect(opts.map((o) => o.id)).toEqual(['farm']);
  });

  it('disables research start when cannot afford or queue busy', () => {
    const registry = createRegistry(buildings, [], researchDefs);
    const s = state();
    expect(researchStartDisabledReason(s, registry, 'r1')).toMatch(/afford/i);
    s.inventory.amounts.food = 50;
    s.activeResearch = { researchId: 'r1', remainingTicks: 1 };
    expect(researchStartDisabledReason(s, registry, 'r1')).toMatch(/busy/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/hudLogic.test.ts`

Expected: FAIL with `Cannot find module '@/phaser/hud/hudLogic'`

- [ ] **Step 3: Implement hudLogic + Phaser HUD panels + GameScene wiring**

```typescript
// src/phaser/hud/hudLogic.ts
import type { ContentRegistry } from '@/core/registry';
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
```

```typescript
// src/phaser/hud/ResourceBar.ts
import Phaser from 'phaser';
import type { GameState } from '@/core/types';

export class ResourceBar {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(2000);
  }

  refresh(state: GameState): void {
    const a = state.inventory.amounts;
    this.text.setText(
      `Food ${a.food}  Wood ${a.wood}  Stone ${a.stone}  Coin ${a.coin}  | Tick ${state.tick}`,
    );
  }
}
```

```typescript
// src/phaser/hud/BuildMenu.ts
import Phaser from 'phaser';
import { unlockedBuildOptions } from './hudLogic';
import type { GameContext } from '../createGame';
import type { BuildingTypeId } from '@/core/types';

export class BuildMenu {
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private ctx: GameContext,
  ) {
    this.container = scene.add.container(8, 40).setScrollFactor(0).setDepth(2000);
    this.refresh();
  }

  refresh(): void {
    this.container.removeAll(true);
    const opts = unlockedBuildOptions(this.ctx.state, this.ctx.registry);
    opts.forEach((def, i) => {
      const label = `${def.label} (${Object.entries(def.cost)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')})`;
      const btn = this.container.scene.add
        .text(0, i * 22, label, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffe066',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => {
        this.ctx.setSelectedBlueprint(def.id as BuildingTypeId);
      });
      this.container.add(btn);
    });
  }
}
```

```typescript
// src/phaser/hud/ResearchPanel.ts
import Phaser from 'phaser';
import { startResearch } from '@/core/research';
import { researchStartDisabledReason } from './hudLogic';
import type { GameContext } from '../createGame';

export class ResearchPanel {
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private ctx: GameContext,
  ) {
    this.container = scene.add.container(8, 140).setScrollFactor(0).setDepth(2000);
    this.refresh();
  }

  refresh(): void {
    this.container.removeAll(true);
    const title = this.container.scene.add.text(0, 0, 'Research', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#a0e7ff',
    });
    this.container.add(title);

    const active = this.ctx.state.activeResearch;
    if (active) {
      this.container.add(
        this.container.scene.add.text(
          0,
          20,
          `In progress: ${active.researchId} (${active.remainingTicks} ticks)`,
          { fontFamily: 'monospace', fontSize: '12px', color: '#ccc' },
        ),
      );
    }

    this.ctx.state.availableResearch.forEach((id, i) => {
      const def = this.ctx.registry.research.get(id);
      if (!def) return;
      const reason = researchStartDisabledReason(
        this.ctx.state,
        this.ctx.registry,
        id,
      );
      const cost = Object.entries(def.cost)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      const label = reason
        ? `${def.label} — ${reason}`
        : `${def.label} [${cost}] ${def.durationTicks}t — Start`;
      const btn = this.container.scene.add
        .text(0, 44 + i * 22, label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: reason ? '#888' : '#7CFC00',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setInteractive({ useHandCursor: !reason });
      if (!reason) {
        btn.on('pointerup', () => {
          const result = startResearch(this.ctx.state, this.ctx.registry, id);
          if (!result.ok) return;
          this.ctx.onStateChange();
          this.refresh();
        });
      }
      this.container.add(btn);
    });
  }
}
```

Add to `GameScene` (fields + create + refreshHud):

```typescript
import { ResourceBar } from '../hud/ResourceBar';
import { BuildMenu } from '../hud/BuildMenu';
import { ResearchPanel } from '../hud/ResearchPanel';

// fields:
private resourceBar!: ResourceBar;
private buildMenu!: BuildMenu;
private researchPanel!: ResearchPanel;

// at end of create():
this.resourceBar = new ResourceBar(this);
this.buildMenu = new BuildMenu(this, this.ctx);
this.researchPanel = new ResearchPanel(this, this.ctx);
this.resourceBar.refresh(this.ctx.state);

const prev = this.ctx.onStateChange;
this.ctx.onStateChange = () => {
  prev();
  this.refreshHud();
  this.redrawBuildings();
};

// method:
refreshHud(): void {
  this.resourceBar.refresh(this.ctx.state);
  this.buildMenu.refresh();
  this.researchPanel.refresh();
}
```

Note: `GameContext.onStateChange` must be a mutable property (plain object field), which it already is.

- [ ] **Step 4: Run HUD logic tests**

Run: `npm test -- tests/core/hudLogic.test.ts`

Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/phaser/hud/hudLogic.ts src/phaser/hud/ResourceBar.ts src/phaser/hud/BuildMenu.ts src/phaser/hud/ResearchPanel.ts src/phaser/scenes/GameScene.ts tests/core/hudLogic.test.ts
git commit -m "feat(phaser): HUD resource bar, unlocked build menu, research panel"
```

---

### Task 12: data/*.json + new-game bootstrap from data + auto-save

**Files:**
- Create: `src/data/buildings.json`
- Create: `src/data/recipes.json`
- Create: `src/data/research.json`
- Create: `src/core/loadContent.ts`
- Create: `tests/core/loadContent.test.ts`
- Modify: `src/main.ts` — JSON imports, LocalStorageAdapter, 1s tick, auto-save
- Modify: `src/phaser/scenes/GameScene.ts` — ensure `refreshHud` is public (already from Task 11)

**Interfaces:**
- Consumes: all core + storage + Phaser/Three wiring
- Produces:
  - `export function loadContentFromData(buildingsJson: unknown, recipesJson: unknown, researchJson: unknown): ContentRegistry`
  - Boot: `loadGame(storage, registry) ?? createNewGame(registry)`; corrupt → `console.warn` + new game
  - Loop: `setInterval(() => { advanceTick(...); saveGame(...); sync + refreshHud }, 1000)`

- [ ] **Step 1: Write failing loadContent test**

```typescript
// tests/core/loadContent.test.ts
import { describe, it, expect } from 'vitest';
import { loadContentFromData } from '@/core/loadContent';
import buildings from '@/data/buildings.json';
import recipes from '@/data/recipes.json';
import research from '@/data/research.json';

describe('loadContentFromData', () => {
  it('loads three building types and tiered research', () => {
    const registry = loadContentFromData(buildings, recipes, research);
    expect(registry.buildings.get('main_house')?.footprint).toEqual({
      width: 2,
      height: 2,
    });
    expect(registry.buildings.get('farm')?.footprint).toEqual({
      width: 1,
      height: 1,
    });
    expect(registry.buildings.get('research_institute')?.footprint).toEqual({
      width: 1,
      height: 1,
    });
    expect(registry.recipes.has('basic_food')).toBe(true);
    expect(registry.research.size).toBeGreaterThanOrEqual(3);
    const tiers = [...registry.research.values()].map((r) => r.tier);
    expect(tiers).toEqual(expect.arrayContaining([1, 2, 3]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/loadContent.test.ts`

Expected: FAIL with resolve error for `@/core/loadContent` or missing JSON

- [ ] **Step 3: Write JSON data + loader + wire main auto-save**

```json
// src/data/buildings.json
[
  {
    "id": "main_house",
    "label": "Main House",
    "footprint": { "width": 2, "height": 2 },
    "demolishable": false,
    "cost": {},
    "meshColor": 9127187,
    "meshHeight": 1.5
  },
  {
    "id": "farm",
    "label": "Farm",
    "footprint": { "width": 1, "height": 1 },
    "demolishable": true,
    "cost": { "wood": 5, "food": 2 },
    "meshColor": 2263842,
    "meshHeight": 0.6,
    "defaultRecipeId": "basic_food"
  },
  {
    "id": "research_institute",
    "label": "Research Institute",
    "footprint": { "width": 1, "height": 1 },
    "demolishable": true,
    "cost": { "stone": 8, "wood": 4 },
    "meshColor": 4286945,
    "meshHeight": 1.2
  },
  {
    "id": "lumber_yard",
    "label": "Lumber Yard",
    "footprint": { "width": 1, "height": 1 },
    "demolishable": true,
    "cost": { "wood": 10, "stone": 4 },
    "meshColor": 139,
    "meshHeight": 0.9,
    "defaultRecipeId": "wood_farm"
  }
]
```

```json
// src/data/recipes.json
[
  { "id": "basic_food", "label": "Basic Food", "outputs": { "food": 1 } },
  { "id": "wood_farm", "label": "Wood Lot", "outputs": { "wood": 1 } },
  { "id": "stone_farm", "label": "Quarry Plot", "outputs": { "stone": 1 } }
]
```

```json
// src/data/research.json
[
  {
    "id": "tier1_wood",
    "label": "Wood Farming",
    "tier": 1,
    "cost": { "food": 8 },
    "durationTicks": 5,
    "unlocksBlueprints": ["lumber_yard"],
    "unlocksRecipes": ["wood_farm"],
    "unlocksResearch": ["tier2_stone"]
  },
  {
    "id": "tier2_stone",
    "label": "Stone Farming",
    "tier": 2,
    "cost": { "wood": 12, "food": 6 },
    "durationTicks": 8,
    "unlocksBlueprints": [],
    "unlocksRecipes": ["stone_farm"],
    "unlocksResearch": ["tier3_market_prep"],
    "softCapBonus": 25
  },
  {
    "id": "tier3_market_prep",
    "label": "Market Prep",
    "tier": 3,
    "cost": { "stone": 15, "wood": 10, "food": 10 },
    "durationTicks": 12,
    "unlocksBlueprints": [],
    "unlocksRecipes": [],
    "unlocksResearch": [],
    "softCapBonus": 50
  }
]
```

```typescript
// src/core/loadContent.ts
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
```

```typescript
// src/main.ts (final)
import buildingsJson from '@/data/buildings.json';
import recipesJson from '@/data/recipes.json';
import researchJson from '@/data/research.json';
import { loadContentFromData } from '@/core/loadContent';
import { createNewGame } from '@/core/bootstrap';
import { advanceTick } from '@/core/tick';
import {
  LocalStorageAdapter,
  loadGame,
  saveGame,
  SAVE_KEY,
} from '@/core/save';
import { createGame } from '@/phaser/createGame';
import { BuildingRenderer } from '@/three/BuildingRenderer';
import { syncThreeCameraFromPhaser } from '@/bridge/cameraSync';
import type { BuildingTypeId } from '@/core/types';
import type Phaser from 'phaser';

const registry = loadContentFromData(buildingsJson, recipesJson, researchJson);
const storage = new LocalStorageAdapter();
const hadSave = storage.getItem(SAVE_KEY) != null;
let state = loadGame(storage, registry);
if (!state) {
  if (hadSave) {
    console.warn('Corrupt save — starting new game');
  }
  state = createNewGame(registry);
}

let selected: BuildingTypeId | null = 'farm';

const canvas = document.getElementById('three-root') as HTMLCanvasElement;
const buildings3d = new BuildingRenderer(canvas);
buildings3d.setSize(640, 640);
buildings3d.sync(state.buildings, registry);

const game = createGame('phaser-root', {
  state,
  registry,
  onStateChange: () => {
    buildings3d.sync(state.buildings, registry);
    saveGame(state, storage);
  },
  getSelectedBlueprint: () => selected,
  setSelectedBlueprint: (id) => {
    selected = id;
  },
});

setInterval(() => {
  advanceTick(state, registry);
  saveGame(state, storage);
  buildings3d.sync(state.buildings, registry);
  const scene = game.scene.getScene('Game') as Phaser.Scene & {
    refreshHud?: () => void;
  };
  scene.refreshHud?.();
}, 1000);

function frame() {
  const scene = game.scene.getScene('Game') as Phaser.Scene | null;
  if (scene?.cameras?.main) {
    const cam = scene.cameras.main;
    syncThreeCameraFromPhaser(
      {
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        zoom: cam.zoom,
        width: cam.width,
        height: cam.height,
      },
      buildings3d.getCamera(),
    );
  }
  buildings3d.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: PASS — all suites green (smoke, grid, inventory, buildings, farm, research, tick, save, coords, bootstrap, buildingLayout, hudLogic, loadContent)

Manual checklist:
1. Place a farm → wait ≥1s → food increases
2. Place research institute → start tier1 research → wait until complete → wood recipe unlocked
3. Refresh page → buildings, inventory, research progress restored

- [ ] **Step 5: Commit**

```bash
git add src/data/buildings.json src/data/recipes.json src/data/research.json src/core/loadContent.ts src/main.ts src/phaser/scenes/GameScene.ts tests/core/loadContent.test.ts
git commit -m "feat: data-driven content, new-game bootstrap, localStorage auto-save"
```

---

## Plan Self-Review

### Spec coverage mapping

| Spec section | Task(s) |
|--------------|---------|
| Goal / sandbox 20×20 no win | Global Constraints; Task 2 grid constants |
| Architecture Approach A (core / phaser / three / bridge) | File Structure; Tasks 2–11 |
| Input via Phaser only | Task 9 GameScene pointer handlers; Three `pointer-events: none` in Task 1 HTML |
| Map & placement (overlap, bounds, ghost, main 2×2 pre-spawned non-demolishable) | Tasks 2, 4, 9; bootstrap Tasks 9/12 |
| Buildings: main / farm / research institute | Tasks 4–6, 12 JSON |
| Farm tick production; skip if inventory full | Tasks 3, 5 |
| Single research queue; unlock blueprints/recipes | Task 6 |
| Market TradeService stub only | Task 4 `trade.ts` |
| Economy: food/wood/stone/coin; coin starts 0; soft cap | Tasks 3, 9 bootstrap, 12 |
| Research three-tier shallow tree in data | Task 12 `research.json` (tier1 unlocks `lumber_yard`) |
| Real-time fixed ticks (1s) | Task 12 `setInterval` |
| Persistence localStorage JSON; corrupt → new game | Tasks 7, 12 |
| Rendering 2.5D Phaser ground + Three boxes; camera sync | Tasks 8–10 |
| UI: resource bar, unlocked build menu, research panel | Task 11 |
| Project layout `src/{core,phaser,three,bridge,data}` | File Structure |
| Testing core unit tests + manual checklist | Tasks 2–8, 11–12; Task 12 manual list |
| Non-goals / YAGNI (no MP, day/night, GLTF required) | Global Constraints; Task 10 boxes only |
| Error handling place/research/save/renderer rebuild | Tasks 4, 6, 7, 9–10, 12 |
| Starting kit enough for 1–2 farms + first research | Task 9 `createNewGame` inventory |

### Placeholder scan

No TBD/TODO/`similar to Task N` without inlined code. Task 9 embeds full BuildingDef arrays; Task 12 replaces them with JSON. Task 5 temporarily hosts `advanceTick` in `farm.ts`; Task 6 moves it to `tick.ts` with updated imports in the same task.

### Type consistency

- `GameState`, `ContentRegistry`, `placeBuilding`, `advanceTick`, `StorageAdapter`, `tileToWorld`, `syncThreeCameraFromPhaser`, `createNewGame`, `SAVE_KEY` names are stable across tasks.
- `createRegistry` is defined in `registry.ts` and re-exported from `buildings.ts` so later tasks import one path.
- `GameContext.onStateChange` is a mutable object field so GameScene can wrap it for HUD refresh.

### Assumptions

1. Soft cap is a **single total** across all four resources (sum of amounts), not per-resource caps.
2. Tick interval is **1000ms** wall clock; research `durationTicks` counts game ticks.
3. Main house spawn origin fixed at **(9,9)** (2×2 covering cells 9–10).
4. Starting unlocked blueprints: `main_house`, `farm`, `research_institute`; starting recipe `basic_food`; all tier-1 research nodes available at new game.
5. Recipe swap UI deferred; farms use `defaultRecipeId` on the instance; unlocking a recipe does not auto-retarget existing farms in MVP (player places new farms after unlock, or keep basic_food — YAGNI).
6. Phaser footprint rectangles remain as cheap ground markers; Three meshes are the canonical 2.5D buildings.
7. Vitest runs in **node** environment; Three WebGL not unit-tested beyond pure `layoutBuildingMesh`.
8. `coin` stays in schema at 0; Market Prep research only raises soft cap (no network listings).
9. Tier-1 research unlocks the `lumber_yard` blueprint (and `wood_farm` recipe) so the MVP success path is: place farm → research → place lumber yard. Wood/stone recipes attach via each building’s `defaultRecipeId`; no recipe-swap UI in MVP.
