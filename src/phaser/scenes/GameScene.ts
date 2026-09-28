import Phaser from 'phaser';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { clickPlacesAt, defaultOriginFor } from '@/core/buildingSlots';
import {
  footprintScreenCorners,
  ISO_TILE_W,
  isoMapBounds,
  isoMapCenter,
  isoGridLines,
  groundCoverRect,
  groundImageRect,
  cameraBoundsForView,
  screenToTile,
  tileToScreen,
} from '@/bridge/coords';
import {
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
  lookAtTileFromBuildings,
  scrollAfterPan,
  stepZoom,
} from '@/bridge/cameraZoom';
import { isTextInputTarget } from '@/ui/domFocus';
import type { BuildingDef, BuildingInstance, BuildingTypeId } from '@/core/types';
import type { GameContext } from '../createGame';

/** Bottom vertex of a footprint diamond — natural ground contact for sprites. */
function footprintBottom(originX: number, originY: number, w: number, h: number) {
  return tileToScreen(originX + w, originY + h);
}

/** Target display width so the sprite spans the footprint's iso diamond. */
function spriteDisplayWidth(footprint: { width: number; height: number }): number {
  return ((footprint.width + footprint.height) / 2) * ISO_TILE_W;
}

/** PixelLab empty tiles stay loaded; stamp them again when this is true. */
const SHOW_GROUND_TILES = false;
const GROUND_FILL = 0x7eb85a;

/** Pixel distance before a pointerdown becomes a map pan. */
const DRAG_THRESHOLD_PX = 8;

type PanState = {
  startX: number;
  startY: number;
  originScrollX: number;
  originScrollY: number;
  active: boolean;
};

export class GameScene extends Phaser.Scene {
  private ghostGfx?: Phaser.GameObjects.Graphics;
  private gridGfx?: Phaser.GameObjects.Graphics;
  private ghostSprite?: Phaser.GameObjects.Image;
  private toastText?: Phaser.GameObjects.Text;
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private pan: PanState | null = null;
  private lastGhostType: string | null = null;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private groundImage?: Phaser.GameObjects.Image;
  private groundFill?: Phaser.GameObjects.Graphics;

  constructor(private ctx: GameContext) {
    super('Game');
  }

  create(): void {
    this.drawGrassTiles();
    this.drawBuildGrid();

    this.cameras.main.roundPixels = true;
    this.cameras.main.setZoom(DEFAULT_ZOOM);
    this.layoutGroundAndCamera();
    this.centerOnCity();
    this.input.mouse?.disableContextMenu();
    this.scale.on('resize', this.onResize, this);

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
      this.scale.off('resize', this.onResize, this);
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
    this.syncBuildGrid();
    if (!this.pan?.active) this.syncPlacementGhost();
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
    const cam = this.cameras.main;
    const midX = cam.midPoint.x;
    const midY = cam.midPoint.y;
    cam.setZoom(stepZoom(cam.zoom, direction));
    this.layoutGroundAndCamera();
    cam.centerOn(midX, midY);
    this.syncZoomButtons();
  }

  private onResize(): void {
    const cam = this.cameras.main;
    const midX = cam.midPoint.x;
    const midY = cam.midPoint.y;
    this.layoutGroundAndCamera();
    cam.centerOn(midX, midY);
  }

  /** Terrain image on the map AABB; camera bounds keep the island in view. */
  private layoutGroundAndCamera(): void {
    const map = isoMapBounds(GRID_WIDTH, GRID_HEIGHT);
    const cover = groundCoverRect(
      map,
      this.scale.width,
      this.scale.height,
      ZOOM_LEVELS[0],
    );
    const image = groundImageRect(map);
    const camBounds = cameraBoundsForView(
      map,
      this.scale.width,
      this.scale.height,
      this.cameras.main.zoom,
    );
    const center = isoMapCenter(GRID_WIDTH, GRID_HEIGHT);
    this.groundImage?.setPosition(center.x, center.y);
    this.groundImage?.setDisplaySize(image.width, image.height);
    if (this.groundFill) {
      this.groundFill.clear();
      this.groundFill.fillStyle(GROUND_FILL, 1);
      this.groundFill.fillRect(cover.minX, cover.minY, cover.width, cover.height);
    }
    this.cameras.main.setBounds(
      camBounds.minX,
      camBounds.minY,
      camBounds.width,
      camBounds.height,
    );
  }

  private syncZoomButtons(): void {
    const z = this.cameras.main.zoom;
    const inBtn = document.getElementById('zoom-in') as HTMLButtonElement | null;
    const outBtn = document.getElementById('zoom-out') as HTMLButtonElement | null;
    if (inBtn) inBtn.disabled = z >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] - 1e-6;
    if (outBtn) outBtn.disabled = z <= ZOOM_LEVELS[0] + 1e-6;
  }

  /** Terrain image aligned to the isometric map; fill pads the zoomed-out view. */
  private drawGrassTiles(): void {
    this.groundFill = this.add.graphics().setDepth(-2);
    if (this.textures.exists('ground')) {
      const center = isoMapCenter(GRID_WIDTH, GRID_HEIGHT);
      this.groundImage = this.add.image(center.x, center.y, 'ground');
      this.groundImage.setOrigin(0.5, 0.5);
      this.groundImage.setDepth(-1);
    }
    this.layoutGroundAndCamera();

    if (!SHOW_GROUND_TILES) return;
    for (let ty = 0; ty < GRID_HEIGHT; ty++) {
      for (let tx = 0; tx < GRID_WIDTH; tx++) {
        // Bottom tip of the cell diamond — matches PixelLab thick-tile art.
        const bottom = tileToScreen(tx + 1, ty + 1);
        const empty = this.add.image(bottom.x, bottom.y, 'empty');
        empty.setOrigin(0.5, 1);
        // Scale empty-tile art so its width matches ISO_TILE_W.
        empty.setScale(ISO_TILE_W / empty.width);
        empty.setDepth(tx + ty);
      }
    }
  }

  private drawBuildGrid(): void {
    const gfx = this.add.graphics().setDepth(2);
    gfx.lineStyle(1, 0xe8f8ee, 0.38);
    for (const line of isoGridLines(GRID_WIDTH, GRID_HEIGHT)) {
      gfx.lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
    }
    gfx.setVisible(false);
    this.gridGfx = gfx;
  }

  private syncBuildGrid(): void {
    const show =
      this.ctx.getBuildMode() || !!this.ctx.getSelectedBlueprint();
    this.gridGfx?.setVisible(show);
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
    this.pan = null;
    if (this.isPanButton(p)) {
      this.beginPan(p);
      return;
    }
    if (this.ctx.getSelectedBlueprint()) {
      const occupant = this.ctx.state.grid.getOccupant(this.tileFromPointer(p));
      if (!occupant) this.beginPan(p);
      return;
    }
    this.beginPan(p);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.pan) {
      this.applyPan(p);
      if (this.pan.active) {
        this.clearGhost();
        return;
      }
    }

    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId) {
      this.clearGhost();
      return;
    }
    const origin = defaultOriginFor(typeId) ?? this.tileFromPointer(p);
    this.showPlacementGhost(typeId, origin);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pan?.active) {
      this.pan = null;
      this.input.setDefaultCursor('default');
      return;
    }
    this.pan = null;
    this.input.setDefaultCursor('default');

    const typeId = this.ctx.getSelectedBlueprint();
    const tile = this.tileFromPointer(p);

    if (typeId) {
      const def = this.ctx.registry.buildings.get(typeId);
      if (!def) return;
      const origin = clickPlacesAt(typeId, tile, def.footprint);
      if (!origin) return;
      void this.ctx.submitPlace(typeId, origin).then((result) => {
        if (!result.ok) {
          this.flash(result.reason ?? 'invalid placement');
        } else {
          this.ctx.setSelectedBlueprint(null);
          this.clearGhost();
        }
        this.redrawBuildings();
      });
      return;
    }

    // Inspect mode: select building under cursor, or clear on empty tile.
    const occupantId = this.ctx.state.grid.getOccupant(tile);
    this.ctx.setSelectedBuildingId(occupantId);
    this.applySelectionTint();
  }

  private isPanButton(p: Phaser.Input.Pointer): boolean {
    return p.button === 1 || p.button === 2;
  }

  private beginPan(p: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;
    this.pan = {
      startX: p.x,
      startY: p.y,
      originScrollX: cam.scrollX,
      originScrollY: cam.scrollY,
      active: false,
    };
  }

  private applyPan(p: Phaser.Input.Pointer): void {
    if (!this.pan) return;
    const dx = p.x - this.pan.startX;
    const dy = p.y - this.pan.startY;
    if (
      !this.pan.active &&
      dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
    ) {
      this.pan.active = true;
      this.input.setDefaultCursor('grabbing');
    }
    if (!this.pan.active) return;
    const next = scrollAfterPan(
      this.pan.originScrollX,
      this.pan.originScrollY,
      this.pan.startX,
      this.pan.startY,
      p.x,
      p.y,
      this.cameras.main.zoom,
    );
    this.cameras.main.setScroll(next.scrollX, next.scrollY);
  }

  private clearGhost(): void {
    this.ghostGfx?.clear();
    this.ghostSprite?.setVisible(false);
  }

  private syncPlacementGhost(): void {
    const typeId = this.ctx.getSelectedBlueprint();
    if (!typeId) {
      if (this.lastGhostType) this.clearGhost();
      this.lastGhostType = null;
      return;
    }
    const origin = defaultOriginFor(typeId);
    if (!origin) return;
    this.showPlacementGhost(typeId, origin);
    if (this.lastGhostType !== typeId) {
      const def = this.ctx.registry.buildings.get(typeId);
      const w = def?.footprint.width ?? 1;
      const h = def?.footprint.height ?? 1;
      const screen = tileToScreen(origin.x + w / 2, origin.y + h / 2);
      this.cameras.main.centerOn(screen.x, screen.y);
    }
    this.lastGhostType = typeId;
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
    sprite.setAlpha(1);
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
