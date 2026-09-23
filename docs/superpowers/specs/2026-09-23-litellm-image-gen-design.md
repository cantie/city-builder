# Design: LiteLLM image generation with provider switch

**Date:** 2026-09-23  
**Status:** Approved

## Goal

Invent custom buildings generate sprites through **LiteLLM** by default, while **PixelLab** stays available. An env var switches providers. Gameplay, costs, and storage stay the same.

## Env

```
IMAGE_PROVIDER=litellm          # or pixellab; default litellm
LITELLM_BASE_URL=http://localhost:4000
LITELLM_API_KEY=
LITELLM_IMAGE_MODEL=
LITELLM_IMAGE_SIZE=1024x1024    # optional
PIXELLAB_API_KEY=               # unchanged
```

`.env` is gitignored. `loadLocalEnv()` fills any unset keys from `.env` (must not skip the file just because `PIXELLAB_API_KEY` is already set).

## Architecture

`createImageGenerator()` reads `IMAGE_PROVIDER` and returns a `GenerateImage` (`description → Promise<Buffer>`). `PlayerStore` keeps injecting that function; it does not know which provider ran.

- `litellm` (default, including unknown values): OpenAI-compatible `POST {LITELLM_BASE_URL}/v1/images/generations`
- `pixellab`: existing Pixflux call

Restart the server after changing env.

## LiteLLM request

Bearer `LITELLM_API_KEY`. Body:

- `model`: `LITELLM_IMAGE_MODEL`
- `prompt`: existing `composeInventPrompt(...)` text
- `n`: 1
- `size`: `LITELLM_IMAGE_SIZE` or `1024x1024`
- `response_format`: `b64_json`

Decode `data[0].b64_json`. If only `data[0].url` is present, fetch that URL and use the bytes. Missing `LITELLM_BASE_URL`, `LITELLM_API_KEY`, or `LITELLM_IMAGE_MODEL` is a config error.

PixelLab request body and URL stay as they are.

## Errors

Invent maps:

- `missing image key` — selected provider is missing required env
- `image generation failed` — HTTP / parse / other failures

Fail generation → no spend, no blueprint (unchanged).

## Tests

Unit-test provider resolution, LiteLLM request/parse (mocked `fetch`), and invent still refusing to spend when generate throws.

## Non-goals

UI changes, resizing sprites after download, recipes, committing secrets, hosting a LiteLLM proxy inside this repo.
