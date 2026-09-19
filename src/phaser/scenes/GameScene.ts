import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { originFromGrab } from '@/core/buildings';
import {
  footprintScreenCorners,
  ISO_TILE_W,
  isoMapBounds,
  screenToTile,
  tileToScreen,
} from '@/bridge/coords';
import {
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
  lookAtTileFromBuildings,
  stepZoom,
} from '@/bridge/cameraZoom';
import { isTextInputTarget } from '@/ui/domFocus';
import type { BuildingDef, BuildingInstance, BuildingTypeId, Cell } from '@/core/types';
import type { GameContext } from '../createGame';

/** Bottom vertex of a footprint diamond — natural ground contact for sprites. */
function footprintBottom(originX: number, originY: number, w: number, h: number) {
  return tileToScreen(originX + w, originY + h);
}

/** Target display width so the sprite spans the footprint's iso diamond. */
function spriteDisplayWidth(footprint: { width: number; height: number }): number {
  return ((footprint.width + footprint.height) / 2) * ISO_TILE_W;
}

/** Pixel distance before a pointerdown becomes a drag-move. */
const DRAG_THRESHOLD_PX = 8;

type DragState = {
  buildingId: string;
  grabOffset: Cell;
  startX: number;
  startY: number;
  active: boolean;
};

export class GameScene extends Phaser.Scene {
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private ghostSprite?: Phaser.GameObjects.Image;
  private toastText?: Phaser.GameObjects.Text;
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private drag: DragState | null = null;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    this.drawGrassTiles();

    const bounds = isoMapBounds(GRID_WIDTH, GRID_HEIGHT);
    const pad = 800;
    this.cameras.main.setBounds(
      bounds.minX - pad,
      bounds.minY - pad,
      bounds.maxX - bounds.minX + pad * 2,
      bounds.maxY - bounds.minY + pad * 2,
    );
    this.cameras.main.setZoom(DEFAULT_ZOOM);
    this.centerOnCity();

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

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on(
      'wheel',
      (
        _p: Phaser.Input.Pointer,
        _over: unknown,
        _dx: number,
        dy: number,
        _dz: number,
        event: WheelEvent,
      ) => {
        event.preventDefault();
        this.applyZoom(dy > 0 ? -1 : 1);
      },
    );

    this.cursors = this.input.keyboard?.addKeys(
      {
        up: 'UP',
        down: 'DOWN',
        left: 'LEFT',
        right: 'RIGHT',
      },
      false,
    ) as Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D', false) as
      | Record<string, Phaser.Input.Keyboard.Key>
      | undefined;
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (isTextInputTarget(document.activeElement)) return;
      if (event.key === '+' || event.key === '=') this.applyZoom(1);
      if (event.key === '-' || event.key === '_') this.applyZoom(-1);
    });

    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const onIn = () => this.applyZoom(1);
    const onOut = () => this.applyZoom(-1);
    zoomIn?.addEventListener('click', onIn);
    zoomOut?.addEventListener('click', onOut);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      zoomIn?.removeEventListener('click', onIn);
      zoomOut?.removeEventListener('click', onOut);
    });
    this.syncZoomButtons();

    this.redrawBuildings();

    const prev = this.ctx.onStateChange;
    this.ctx.onStateChange = () => {
      prev();
      this.redrawBuildings();
      this.applySelectionTint();
    };
  }

  update(_time: number, delta: number): void {
    if (isTextInputTarget(document.activeElement)) return;
    const cam = this.cameras.main;
    const speed = (520 * delta) / 1000 / cam.zoom;
    const left = this.cursors?.left.isDown || this.wasd?.A?.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D?.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W?.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S?.isDown;
    if (left) cam.scrollX -= speed;
    if (right) cam.scrollX += speed;
    if (up) cam.scrollY -= speed;
    if (down) cam.scrollY += speed;
  }

  private centerOnCity(): void {
    const look = lookAtTileFromBuildings(this.ctx.state.buildings);
    const screen = tileToScreen(look.x, look.y);
    this.cameras.main.centerOn(screen.x, screen.y);
  }

  private applyZoom(direction: 1 | -1): void {
    this.cameras.main.setZoom(stepZoom(this.cameras.main.zoom, direction));
    this.syncZoomButtons();
  }

  private syncZoomButtons(): void {
    const z = this.cameras.main.zoom;
    const inBtn = document.getElementById('zoom-in') as HTMLButtonElement | null;
    const outBtn = document.getElementById('zoom-out') as HTMLButtonElement | null;
    if (inBtn) inBtn.disabled = z >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] - 1e-6;
    if (outBtn) outBtn.disabled = z <= ZOOM_LEVELS[0] + 1e-6;
  }

  /** Stamp empty isometric tile sprites across the 50×50 grid. */
  private drawGrassTiles(): void {
    for (let ty = 0; ty < GRID_HEIGHT; ty++) {
      for (let tx = 0; tx < GRID_WIDTH; tx++) {
        // Bottom tip of the cell diamond — matches PixelLab thick-tile art.
        const bottom = tileToScreen(tx + 1, ty + 1);
        const empty = this.add.image(bottom.x, bottom.y, 'empty');
        empty.setOrigin(0.5, 1);
        // Scale 32→64 so tile width matches ISO_TILE_W.
        empty.setScale(ISO_TILE_W / empty.width);
        empty.setDepth(tx + ty);
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
    // Sort among buildings by origin; offset keeps them above empty tiles (tx+ty).
    image.setDepth(1000 + origin.x + origin.y);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.drag = null;
    if (this.ctx.getSelectedBlueprint()) return;
    const tile = this.tileFromPointer(p);
    const occupantId = this.ctx.state.grid.getOccupant(tile);
    if (!occupantId) return;
    const building = this.ctx.state.buildings.find((b) => b.id === occupantId);
    if (!building) return;
    this.drag = {
      buildingId: occupantId,
      grabOffset: {
        x: tile.x - building.origin.x,
        y: tile.y - building.origin.y,
      },
      startX: p.x,
      startY: p.y,
      active: false,
    };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.drag && !this.ctx.getSelectedBlueprint()) {
      const dx = p.x - this.drag.startX;
      const dy = p.y - this.drag.startY;
      if (
        !this.drag.active &&
        dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
      ) {
        this.drag.active = true;
        this.ctx.setSelectedBuildingId(this.drag.buildingId);
        this.redrawBuildings();
      }
      if (this.drag.active) {
        const building = this.ctx.state.buildings.find(
          (b) => b.id === this.drag!.buildingId,
        );
        if (!building) return;
        const origin = originFromGrab(
          this.tileFromPointer(p),
          this.drag.grabOffset,
        );
        this.showPlacementGhost(building.typeId, origin, building.id);
        return;
      }
    }

    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId) {
      this.clearGhost();
      return;
    }
    this.showPlacementGhost(typeId, this.tileFromPointer(p));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.drag?.active) {
      const drag = this.drag;
      this.drag = null;
      const origin = originFromGrab(
        this.tileFromPointer(p),
        drag.grabOffset,
      );
      this.clearGhost();
      void this.ctx.submitMove(drag.buildingId, origin).then((result) => {
        if (!result.ok) this.flash(result.reason ?? 'invalid placement');
        this.redrawBuildings();
      });
      return;
    }
    this.drag = null;

    const typeId = this.ctx.getSelectedBlueprint();
    const tile = this.tileFromPointer(p);

    // Build mode: place on empty tile; do not place when clicking occupied cell.
    if (typeId) {
      const occupant = this.ctx.state.grid.getOccupant(tile);
      if (occupant) {
        // Occupied — ignore (ghost shows red); stay in build mode.
        this.flash('tile occupied');
        return;
      }
      void this.ctx.submitPlace(typeId, tile).then((result) => {
        if (!result.ok) this.flash(result.reason ?? 'invalid placement');
        this.redrawBuildings();
      });
      return;
    }

    // Inspect mode: select building under cursor, or clear on empty tile.
    const occupantId = this.ctx.state.grid.getOccupant(tile);
    this.ctx.setSelectedBuildingId(occupantId);
    this.applySelectionTint();
  }

  private clearGhost(): void {
    this.ghostGfx?.clear();
    this.ghostSprite?.setVisible(false);
  }

  private showPlacementGhost(
    typeId: BuildingTypeId,
    origin: Cell,
    ignoreBuildingId?: string,
  ): void {
    if (!this.ghostGfx) return;
    const def = this.ctx.registry.buildings.get(typeId);
    if (!def) return;
    const ok = this.ctx.state.grid.canPlace(
      origin,
      def.footprint,
      ignoreBuildingId,
    );
    const corners = footprintScreenCorners(
      origin.x,
      origin.y,
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

    if (this.ghostSprite && this.textures.exists(typeId)) {
      this.ghostSprite.setTexture(typeId);
      this.placeBuildingSprite(this.ghostSprite, def, origin);
      this.ghostSprite.setAlpha(ok ? 0.5 : 0.35);
      this.ghostSprite.setTint(ok ? 0xffffff : 0xff6666);
      this.ghostSprite.setVisible(true);
      this.ghostSprite.setDepth(10_001);
    } else {
      this.ghostSprite?.setVisible(false);
    }
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
    this.applySelectionTint();
  }

  private syncBuildingSprite(b: BuildingInstance): void {
    const def = this.ctx.registry.buildings.get(b.typeId);
    if (!def || !this.textures.exists(b.typeId)) return;

    let sprite = this.buildingSprites.get(b.id);
    if (!sprite) {
      sprite = this.add.image(0, 0, b.typeId);
      sprite.setInteractive({ useHandCursor: true });
      this.buildingSprites.set(b.id, sprite);
    } else if (sprite.texture.key !== b.typeId) {
      sprite.setTexture(b.typeId);
    }
    this.placeBuildingSprite(sprite, def, b.origin);
    sprite.setAlpha(
      this.drag?.active && this.drag.buildingId === b.id ? 0.35 : 1,
    );
  }

  private applySelectionTint(): void {
    const selected = this.ctx.getSelectedBuildingId();
    for (const [id, sprite] of this.buildingSprites) {
      if (id === selected) {
        sprite.setTint(0xaaddff);
      } else {
        sprite.clearTint();
      }
    }
  }

  /** Kept for main.ts tick refresh; sidebar owns HUD now. */
  refreshHud(): void {
    this.applySelectionTint();
  }
}
