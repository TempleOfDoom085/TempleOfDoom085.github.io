import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class Lighting {
  constructor(scene, renderer) {
    this.scene    = scene;
    this.renderer = renderer;
    this.timeOfDay = 0.38;

    // Sky mesh (handles background + atmospheric scattering)
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    scene.add(this.sky);

    const su = this.sky.material.uniforms;
    su['turbidity'].value       = 8;
    su['rayleigh'].value        = 1.5;
    su['mieCoefficient'].value  = 0.005;
    su['mieDirectionalG'].value = 0.8;
    this._skyUni = su;
    this._sunVec = new THREE.Vector3();

    // Directional sun with soft shadows
    this.sunLight = new THREE.DirectionalLight(0xfffbe8, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near   = 0.5;
    this.sunLight.shadow.camera.far    = 400;
    this.sunLight.shadow.camera.left   = -180;
    this.sunLight.shadow.camera.right  = 180;
    this.sunLight.shadow.camera.top    = 180;
    this.sunLight.shadow.camera.bottom = -180;
    this.sunLight.shadow.bias = -0.0002;
    scene.add(this.sunLight);

    // Dim moon for night fill
    this.moonLight = new THREE.DirectionalLight(0x334488, 0.0);
    this.moonLight.position.set(-80, 100, -60);
    scene.add(this.moonLight);

    // Ambient
    this.ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(this.ambient);

    // FogExp2 — color updated each frame to match sky horizon
    scene.fog = new THREE.FogExp2(0x88bbee, 0.0018);

    this._updateSun();
  }

  _updateSun() {
    // Sun orbits: rises at timeOfDay≈0.25, peaks at 0.5, sets at 0.75
    const elevation = Math.sin(this.timeOfDay * Math.PI * 2) * 88;
    const azimuth   = 180 + this.timeOfDay * 360;
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this._sunVec.setFromSphericalCoords(1, phi, theta);
    this._skyUni['sunPosition'].value.copy(this._sunVec);
    this.sunLight.position.copy(this._sunVec).multiplyScalar(180);
  }

  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt * 0.006) % 1;
    const d = Math.max(0, Math.sin(this.timeOfDay * Math.PI));

    this._updateSun();

    this.sunLight.intensity  = 0.2 + d * 1.8;
    this.moonLight.intensity = 0.05 + (1 - d) * 0.35;
    this.ambient.intensity   = 0.18 + d * 0.38;

    // Fog color: pale blue at noon → deep navy at midnight
    const fogDay   = new THREE.Color(0x99c4e8);
    const fogNight = new THREE.Color(0x05050f);
    this.scene.fog.color.lerpColors(fogNight, fogDay, d);
    this.scene.fog.density = 0.0013 + (1 - d) * 0.001;

    return d; // dayFrac consumed by Game.setDayFrac
  }
}
