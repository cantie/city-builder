import { trySpend } from './inventory';
import type { BuildingLicense, BuildingTypeId, GameState } from './types';

export const LISTING_PRICE_MIN = 10;
export const LISTING_PRICE_MAX = 200;
export const DEFAULT_LISTING_PRICE = 20;

export interface MarketListing {
  typeId: string;
  owner: string;
  slot: 'custom-1' | 'custom-2' | 'custom-3';
  price: number;
  listedAt: number;
  label: string;
  resourceLabel: string;
  unitLabel: string;
  sprite: string;
}

export function validateList(
  state: GameState,
  typeId: BuildingTypeId,
  price: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(price) || price < LISTING_PRICE_MIN || price > LISTING_PRICE_MAX) {
    return { ok: false, reason: 'invalid price' };
  }
  const rec = (state.customBuildings ?? []).find((c) => c.id === typeId);
  if (!rec) return { ok: false, reason: 'need origin' };
  if (!state.buildings.some((b) => b.typeId === typeId)) {
    return { ok: false, reason: 'need origin' };
  }
  return { ok: true };
}

export function applyBuy(
  buyer: GameState,
  listing: MarketListing,
  buyerName: string,
): { ok: true } | { ok: false; reason: string } {
  if (listing.owner === buyerName) {
    return { ok: false, reason: 'own listing' };
  }
  if ((buyer.licenses ?? []).some((l) => l.typeId === listing.typeId)) {
    return { ok: false, reason: 'already licensed' };
  }
  if (!trySpend(buyer.inventory, { coin: listing.price })) {
    return { ok: false, reason: 'cannot afford' };
  }
  const license: BuildingLicense = {
    typeId: listing.typeId,
    owner: listing.owner,
    slot: listing.slot,
    label: listing.label,
    resourceId: `res-${listing.owner}-${listing.slot.replace('custom-', '')}`,
    resourceLabel: listing.resourceLabel,
    unitId: `unit-${listing.owner}-${listing.slot.replace('custom-', '')}`,
    unitLabel: listing.unitLabel,
    sprite: listing.sprite,
  };
  if (!buyer.licenses) buyer.licenses = [];
  buyer.licenses.push(license);
  if (!buyer.unlockedBlueprints.includes(listing.typeId)) {
    buyer.unlockedBlueprints.push(listing.typeId);
  }
  return { ok: true };
}
