import Phaser from 'phaser';
import { unlockedBuildOptions } from './hudLogic';
import type { GameContext } from '../createGame';
import type { BuildingTypeId } from '@/core/types';

export class BuildMenu {
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private ctx: GameContext,
  ) {
    this.container = scene.add.container(8, 40).setScrollFactor(0).setDepth(2000);
    this.refresh();
  }

  refresh(): void {
    this.container.removeAll(true);
    const opts = unlockedBuildOptions(this.ctx.state, this.ctx.registry);
    opts.forEach((def, i) => {
      const label = `${def.label} (${Object.entries(def.cost)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')})`;
      const btn = this.container.scene.add
        .text(0, i * 22, label, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffe066',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => {
        this.ctx.setSelectedBlueprint(def.id as BuildingTypeId);
      });
      this.container.add(btn);
    });
  }
}
