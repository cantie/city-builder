import { produceFarms } from './farm';
import { advanceResearch } from './research';
import type { ContentRegistry } from './registry';
import type { GameState } from './types';

export function advanceTick(state: GameState, registry: ContentRegistry): void {
  produceFarms(state, registry);
  advanceResearch(state, registry);
  state.tick += 1;
}

export { produceFarms };
