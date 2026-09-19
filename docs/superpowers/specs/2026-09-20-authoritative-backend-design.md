# Design: Authoritative backend (solo, named save, catch-up ticks)

**Date:** 2026-09-20  
**Status:** Approved  
**Stack:** Vite client + Node (Hono) server; shared `src/core` TypeScript

## Goal

Move game rules and persistence off the browser. The client renders Phaser UI and sends commands. The server owns mutations, ticks, and save files. One player name maps to one city (no password). Rejoining applies **catch-up ticks** for time away, capped at one hour.

## Non-goals

- Passwords, OAuth, or accounts
- Multiplayer / shared map
- WebSockets
- SQLite (JSON files are enough)
- Offline play without the server
- Market / `TradeService` implementation

## Architecture

```
Phaser UI  --HTTP /api-->  server/ (Hono)
                              │
                              ▼
                         src/core (place, move, tick, research, serialize)
                              │
                              ▼
                    data/players/{name}.json
```

- Vite proxies `/api` → `http://localhost:3001`.
- Cookie `player` (httpOnly, SameSite=Lax) set on login; required on later routes.
- Anyone who types the same name loads that save (acceptable for local/dev).

## Identity

- `POST /api/login { name }`: trim, match `^[a-zA-Z0-9_-]{2,24}$`, store lowercase.
- Missing save → `createNewGame`, `lastTickAt = now`.
- Prefill name from `localStorage` key `city-builder-player-name` (convenience only).

## Persistence

File `data/players/{name}.json`:

```json
{ "name": "ada", "lastTickAt": 0, "game": { "version": 1, "...": "SerializedGame" } }
```

On load: `deserializeGame` → `ensureWarehouseMigrated` → `syncCompletedResearchUnlocks` → catch-up → save.

## Catch-up

- Tick length: 1000 ms (same as current client interval).
- `applied = min(floor((now - lastTickAt) / 1000), 3600)`.
- If raw ticks exceed 3600, set `lastTickAt = now` (drop extra AFK).
- Else `lastTickAt += applied * 1000` (keep leftover milliseconds).
- Run catch-up before every command and on `GET /api/state`.

## API

All success bodies: `{ "ok": true, "game": SerializedGame }`.  
Failures: `{ "ok": false, "reason": string }` with HTTP 400/401/404.

| Method | Path | Body |
|--------|------|------|
| POST | `/api/login` | `{ name }` |
| GET | `/api/state` | — |
| POST | `/api/new-game` | — |
| POST | `/api/place` | `{ typeId, x, y }` |
| POST | `/api/move` | `{ buildingId, x, y }` |
| POST | `/api/demolish` | `{ buildingId }` |
| POST | `/api/harvest` | `{ buildingId }` |
| POST | `/api/research` | `{ researchId }` |
| POST | `/api/upgrade` | `{ buildingId }` |

Per-player mutex so overlapping requests cannot double-tick.

## Client

- Login overlay before Phaser boot.
- Replace localStorage save + `setInterval(advanceTick)` with `GET /api/state` every 1s.
- Place/move/harvest/research/upgrade/demolish/new-game wait for server snapshot, then `session.state = deserialize(...)`.
- Ghost preview still uses local `canPlace` (stale by at most one poll).
- `npm run dev` starts Vite and the API together.

## Testing

- Unit: name normalize, catch-up math, `PlayerStore` mutate/load in a temp dir.
- Existing core tests stay in-process (no HTTP).
