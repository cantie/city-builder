const NAME_MAX = 24;

/** Max invented custom buildings per player. Slot ids are custom-1 … custom-N. */
export const MAX_CUSTOM_BUILDINGS = 10;

function clipName(text: string): string {
  return text.length <= NAME_MAX ? text : `${text.slice(0, NAME_MAX - 1)}…`;
}

export function parseCustomSlot(id: string): number | null {
  const m = /^custom-(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM_BUILDINGS) return null;
  return n;
}

export function sharedCustomTypeId(owner: string, slot: number): string {
  return `custom-${owner}-${slot}`;
}

export function sharedResourceId(owner: string, slot: number): string {
  return `res-${owner}-${slot}`;
}

export function sharedUnitId(owner: string, slot: number): string {
  return `unit-${owner}-${slot}`;
}

export function fallbackInventNames(prompt: string): {
  building: string;
  resource: string;
  unit: string;
} {
  const building = clipName(prompt.trim().replace(/\s+/g, ' '));
  return {
    building,
    resource: clipName(`${building} Ore`),
    unit: clipName(`${building} Troop`),
  };
}
