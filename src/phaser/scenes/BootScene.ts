import Phaser from 'phaser';
import type { GameContext } from '../createGame';

export class BootScene extends Phaser.Scene {
  constructor(private ctx: GameContext) {
    super('Boot');
  }

  preload(): void {
    // Keep empty ground tile in the atlas; GameScene hides the stamp for now.
    this.load.image('empty', '/assets/tiles/empty.png');
    this.load.image('ground', '/assets/tiles/ground.png');
    for (const def of this.ctx.registry.buildings.values()) {
      const path = def.sprite ?? `/assets/buildings/${def.id}.png`;
      const url = path.startsWith('/') ? path : `/${path}`;
      this.load.image(def.id, url);
    }
  }

  create(): void {
    this.scene.start('Game');
  }
}
