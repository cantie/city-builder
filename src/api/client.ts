import { deserializeGame, type SerializedGame } from '@/core/save';
import { syncCustomRegistry } from '@/core/customBuilding';
import type { ContentRegistry } from '@/core/registry';
import type { UpgradesConfig } from '@/core/upgrades';
import type { BuildingTypeId, GameState } from '@/core/types';

export type ApiResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string; state?: GameState };

interface WireResult {
  ok: boolean;
  reason?: string;
  game?: SerializedGame;
}

const NAME_KEY = 'city-builder-player-name';

export class GameApi {
  constructor(
    private registry: ContentRegistry,
    private upgrades: UpgradesConfig,
  ) {}

  rememberedName(): string {
    return localStorage.getItem(NAME_KEY) ?? '';
  }

  async login(name: string): Promise<ApiResult> {
    const result = await this.post('/api/login', { name });
    if (result.ok) localStorage.setItem(NAME_KEY, name.trim());
    return result;
  }

  snapshot(): Promise<ApiResult> {
    return this.request('/api/state', { method: 'GET' });
  }

  place(typeId: BuildingTypeId, x: number, y: number): Promise<ApiResult> {
    return this.post('/api/place', { typeId, x, y });
  }

  move(buildingId: string, x: number, y: number): Promise<ApiResult> {
    return this.post('/api/move', { buildingId, x, y });
  }

  demolish(buildingId: string): Promise<ApiResult> {
    return this.post('/api/demolish', { buildingId });
  }

  harvest(buildingId: string): Promise<ApiResult> {
    return this.post('/api/harvest', { buildingId });
  }

  train(buildingId: string): Promise<ApiResult> {
    return this.post('/api/train', { buildingId });
  }

  research(researchId: string): Promise<ApiResult> {
    return this.post('/api/research', { researchId });
  }

  upgrade(buildingId: string): Promise<ApiResult> {
    return this.post('/api/upgrade', { buildingId });
  }

  newGame(): Promise<ApiResult> {
    return this.post('/api/new-game', {});
  }

  invent(prompt: string, width: number, height: number): Promise<ApiResult> {
    return this.post('/api/invent-building', { prompt, width, height });
  }

  forgetBuilding(typeId: BuildingTypeId): Promise<ApiResult> {
    return this.post('/api/forget-building', { typeId });
  }

  setExport(
    typeId: BuildingTypeId,
    enabled: boolean,
    price?: number,
  ): Promise<ApiResult> {
    return this.post('/api/export', { typeId, enabled, price });
  }

  listOnMarket(typeId: BuildingTypeId, price: number): Promise<ApiResult> {
    return this.post('/api/market/list', { typeId, price });
  }

  unlistFromMarket(typeId: BuildingTypeId): Promise<ApiResult> {
    return this.post('/api/market/unlist', { typeId });
  }

  async marketCatalog(): Promise<{
    ok: boolean;
    listings: import('@/core/market').MarketListing[];
  }> {
    const res = await fetch('/api/market', { credentials: 'include' });
    const data = (await res.json()) as {
      ok?: boolean;
      listings?: import('@/core/market').MarketListing[];
    };
    return { ok: data.ok === true, listings: data.listings ?? [] };
  }

  buyListing(typeId: string): Promise<ApiResult> {
    return this.post('/api/market/buy', { typeId });
  }

  private post(path: string, body: unknown): Promise<ApiResult> {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request(path: string, init: RequestInit): Promise<ApiResult> {
    const res = await fetch(path, { ...init, credentials: 'include' });
    const data = (await res.json()) as WireResult;
    if (data.game) {
      syncCustomRegistry(
        this.registry,
        data.game.customBuildings,
        data.game.licenses,
      );
    }
    const state = data.game
      ? deserializeGame(data.game, this.registry, this.upgrades)
      : null;
    if (!data.ok) {
      return {
        ok: false,
        reason: data.reason ?? 'request failed',
        ...(state ? { state } : {}),
      };
    }
    if (!state) return { ok: false, reason: 'invalid snapshot' };
    return { ok: true, state };
  }
}
