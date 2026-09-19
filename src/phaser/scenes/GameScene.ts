import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import {
  footprintScreenCorners,
  isoMapBounds,
  screenToTile,
  tileToScreen,
} from '@/bridge/coords';
import type { GameContext } from '../createGame';
import { ResourceBar } from '../hud/ResourceBar';
import { BuildMenu } from '../hud/BuildMenu';
import { ResearchPanel } from '../hud/ResearchPanel';

export class GameScene extends Phaser.Scene {
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private toastText?: Phaser.GameObjects.Text;
  private resourceBar!: ResourceBar;
  private buildMenu!: BuildMenu;
  private researchPanel!: ResearchPanel;
  private buildingFeetGfx?: Phaser.GameObjects.Graphics;

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    this.drawIsoGrid();

    const bounds = isoMapBounds(GRID_WIDTH, GRID_HEIGHT);
    this.cameras.main.setBounds(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );
    const center = tileToScreen(GRID_WIDTH / 2, GRID_HEIGHT / 2);
    this.cameras.main.centerOn(center.x, center.y);

    this.ghostGfx = this.add.graphics().setDepth(10);
    this.buildingFeetGfx = this.add.graphics().setDepth(1);

    this.toastText = this.add
      .text(8, 8, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));

    this.redrawBuildings();

    this.resourceBar = new ResourceBar(this);
    this.buildMenu = new BuildMenu(this, this.ctx);
    this.researchPanel = new ResearchPanel(this, this.ctx);
    this.resourceBar.refresh(this.ctx.state);

    const prev = this.ctx.onStateChange;
    this.ctx.onStateChange = () => {
      prev();
      this.refreshHud();
      this.redrawBuildings();
    };
  }

  private drawIsoGrid(): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.28);
    g.fillStyle(0x1b4332, 0.35);

    for (let ty = 0; ty < GRID_HEIGHT; ty++) {
      for (let tx = 0; tx < GRID_WIDTH; tx++) {
        const corners = footprintScreenCorners(tx, ty, 1, 1);
        g.beginPath();
        g.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
          g.lineTo(corners[i].x, corners[i].y);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
    }
  }

  private tileFromPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return screenToTile(world.x, world.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId || !this.ghostGfx) {
      this.ghostGfx?.clear();
      return;
    }
    const def = this.ctx.registry.buildings.get(typeId);
    if (!def) return;
    const tile = this.tileFromPointer(p);
    const ok = this.ctx.state.grid.canPlace(tile, def.footprint);
    const corners = footprintScreenCorners(
      tile.x,
      tile.y,
      def.footprint.width,
      def.footprint.height,
    );

    this.ghostGfx.clear();
    this.ghostGfx.fillStyle(ok ? 0x00ff00 : 0xff0000, 0.35);
    this.ghostGfx.lineStyle(2, ok ? 0x88ff88 : 0xff8888, 0.9);
    this.ghostGfx.beginPath();
    this.ghostGfx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.ghostGfx.lineTo(corners[i].x, corners[i].y);
    }
    this.ghostGfx.closePath();
    this.ghostGfx.fillPath();
    this.ghostGfx.strokePath();
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
    if (!this.buildingFeetGfx) return;
    this.buildingFeetGfx.clear();
    // Faint diamond outlines only — Three.js owns the solid building visuals.
    this.buildingFeetGfx.lineStyle(1, 0xffffff, 0.15);

    for (const b of this.ctx.state.buildings) {
      const def = this.ctx.registry.buildings.get(b.typeId);
      if (!def) continue;
      const corners = footprintScreenCorners(
        b.origin.x,
        b.origin.y,
        def.footprint.width,
        def.footprint.height,
      );
      this.buildingFeetGfx.beginPath();
      this.buildingFeetGfx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) {
        this.buildingFeetGfx.lineTo(corners[i].x, corners[i].y);
      }
      this.buildingFeetGfx.closePath();
      this.buildingFeetGfx.strokePath();
    }
  }

  refreshHud(): void {
    this.resourceBar.refresh(this.ctx.state);
    this.buildMenu.refresh();
    this.researchPanel.refresh();
  }
}
