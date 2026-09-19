import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { placeBuilding } from '@/core/buildings';
import {
  footprintScreenCorners,
  ISO_TILE_W,
  isoMapBounds,
  screenToTile,
  tileToScreen,
} from '@/bridge/coords';
import type { BuildingDef, BuildingInstance } from '@/core/types';
import type { GameContext } from '../createGame';
import { ResourceBar } from '../hud/ResourceBar';
import { BuildMenu } from '../hud/BuildMenu';
import { ResearchPanel } from '../hud/ResearchPanel';

/** Bottom vertex of a footprint diamond — natural ground contact for sprites. */
function footprintBottom(originX: number, originY: number, w: number, h: number) {
  return tileToScreen(originX + w, originY + h);
}

/** Target display width so the sprite spans the footprint's iso diamond. */
function spriteDisplayWidth(footprint: { width: number; height: number }): number {
  return ((footprint.width + footprint.height) / 2) * ISO_TILE_W;
}

export class GameScene extends Phaser.Scene {
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private ghostSprite?: Phaser.GameObjects.Image;
  private toastText?: Phaser.GameObjects.Text;
  private resourceBar!: ResourceBar;
  private buildMenu!: BuildMenu;
  private researchPanel!: ResearchPanel;
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    this.drawGrassTiles();

    const bounds = isoMapBounds(GRID_WIDTH, GRID_HEIGHT);
    this.cameras.main.setBounds(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );
    const center = tileToScreen(GRID_WIDTH / 2, GRID_HEIGHT / 2);
    this.cameras.main.centerOn(center.x, center.y);

    this.ghostGfx = this.add.graphics().setDepth(10_000);
    this.ghostSprite = this.add
      .image(0, 0, 'farm')
      .setVisible(false)
      .setAlpha(0.45)
      .setDepth(10_001);

    this.toastText = this.add
      .text(8, 8, '', { fontSize: '14px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(20_000);

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

  /** Stamp grass isometric tile sprites across the 20×20 grid. */
  private drawGrassTiles(): void {
    for (let ty = 0; ty < GRID_HEIGHT; ty++) {
      for (let tx = 0; tx < GRID_WIDTH; tx++) {
        // Bottom tip of the cell diamond — matches PixelLab thick-tile art.
        const bottom = tileToScreen(tx + 1, ty + 1);
        const grass = this.add.image(bottom.x, bottom.y, 'grass');
        grass.setOrigin(0.5, 1);
        // Scale 32→64 so tile width matches ISO_TILE_W.
        grass.setScale(ISO_TILE_W / grass.width);
        grass.setDepth(tx + ty);
      }
    }
  }

  private tileFromPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    return screenToTile(world.x, world.y);
  }

  private placeBuildingSprite(
    image: Phaser.GameObjects.Image,
    def: BuildingDef,
    origin: { x: number; y: number },
  ): void {
    const anchor = footprintBottom(
      origin.x,
      origin.y,
      def.footprint.width,
      def.footprint.height,
    );
    // Bottom-center of sprite sits on the footprint's bottom diamond tip.
    image.setOrigin(0.5, 1);
    image.setPosition(anchor.x, anchor.y);
    const targetW = spriteDisplayWidth(def.footprint);
    // Use frame width so repeated redraws do not compound scale.
    image.setScale(targetW / image.frame.width);
    // Sort among buildings by origin; offset keeps them above grass (tx+ty).
    image.setDepth(1000 + origin.x + origin.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId || !this.ghostGfx) {
      this.ghostGfx?.clear();
      this.ghostSprite?.setVisible(false);
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
    this.ghostGfx.fillStyle(ok ? 0x00ff00 : 0xff0000, 0.28);
    this.ghostGfx.lineStyle(2, ok ? 0x88ff88 : 0xff8888, 0.9);
    this.ghostGfx.beginPath();
    this.ghostGfx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.ghostGfx.lineTo(corners[i].x, corners[i].y);
    }
    this.ghostGfx.closePath();
    this.ghostGfx.fillPath();
    this.ghostGfx.strokePath();

    // Semi-transparent building sprite preview when texture is loaded.
    if (this.ghostSprite && this.textures.exists(typeId)) {
      this.ghostSprite.setTexture(typeId);
      this.placeBuildingSprite(this.ghostSprite, def, tile);
      this.ghostSprite.setAlpha(ok ? 0.5 : 0.35);
      this.ghostSprite.setTint(ok ? 0xffffff : 0xff6666);
      this.ghostSprite.setVisible(true);
      this.ghostSprite.setDepth(10_001);
    } else {
      this.ghostSprite?.setVisible(false);
    }
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
    const live = new Set(this.ctx.state.buildings.map((b) => b.id));
    for (const [id, sprite] of this.buildingSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
      }
    }

    for (const b of this.ctx.state.buildings) {
      this.syncBuildingSprite(b);
    }
  }

  private syncBuildingSprite(b: BuildingInstance): void {
    const def = this.ctx.registry.buildings.get(b.typeId);
    if (!def || !this.textures.exists(b.typeId)) return;

    let sprite = this.buildingSprites.get(b.id);
    if (!sprite) {
      sprite = this.add.image(0, 0, b.typeId);
      this.buildingSprites.set(b.id, sprite);
    } else if (sprite.texture.key !== b.typeId) {
      sprite.setTexture(b.typeId);
    }
    this.placeBuildingSprite(sprite, def, b.origin);
  }

  refreshHud(): void {
    this.resourceBar.refresh(this.ctx.state);
    this.buildMenu.refresh();
    this.researchPanel.refresh();
  }
}
