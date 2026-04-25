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
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 420);
    this.scene.background = new THREE.Color(0x87ceeb);

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
    const sky = new THREE.Color().setHSL(0.58, 0.55, 0.12 + f * 0.48);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.renderer.toneMappingExposure = 0.72 + f * 0.52;
  }

  render() { this.composer.render(); }
}
