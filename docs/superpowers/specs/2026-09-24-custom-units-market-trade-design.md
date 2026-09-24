# Design: Custom units, blueprint market, and trade routes

**Date:** 2026-09-24  
**Status:** Draft for review

## Goal

Each invented building defines a **unique resource** and a **unique unit**. The inventor produces that resource and can train those units locally. They may list the blueprint on a **market**. Buyers place a **replica** that looks the same but **does not produce** the unique resource. Buyers train units only by **importing** that resource from the inventor (option A).

Combat / map battles are out of scope. Units are army counts on the player save.

## Current seams

- Invent already creates up to 3 custom 3×3 buildings (`custom-1`…`custom-3`) with a sprite and label.
- Recipes today only output `food | wood | stone | coin`.
- `TradeService` is a no-op stub.
- Inventory HUD is the four shared resources plus a per-type warehouse cap.

## Player loop

1. Invent a building. LLM returns building name, unique resource name, unit name.
2. Place the origin. It accumulates unique resource in `pending` (cap 50). Harvest moves it into an **export stock** on that instance (same cap 50).
3. Train on the origin: auto-pull from that instance’s pending into export stock if stock is below 5, then spend unique stock + food → +1 unit in army. Harvest remains available to stockpile without training.
4. Optionally **list** the blueprint on the market for coin.
5. Another player **buys** the listing, unlocks a replica blueprint, places it.
6. Train on the replica: spend buyer food + pay seller’s export price; server deducts unique stock from a seller origin instance and credits seller coin; buyer army +1.
7. If the seller has no origin left, no export stock, or export is off → replica train is disabled (`out of stock`).

## Identity

Local slot ids stay `custom-1`…`custom-3` on the inventor’s save.

Shared type id (market + licenses):

`custom-{owner}-{n}` where `n` is `1|2|3`.  
Example: `custom-zz-1`

- `resourceId`: `res-{owner}-{n}`
- `unitId`: `unit-{owner}-{n}`

Names come from the invent LLM call (same LiteLLM chat as building name), JSON only:

```json
{ "building": "Namek House", "resource": "Namek Crystal", "unit": "Namek Warrior" }
```

Sanitize each field with the existing 24-character building-name rules. If chat fails, fall back to: building = clipped prompt; resource = `{building} Ore`; unit = `{building} Troop`.

Unique resources **never** appear on the top food/wood/stone/coin bar. They live on the selected building panel and a small “Special goods” list if the player owns any stock or licenses.

## Origin vs replica

| | Origin (inventor) | Replica (buyer) |
|---|---|---|
| Place | Inventor’s unlocked custom slot | License from market |
| Produce unique resource | Yes, +1 / tick into pending | No |
| Harvest unique resource | Yes, into instance export stock | No |
| Train unit | Spend own export stock + 2 food | Import (see Trade) + 2 food |
| List on market | Yes, if at least one origin still exists | No |
| Forget design | Removes listing, origins, stock; replicas become `abandoned` | Removes license + own replicas only |

`abandoned`: replica still stands, train locked, tooltip “origin forgotten”. Buyer may demolish.

## Numbers

| Rule | Value |
|------|--------|
| Unique resource per origin tick | +1 |
| Pending / export stock cap per origin instance | 50 |
| Train cost (origin or replica) | 5 unique + 2 food → 1 unit |
| Default export price | 2 coin per unique resource (10 coin per troop to seller) |
| Export price range | 1–20 coin per unique resource |
| Default listing price | 20 coin |
| Listing price range | 10–200 coin |
| Listings per custom slot | 1 |
| Resale of a bought blueprint | Forbidden |
| Custom slots | 3 (unchanged) |
| Army | no hard cap in this spec |

Seller sets export price and listing price. Changing export price applies to the next train, not in-flight.

## Data

Extend `CustomBuilding` on the inventor save:

- `resourceId`, `resourceLabel`
- `unitId`, `unitLabel`
- `exportPrice` (coin per unique resource, default 2)
- `exportEnabled` (default true)

`BuildingInstance` for an origin keeps unique amounts in `pending[resourceId]` and `exportStock` (number). Replica instances store `licenseTypeId` (`custom-{owner}-{n}`) and no unique pending.

`GameState` gains:

```ts
army: Record<string, number>; // unitId → count
licenses: Array<{
  typeId: string;       // custom-{owner}-{n}
  owner: string;
  slot: 'custom-1' | 'custom-2' | 'custom-3';
  label: string;
  resourceId: string;
  resourceLabel: string;
  unitId: string;
  unitLabel: string;
  sprite: string;       // /api/market/sprites/{typeId}
}>;
```

Market listings are **server-global**, not inside one player save:

`data/market/listings.json`

```ts
{
  typeId: string;
  owner: string;
  slot: string;
  price: number;
  listedAt: number;
  // denormalized for the catalog (copied at list time)
  label, resourceLabel, unitLabel, sprite
}
```

Listing a slot again overwrites the previous row. Forget / new-game removes that owner’s listings.

Sprite for buyers: `GET /api/market/sprites/:typeId` reads `data/players/{owner}/sprites/{slot}.png`. Cookie required (logged-in buyer). No anonymous access.

## API

| Method | Path | Body / result |
|--------|------|----------------|
| POST | `/api/invent-building` | Existing. Response custom now includes resource/unit fields. |
| POST | `/api/forget-building` | Existing. Also drops that slot’s listing; marks replicas abandoned. |
| POST | `/api/train` | `{ buildingId }` origin or replica. |
| POST | `/api/export` | `{ typeId, enabled, price? }` inventor only. |
| POST | `/api/market/list` | `{ typeId, price }` inventor only. |
| POST | `/api/market/unlist` | `{ typeId }` |
| GET | `/api/market` | Catalog array (no secrets). |
| POST | `/api/market/buy` | `{ typeId }` buyer pays listing price, gains license. |
| GET | `/api/market/sprites/:typeId` | PNG for a listed or licensed type. |

`POST /api/train` on a replica is the trade: one atomic server transaction across buyer + seller files (take both player locks, buyer first then seller by name sort if needed to avoid deadlock).

Train errors: `not found` · `cannot afford` · `nothing to harvest` is unused · `out of stock` · `export disabled` · `abandoned` · `need origin` (inventor has no placed origin).

Buy errors: `cannot afford` · `already licensed` · `not listed` · `own listing`.

## UI

- **Invent:** unchanged prompt; after success, selection shows resource name + unit name.
- **Origin selection:** pending / export stock, Harvest, Train, Export toggle + price, List/Unlist on market.
- **Replica selection:** “Imported from {owner}”, export price, stock availability (computed on snapshot), Train, no Harvest of unique resource.
- **Market panel:** new sidebar mode or Research footer sibling. Rows: sprite, names, seller, price, Buy.
- **Army:** counts under Selection when main house is selected (next to New game), or a one-line “Army: …” under resources if any unit count > 0.

## Concurrency and offline

Inventor does not need to be online. Buyer train opens both JSON saves under `PlayerStore` locks, applies catch-up on the seller first (so origin ticks can refill pending), then harvests enough unique resource from seller origins into export stock if needed, then deducts 5, pays coin, increments army.

If seller catch-up cannot produce 5 unique (cap already full and stock empty, or no origin), return `out of stock`.

## Client registry

`syncCustomRegistry` already merges local customs. Also merge `licenses` into the registry as non-producing defs (`defaultRecipeId` unset; train is a command, not a tick recipe).

Place cost for replica and origin stays `{ wood: 6, stone: 3 }`.

## Testing

- Invent persists resource/unit labels; fallback names when chat fails.
- Origin tick + harvest + train spends 5 unique + 2 food.
- Replica train fails without license / stock / export; succeeds and moves coin + stock across two player files.
- List / unlist / buy; cannot buy own listing; forget drops listing.
- Duplicate `custom-1` ids for two players stay isolated; market type ids differ.
- Unique resources never increment `inventory.amounts.food|wood|stone|coin`.

## Non-goals

- Combat, unit movement, or unit sprites beyond a text count.
- Buyers producing any amount of the unique resource.
- Resale or gifting of licenses.
- Unique resources in the main warehouse cap / ResourceBar.
- Changing invent slot count or 3×3 footprint.

## Implementation slices (for the later plan)

1. Invent trio + origin produce / harvest / train + army on one save.  
2. Market list / catalog / buy + license + replica place.  
3. Cross-save train (locks, catch-up, export price, abandoned).
