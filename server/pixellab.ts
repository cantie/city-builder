import { loadLocalEnv } from './env';
import { IMAGE_GEN_FAILED, MISSING_IMAGE_KEY } from './imageErrors';

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

export async function generateImagePixflux(description: string): Promise<Buffer> {
  loadLocalEnv();
  const key = process.env.PIXELLAB_API_KEY?.trim();
  if (!key) {
    throw new Error(MISSING_IMAGE_KEY);
  }
  const seed = Math.floor(Math.random() * 1e9);
  console.log(
    '[image-gen] calling pixellab pixflux https://api.pixellab.ai/v2/create-image-pixflux',
  );
  const res = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
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
      text_guidance_scale: 5,
      detail: 'highly detailed',
      outline: 'single color outline',
      seed,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('pixellab error', res.status, errText);
    throw new Error(IMAGE_GEN_FAILED);
  }
  const data = await res.json();
  const b64 = extractBase64(data);
  if (!b64) throw new Error(IMAGE_GEN_FAILED);
  return Buffer.from(b64, 'base64');
}
