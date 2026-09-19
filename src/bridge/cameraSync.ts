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
  updateProjectionMatrix(): void;
}

export function syncThreeCameraFromPhaser(
  phaser: PhaserCamLike,
  three: ThreeCamLike,
): void {
  three.position.x = phaser.scrollX + phaser.width / 2;
  three.position.z = phaser.scrollY + phaser.height / 2;
  three.zoom = phaser.zoom;
  three.updateProjectionMatrix();
}
