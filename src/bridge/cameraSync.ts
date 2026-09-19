import { screenToTileFloat, tileToWorld } from './coords';

export interface PhaserCamLike {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface ThreeCamLike {
  position: { x: number; y: number; z: number };
  zoom: number;
  lookAt(x: number, y: number, z: number): void;
  updateProjectionMatrix(): void;
}

/** World-space distance from look-at along the isometric (d, d*0.75, d) offset. */
export const ISO_CAM_DISTANCE = 480;

/**
 * Sync Three OrthographicCamera to an isometric view matching Phaser's
 * isometric screen camera (scroll + zoom).
 */
export function syncThreeCameraFromPhaser(
  phaser: PhaserCamLike,
  three: ThreeCamLike,
  distance: number = ISO_CAM_DISTANCE,
): void {
  const centerSx = phaser.scrollX + phaser.width / 2;
  const centerSy = phaser.scrollY + phaser.height / 2;
  const tile = screenToTileFloat(centerSx, centerSy);
  const look = tileToWorld(tile.x, tile.y);

  three.position.x = look.x + distance;
  three.position.y = distance * 0.75;
  three.position.z = look.z + distance;
  three.lookAt(look.x, look.y, look.z);

  three.zoom = phaser.zoom;
  three.updateProjectionMatrix();
}
