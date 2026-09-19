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
}

export function createGame(parent: string, ctx: GameContext): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 640,
    backgroundColor: '#2d6a4f',
    scene: [new BootScene(ctx), new GameScene(ctx)],
  });
}
