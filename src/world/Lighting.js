import * as THREE from 'three';

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 0.38;

    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfffbe8, 1.5);
    this.sun.position.set(80, 130, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { near:0.5, far:600, left:-220, right:220, top:220, bottom:-220 });
    scene.add(this.sun);

    this.moon = new THREE.DirectionalLight(0x6688cc, 0.35);
    this.moon.position.set(-80, 100, -60);
    scene.add(this.moon);
  }

  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt * 0.006) % 1;
    const d = Math.max(0, Math.sin(this.timeOfDay * Math.PI));
    this.sun.intensity  = 0.3 + d * 1.4;
    this.moon.intensity = 0.1 + (1 - d) * 0.4;
    this.ambient.intensity = 0.25 + d * 0.45;
    const sunAngle = this.timeOfDay * Math.PI * 2;
    this.sun.position.set(Math.cos(sunAngle) * 120, Math.sin(sunAngle) * 120 + 20, 60);
    return d; // dayFrac for sky color
  }
}
