import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

function buildUFO(scene) {
  const g = new THREE.Group();
  const saucer = new THREE.Mesh(new THREE.SphereGeometry(3.2,14,7), new THREE.MeshLambertMaterial({color:0xaaddff,emissive:0x224488}));
  saucer.scale.y = 0.28; g.add(saucer);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.55,10,8), new THREE.MeshLambertMaterial({color:0x88ddff,emissive:0x22aaff,transparent:true,opacity:0.82}));
  dome.position.y = 0.55; g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6,0.18,6,18), new THREE.MeshLambertMaterial({color:0x00ff88,emissive:0x00cc44}));
  ring.rotation.x = Math.PI/2; g.add(ring);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.8,18,10,1,true), new THREE.MeshLambertMaterial({color:0x88ffcc,emissive:0x00ff88,transparent:true,opacity:0.18,side:THREE.DoubleSide}));
  beam.position.y = -9; g.add(beam);
  const light = new THREE.PointLight(0x00ff88, 4, 30);
  light.position.y = -2; g.add(light);
  scene.add(g);
  return g;
}

const EVENTS = [
  {
    id: 'ufo',
    msg: '👽 UNIDENTIFIED OBJECT DETECTED OVERHEAD',
    duration: 22,
  },
  {
    id: 'meteorShower',
    msg: '☄️ METEOR SHOWER INCOMING — TAKE COVER',
    duration: 12,
  },
  {
    id: 'powerSurge',
    msg: '⚡ CITY POWER SURGE — ALL SYSTEMS AFFECTED',
    duration: 8,
  },
  {
    id: 'stampede',
    msg: '🐴 HORSE STAMPEDE DETECTED IN THE CITY',
    duration: 14,
  },
];

export class WorldEvents {
  constructor(scene, hud, particles) {
    this.scene     = scene;
    this.hud       = hud;
    this.particles = particles;
    this._timer    = 55 + Math.random() * 45; // first event 55-100s in
    this._ufo      = null;
    this._ufoTimer = 0;
    this._ufoPhase = 0;
    this._meteors  = [];
  }

  update(dt, player) {
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 70 + Math.random() * 80;
      this._trigger(player);
    }

    // UFO hover
    if (this._ufo) {
      this._ufoTimer -= dt;
      this._ufoPhase += dt;
      this._ufo.rotation.y += dt * 0.7;
      this._ufo.position.set(
        player.x + Math.sin(this._ufoPhase * 0.4) * 8,
        player.y + 28 + Math.sin(this._ufoPhase * 0.7) * 2.5,
        player.z - 8 + Math.cos(this._ufoPhase * 0.3) * 5
      );
      if (this._ufoTimer <= 0) {
        this.scene.remove(this._ufo);
        this._ufo = null;
        this.hud.notify('👽 Contact lost. It was probably nothing.', 3);
      }
    }

    // Meteor shower particles
    if (this._meteors.length > 0) {
      for (let i = this._meteors.length - 1; i >= 0; i--) {
        const m = this._meteors[i];
        m.life -= dt;
        m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
        m.mesh.position.set(m.x, m.y, m.z);
        if (m.life <= 0 || m.y < getHeight(m.x, m.z)) {
          this.scene.remove(m.mesh);
          this.particles.burst(new THREE.Vector3(m.x, m.y, m.z), 0xff6600, 12, 8);
          this._meteors.splice(i, 1);
        }
      }
    }
  }

  _trigger(player) {
    const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    this.hud.notify(evt.msg, 4.5);

    if (evt.id === 'ufo' && !this._ufo) {
      this._ufo      = buildUFO(this.scene);
      this._ufoTimer = evt.duration;
      this._ufoPhase = 0;
    }

    if (evt.id === 'meteorShower') {
      for (let i = 0; i < 18; i++) {
        setTimeout(() => this._spawnMeteor(player), i * 600);
      }
    }

    if (evt.id === 'powerSurge') {
      // Visual: handled by CSS flash in main
      if (typeof window._powerSurge === 'function') window._powerSurge();
    }
  }

  _spawnMeteor(player) {
    const x = player.x + (Math.random()-0.5)*180;
    const z = player.z + (Math.random()-0.5)*180;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28,5,5),
      new THREE.MeshLambertMaterial({color:0xff6600,emissive:0xcc2200})
    );
    mesh.position.set(x, 80, z);
    this.scene.add(mesh);
    this._meteors.push({ mesh, x, y:80, z, vx:(Math.random()-0.5)*4, vy:-35, vz:(Math.random()-0.5)*4, life:5 });
  }
}
