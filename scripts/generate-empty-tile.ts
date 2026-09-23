import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../server/env';

loadLocalEnv();

function extractBase64(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const image = obj.image;
  if (image && typeof image === 'object') {
    const b64 = (image as Record<string, unknown>).base64;
    if (typeof b64 === 'string' && b64) return b64;
  }
  if (typeof obj.base64 === 'string' && obj.base64) return obj.base64;
  return undefined;
}

const key = process.env.PIXELLAB_API_KEY?.trim();
if (!key) {
  console.error('missing PIXELLAB_API_KEY');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function pollTile(tileId: string): Promise<unknown> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`https://api.pixellab.ai/v2/isometric-tiles/${tileId}`, {
      headers,
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`poll failed ${r.status} ${text.slice(0, 500)}`);
    }
    const data = JSON.parse(text) as { status?: string };
    if (extractBase64(data) || data.status === 'completed' || data.status === 'failed') {
      return data;
    }
    console.log(`[tile] ${data.status ?? 'unknown'} (${i + 1})`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('timed out waiting for isometric tile');
}

const description =
  'packed dirt ground, warm beige-brown earth, subtle soil grain, flat isometric thick tile, cozy pixel-art city builder, clean single outline, no grass no plants no rocks no flowers no props no cracks no decoration';

const res = await fetch('https://api.pixellab.ai/v2/create-isometric-tile', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    description,
    image_size: { width: 64, height: 64 },
    isometric_tile_shape: 'thick tile',
    isometric_tile_size: 32,
    text_guidance_scale: 8,
    seed: Math.floor(Math.random() * 1e9),
  }),
});

const createdText = await res.text();
if (!res.ok) {
  console.error('pixellab isometric tile failed', res.status, createdText);
  process.exit(1);
}

const created = JSON.parse(createdText) as { tile_id?: string; status?: string };
let payload: unknown = created;
if (!extractBase64(created)) {
  if (!created.tile_id) {
    console.error('pixellab returned no tile_id', createdText.slice(0, 800));
    process.exit(1);
  }
  console.log(`[tile] job ${created.tile_id} ${created.status ?? ''}`);
  payload = await pollTile(created.tile_id);
}

const b64 = extractBase64(payload);
if (!b64) {
  console.error('pixellab returned no image', JSON.stringify(payload).slice(0, 800));
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, '..', 'public', 'assets', 'tiles', 'empty.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`wrote ${out}`);
