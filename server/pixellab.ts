import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadLocalEnv(): void {
  if (process.env.PIXELLAB_API_KEY) return;
  try {
    const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* no .env file */
  }
}

export type GenerateImage = (description: string) => Promise<Buffer>;

export async function generateImagePixflux(description: string): Promise<Buffer> {
  loadLocalEnv();
  const key = process.env.PIXELLAB_API_KEY?.trim();
  if (!key) {
    throw new Error('missing pixellab key');
  }
  const res = await fetch('https://api.pixellab.ai/v1/generate-image-pixflux', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
      image_size: { width: 128, height: 128 },
      isometric: true,
      no_background: true,
    }),
  });
  if (!res.ok) {
    throw new Error('pixellab failed');
  }
  const data = (await res.json()) as {
    image?: { base64?: string };
  };
  const b64 = data.image?.base64;
  if (!b64) throw new Error('pixellab failed');
  return Buffer.from(b64, 'base64');
}
