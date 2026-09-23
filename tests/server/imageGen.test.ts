import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_GEN_FAILED,
  MISSING_IMAGE_KEY,
  createImageGenerator,
  describeImageBackend,
  resolveImageProvider,
} from '../../server/imageGen';
import { generateImageLiteLLM } from '../../server/litellm';

const TINY_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('resolveImageProvider', () => {
  it('defaults to litellm', () => {
    expect(resolveImageProvider({})).toBe('litellm');
    expect(resolveImageProvider({ IMAGE_PROVIDER: 'LITELLM' })).toBe('litellm');
    expect(resolveImageProvider({ IMAGE_PROVIDER: 'unknown' })).toBe('litellm');
  });

  it('selects pixellab only when IMAGE_PROVIDER is pixellab', () => {
    expect(resolveImageProvider({ IMAGE_PROVIDER: 'pixellab' })).toBe('pixellab');
    expect(resolveImageProvider({ IMAGE_PROVIDER: ' PixelLab ' })).toBe(
      'pixellab',
    );
  });
});

describe('describeImageBackend', () => {
  it('reports LiteLLM target without secrets', () => {
    expect(
      describeImageBackend({
        IMAGE_PROVIDER: 'litellm',
        LITELLM_BASE_URL: 'http://llm.example:4000',
        LITELLM_IMAGE_MODEL: 'google-imagen',
        LITELLM_API_KEY: 'sk-secret',
      }),
    ).toEqual({
      provider: 'litellm',
      target: 'http://llm.example:4000/v1/images/generations',
      model: 'google-imagen',
    });
  });

  it('reports PixelLab target', () => {
    expect(describeImageBackend({ IMAGE_PROVIDER: 'pixellab' })).toEqual({
      provider: 'pixellab',
      target: 'https://api.pixellab.ai/v2/create-image-pixflux',
      model: 'pixflux',
    });
  });

  it('marks missing LiteLLM model', () => {
    expect(
      describeImageBackend({
        IMAGE_PROVIDER: 'litellm',
        LITELLM_BASE_URL: 'http://llm.example:4000',
        LITELLM_IMAGE_MODEL: '',
      }).model,
    ).toBe('(missing LITELLM_IMAGE_MODEL)');
  });
});

describe('generateImageLiteLLM', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const env = {
    LITELLM_BASE_URL: 'http://llm.example:4000/',
    LITELLM_API_KEY: 'sk-test',
    LITELLM_IMAGE_MODEL: 'google-imagen',
    LITELLM_IMAGE_SIZE: '512x512',
  };

  it('throws missing image key when config is incomplete', async () => {
    await expect(generateImageLiteLLM('a hut', {}, fetch)).rejects.toThrow(
      MISSING_IMAGE_KEY,
    );
  });

  it('POSTs OpenAI-compatible image generation and decodes b64_json', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://llm.example:4000/v1/images/generations');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        'Bearer sk-test',
      );
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('google-imagen');
      expect(body.prompt).toContain('a hut');
      expect(body.prompt).toContain('solid #FFFFFF background');
      expect(body.n).toBe(1);
      expect(body.size).toBe('512x512');
      expect(body.response_format).toBe('b64_json');
      return new Response(JSON.stringify({ data: [{ b64_json: TINY_B64 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const png = await generateImageLiteLLM('a hut', env, fetchFn);
    expect(png.equals(Buffer.from(TINY_B64, 'base64'))).toBe(true);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('fetches data[0].url when b64_json is absent', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/v1/images/generations')) {
        return new Response(
          JSON.stringify({ data: [{ url: 'http://cdn.example/sprite.png' }] }),
          { status: 200 },
        );
      }
      expect(String(input)).toBe('http://cdn.example/sprite.png');
      return new Response(Buffer.from(TINY_B64, 'base64'), { status: 200 });
    });

    const png = await generateImageLiteLLM('a hut', env, fetchFn);
    expect(png.equals(Buffer.from(TINY_B64, 'base64'))).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws image generation failed on HTTP error', async () => {
    const fetchFn = vi.fn(
      async () => new Response('nope', { status: 502 }),
    );
    await expect(generateImageLiteLLM('a hut', env, fetchFn)).rejects.toThrow(
      IMAGE_GEN_FAILED,
    );
  });
});

describe('createImageGenerator', () => {
  it('uses LiteLLM when provider is litellm', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ b64_json: TINY_B64 }] }), {
          status: 200,
        }),
    );
    const gen = createImageGenerator(
      {
        IMAGE_PROVIDER: 'litellm',
        LITELLM_BASE_URL: 'http://llm.example:4000',
        LITELLM_API_KEY: 'sk-test',
        LITELLM_IMAGE_MODEL: 'google-imagen',
      },
      fetchFn,
    );
    const png = await gen('prompt');
    expect(png.equals(Buffer.from(TINY_B64, 'base64'))).toBe(true);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain(
      '/v1/images/generations',
    );
  });
});
