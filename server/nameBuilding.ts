import { customBuildingLabel } from '../src/core/customBuilding';
import { loadLocalEnv } from './env';
import type { FetchLike, ImageEnv } from './litellm';

const SYSTEM_PROMPT =
  'You name city-builder buildings. Reply with only a short display name ' +
  '(1–4 words) in the same language as the player description. ' +
  'No quotes, no punctuation, no explanation.';

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

export async function nameBuildingFromPrompt(
  prompt: string,
  env: ImageEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<string> {
  loadLocalEnv();
  const fallback = customBuildingLabel(prompt);
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
        max_tokens: 24,
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
    return customBuildingLabel(prompt, raw ?? undefined);
  } catch (err) {
    console.error('litellm name error', err);
    return fallback;
  }
}
