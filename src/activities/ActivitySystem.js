import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

/**
 * Manages activity modes: walk | skate | bike | fish
 * Each mode changes movement feel + camera + controls.
 */
export class ActivitySystem {
  constructor(player, scene) {
    this.player   = player;
    this.scene    = scene;
    this.mode     = 'walk';
    this._skateboard = null;
    this._fishLine   = null;
    this._fishTimer  = 0;
    this._fishBite   = false;
    this._buildSkateboard();
  }

  _buildSkateboard() {
    const g = new THREE.Group();
    const deck  = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 1.6), new THREE.MeshLambertMaterial({color:0x882200}));
    const wheel = new THREE.MeshLambertMaterial({color:0x111111});
    [[-0.28,-0.6],[-0.28,0.6],[0.28,-0.6],[0.28,0.6]].forEach(([wx,wz])=>{
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.12,8),wheel);
      w.rotation.z=Math.PI/2; w.position.set(wx,-0.1,wz); g.add(w);
    });
    g.add(deck);
    g.visible = false;
    this.scene.add(g);
    this._skateboard = g;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.player.activity = mode;
    this._skateboard.visible = (mode === 'skate');
    if (mode !== 'fish') this._endFishing();
    return mode;
  }

  update(dt, time, input, audio) {
    const p = this.player;
    // Mode switch hotkeys
    if (input.is('1')) this.setMode('walk');
    if (input.is('3')) this.setMode('skate');
    if (input.is('4') && this._nearWater()) this.setMode('fish');

    // Skateboard follows player
    if (this.mode === 'skate') {
      this._skateboard.position.set(p.x, p.y - 1.55, p.z);
      this._skateboard.rotation.y = p.facing;
      if (audio && Math.abs(p.vx)+Math.abs(p.vz) > 1) audio.skate();
    }

    // Fishing
    if (this.mode === 'fish') this._updateFishing(dt, audio);
  }

  _nearWater() {
    return this.player.z > 155;
  }

  _updateFishing(dt, audio) {
    const p = this.player;
    if (!this._fishLine) this._castLine();
    this._fishTimer += dt;
    // Random bite every 5-12s
    if (!this._fishBite && this._fishTimer > 5 + Math.random()*7) {
      this._fishBite = true;
      this._fishTimer = 0;
    }
    // Reel in
    if (this._fishBite) {
      if (this._fishLine) {
        this._fishLine.material.color.set(0xff4400);
      }
    }
  }

  _castLine() {
    const p = this.player;
    const pts = [
      new THREE.Vector3(p.x, p.y, p.z),
      new THREE.Vector3(p.x + Math.sin(p.facing)*8, p.y - 2, p.z + Math.cos(p.facing)*8),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this._fishLine = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x888888}));
    this.scene.add(this._fishLine);
  }

  _endFishing() {
    if (this._fishLine) { this.scene.remove(this._fishLine); this._fishLine = null; }
    this._fishBite = false; this._fishTimer = 0;
  }

  reelIn() {
    if (this.mode !== 'fish' || !this._fishBite) return null;
    this._fishBite = false;
    const fish = ['🐟 Tuna (+$80)', '🐡 Pufferfish (+$50)', '🦈 Baby Shark (+$200)', '👟 Old Boot (+$0)', '💍 Ring (+$300)', '🐙 Octopus (+$120)'];
    const catch_ = fish[Math.floor(Math.random()*fish.length)];
    const reward = parseInt(catch_.match(/\+\$(\d+)/)?.[1] || 0);
    this.player.money += reward;
    this._endFishing();
    setTimeout(() => this._castLine(), 1500);
    return catch_;
  }

  get label() {
    const labels = { walk:'WALKING', skate:'SKATING 🛹', bike:'BIKING 🚲', fish:'FISHING 🎣' };
    return labels[this.mode] || 'WALKING';
  }
}
