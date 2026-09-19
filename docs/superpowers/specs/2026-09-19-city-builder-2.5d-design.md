# Design: 2.5D City Builder (20×20) — Phaser + Three.js

**Date:** 2026-09-19  
**Status:** Draft for user review  
**Stack:** Web — Vite, TypeScript, Phaser 3 (lead), Three.js (building meshes)

## Goal

A cozy, open-ended **sandbox** city builder on a fixed **20×20** tilemap. Players place buildings, grow resources on farms, and unlock more buildings via research. There is **no win condition**. A player-to-player **market** is planned later and must not force a rewrite of core systems.

## Non-goals (MVP)

- Multiplayer / realtime sync
- Combat, NPCs, or pathfinding agents
- Deep economic balance or many resource types
- Mobile-first controls (desktop web first; touch later if easy)
- Godot or native desktop packaging

## Players & success

- **Solo first:** satisfying loop of place → produce → research → place more.
- **Success criteria for MVP:** player can start a town, run farms, complete at least one research unlock, place a new building type, and reload a saved game — all in the browser.

## Architecture (Approach A)

```
┌─────────────────────────────────────────┐
│  core/  (pure TS, no renderer)          │
│  Grid, buildings, inventory, research,  │
│  tick, save/load                        │
└───────────────┬─────────────────────────┘
                │ events / snapshots
     ┌──────────┴──────────┐
     ▼                     ▼
┌─────────────┐     ┌──────────────┐
│ phaser/     │     │ three/       │
│ tilemap,    │     │ BuildingRenderer │
│ input, HUD  │     │ meshes only  │
└──────┬──────┘     └──────▲───────┘
       │                   │
       └──── bridge/ ──────┘
         tile ↔ world, camera sync
```

### Responsibilities

| Layer | Owns | Does not own |
|-------|------|--------------|
| `core` | Game rules, state mutations, ticks, persistence | Drawing, DOM, WebGL |
| `phaser` | Camera pan/zoom, grid highlight, placement ghost, HUD / build & research UI | Authoritative economy |
| `three` | Building meshes, simple lighting | Input, hit-testing |
| `bridge` | Shared `tileSize`, origin, camera matrix copy Phaser → Three | Game rules |

**Input rule:** all click/hover goes through Phaser grid hit-tests. Three.js does not receive pointer events (avoids double-pick).

## Map & placement

- Grid: **20×20** cells.
- Default building footprints: **main house 2×2**; **farm** and **research institute** **1×1** (extensible later).
- Rules: no overlap; cannot overwrite main house; out-of-bounds rejected.
- Placement UX: ghost preview (valid = green tint, invalid = red) before confirm.
- Main house: **pre-spawned** at a fixed start (e.g. near map center); not demolishable in MVP.

## Buildings

### Main house

- City **shared inventory** lives here conceptually (one global inventory is fine in data).
- Overview panel: resources, active research.

### Farm

- Each farm has a **production recipe** unlocked by research (default recipe at game start for basic food farm).
- On each production tick: if inventory has capacity, add output items.
- Future: recipe swap UI if a farm supports multiple unlocked recipes.

### Research institute

- **One research queue** at a time (MVP).
- Cost: items + duration in **game ticks** (wall clock ≈ tick interval × ticks).
- On complete: unlock **blueprint(s)** (new farm types, cosmetic buildings, inventory capacity, or “market prep” stubs).

### Market (phase 2 — stub only in MVP)

- UI slot / building blueprint may appear via late tech (“market prep”) but **no network**.
- Design seam: `TradeService` interface + inventory reserve/commit API so multiplayer can plug in later without changing grid/render.

## Economy (MVP)

- Resources: **`food`**, **`wood`**, **`stone`**, and **`coin`** (in schema from day one, starts at 0; unused until market phase).
- Inventory: soft cap (upgradeable via research later); when full, farm **skips** that production tick (no overflow).
- Starting kit: enough resources to place 1–2 farms and start first research.

## Research tree (shallow)

1. **Tier 1:** basic farm variants / small production buffs.  
2. **Tier 2:** alternate farms (wood/stone producers) or footprint cosmetics.  
3. **Tier 3:** “market prep” (UI/building stub, warehouse capacity) — still offline.

Exact node list can be tuned in data files (`research.json`); design only requires the three-tier shape and single-queue behavior.

## Time model

- Continuous **real-time ticks** (fixed interval, e.g. 1s game tick), not day/night cycles in MVP.
- Research and farm production advance on ticks.
- Pause: optional later; not required for MVP.

## Persistence

- Save payload: grid occupancy, building instances (id, type, cell, farm recipe, etc.), inventory, research unlocks + active research progress, tick counter / timestamps.
- Storage: **`localStorage`** (JSON). Export/import file optional stretch.

## Rendering (2.5D)

- Ground: Phaser tilemap (top-down or lightly skewed art — art direction flexible).
- Buildings: Three.js orthographic (or matching projection) **low-poly boxes** color-coded by type; replaceable with GLTF later without API change.
- Height variation by building type for readability on a small map.
- Camera: Phaser leads; Three copies pan/zoom each frame (or on camera move events).

## UI

- Always-on resource bar.
- Build menu: only **unlocked** blueprints.
- Research panel: select node → show cost/time → Start (disabled if queue busy or cannot afford).
- Farm panel: show current recipe / output rate.
- Implementation: Phaser UI **or** light DOM overlay — default **Phaser HUD** for one toolkit; DOM allowed if a panel is painful in Phaser.

## Project layout

```
src/
  core/       # state, tick, research, save
  phaser/     # scenes, input, HUD
  three/      # BuildingRenderer, lights
  bridge/     # coordinates, camera sync
  data/       # buildings, recipes, research tree (JSON)
index.html
```

Tooling: **Vite + TypeScript + Phaser 3 + three**.

## Error handling

- Invalid place: ignore confirm + feedback toast/flash.
- Cannot afford research/build: disable button + reason text.
- Corrupt save: fall back to new game + console warning (no crash loop).
- Renderer desync: Three rebuilds meshes from full building list on scene boot / load.

## Testing (MVP)

- Unit tests on `core` only: placement rules, inventory caps, research complete, save round-trip.
- Manual playtest checklist: place farm, wait for tick income, finish one research, place unlocked building, refresh page and continue.

## Phasing

| Phase | Scope |
|-------|--------|
| **MVP** | Core loop, 3 building types, shallow research, save, Phaser+Three sync |
| **Polish** | Better art/GLTF, audio, pause, balance |
| **Market** | `TradeService`, auth, listings, inventory reserve/commit, P2P exchange |

## Open decisions (resolved in this doc)

| Topic | Decision |
|-------|----------|
| Engine | Web: Phaser lead + Three.js buildings |
| Win condition | None (sandbox) |
| Multiplayer | After solo MVP |
| Main house | Pre-spawned, fixed, non-demolishable |
| Research | Single queue |
| Farm | Tick production, skip if inventory full |
| Time | Real-time ticks, no day/night MVP |

## Out of scope reminders

Do not implement market networking, combat, or engine alternatives in MVP.
