import { loadLocalEnv } from './env';
import { IMAGE_GEN_FAILED, MISSING_IMAGE_KEY } from './imageErrors';
import { generateImageLiteLLM, type FetchLike, type ImageEnv } from './litellm';
import { generateImagePixflux } from './pixellab';

export { IMAGE_GEN_FAILED, MISSING_IMAGE_KEY };

export type GenerateImage = (description: string) => Promise<Buffer>;
export type ImageProvider = 'litellm' | 'pixellab';

export type ImageBackendInfo = {
  provider: ImageProvider;
  target: string;
  model: string;
};

export function resolveImageProvider(env: ImageEnv = process.env): ImageProvider {
  const raw = (env.IMAGE_PROVIDER ?? 'litellm').trim().toLowerCase();
  return raw === 'pixellab' ? 'pixellab' : 'litellm';
}

export function describeImageBackend(env: ImageEnv = process.env): ImageBackendInfo {
  const provider = resolveImageProvider(env);
  if (provider === 'pixellab') {
    return {
      provider,
      target: 'https://api.pixellab.ai/v2/create-image-pixflux',
      model: 'pixflux',
    };
  }
  const base = env.LITELLM_BASE_URL?.trim();
  const model = env.LITELLM_IMAGE_MODEL?.trim();
  return {
    provider,
    target: base
      ? `${base.replace(/\/+$/, '')}/v1/images/generations`
      : '(missing LITELLM_BASE_URL)',
    model: model || '(missing LITELLM_IMAGE_MODEL)',
  };
}

export function logImageBackend(phase: string, env: ImageEnv = process.env): ImageBackendInfo {
  const info = describeImageBackend(env);
  console.log(
    `[image-gen] ${phase} provider=${info.provider} model=${info.model} target=${info.target}`,
  );
  return info;
}

export function createImageGenerator(
  env: ImageEnv = process.env,
  fetchFn: FetchLike = fetch,
): GenerateImage {
  return async (description) => {
    loadLocalEnv();
    logImageBackend('invent', env);
    if (resolveImageProvider(env) === 'pixellab') {
      return generateImagePixflux(description);
    }
    return generateImageLiteLLM(description, env, fetchFn);
  };
}
