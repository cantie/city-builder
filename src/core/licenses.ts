import type { ContentRegistry } from './registry';
import type { BuildingDef, BuildingLicense } from './types';

export function toLicenseDef(license: BuildingLicense): BuildingDef {
  return {
    id: license.typeId,
    label: license.label,
    footprint: { width: 3, height: 3 },
    demolishable: true,
    cost: { wood: 6, stone: 3 },
    meshColor: 0x7a6bb0,
    meshHeight: 1.0,
    sprite: license.sprite,
  };
}

export function withLicenses(
  registry: ContentRegistry,
  licenses: BuildingLicense[] | undefined,
): ContentRegistry {
  const buildings = new Map(registry.buildings);
  for (const license of licenses ?? []) {
    buildings.set(license.typeId, toLicenseDef(license));
  }
  return { buildings, recipes: registry.recipes, research: registry.research };
}
