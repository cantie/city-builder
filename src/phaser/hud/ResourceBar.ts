import Phaser from 'phaser';
import type { GameState } from '@/core/types';

export class ResourceBar {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(2000);
  }

  refresh(state: GameState): void {
    const a = state.inventory.amounts;
    this.text.setText(
      `Food ${a.food}  Wood ${a.wood}  Stone ${a.stone}  Coin ${a.coin}  | Tick ${state.tick}`,
    );
  }
}
