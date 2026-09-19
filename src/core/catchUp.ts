import { advanceTick } from './tick';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export const TICK_INTERVAL_MS = 1000;
export const MAX_CATCH_UP_TICKS = 3600;

export function catchUpTicks(
  state: GameState,
  registry: ContentRegistry,
  lastTickAt: number,
  now: number,
): { applied: number; lastTickAt: number } {
  if (now <= lastTickAt) {
    return { applied: 0, lastTickAt };
  }
  const raw = Math.floor((now - lastTickAt) / TICK_INTERVAL_MS);
  const applied = Math.min(Math.max(0, raw), MAX_CATCH_UP_TICKS);
  for (let i = 0; i < applied; i++) {
    advanceTick(state, registry);
  }
  const last =
    raw > MAX_CATCH_UP_TICKS
      ? now
      : lastTickAt + applied * TICK_INTERVAL_MS;
  return { applied, lastTickAt: last };
}
