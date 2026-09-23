# LiteLLM Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invent uses LiteLLM image generation by default, with `IMAGE_PROVIDER` to switch back to PixelLab.

**Architecture:** Extract `loadLocalEnv` so it loads every unset key. Add a factory that returns `GenerateImage`. LiteLLM calls `POST {base}/v1/images/generations`. PixelLab stays. PlayerStore maps generic image errors.

**Tech Stack:** TypeScript, Node fetch, Vitest, existing Hono PlayerStore.

## Global Constraints

- Default provider is `litellm`; only `pixellab` selects PixelLab
- Switch via `IMAGE_PROVIDER` in `.env` (restart required)
- LiteLLM: OpenAI-compatible `/v1/images/generations` with Bearer key
- Errors: `missing image key` · `image generation failed`
- Fail generate → no spend, no blueprint
- Never commit `.env` secrets
- TDD: failing test → implement → pass

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `server/env.ts` | `loadLocalEnv()` — load unset keys from `.env` |
| `server/imageGen.ts` | `GenerateImage`, error strings, `resolveImageProvider`, `createImageGenerator` |
| `server/litellm.ts` | OpenAI image parse + `generateImageLiteLLM` |
| `server/pixellab.ts` | Existing Pixflux call; generic errors |
| `server/playerStore.ts` | Default generator from factory; generic invent errors |
| `server/index.ts` | Import `loadLocalEnv` from `env.ts` |
| `.env.example` | Document switch + LiteLLM vars |
| `tests/server/imageGen.test.ts` | Provider + LiteLLM mocked fetch |
| `tests/server/playerStore.test.ts` | Invent still no-spend on generate fail |

---

## Task 1: Provider factory + LiteLLM client

**Files:**
- Create: `tests/server/imageGen.test.ts`
- Create: `server/env.ts`
- Create: `server/imageGen.ts`
- Create: `server/litellm.ts`
- Modify: `server/pixellab.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing tests** for default=`litellm`, `pixellab` switch, LiteLLM POST + `b64_json`, URL fallback, missing config → `missing image key`
- [ ] **Step 2: Run** `npm test -- tests/server/imageGen.test.ts` — expect FAIL
- [ ] **Step 3: Implement** env/factory/LiteLLM/PixelLab error rename
- [ ] **Step 4: Run tests** — expect PASS

## Task 2: Wire Invent

**Files:**
- Modify: `server/playerStore.ts`
- Modify: `server/index.ts`
- Modify: `tests/server/playerStore.test.ts`

- [ ] **Step 1: Point PlayerStore default at `createImageGenerator`; map generic errors**
- [ ] **Step 2: Run** `npm test -- tests/server` — expect PASS
- [ ] **Step 3: Run** `npm test` — expect PASS
