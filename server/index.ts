import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContentFromData } from '../src/core/loadContent';
import buildings from '../src/data/buildings.json';
import recipes from '../src/data/recipes.json';
import research from '../src/data/research.json';
import upgradesJson from '../src/data/upgrades.json';
import type { UpgradesConfig } from '../src/core/upgrades';
import type { BuildingTypeId } from '../src/core/types';
import { PlayerStore, type PlayerAction } from './playerStore';
import { loadLocalEnv } from './env';
import { logImageBackend } from './imageGen';
import { normalizePlayerName } from '../src/core/playerName';

loadLocalEnv();
logImageBackend('startup');

const COOKIE = 'player';
const PORT = Number(process.env.PORT ?? 3001);

const registry = loadContentFromData(buildings, recipes, research);
const upgrades = upgradesJson as UpgradesConfig;
const root = dirname(fileURLToPath(import.meta.url));
const store = new PlayerStore(
  join(root, '..', 'data', 'players'),
  registry,
  upgrades,
);

const app = new Hono();

function playerOf(c: Context): string | null {
  return getCookie(c, COOKIE) ?? null;
}

app.post('/api/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name : '';
  const key = normalizePlayerName(name);
  if (!key) {
    return c.json({ ok: false, reason: 'invalid player name' }, 400);
  }
  const result = await store.login(key);
  setCookie(c, COOKIE, key, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
  return c.json(result);
});

app.get('/api/state', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  return c.json(await store.snapshot(name));
});

app.post('/api/new-game', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  return c.json(await store.apply(name, { op: 'new-game' }));
});

app.post('/api/place', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as {
    typeId?: BuildingTypeId;
    x?: number;
    y?: number;
  };
  if (typeof body.typeId !== 'string' || typeof body.x !== 'number' || typeof body.y !== 'number') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  const action: PlayerAction = {
    op: 'place',
    typeId: body.typeId,
    x: body.x,
    y: body.y,
  };
  return c.json(await store.apply(name, action));
});

app.post('/api/move', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as {
    buildingId?: string;
    x?: number;
    y?: number;
  };
  if (
    typeof body.buildingId !== 'string' ||
    typeof body.x !== 'number' ||
    typeof body.y !== 'number'
  ) {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, {
      op: 'move',
      buildingId: body.buildingId,
      x: body.x,
      y: body.y,
    }),
  );
});

app.post('/api/demolish', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { buildingId?: string };
  if (typeof body.buildingId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'demolish', buildingId: body.buildingId }),
  );
});

app.post('/api/harvest', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { buildingId?: string };
  if (typeof body.buildingId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'harvest', buildingId: body.buildingId }),
  );
});

app.post('/api/train', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { buildingId?: string };
  if (typeof body.buildingId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'train', buildingId: body.buildingId }),
  );
});

app.post('/api/research', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { researchId?: string };
  if (typeof body.researchId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'research', researchId: body.researchId }),
  );
});

app.post('/api/upgrade', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { buildingId?: string };
  if (typeof body.buildingId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'upgrade', buildingId: body.buildingId }),
  );
});

app.post('/api/invent-building', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as {
    prompt?: string;
    width?: number;
    height?: number;
  };
  if (
    typeof body.prompt !== 'string' ||
    typeof body.width !== 'number' ||
    typeof body.height !== 'number'
  ) {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(await store.invent(name, body.prompt, body.width, body.height));
});

app.post('/api/forget-building', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { typeId?: string };
  if (typeof body.typeId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.apply(name, { op: 'forget-building', typeId: body.typeId }),
  );
});

app.post('/api/export', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as {
    typeId?: string;
    enabled?: boolean;
    price?: number;
  };
  if (typeof body.typeId !== 'string' || typeof body.enabled !== 'boolean') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(
    await store.setExport(name, body.typeId, body.enabled, body.price),
  );
});

app.post('/api/market/list', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { typeId?: string; price?: number };
  if (typeof body.typeId !== 'string' || typeof body.price !== 'number') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(await store.listOnMarket(name, body.typeId, body.price));
});

app.post('/api/market/unlist', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { typeId?: string };
  if (typeof body.typeId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(await store.unlistFromMarket(name, body.typeId));
});

app.get('/api/market', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  return c.json({ ok: true, listings: await store.catalog() });
});

app.post('/api/market/buy', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const body = (await c.req.json()) as { typeId?: string };
  if (typeof body.typeId !== 'string') {
    return c.json({ ok: false, reason: 'invalid body' }, 400);
  }
  return c.json(await store.buyListing(name, body.typeId));
});

app.get('/api/market/sprites/:typeId', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const png = await store.readMarketSprite(c.req.param('typeId'));
  if (!png) return c.json({ ok: false, reason: 'not found' }, 404);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
});

app.get('/api/sprites/:id', async (c) => {
  const name = playerOf(c);
  if (!name) return c.json({ ok: false, reason: 'not logged in' }, 401);
  const png = await store.readSprite(name, c.req.param('id'));
  if (!png) return c.json({ ok: false, reason: 'not found' }, 404);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`city-builder API on http://localhost:${PORT}`);
  logImageBackend('listening');
});
