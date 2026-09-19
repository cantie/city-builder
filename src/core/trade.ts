import type { ResourceId } from './types';

/** Phase-2 seam only — no network in MVP. */
export interface TradeService {
  reserve(resource: ResourceId, amount: number): string | null;
  commit(reservationId: string): boolean;
  cancel(reservationId: string): void;
}

export class NoopTradeService implements TradeService {
  reserve(): string | null {
    return null;
  }

  commit(): boolean {
    return false;
  }

  cancel(): void {}
}
