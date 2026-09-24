import { demolishBuilding } from './buildings';
import {
  fallbackInventNames,
  parseCustomSlot,
  sharedResourceId,
  sharedUnitId,
} from './customIds';
import { toLicenseDef } from './licenses';
import type { ContentRegistry } from './registry';
import type {
  BuildingDef,
  BuildingLicense,
  BuildingTypeId,
  CustomBuilding,
  Footprint,
  GameState,
  ResourceId,
} from './types';

export const MAX_CUSTOM_BUILDINGS = 3;
export const CUSTOM_FOOTPRINT: Footprint = { width: 3, height: 3 };
export const DEFAULT_EXPORT_PRICE = 2;
export const INVENT_COST: Partial<Record<ResourceId, number>> = {
  wood: 10,
  stone: 8,
  food: 8,
};
export const CUSTOM_PLACE_COST: Partial<Record<ResourceId, number>> = {
  wood: 6,
  stone: 3,
};

/** Soft invent constraints — keep name for export stability. */
export const SYSTEM_ART_STYLE =
  'isometric pixel-art game building, transparent background, no UI no text no characters, readable silhouette; varied materials, shapes, mood, fantasy or quirky designs welcome';

export type InventInputResult =
  | { ok: true; prompt: string; footprint: Footprint }
  | { ok: false; reason: string };

export function validateInventInput(
  rawPrompt: string,
  width: number,
  height: number,
): InventInputResult {
  const prompt = rawPrompt.trim().replace(/\s+/g, ' ');
  if (prompt.length < 4 || prompt.length > 160) {
    return { ok: false, reason: 'invalid prompt' };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(prompt)) {
    return { ok: false, reason: 'invalid prompt' };
  }
  return { ok: true, prompt, footprint: { ...CUSTOM_FOOTPRINT } };
}

type CustomBuildingDraft = Partial<CustomBuilding> &
  Pick<CustomBuilding, 'id' | 'label' | 'prompt' | 'footprint' | 'sprite'>;

export function normalizeCustomBuildings(
  customs: CustomBuildingDraft[] | undefined,
  owner = 'local',
): CustomBuilding[] {
  return (customs ?? []).map((b) => {
    const slot = parseCustomSlot(String(b.id)) ?? 1;
    const names = fallbackInventNames(b.prompt);
    return {
      id: b.id,
      label: b.label,
      prompt: b.prompt,
      footprint: { ...CUSTOM_FOOTPRINT },
      sprite: b.sprite,
      resourceId: b.resourceId ?? sharedResourceId(owner, slot),
      resourceLabel: b.resourceLabel ?? names.resource,
      unitId: b.unitId ?? sharedUnitId(owner, slot),
      unitLabel: b.unitLabel ?? names.unit,
      exportPrice:
        typeof b.exportPrice === 'number' ? b.exportPrice : DEFAULT_EXPORT_PRICE,
      exportEnabled: b.exportEnabled !== false,
    };
  });
}

export function composeInventPrompt(prompt: string, footprint: Footprint): string {
  return (
    `Creative isometric pixel-art building: ${prompt}. ` +
    `Soft constraints: ${footprint.width}×${footprint.height} footprint feel, ` +
    `transparent background, no UI no text no characters, cohesive game-ready sprite, ` +
    `encourage unique silhouette and details.`
  );
}

export function nextCustomBuildingId(
  existing: { id: string }[],
): BuildingTypeId | null {
  const used = new Set(existing.map((b) => b.id));
  for (let i = 1; i <= MAX_CUSTOM_BUILDINGS; i++) {
    const id = `custom-${i}`;
    if (!used.has(id)) return id;
  }
  return null;
}

/** Keep a building name short enough for the build grid. */
export const BUILDING_NAME_MAX = 24;

export function sanitizeBuildingName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/\r?\n/)[0] ?? '';
  const cleaned = first
    .replace(/[`*_#]/g, '')
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= BUILDING_NAME_MAX) return cleaned;
  return `${cleaned.slice(0, BUILDING_NAME_MAX - 1)}…`;
}

export function customBuildingLabel(prompt: string, suggested?: string): string {
  return sanitizeBuildingName(suggested) ?? (prompt.length <= BUILDING_NAME_MAX
    ? prompt
    : `${prompt.slice(0, BUILDING_NAME_MAX - 1)}…`);
}

export function toCustomBuildingDef(rec: CustomBuilding): BuildingDef {
  return {
    id: rec.id,
    label: rec.label,
    footprint: { ...rec.footprint },
    demolishable: true,
    cost: { ...CUSTOM_PLACE_COST },
    meshColor: 0x7a6bb0,
    meshHeight: 1.0,
    sprite: rec.sprite,
  };
}

export function withCustomBuildings(
  registry: ContentRegistry,
  customs: CustomBuilding[] | undefined,
): ContentRegistry {
  const buildings = new Map(registry.buildings);
  for (const rec of customs ?? []) {
    buildings.set(rec.id, toCustomBuildingDef(rec));
  }
  return { buildings, recipes: registry.recipes, research: registry.research };
}

export function syncCustomRegistry(
  registry: ContentRegistry,
  customs: CustomBuilding[] | undefined,
  licenses?: BuildingLicense[],
): void {
  for (const id of [...registry.buildings.keys()]) {
    if (String(id).startsWith('custom-')) {
      registry.buildings.delete(id);
    }
  }
  for (const rec of customs ?? []) {
    registry.buildings.set(rec.id, toCustomBuildingDef(rec));
  }
  for (const license of licenses ?? []) {
    registry.buildings.set(license.typeId, toLicenseDef(license));
  }
}

export function applyInventedBuilding(
  state: GameState,
  registry: ContentRegistry,
  input: {
    id: BuildingTypeId;
    prompt: string;
    footprint: Footprint;
    sprite: string;
    label?: string;
    owner?: string;
    names?: { building?: string; resource?: string; unit?: string };
  },
): CustomBuilding {
  const slot = parseCustomSlot(String(input.id)) ?? 1;
  const owner = input.owner ?? 'local';
  const fallback = fallbackInventNames(input.prompt);
  const rec: CustomBuilding = {
    id: input.id,
    label: customBuildingLabel(
      input.prompt,
      input.names?.building ?? input.label,
    ),
    prompt: input.prompt,
    footprint: { ...CUSTOM_FOOTPRINT },
    sprite: input.sprite,
    resourceId: sharedResourceId(owner, slot),
    resourceLabel: customBuildingLabel(
      input.prompt,
      input.names?.resource ?? fallback.resource,
    ),
    unitId: sharedUnitId(owner, slot),
    unitLabel: customBuildingLabel(
      input.prompt,
      input.names?.unit ?? fallback.unit,
    ),
    exportPrice: DEFAULT_EXPORT_PRICE,
    exportEnabled: true,
  };
  if (!state.customBuildings) state.customBuildings = [];
  state.customBuildings.push(rec);
  if (!state.unlockedBlueprints.includes(rec.id)) {
    state.unlockedBlueprints.push(rec.id);
  }
  registry.buildings.set(rec.id, toCustomBuildingDef(rec));
  return rec;
}

export function forgetCustomBuilding(
  state: GameState,
  registry: ContentRegistry,
  typeId: BuildingTypeId,
): { ok: true } | { ok: false; reason: string } {
  if (!String(typeId).startsWith('custom-')) {
    return { ok: false, reason: 'not a custom building' };
  }
  const list = state.customBuildings ?? [];
  if (!list.some((b) => b.id === typeId)) {
    return { ok: false, reason: 'not found' };
  }
  const instances = state.buildings.filter((b) => b.typeId === typeId);
  for (const inst of instances) {
    demolishBuilding(state, registry, inst.id);
  }
  state.customBuildings = list.filter((b) => b.id !== typeId);
  state.unlockedBlueprints = state.unlockedBlueprints.filter((id) => id !== typeId);
  registry.buildings.delete(typeId);
  return { ok: true };
}
