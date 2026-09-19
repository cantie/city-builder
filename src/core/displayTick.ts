import { MAX_CATCH_UP_TICKS } from './catchUp';
import { advanceTick } from './tick';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

/**
 * Client-side production clock. Does not persist or talk to the server —
 * the next command/login catch-up remains authoritative.
 */
export function tryAdvanceLocalDisplay(
  state: GameState,
  registry: ContentRegistry,
  lastAuthoritativeTick: number,
  cap: number = MAX_CATCH_UP_TICKS,
): boolean {
  if (state.tick - lastAuthoritativeTick >= cap) return false;
  advanceTick(state, registry);
  return true;
}
