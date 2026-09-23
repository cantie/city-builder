import { loadLocalEnv } from './env';
import { IMAGE_GEN_FAILED, MISSING_IMAGE_KEY } from './imageErrors';
import { removeBackground } from './removeBackground';

const SOLID_BG_HINT =
  ' Isolated subject on a flat solid #FFFFFF background only, no checkerboard, no scene, no drop shadow.';

export type ImageEnv = Record<string, string | undefined>;
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function firstImage(data: unknown): { b64_json?: unknown; url?: unknown } | null {
  if (!data || typeof data !== 'object') return null;
  const list = (data as { data?: unknown }).data;
  if (!Array.isArray(list) || !list[0] || typeof list[0] !== 'object') return null;
  return list[0] as { b64_json?: unknown; url?: unknown };
}

export async function generateImageLiteLLM(
  description: string,
  env: ImageEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<Buffer> {
  loadLocalEnv();
  const base = env.LITELLM_BASE_URL?.trim();
  const key = env.LITELLM_API_KEY?.trim();
  const model = env.LITELLM_IMAGE_MODEL?.trim();
  if (!base || !key || !model) {
    throw new Error(MISSING_IMAGE_KEY);
  }
  const size = env.LITELLM_IMAGE_SIZE?.trim() || '1024x1024';
  const url = `${base.replace(/\/+$/, '')}/v1/images/generations`;
  console.log(`[image-gen] calling litellm model=${model} size=${size} url=${url}`);
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: `${description}${SOLID_BG_HINT}`,
      n: 1,
      size,
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('litellm error', res.status, errText);
    throw new Error(IMAGE_GEN_FAILED);
  }
  const payload = await res.json();
  const image = firstImage(payload);
  if (typeof image?.b64_json === 'string' && image.b64_json) {
    return removeBackground(Buffer.from(image.b64_json, 'base64'));
  }
  if (typeof image?.url === 'string' && image.url) {
    const file = await fetchFn(image.url);
    if (!file.ok) throw new Error(IMAGE_GEN_FAILED);
    return removeBackground(Buffer.from(await file.arrayBuffer()));
  }
  throw new Error(IMAGE_GEN_FAILED);
}
