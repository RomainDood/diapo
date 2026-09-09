import * as THREE from 'three';
import { craftNodeDirective } from '@craft-ts/core';

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

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.7, 2),
      new THREE.MeshBasicMaterial({ color: 0x8514f5, transparent: true, opacity: 0.24, wireframe: true }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.018, 12, 120),
      new THREE.MeshBasicMaterial({ color: 0xf736e3, transparent: true, opacity: 0.42 }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x5c44e4, transparent: true, opacity: 0.09 }),
    );
    group.add(orb, ring, halo);

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
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;
    observer?.observe(canvas);
    renderer.setAnimationLoop((time) => {
      const seconds = time / 1000;
      orb.rotation.x = seconds * 0.08;
      orb.rotation.y = seconds * 0.14;
      ring.rotation.x = seconds * 0.05;
      ring.rotation.y = seconds * -0.08;
      group.position.y = Math.sin(seconds * 0.7) * 0.08;
      renderer.render(scene, camera);
    });

    return () => {
      observer?.disconnect();
      renderer.setAnimationLoop(null);
      orb.geometry.dispose();
      ring.geometry.dispose();
      halo.geometry.dispose();
      orb.material.dispose();
      ring.material.dispose();
      halo.material.dispose();
      renderer.dispose();
    };
  },
);
