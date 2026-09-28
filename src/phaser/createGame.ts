import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingTypeId, GameState } from '@/core/types';

export interface GameContext {
  state: GameState;
  registry: ContentRegistry;
  onStateChange: () => void;
  getSelectedBlueprint: () => BuildingTypeId | null;
  setSelectedBlueprint: (id: BuildingTypeId | null) => void;
  selectedBuildingId: string | null;
  getSelectedBuildingId: () => string | null;
  setSelectedBuildingId: (id: string | null) => void;
  getBuildMode: () => boolean;
  submitPlace: (
    typeId: BuildingTypeId,
    origin: { x: number; y: number },
  ) => Promise<{ ok: boolean; reason?: string }>;
  submitMove: (
    buildingId: string,
    origin: { x: number; y: number },
  ) => Promise<{ ok: boolean; reason?: string }>;
}

export const GROUND_COLOR_HEX = '#7eb85a';

export function createGame(parent: string, ctx: GameContext): Phaser.Game {
  const el = document.getElementById(parent);
  const width = el?.clientWidth || 800;
  const height = el?.clientHeight || 600;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: GROUND_COLOR_HEX,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width,
      height,
    },
    scene: [new BootScene(ctx), new GameScene(ctx)],
  });
}
