import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import { TILE_SIZE } from '@/bridge/coords';
import type { GameContext } from '../createGame';

export class GameScene extends Phaser.Scene {
  private ghost?: Phaser.GameObjects.Rectangle;
  private toastText?: Phaser.GameObjects.Text;

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.25);
    for (let x = 0; x <= GRID_WIDTH; x++) {
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      g.lineBetween(0, y * TILE_SIZE, GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }

    this.cameras.main.setBounds(
      0,
      0,
      GRID_WIDTH * TILE_SIZE,
      GRID_HEIGHT * TILE_SIZE,
    );
    this.cameras.main.centerOn(
      (GRID_WIDTH * TILE_SIZE) / 2,
      (GRID_HEIGHT * TILE_SIZE) / 2,
    );

    this.ghost = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0x00ff00, 0.35)
      .setOrigin(0)
      .setVisible(false);

    this.toastText = this.add
      .text(8, 8, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));

    this.redrawBuildings();
  }

  private tileFromPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return {
      x: Math.floor(world.x / TILE_SIZE),
      y: Math.floor(world.y / TILE_SIZE),
    };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId || !this.ghost) {
      this.ghost?.setVisible(false);
      return;
    }
    const def = this.ctx.registry.buildings.get(typeId);
    if (!def) return;
    const tile = this.tileFromPointer(p);
    const ok = this.ctx.state.grid.canPlace(tile, def.footprint);
    this.ghost
      .setSize(def.footprint.width * TILE_SIZE, def.footprint.height * TILE_SIZE)
      .setPosition(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
      .setFillStyle(ok ? 0x00ff00 : 0xff0000, 0.35)
      .setVisible(true);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId) return;
    const tile = this.tileFromPointer(p);
    const result = placeBuilding(this.ctx.state, this.ctx.registry, typeId, tile);
    if (!result.ok) {
      this.flash(result.reason);
      return;
    }
    this.redrawBuildings();
    this.ctx.onStateChange();
  }

  private flash(msg: string): void {
    if (!this.toastText) return;
    this.toastText.setText(msg);
    this.time.delayedCall(1200, () => this.toastText?.setText(''));
  }

  redrawBuildings(): void {
    const existing = this.children.list.filter(
      (c) => (c as Phaser.GameObjects.Rectangle).name === 'building-foot',
    );
    for (const c of existing) c.destroy();

    for (const b of this.ctx.state.buildings) {
      const def = this.ctx.registry.buildings.get(b.typeId);
      if (!def) continue;
      this.add
        .rectangle(
          b.origin.x * TILE_SIZE,
          b.origin.y * TILE_SIZE,
          def.footprint.width * TILE_SIZE,
          def.footprint.height * TILE_SIZE,
          def.meshColor,
          0.85,
        )
        .setOrigin(0)
        .setName('building-foot')
        .setDepth(1);
    }
  }

  refreshHud(): void {
    // Filled in Task 11
  }
}
