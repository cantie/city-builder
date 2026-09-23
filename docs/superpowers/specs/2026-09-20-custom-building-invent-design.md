# Design: Custom buildings via Research Institute + PixelLab

**Date:** 2026-09-20  
**Status:** Approved

## Goal

A player with a Research Institute can invent up to **3** personal production buildings. They type a short prompt and pick **2×2 or 3×3**. The server combines the shared art style with that prompt, generates a sprite with PixelLab, and unlocks a placeable blueprint. Production recipes are **out of scope**.

## Art pipeline (same as stock buildings)

Stock art lives in `assets/prompts/buildings.json`: shared `style` + per-building prompt → 128×128 PNG, isometric, transparent background.

Invent uses Pixflux:

- `POST https://api.pixellab.ai/v1/generate-image-pixflux`
- Bearer token from `PIXELLAB_API_KEY` (`.env` only; never commit)
- Body: `description`, `image_size: {width:128,height:128}`, `isometric: true`, `no_background: true`

## Player flow

1. Need a placed Research Institute and fewer than 3 custom blueprints.
2. Sidebar: prompt (4–80 chars), footprint 2×2 or 3×3, Invent.
3. Server generates PNG, stores it per player, unlocks blueprint (no recipe yet).
4. At 3 customs, Invent is locked. Forget (delete blueprint + all instances + PNG) frees a slot.

Invent does **not** use the research tick queue. Wait time is PixelLab. Fail generation → no spend, no blueprint.

## Data

`GameState` / `SerializedGame` gain `customBuildings[]` (max 3):

- `id`: `custom-1` … `custom-3` (first free slot)
- `label`: first 24 chars of prompt
- `prompt`, `footprint`, `sprite` (`/api/sprites/{id}`)

PNG: `data/players/{name}/sprites/{id}.png` (gitignored).

`BuildingTypeId` is a string so custom ids fit. Place cost: `{ wood: 6, stone: 3 }`. Invent cost: `{ wood: 10, stone: 8, food: 8 }` after a successful image.

Per-request registry copy on the server so customs never leak across players.

## API

| Method | Path | Body |
|--------|------|------|
| POST | `/api/invent-building` | `{ prompt, width: 2\|3, height: 2\|3 }` |
| POST | `/api/forget-building` | `{ typeId }` |
| GET | `/api/sprites/:id` | cookie; PNG |

Login/command snapshots include `customBuildings`. Client merges defs into the registry and loads textures (fetch + Phaser).

## Errors

`need research institute` · `custom building limit` · `invalid prompt` · `invalid footprint` · `cannot afford` · `missing image key` · `image generation failed`

## Non-goals

Custom production recipes, sharing sprites between players, committing secrets.
