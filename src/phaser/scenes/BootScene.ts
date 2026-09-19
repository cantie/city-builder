import Phaser from 'phaser';
import type { GameContext } from '../createGame';

export class BootScene extends Phaser.Scene {
  // ctx reserved for Task 12 content wiring; kept for constructor parity with GameScene
  constructor(_ctx: GameContext) {
    super('Boot');
  }

  preload(): void {
    // Content comes from ctx.registry (JSON wired in Task 12).
  }

  create(): void {
    this.scene.start('Game');
  }
}
