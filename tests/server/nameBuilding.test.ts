import { afterEach, describe, expect, it, vi } from 'vitest';
import { nameBuildingFromPrompt, nameInventTrio } from '../../server/nameBuilding';

describe('nameBuildingFromPrompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const env = {
    LITELLM_BASE_URL: 'http://llm.example:4000/',
    LITELLM_API_KEY: 'sk-test',
    LITELLM_CHAT_MODEL: 'openai/gpt-4.1-mini',
  };

  it('POSTs a chat completion and returns a short sanitized name', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://llm.example:4000/v1/chat/completions');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        'Bearer sk-test',
      );
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('openai/gpt-4.1-mini');
      expect(body.messages.at(-1)?.content).toContain('cozy noodle stall');
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"building":"Noodle Stall","resource":"Broth","unit":"Cook"}',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(
      nameBuildingFromPrompt('a cozy noodle stall with lanterns', env, fetchFn),
    ).resolves.toBe('Noodle Stall');
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('parses JSON trio and sanitizes names', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"building":"Noodle Stall","resource":"Broth","unit":"Cook"}',
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(
      nameInventTrio('a cozy noodle stall', env, fetchFn),
    ).resolves.toEqual({
      building: 'Noodle Stall',
      resource: 'Broth',
      unit: 'Cook',
    });
  });

  it('falls back to Ore/Troop when chat fails', async () => {
    await expect(nameInventTrio('crystal bakery', {}, fetch)).resolves.toEqual({
      building: 'crystal bakery',
      resource: 'crystal bakery Ore',
      unit: 'crystal bakery Troop',
    });
  });

  it('falls back to a clipped prompt when chat config or the call fails', async () => {
    await expect(
      nameBuildingFromPrompt('a cozy noodle stall with lanterns', {}, fetch),
    ).resolves.toBe('a cozy noodle stall wit…');

    const fetchFn = vi.fn(async () => new Response('nope', { status: 502 }));
    await expect(
      nameBuildingFromPrompt(
        'a cozy noodle stall with lanterns',
        env,
        fetchFn,
      ),
    ).resolves.toBe('a cozy noodle stall wit…');
  });
});
