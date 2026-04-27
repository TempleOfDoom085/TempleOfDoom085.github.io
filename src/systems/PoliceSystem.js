import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

function buildPoliceMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.95,0.42), new THREE.MeshLambertMaterial({color:0x1a2a6c}));
  body.position.y = 0.28; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.52,0.52), new THREE.MeshLambertMaterial({color:0xffd0a0}));
  head.position.y = 1.12; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.29,0.29,0.14,8), new THREE.MeshLambertMaterial({color:0x0d1a4a}));
  cap.position.y = 1.44; g.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.06,8), new THREE.MeshLambertMaterial({color:0x0d1a4a}));
  brim.position.y = 1.36; g.add(brim);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.10,0.05), new THREE.MeshLambertMaterial({color:0xffcc00}));
  badge.position.set(0.12, 0.55, 0.25); g.add(badge);
  [-0.18,0.18].forEach((ox,i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.72,0.26), new THREE.MeshLambertMaterial({color:0x101830}));
    leg.position.set(ox,-0.38,0); leg.name=`pl${i}`; g.add(leg);
  });
  [-0.46,0.46].forEach((ox,i) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.72,0.22), new THREE.MeshLambertMaterial({color:0x1a2a6c}));
    arm.position.set(ox,0.28,0); arm.name=`pa${i}`; g.add(arm);
  });
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return g;
}

export class PoliceSystem {
  constructor(scene, player, hud, audio) {
    this.scene  = scene;
    this.player = player;
    this.hud    = hud;
    this.audio  = audio;
    this.units  = [];
    this._siren    = null;
    this._sirenT   = 0;
    this._spawnCd  = 0;
    this._escapeCd = 0;
    this._prevWanted = 0;
    this._siren = new THREE.PointLight(0xff1111, 0, 24);
    scene.add(this._siren);
  }

  _spawnUnit() {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 55 + Math.random() * 20;
    const x = this.player.x + Math.sin(angle) * dist;
    const z = this.player.z + Math.cos(angle) * dist;
    const y = getHeight(x, z) + 0.85;
    const mesh = buildPoliceMesh();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.units.push({ mesh, x, z, y, vx: 0, vz: 0, walkPhase: 0, attackCd: 0 });
  }

  update(dt, time) {
    const player = this.player;
    const wanted = player.wanted;

    // Spawn cops when wanted rises
    if (wanted > 0 && this._spawnCd <= 0) {
      const target = Math.min(wanted, 4);
      if (this.units.length < target) {
        this._spawnUnit();
        this.audio.sirenAlert();
        this._spawnCd = 7;
      }
    }
    if (this._spawnCd > 0) this._spawnCd -= dt;

    // Siren light follows nearest unit, alternates red/blue
    this._sirenT += dt;
    if (wanted > 0 && this.units.length > 0) {
      const u = this.units[0];
      this._siren.position.set(u.x, u.y + 2.4, u.z);
      this._siren.color.set(Math.floor(this._sirenT * 5) % 2 === 0 ? 0xff1111 : 0x1144ff);
      this._siren.intensity = 2.5 + Math.sin(this._sirenT * 18) * 0.3;
      this.audio.setSiren(true);
    } else {
      this._siren.intensity = 0;
      this.audio.setSiren(false);
    }

    // AI: pursue and attack
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.attackCd > 0) u.attackCd -= dt;

      if (wanted <= 0) {
        this.scene.remove(u.mesh);
        this.units.splice(i, 1);
        continue;
      }

      const dx   = player.x - u.x;
      const dz   = player.z - u.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 1.8) {
        if (u.attackCd <= 0) {
          player.takeDamage(14);
          u.attackCd = 1.4;
        }
      } else {
        const spd = 5.8;
        u.vx = THREE.MathUtils.lerp(u.vx, (dx / dist) * spd, 0.15);
        u.vz = THREE.MathUtils.lerp(u.vz, (dz / dist) * spd, 0.15);
        u.x += u.vx * dt;
        u.z += u.vz * dt;
        u.y = getHeight(u.x, u.z) + 0.85;
        u.mesh.position.set(u.x, u.y, u.z);
        u.mesh.rotation.y = Math.atan2(dx, dz);
        u.walkPhase += dt * 4;
        const s = Math.sin(u.walkPhase);
        const l0 = u.mesh.getObjectByName('pl0'); if (l0) l0.rotation.x =  s * 0.5;
        const l1 = u.mesh.getObjectByName('pl1'); if (l1) l1.rotation.x = -s * 0.5;
      }
    }

    // Escape: all units >70 units away → 9s cooldown → -1 wanted
    if (wanted > 0 && this.units.length > 0) {
      const allFar = this.units.every(u => Math.hypot(player.x - u.x, player.z - u.z) > 70);
      if (allFar) {
        this._escapeCd += dt;
        if (this._escapeCd >= 9) {
          player.wanted = Math.max(0, player.wanted - 1);
          this._escapeCd = 0;
          if (player.wanted === 0) { this.clear(); this.hud.notify('🚔 Escaped. Stay low.'); }
          else this.hud.notify('🚔 Heat dropping…');
        }
      } else {
        this._escapeCd = 0;
      }
    }
  }

  // Returns true if a police unit is within range — used to detect attacking cops
  isNearUnit(x, z, range = 3.5) {
    return this.units.some(u => Math.hypot(x - u.x, z - u.z) < range);
  }

  clear() {
    this.units.forEach(u => this.scene.remove(u.mesh));
    this.units = [];
    this._siren.intensity = 0;
    this._escapeCd = 0;
    this._spawnCd  = 0;
    this.audio.setSiren(false);
  }
}
