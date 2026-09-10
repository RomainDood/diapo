import * as THREE from 'three';
import { craftNodeDirective } from '@craft-ts/core';

const DEFAULT_DECORATION = 'orb';
const DEFAULT_COLOR = '#f736e3';

function decorationColor(value: string | undefined): THREE.Color {
  return /^#[0-9a-f]{6}$/i.test(value ?? '') ? new THREE.Color(value ?? DEFAULT_COLOR) : new THREE.Color(DEFAULT_COLOR);
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[]): void {
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else (material as THREE.Material).dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh;
    if (renderable.geometry instanceof THREE.BufferGeometry) renderable.geometry.dispose();
    if (renderable.material instanceof THREE.Material || Array.isArray(renderable.material)) disposeMaterial(renderable.material);
  });
}

/**
 * Adds a lightweight Three.js ambient scene behind the semantic presentation
 * cards. The cards themselves stay native CraftTS buttons so they remain
 * keyboard accessible and work without WebGL.
 */
export const threePresentationBackdrop = craftNodeDirective(
  'threePresentationBackdrop',
  [],
  ({ element }) => {
    if (!('getContext' in element) || !('getBoundingClientRect' in element)) return;

    const canvas = element as HTMLCanvasElement;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.z = 7;
    const group = new THREE.Group();
    scene.add(group);

    const shell = canvas.closest<HTMLElement>('.presentation-shell');
    let activeDecoration = DEFAULT_DECORATION;
    let structures: THREE.Object3D[] = [];
    const clearStructures = () => {
      structures.forEach((structure) => {
        group.remove(structure);
        disposeObject(structure);
      });
      structures = [];
    };
    const buildStructures = () => {
      clearStructures();
      activeDecoration = shell?.dataset.decoration ?? DEFAULT_DECORATION;
      const color = decorationColor(shell?.dataset.decorationColor);
      if (activeDecoration === 'rings') {
        structures = [0, 1, 2].map((index) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35 + index * 0.55, 0.018, 12, 120), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 - index * 0.1 }));
          ring.rotation.x = index * 0.7;
          ring.rotation.y = index * 0.35;
          return ring;
        });
      } else if (activeDecoration === 'particles') {
        const positions = new Float32Array(96 * 3);
        for (let index = 0; index < 96; index += 1) {
          const angle = index * 2.39996;
          const radius = 0.35 + (index % 12) * 0.14;
          positions[index * 3] = Math.cos(angle) * radius;
          positions[index * 3 + 1] = ((index % 16) - 7.5) * 0.18;
          positions[index * 3 + 2] = Math.sin(angle) * radius;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        structures = [new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 0.78 }))];
      } else if (activeDecoration === 'grid') {
        const grid = new THREE.Mesh(new THREE.PlaneGeometry(7, 7, 20, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, wireframe: true, side: THREE.DoubleSide }));
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -0.4;
        structures = [grid];
      } else if (activeDecoration === 'orb') {
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, wireframe: true }));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.018, 12, 120), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.52 }));
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 }));
        structures = [orb, ring, halo];
      }
      group.add(...structures);
    };
    buildStructures();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(bounds.width, 1);
      const height = Math.max(bounds.height, 1);
      renderer.setPixelRatio(Math.min(canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;
    resizeObserver?.observe(canvas);
    const attributeObserver = shell && typeof MutationObserver === 'function' ? new MutationObserver(buildStructures) : undefined;
    if (attributeObserver && shell) attributeObserver.observe(shell, { attributes: true, attributeFilter: ['data-decoration', 'data-decoration-color'] });
    renderer.setAnimationLoop((time) => {
      const seconds = time / 1000;
      if (activeDecoration === 'orb') {
        structures[0]?.rotation.set(seconds * 0.08, seconds * 0.14, 0);
        structures[1]?.rotation.set(seconds * 0.05, seconds * -0.08, 0);
      } else if (activeDecoration === 'rings') {
        structures.forEach((ring, index) => {
          ring.rotation.x += 0.0015 * (index + 1);
          ring.rotation.y -= 0.002 * (index + 1);
          ring.rotation.z = Math.sin(seconds * 0.45 + index) * 0.25;
        });
      } else if (activeDecoration === 'particles') {
        structures[0]?.rotation.set(seconds * 0.04, seconds * 0.12, seconds * 0.02);
      } else if (activeDecoration === 'grid') {
        if (structures[0]) structures[0].rotation.z = seconds * 0.05;
      }
      group.position.y = Math.sin(seconds * 0.7) * 0.08;
      renderer.render(scene, camera);
    });

    return () => {
      resizeObserver?.disconnect();
      attributeObserver?.disconnect();
      renderer.setAnimationLoop(null);
      clearStructures();
      renderer.dispose();
    };
  },
);
