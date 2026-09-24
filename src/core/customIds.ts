const NAME_MAX = 24;

function clipName(text: string): string {
  return text.length <= NAME_MAX ? text : `${text.slice(0, NAME_MAX - 1)}…`;
}

export function parseCustomSlot(id: string): 1 | 2 | 3 | null {
  const m = /^custom-([123])$/.exec(id);
  if (!m) return null;
  return Number(m[1]) as 1 | 2 | 3;
}

export function sharedCustomTypeId(owner: string, slot: 1 | 2 | 3): string {
  return `custom-${owner}-${slot}`;
}

export function sharedResourceId(owner: string, slot: 1 | 2 | 3): string {
  return `res-${owner}-${slot}`;
}

export function sharedUnitId(owner: string, slot: 1 | 2 | 3): string {
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
