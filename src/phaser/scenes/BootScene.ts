import Phaser from 'phaser';
import type { GameContext } from '../createGame';

export class BootScene extends Phaser.Scene {
  constructor(private ctx: GameContext) {
    super('Boot');
  }

  preload(): void {
    this.load.image('empty', '/assets/tiles/empty.png');
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
