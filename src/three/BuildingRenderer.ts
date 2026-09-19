import * as THREE from 'three';
import { GRID_HEIGHT, GRID_WIDTH } from '@/core/grid';
import { TILE_SIZE, tileToWorld } from '@/bridge/coords';
import { ISO_CAM_DISTANCE } from '@/bridge/cameraSync';
import type { ContentRegistry } from '@/core/registry';
import type { BuildingInstance, Cell, Footprint } from '@/core/types';

export function layoutBuildingMesh(
  origin: Cell,
  footprint: Footprint,
  meshHeight: number,
): {
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
} {
  const center = tileToWorld(
    origin.x + (footprint.width - 1) / 2,
    origin.y + (footprint.height - 1) / 2,
  );
  // meshHeight is in tile units → world units so height is readable in iso view.
  const heightWorld = meshHeight * TILE_SIZE;
  return {
    position: { x: center.x, y: heightWorld / 2, z: center.z },
    scale: {
      x: footprint.width * TILE_SIZE * 0.9,
      y: heightWorld,
      z: footprint.height * TILE_SIZE * 0.9,
    },
  };
}

export class BuildingRenderer {
  readonly scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private root = new THREE.Group();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    const frustum = 320;
    this.camera = new THREE.OrthographicCamera(
      -frustum,
      frustum,
      frustum,
      -frustum,
      0.1,
      4000,
    );

    const look = tileToWorld(GRID_WIDTH / 2 - 0.5, GRID_HEIGHT / 2 - 0.5);
    const d = ISO_CAM_DISTANCE;
    this.camera.position.set(look.x + d, d * 0.75, look.z + d);
    this.camera.lookAt(look.x, look.y, look.z);

    this.scene.add(this.root);
    this.addGroundGrid();

    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(5, 10, 3);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  }

  private addGroundGrid(): void {
    const pts: number[] = [];
    const mapW = GRID_WIDTH * TILE_SIZE;
    const mapH = GRID_HEIGHT * TILE_SIZE;
    for (let i = 0; i <= GRID_WIDTH; i++) {
      const x = i * TILE_SIZE;
      pts.push(x, 0, 0, x, 0, mapH);
    }
    for (let j = 0; j <= GRID_HEIGHT; j++) {
      const z = j * TILE_SIZE;
      pts.push(0, 0, z, mapW, 0, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
      }),
    );
    this.scene.add(lines);
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const frustum = 320;
    const aspect = w / h;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
  }

  sync(buildings: BuildingInstance[], registry: ContentRegistry): void {
    while (this.root.children.length) {
      const child = this.root.children[0];
      this.root.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    for (const b of buildings) {
      const def = registry.buildings.get(b.typeId);
      if (!def) continue;
      const layout = layoutBuildingMesh(b.origin, def.footprint, def.meshHeight);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: def.meshColor }),
      );
      mesh.position.set(layout.position.x, layout.position.y, layout.position.z);
      mesh.scale.set(layout.scale.x, layout.scale.y, layout.scale.z);
      this.root.add(mesh);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
