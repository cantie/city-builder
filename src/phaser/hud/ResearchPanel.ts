import Phaser from 'phaser';
import { startResearch } from '@/core/research';
import { researchStartDisabledReason } from './hudLogic';
import type { GameContext } from '../createGame';

export class ResearchPanel {
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private ctx: GameContext,
  ) {
    this.container = scene.add.container(8, 140).setScrollFactor(0).setDepth(2000);
    this.refresh();
  }

  refresh(): void {
    this.container.removeAll(true);
    const title = this.container.scene.add.text(0, 0, 'Research', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#a0e7ff',
    });
    this.container.add(title);

    const active = this.ctx.state.activeResearch;
    if (active) {
      this.container.add(
        this.container.scene.add.text(
          0,
          20,
          `In progress: ${active.researchId} (${active.remainingTicks} ticks)`,
          { fontFamily: 'monospace', fontSize: '12px', color: '#ccc' },
        ),
      );
    }

    this.ctx.state.availableResearch.forEach((id, i) => {
      const def = this.ctx.registry.research.get(id);
      if (!def) return;
      const reason = researchStartDisabledReason(
        this.ctx.state,
        this.ctx.registry,
        id,
      );
      const cost = Object.entries(def.cost)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      const label = reason
        ? `${def.label} — ${reason}`
        : `${def.label} [${cost}] ${def.durationTicks}t — Start`;
      const btn = this.container.scene.add
        .text(0, 44 + i * 22, label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: reason ? '#888' : '#7CFC00',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setInteractive({ useHandCursor: !reason });
      if (!reason) {
        btn.on('pointerup', () => {
          const result = startResearch(this.ctx.state, this.ctx.registry, id);
          if (!result.ok) return;
          this.ctx.onStateChange();
          this.refresh();
        });
      }
      this.container.add(btn);
    });
  }
}
