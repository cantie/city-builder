import { customBuildingLabel } from '../src/core/customBuilding';
import { fallbackInventNames } from '../src/core/customIds';
import { loadLocalEnv } from './env';
import type { FetchLike, ImageEnv } from './litellm';

export type InventTrio = {
  building: string;
  resource: string;
  unit: string;
};

const SYSTEM_PROMPT =
  'You name a city-builder invention. Reply with JSON only, keys ' +
  'building, resource, unit. Each value is 1–4 words in the same language ' +
  'as the player description. No markdown, no explanation.';

function chatContent(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    return null;
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseTrioJson(raw: string | null): Partial<InventTrio> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripFences(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    return {
      building: typeof o.building === 'string' ? o.building : undefined,
      resource: typeof o.resource === 'string' ? o.resource : undefined,
      unit: typeof o.unit === 'string' ? o.unit : undefined,
    };
  } catch {
    return null;
  }
}

function sanitizeTrio(prompt: string, parsed: Partial<InventTrio> | null): InventTrio {
  const fallback = fallbackInventNames(prompt);
  return {
    building: customBuildingLabel(prompt, parsed?.building ?? fallback.building),
    resource: customBuildingLabel(prompt, parsed?.resource ?? fallback.resource),
    unit: customBuildingLabel(prompt, parsed?.unit ?? fallback.unit),
  };
}

export async function nameInventTrio(
  prompt: string,
  env: ImageEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<InventTrio> {
  loadLocalEnv();
  const fallback = fallbackInventNames(prompt);
  const base = env.LITELLM_BASE_URL?.trim();
  const key = env.LITELLM_API_KEY?.trim();
  const model = env.LITELLM_CHAT_MODEL?.trim();
  if (!base || !key || !model) {
    console.warn('[invent] naming skipped: missing LiteLLM chat config');
    return fallback;
  }
  const url = `${base.replace(/\/+$/, '')}/v1/chat/completions`;
  console.log(`[invent] naming model=${model} url=${url}`);
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 80,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('litellm name error', res.status, errText);
      return fallback;
    }
    const raw = chatContent(await res.json());
    return sanitizeTrio(prompt, parseTrioJson(raw));
  } catch (err) {
    console.error('litellm name error', err);
    return fallback;
  }
}

export async function nameBuildingFromPrompt(
  prompt: string,
  env: ImageEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<string> {
  return (await nameInventTrio(prompt, env, fetchFn)).building;
}
