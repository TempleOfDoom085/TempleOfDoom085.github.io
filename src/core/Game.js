import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Game {
  constructor() {
    this.scene    = new THREE.Scene();
    this.clock    = new THREE.Clock();
    this.canvas   = document.getElementById('c');
    this.W = window.innerWidth;
    this.H = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.W, this.H);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.camera = new THREE.PerspectiveCamera(70, this.W / this.H, 0.1, 800);
    // Fog and background are owned by Lighting.js (Sky addon + FogExp2)

    this._setupComposer();
    window.addEventListener('resize', () => this._onResize());
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.W, this.H), 0.28, 0.5, 0.88);
    this.composer.addPass(this.bloom);
  }

  _onResize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.renderer.setSize(this.W, this.H);
    this.composer.setSize(this.W, this.H);
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
  }

  setDayFrac(f) {
    // Sky and fog colors are driven by Lighting.js; only exposure changes here
    this.renderer.toneMappingExposure = 0.72 + f * 0.52;
  }

  render() { this.composer.render(); }
}
