# Custom Units, Market, and Trade Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invented buildings gain a unique resource and unit; the inventor produces and trains locally; a market sells blueprints; buyers place replicas and train only by importing the inventor’s unique resource.

**Architecture:** Keep unique goods off `inventory.amounts` (still only food/wood/stone/coin). Origin instances store `uniquePending` + `exportStock`. Pure `src/core/customEconomy.ts` owns produce/harvest/train-origin. Pure `src/core/market.ts` + `server/marketStore.ts` own listings. Replica train is a `PlayerStore` two-file lock that catch-up-ticks the seller then spends export stock. Combat is out of scope.

**Tech Stack:** Vite, TypeScript, Phaser 3, Hono, Vitest, LiteLLM chat (existing)

## Global Constraints

- Unique resources never increment `inventory.amounts.food|wood|stone|coin`
- Origin +1 unique / tick; pending and export stock cap 50 each
- Train cost: 5 unique + 2 food → 1 army unit
- Default export price 2 coin per unique (range 1–20); listing price default 20 (range 10–200)
- Local slots stay `custom-1`…`custom-3`; shared ids `custom-{owner}-{n}`, `res-{owner}-{n}`, `unit-{owner}-{n}`
- Buyers train on the replica (option A); replicas never produce unique resource
- One listing per slot; no resale; forget drops listing; replicas become abandoned
- Custom footprint stays 3×3; max 3 invent slots
- TDD: failing test → implement → pass → commit each task
- Respond to the user in Vietnamese if talking to them; plan/code comments in English

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `src/core/types.ts` | Extend `CustomBuilding`, `BuildingInstance`, `GameState`, add `BuildingLicense` |
| `src/core/customIds.ts` | Parse/build shared ids from owner + slot |
| `src/core/customEconomy.ts` | Caps, produce unique, harvest unique, train origin, addArmy |
| `src/core/customBuilding.ts` | Invent trio fields, fallback names, normalize defaults |
| `src/core/licenses.ts` | Merge licenses into registry as non-producing defs |
| `src/core/market.ts` | Pure list/unlist/buy validation + listing type |
| `src/core/tick.ts` | Call `produceCustomOrigins` after farms |
| `src/core/save.ts` | Persist new fields; default army/licenses/export |
| `src/core/farm.ts` | Harvest: if origin custom, harvest unique instead of warehouse |
| `src/core/bootstrap.ts` | New game: `army: {}`, `licenses: []` |
| `server/nameBuilding.ts` | `nameInventTrio` JSON `{building,resource,unit}` |
| `server/marketStore.ts` | Read/write `data/market/listings.json` |
| `server/playerStore.ts` | Invent trio, train, export, market ops, two-file train |
| `server/index.ts` | New HTTP routes |
| `src/api/client.ts` | Client methods |
| `src/phaser/hud/hudLogic.ts` | Market panel + train disable reasons |
| `src/ui/Sidebar.ts` | Origin/replica/market/army UI |
| `src/main.ts` | Wire commands; merge licenses |
| `index.html` | Market footer button + section |
| `tests/core/customIds.test.ts` | Id helpers |
| `tests/core/customEconomy.test.ts` | Produce/harvest/train origin |
| `tests/core/market.test.ts` | List/buy rules |
| `tests/server/nameBuilding.test.ts` | Trio parse + fallback |
| `tests/server/playerStore.test.ts` | Invent fields, train, market, two-player train |
| `tests/core/save.test.ts` | Round-trip new fields |

---

### Task 1: Shared ids, fallback names, persist invent trio

**Files:**
- Create: `src/core/customIds.ts`
- Create: `tests/core/customIds.test.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/customBuilding.ts`
- Modify: `src/core/save.ts`
- Modify: `src/core/bootstrap.ts`
- Test: `tests/core/customBuilding.test.ts`, `tests/core/save.test.ts`

**Interfaces:**
- Consumes: existing `CustomBuilding`, `sanitizeBuildingName`, `customBuildingLabel`
- Produces:
  - `parseCustomSlot(id: string): 1 | 2 | 3 | null`
  - `sharedCustomTypeId(owner: string, slot: 1 \| 2 \| 3): string` → `custom-{owner}-{n}`
  - `sharedResourceId(owner: string, slot: 1 \| 2 \| 3): string`
  - `sharedUnitId(owner: string, slot: 1 \| 2 \| 3): string`
  - `fallbackInventNames(prompt: string): { building: string; resource: string; unit: string }`
  - `applyInventedBuilding(..., input: { ..., names?: { building?: string; resource?: string; unit?: string }; owner?: string })`
  - `CustomBuilding` gains `resourceId`, `resourceLabel`, `unitId`, `unitLabel`, `exportPrice`, `exportEnabled`
  - `GameState.army: Record<string, number>`
  - `GameState.licenses: BuildingLicense[]`
  - `BuildingInstance.uniquePending?: number`
  - `BuildingInstance.exportStock?: number`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/customIds.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseCustomSlot,
  sharedCustomTypeId,
  sharedResourceId,
  sharedUnitId,
  fallbackInventNames,
} from '@/core/customIds';

describe('custom ids', () => {
  it('builds stable shared ids from owner + slot', () => {
    expect(parseCustomSlot('custom-1')).toBe(1);
    expect(parseCustomSlot('farm')).toBeNull();
    expect(sharedCustomTypeId('zz', 1)).toBe('custom-zz-1');
    expect(sharedResourceId('zz', 1)).toBe('res-zz-1');
    expect(sharedUnitId('zz', 1)).toBe('unit-zz-1');
  });

  it('falls back to Ore / Troop names from the prompt', () => {
    expect(fallbackInventNames('crystal bakery')).toEqual({
      building: 'crystal bakery',
      resource: 'crystal bakery Ore',
      unit: 'crystal bakery Troop',
    });
  });
});
```

Also extend `tests/core/customBuilding.test.ts` invent apply: after `applyInventedBuilding` with `owner: 'ada'` and no names, expect `resourceId === 'res-ada-1'`, `unitLabel` ends with `Troop`, `exportPrice === 2`, `exportEnabled === true`.

Extend a save round-trip: state with `army: { 'unit-ada-1': 3 }`, `licenses: []`, building `exportStock: 4`, `uniquePending: 2` must reload equal.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/customIds.test.ts tests/core/customBuilding.test.ts tests/core/save.test.ts`

Expected: FAIL — `customIds` module missing; apply result lacks resource fields.

- [ ] **Step 3: Write minimal implementation**

`src/core/customIds.ts`:

```ts
import { customBuildingLabel } from './customBuilding';

export function parseCustomSlot(id: string): 1 | 2 | 3 | null {
  const m = /^custom-([123])$/.exec(id);
  if (!m) return null;
  return Number(m[1]) as 1 | 2 | 3;
}

export function sharedCustomTypeId(owner: string, slot: 1 | 2 | 3): string {
  return `custom-${owner}-${slot}`;
}
export function sharedResourceId(owner: string, slot: 1 | 2 | 3): string {
  return `res-${owner}-${slot}`;
}
export function sharedUnitId(owner: string, slot: 1 | 2 | 3): string {
  return `unit-${owner}-${slot}`;
}

export function fallbackInventNames(prompt: string): {
  building: string;
  resource: string;
  unit: string;
} {
  const building = customBuildingLabel(prompt);
  return {
    building,
    resource: customBuildingLabel(`${building} Ore`),
    unit: customBuildingLabel(`${building} Troop`),
  };
}
```

Update `CustomBuilding` / `GameState` / `BuildingInstance` / `BuildingLicense` in `types.ts`.

`applyInventedBuilding`: if `owner` + slot from `input.id`, fill resource/unit via `fallbackInventNames` then optional `names`. Defaults `exportPrice: 2`, `exportEnabled: true`.

`normalizeCustomBuildings`: fill missing trio from fallback + owner unknown → if no owner, derive ids from slot only as `res-local-{n}` **only for old saves without owner**. Prefer: old saves get `resourceId: res-local-{n}` until next invent. Spec wants `res-{owner}-{n}`. On hydrate in PlayerStore (Task 5) pass player name to `normalizeCustomBuildings(customs, owner)`.

For Task 1, `normalizeCustomBuildings(customs, owner?: string)`: if missing fields, use `owner ?? 'local'` + slot.

`serializeGame` / `deserializeGame`: copy new fields; default `army: {}`, `licenses: []`, `uniquePending/exportStock` 0 when absent.

`createNewGame`: `army: {}`, `licenses: []`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/customIds.test.ts tests/core/customBuilding.test.ts tests/core/save.test.ts tests/core/bootstrap.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/customIds.ts src/core/types.ts src/core/customBuilding.ts src/core/save.ts src/core/bootstrap.ts tests/core/customIds.test.ts tests/core/customBuilding.test.ts tests/core/save.test.ts
git commit -m "feat: persist unique resource and unit on invented buildings"
```

---

### Task 2: LLM invent trio

**Files:**
- Modify: `server/nameBuilding.ts`
- Modify: `tests/server/nameBuilding.test.ts`

**Interfaces:**
- Consumes: `customBuildingLabel`, LiteLLM chat env
- Produces: `nameInventTrio(prompt, env?, fetchFn?): Promise<{ building: string; resource: string; unit: string }>`
- Keep `nameBuildingFromPrompt` as `trio.building` wrapper so existing injects still typecheck until Task 5

- [ ] **Step 1: Write the failing test**

```ts
it('parses JSON trio and sanitizes names', async () => {
  const fetchFn = vi.fn(async () =>
    new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: '{"building":"Noodle Stall","resource":"Broth","unit":"Cook"}',
          },
        }],
      }),
      { status: 200 },
    ),
  );
  await expect(
    nameInventTrio('a cozy noodle stall', env, fetchFn),
  ).resolves.toEqual({
    building: 'Noodle Stall',
    resource: 'Broth',
    unit: 'Cook',
  });
});

it('falls back to Ore/Troop when chat fails', async () => {
  await expect(nameInventTrio('crystal bakery', {}, fetch)).resolves.toEqual({
    building: 'crystal bakery',
    resource: 'crystal bakery Ore',
    unit: 'crystal bakery Troop',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/nameBuilding.test.ts`

Expected: FAIL — `nameInventTrio` is not a function

- [ ] **Step 3: Write minimal implementation**

System prompt: reply with JSON only, keys building/resource/unit, 1–4 words each, same language as the player.

`max_tokens: 80`. Parse JSON from content (strip markdown fences). Each field through `customBuildingLabel(prompt, value)`. Any missing field → `fallbackInventNames`.

`nameBuildingFromPrompt` returns `(await nameInventTrio(...)).building`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/server/nameBuilding.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/nameBuilding.ts tests/server/nameBuilding.test.ts
git commit -m "feat: name invented building, resource, and unit together"
```

---

### Task 3: Origin produce + unique harvest

**Files:**
- Create: `src/core/customEconomy.ts`
- Create: `tests/core/customEconomy.test.ts`
- Modify: `src/core/tick.ts`
- Modify: `src/core/farm.ts` (`harvestBuilding` branch)
- Test: `tests/core/farm.test.ts` (existing farm harvest still passes)

**Interfaces:**
- Consumes: `CustomBuilding`, `parseCustomSlot`
- Produces:
  - `UNIQUE_PENDING_CAP = 50`
  - `UNIQUE_PER_TICK = 1`
  - `TRAIN_UNIQUE_COST = 5`
  - `TRAIN_FOOD_COST = 2`
  - `isOriginCustom(state, building): boolean` — `typeId` is `custom-1|2|3` and exists in `state.customBuildings`
  - `produceCustomOrigins(state: GameState): void`
  - `harvestUnique(state, buildingId): { ok: true } | { ok: false; reason: string }`
  - `pullUniqueToStock(building, need: number): void` — move min(need, uniquePending, room in export) from pending → stock

- [ ] **Step 1: Write the failing tests**

```ts
it('origins gain 1 unique pending per tick up to 50, not city inventory', () => {
  // state with custom-1 def + placed origin
  produceCustomOrigins(state);
  const b = state.buildings.find((x) => x.typeId === 'custom-1')!;
  expect(b.uniquePending).toBe(1);
  expect(state.inventory.amounts.food).toBe(0); // or unchanged
});

it('harvestUnique moves pending into exportStock and never warehouse', () => {
  b.uniquePending = 8;
  expect(harvestUnique(state, b.id).ok).toBe(true);
  expect(b.uniquePending).toBe(0);
  expect(b.exportStock).toBe(8);
  expect(state.inventory.amounts.food).toBe(startFood);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/customEconomy.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

`produceCustomOrigins`: for each building whose `typeId` is in `state.customBuildings`, `uniquePending = min(cap, (uniquePending ?? 0) + 1)`. Skip replicas (typeId starts with `custom-{owner}-`).

`harvestUnique`: require origin; if uniquePending === 0 → `nothing to harvest`; add to exportStock up to 50; leftover stays pending.

`harvestBuilding`: if `isOriginCustom(state, building)` return `harvestUnique(...)`; else existing warehouse logic.

`advanceTick`: `produceFarms` then `produceCustomOrigins` then research.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/customEconomy.test.ts tests/core/farm.test.ts tests/core/tick.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/customEconomy.ts src/core/tick.ts src/core/farm.ts tests/core/customEconomy.test.ts
git commit -m "feat: origin buildings produce and stockpile unique resources"
```

---

### Task 4: Origin train + army

**Files:**
- Modify: `src/core/customEconomy.ts`
- Modify: `tests/core/customEconomy.test.ts`

**Interfaces:**
- Consumes: `trySpend` from inventory (food only)
- Produces:
  - `trainAtOrigin(state, buildingId): { ok: true } | { ok: false; reason: string }`
  - `addArmy(state, unitId: string, n: number): void`
  - Reasons: `not found` · `need origin` · `out of stock` · `cannot afford`

- [ ] **Step 1: Write the failing tests**

```ts
it('trains one unit from export stock and 2 food', () => {
  b.exportStock = 5;
  state.inventory.amounts.food = 10;
  expect(trainAtOrigin(state, b.id).ok).toBe(true);
  expect(b.exportStock).toBe(0);
  expect(state.inventory.amounts.food).toBe(8);
  expect(state.army[custom.unitId]).toBe(1);
});

it('auto-pulls pending into stock before spending', () => {
  b.uniquePending = 5;
  b.exportStock = 0;
  state.inventory.amounts.food = 2;
  expect(trainAtOrigin(state, b.id).ok).toBe(true);
  expect(b.uniquePending).toBe(0);
  expect(state.army[custom.unitId]).toBe(1);
});

it('fails out of stock or cannot afford without mutation', () => {
  b.exportStock = 1;
  b.uniquePending = 0;
  state.inventory.amounts.food = 10;
  expect(trainAtOrigin(state, b.id)).toEqual({ ok: false, reason: 'out of stock' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/customEconomy.test.ts`

Expected: FAIL — `trainAtOrigin` missing

- [ ] **Step 3: Write minimal implementation**

```ts
export function trainAtOrigin(state: GameState, buildingId: string) {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, reason: 'not found' };
  const rec = (state.customBuildings ?? []).find((c) => c.id === building.typeId);
  if (!rec) return { ok: false, reason: 'need origin' };
  pullUniqueToStock(building, TRAIN_UNIQUE_COST);
  if ((building.exportStock ?? 0) < TRAIN_UNIQUE_COST) {
    return { ok: false, reason: 'out of stock' };
  }
  if (!trySpend(state.inventory, { food: TRAIN_FOOD_COST })) {
    return { ok: false, reason: 'cannot afford' };
  }
  building.exportStock = (building.exportStock ?? 0) - TRAIN_UNIQUE_COST;
  addArmy(state, rec.unitId, 1);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/customEconomy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/customEconomy.ts tests/core/customEconomy.test.ts
git commit -m "feat: train unique units from origin export stock"
```

---

### Task 5: Wire invent trio, harvest, and train on one save

**Files:**
- Modify: `server/playerStore.ts`
- Modify: `server/index.ts`
- Modify: `src/api/client.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/Sidebar.ts`
- Test: `tests/server/playerStore.test.ts`

**Interfaces:**
- Consumes: `nameInventTrio`, `applyInventedBuilding` names+owner, `trainAtOrigin`, `harvestBuilding`
- Produces: `PlayerStore` 6th ctor arg becomes `nameTrio?: (prompt) => Promise<{building,resource,unit}>` (adapt existing tests that pass a string namer: wrap as `{ building: s, resource: fallback, unit: fallback }` **or** keep 6th as trio and update the invent test)
- `POST /api/train` `{ buildingId }`
- `GameApi.train(buildingId)`

- [ ] **Step 1: Write the failing store test**

In `playerStore.test.ts` invent success path, assert:

```ts
const rec = ok.game.customBuildings!.find((b) => b.id === 'custom-1')!;
expect(rec.resourceLabel).toBeTruthy();
expect(rec.unitLabel).toBe('Crystal Troop'); // if stub trio
```

Pass stub: `async () => ({ building: 'Crystal Bakery', resource: 'Crystal Ore', unit: 'Crystal Troop' })`.

Add: after invent + place `custom-1`, apply ticks via snapshot time jump **or** call `store.apply` harvest/train after manually… store doesn’t expose internals. Easier: `apply({ op: 'train', buildingId })` after setting lastTickAt so catch-up fills pending, then harvest/train.

Use the existing catch-up test pattern: login, invent, place, advance `now` by `TICK_INTERVAL_MS * 5`, snapshot (catch-up produces unique), `apply harvest`, `apply train` with food granted in save… food may be low after invent cost. Grant food by placing isn’t enough. In test, after invent, write isn’t accessible. Catch-up doesn’t add food. Start with enough food (new game has 20, invent spends 8 → 12). Train needs 2 food. OK.

Flow: invent → place custom at empty cell → bump now 5 ticks → harvest → train → `game.army[rec.unitId] === 1`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/playerStore.test.ts`

Expected: FAIL — no `op: 'train'` / no resourceLabel

- [ ] **Step 3: Write minimal implementation**

`invent`: `Promise.all([generateImage, nameInventTrio])`; `applyInventedBuilding(..., { names, owner: key })`.

`runAction` `train`: `trainAtOrigin`.

`index.ts`: `POST /api/train`.

Sidebar origin (`typeId` matches `customBuildings`): show resource/unit labels, unique pending, export stock, Harvest (existing), Train button → `commands.train`.

`SidebarDeps.commands.train`. `main.ts` wires `api.train`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/server/playerStore.test.ts tests/core/customEconomy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/playerStore.ts server/index.ts src/api/client.ts src/main.ts src/ui/Sidebar.ts tests/server/playerStore.test.ts
git commit -m "feat: invent names resource and unit; origin can train"
```

---

### Task 6: Market list, catalog, buy, replica place

**Files:**
- Create: `src/core/market.ts`
- Create: `src/core/licenses.ts`
- Create: `server/marketStore.ts`
- Create: `tests/core/market.test.ts`
- Modify: `server/playerStore.ts`, `server/index.ts`
- Modify: `src/api/client.ts`, `src/main.ts`
- Modify: `src/core/customBuilding.ts` `unlockedBuildOptions` stays; `syncCustomRegistry` also merge licenses
- Test: `tests/server/playerStore.test.ts`, `tests/core/hudLogic.test.ts` if needed

**Interfaces:**
- Consumes: `CustomBuilding`, `sharedCustomTypeId`
- Produces:
  - `MarketListing` type matching the spec
  - `validateList(state, typeId, price): { ok: true } | { ok: false; reason }`
  - `applyBuy(buyer, listing): { ok: true } | { ok: false; reason }` — spends coin, pushes license, unlocks `listing.typeId` (not `custom-1`)
  - `toLicenseDef(license): BuildingDef` — same place cost, sprite `/api/market/sprites/{typeId}`
  - `syncCustomRegistry(registry, customs, licenses?)`
  - `MarketStore` `{ list, unlist, get, all, removeOwnerSlot, removeOwnerAll }`
  - Routes: `POST /api/market/list` `{ typeId, price }`, `unlist`, `GET /api/market`, `POST /api/market/buy`, `GET /api/market/sprites/:typeId`
  - `POST /api/export` `{ typeId, enabled, price? }` clamps price 1–20

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/market.test.ts
it('rejects listing price outside 10–200 and own missing origin', () => {
  expect(validateList(state, 'custom-1', 5).ok).toBe(false);
  expect(validateList(state, 'custom-1', 20).ok).toBe(true); // has placed origin
});

it('buy spends coin and adds a license, not an origin slot', () => {
  const listing = { typeId: 'custom-ada-1', owner: 'ada', slot: 'custom-1', price: 20, ... };
  buyer.inventory.amounts.coin = 20;
  expect(applyBuy(buyer, listing).ok).toBe(true);
  expect(buyer.licenses[0].typeId).toBe('custom-ada-1');
  expect(buyer.customBuildings ?? []).toHaveLength(0);
  expect(buyer.unlockedBlueprints).toContain('custom-ada-1');
});
```

Store test with two temp dirs? One store, two names: Ada invents+places+lists; Bob buys; Bob place `custom-ada-1`; Ada place still `custom-1`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/market.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

`validateList`: type in `customBuildings`; at least one placed building with that typeId; price integer 10–200.

`applyBuy`: not own listing (`listing.owner === buyerName` → pass name in); not already licensed; `trySpend({ coin: price })`; push license; unlock blueprint.

`PlayerStore` constructor: `private market = new MarketStore(join(dir, '..', 'market'))` — **do not** put market inside a player folder. Use `join(this.dir, '..', 'market')` so tests using `mkdtemp` get a sibling `market` dir.

`list`: validate, `market.upsert(listing)`.
`buy`: load listing, applyBuy, write buyer.
Sprite GET: parse typeId `^custom-([a-z0-9_-]+)-([123])$`, read seller sprite file.

`place` already uses registry from `withCustomBuildings` + licenses via `liveRegistry`:

```ts
private liveRegistry(state: GameState): ContentRegistry {
  const r = withCustomBuildings(this.registry, state.customBuildings);
  return withLicenses(r, state.licenses);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/market.test.ts tests/server/playerStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/market.ts src/core/licenses.ts server/marketStore.ts server/playerStore.ts server/index.ts src/api/client.ts src/main.ts tests/core/market.test.ts tests/server/playerStore.test.ts
git commit -m "feat: list and buy custom blueprints on a shared market"
```

---

### Task 7: Replica train, export, forget/abandoned

**Files:**
- Modify: `src/core/customEconomy.ts` — `trainAtReplica` **or** keep spend helper
- Modify: `server/playerStore.ts` — two-lock train
- Modify: `src/core/customBuilding.ts` `forgetCustomBuilding` (buyer forget license)
- Test: `tests/server/playerStore.test.ts`, `tests/core/customEconomy.test.ts`

**Interfaces:**
- Consumes: `trainAtOrigin`, `pullUniqueToStock`, `MarketStore.removeOwnerSlot`
- Produces:
  - `spendSellerForReplica(seller, typeId, uniqueNeed): { ok: true } | { ok: false; reason }`
  - `PlayerStore.train` if building is replica (typeId matches a license): lock both names (sort keys), catch-up seller, spendSeller, trySpend buyer food + coin (`exportPrice * 5`), addArmy buyer, add coin seller
  - Reasons: `out of stock` · `export disabled` · `abandoned` · `need origin` · `cannot afford`
  - Forget origin: `market.removeOwnerSlot`; replicas stay, next train → `abandoned` if seller no longer has that `customBuildings` slot
  - `POST /api/export`

- [ ] **Step 1: Write the failing tests**

```ts
it('replica train pays seller and deducts unique stock', async () => {
  // Ada: invent, place, 5+ ticks, harvest, export on
  // Bob: buy, place replica, food+coin
  const trained = await store.apply('bob', { op: 'train', buildingId: replicaId });
  expect(trained.ok).toBe(true);
  expect(trained.game.army[unitId]).toBe(1);
  const ada = await store.snapshot('ada');
  expect(ada.game.inventory.amounts.coin).toBeGreaterThan(0);
});

it('replica train fails when export disabled or no stock', async () => {
  await store.apply('ada', { op: 'export', typeId: 'custom-1', enabled: false });
  const r = await store.apply('bob', { op: 'train', buildingId: replicaId });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe('export disabled');
});
```

Deadlock: `withLock` must support nested multi-key. Implement `withLocks(keys: string[], fn)` that sorts keys and chains existing `withLock`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/playerStore.test.ts`

Expected: FAIL — train on replica returns `need origin`

- [ ] **Step 3: Write minimal implementation**

```ts
async train(name, buildingId) {
  const buyerKey = normalizePlayerName(name)!;
  return this.withLock(buyerKey, async () => {
    const buyerRec = await this.readOrCreate(buyerKey);
    const buyer = this.hydrate(buyerRec);
    this.catchUpAndMigrate(buyer, buyerRec);
    const b = buyer.buildings.find((x) => x.id === buildingId);
    if (!b) return fail(...);
    if (isOriginCustom(buyer, b)) {
      const result = trainAtOrigin(buyer, buildingId);
      await this.write(buyerKey, buyerRec, buyer);
      return result.ok ? ok(buyer) : fail(result.reason, buyer);
    }
    const lic = (buyer.licenses ?? []).find((l) => l.typeId === b.typeId);
    if (!lic) return fail('abandoned', buyer);
    const sellerKey = lic.owner;
    // release? cannot — hold buyer lock, then withLock(seller)
    // Deadlock if seller trains replica of buyer. Always lock min(buyer,seller) first.
  });
}
```

**Do not nest locks ad-hoc.** Add `withLocks(keys: string[], fn)`:

```ts
private async withLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const uniq = [...new Set(keys)].sort();
  const run = async (i: number): Promise<T> =>
    i >= uniq.length ? fn() : this.withLock(uniq[i], () => run(i + 1));
  return run(0);
}
```

`train` uses `withLocks([buyer, seller?], ...)`. For origin, `withLocks([buyer])`.

`spendSellerForReplica`: find seller `customBuildings` by slot; if missing → `abandoned`; if `!exportEnabled` → `export disabled`; no placed origin → `need origin`; pull stock across origin instances until 5; else `out of stock`; deduct 5 from those stocks.

Coin: `exportPrice * TRAIN_UNIQUE_COST` from buyer to seller.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/server/playerStore.test.ts tests/core/customEconomy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/customEconomy.ts src/core/customBuilding.ts server/playerStore.ts server/index.ts tests/server/playerStore.test.ts tests/core/customEconomy.test.ts
git commit -m "feat: replica training imports unique resources from the inventor"
```

---

### Task 8: Sidebar market, replica inspect, army line

**Files:**
- Modify: `index.html` — footer Market button, `#sidebar-market`
- Modify: `src/phaser/hud/hudLogic.ts` — panel `'market'`; `trainDisabledReason`; `showNewGameButton` unchanged
- Modify: `tests/core/hudLogic.test.ts`
- Modify: `src/ui/Sidebar.ts`
- Modify: `src/main.ts` — `market.list/unlist/buy`, `exportSettings`, load market sprites like customs
- Modify: `src/api/client.ts` if any method missing

**Interfaces:**
- Consumes: all prior commands
- Produces: exclusive panel `inspect | build | research | market`

- [ ] **Step 1: Write the failing tests**

```ts
it('toggles market exclusive of build/research', () => {
  expect(nextSidebarPanel({ current: 'inspect', action: 'toggle-market', selectedTypeId: null })).toBe('market');
  expect(nextSidebarPanel({ current: 'market', action: 'toggle-market', selectedTypeId: null })).toBe('inspect');
  expect(nextSidebarPanel({ current: 'market', action: 'toggle-build', selectedTypeId: null })).toBe('build');
});

it('disables replica train when export is down', () => {
  expect(trainDisabledReason({ kind: 'replica', exportEnabled: false, stock: 10, food: 10, coin: 100, price: 2 })).toMatch(/export/i);
  expect(trainDisabledReason({ kind: 'replica', exportEnabled: true, stock: 0, food: 10, coin: 100, price: 2 })).toMatch(/stock/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/hudLogic.test.ts`

Expected: FAIL — unknown action / missing helper

- [ ] **Step 3: Write minimal implementation**

`nextSidebarPanel` add `toggle-market`.

Sidebar:
- Footer Market button.
- Catalog rows: img, label, resource, unit, seller, price, Buy.
- Origin: Export checkbox + price input + List/Unlist.
- Replica: “Imported from {owner}”, stock line (from snapshot field).

**Snapshot extra for replicas:** `PlayerStore.snapshot/serialize` cannot see seller stock unless we attach `marketStatus[]` on the wire. Add optional `SerializedGame.replicaStatus?: Array<{ typeId, exportEnabled, stock, exportPrice, abandoned }>` computed in `PlayerStore` when serializing by reading seller files **without** blocking forever: for each license, `readOrCreate(owner)` (no catch-up here; train path catch-up is enough). Cache per serialize.

Alternatively compute only on train and show “unknown until train”. Spec wants availability on snapshot. Implement `attachReplicaStatus(game, licenses)` inside `PlayerStore` after hydrate.

Army line under resources: if `Object.values(army).some(n => n > 0)`, list `unitLabel × count` by resolving labels from `customBuildings` + `licenses`.

`loadCustomSprites` also fetches license sprites (`rec.sprite`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/hudLogic.test.ts tests/server/playerStore.test.ts`

Expected: PASS. Then `npx vitest run` all green.

Manual: login A invent+place+list; login B buy+place+train.

- [ ] **Step 5: Commit**

```bash
git add index.html src/phaser/hud/hudLogic.ts src/ui/Sidebar.ts src/main.ts src/api/client.ts server/playerStore.ts tests/core/hudLogic.test.ts
git commit -m "feat: market panel, replica inspect, and army counts"
```

---

## Self-review

**Spec coverage**
- Invent trio + fallback — Tasks 1–2, 5
- Origin produce/harvest/train/army — Tasks 3–5
- Unique goods off main inventory — Task 3 tests
- Market list/unlist/buy/sprite — Task 6
- Replica place, no production — Task 6
- Replica train + locks + catch-up + prices — Task 7
- Export toggle/price — Tasks 6–7
- Forget drops listing + abandoned — Task 7
- UI origin/replica/market/army — Task 8
- Non-goals (combat, resale, HUD unique icons) — not tasked

**Type consistency**
- Shared ids `custom-{owner}-{n}` / `res-` / `unit-` used in Tasks 1, 6, 7
- `exportPrice` default 2, listing 20
- `trainAtOrigin` vs replica `spendSellerForReplica` share `TRAIN_UNIQUE_COST = 5`

**Placeholders**
- None. Owner on old saves uses `normalizeCustomBuildings(customs, playerName)` in hydrate (Task 1 + 5).
