import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    // Stats
    this.hp       = 100; this.maxHp = 100;
    this.money    = 500;
    this.wanted   = 0;
    this.weapon   = 'fist'; // fist | sword | pistol
    this.ammo     = 0;
    this.activity = 'walk'; // walk | bike | skate | fish | drive | ride | fly
    // Physics
    this.x = 8; this.y = 3; this.z = 8;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing  = 0;
    this.onGround = false;
    this.inVehicle = null;
    // State
    this.dead      = false;
    this.invTimer  = 0;
    this.walkPhase = 0;
    this.shootCd   = 0;
    this.punchCd   = 0;
    this._mesh = this._buildMesh();
    scene.add(this._mesh);
  }

  get mesh() { return this._mesh; }

  _buildMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.95,0.42), new THREE.MeshLambertMaterial({color:0x2244aa}));
    body.position.y = 0.28; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.52,0.52), new THREE.MeshLambertMaterial({color:0xffd0a0}));
    head.position.y = 1.12; g.add(head);
    [-0.18,0.18].forEach((ox,i)=>{
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.72,0.26), new THREE.MeshLambertMaterial({color:0x223366}));
      leg.position.set(ox,-0.38,0); leg.name=`leg${i}`; g.add(leg);
    });
    [-0.46,0.46].forEach((ox,i)=>{
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.72,0.22), new THREE.MeshLambertMaterial({color:0x2244aa}));
      arm.position.set(ox,0.28,0); arm.name=`arm${i}`; g.add(arm);
    });
    g.castShadow = true;
    return g;
  }

  update(dt, input, camYaw) {
    if (this.inVehicle || this.dead) return;
    if (this.shootCd  > 0) this.shootCd  -= dt;
    if (this.punchCd  > 0) this.punchCd  -= dt;
    if (this.invTimer > 0) {
      this.invTimer -= dt;
      this._mesh.visible = (Math.floor(this.invTimer * 9) % 2 === 0);
    } else { this._mesh.visible = true; }

    const speed = this.activity === 'skate' ? 13 : 9;
    const fwd   = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3( Math.cos(camYaw), 0, -Math.sin(camYaw));
    const dir   = new THREE.Vector3();
    let moving  = false;

    if (input.is('w')||input.is('ArrowUp'))    { dir.addScaledVector(fwd,  1); moving=true; }
    if (input.is('s')||input.is('ArrowDown'))  { dir.addScaledVector(fwd, -1); moving=true; }
    if (input.is('a')||input.is('ArrowLeft'))  { dir.addScaledVector(right,-1); moving=true; }
    if (input.is('d')||input.is('ArrowRight')) { dir.addScaledVector(right, 1); moving=true; }

    const friction = this.activity === 'skate' ? 0.92 : 0.65;
    if (moving) {
      dir.normalize();
      this.vx = dir.x * speed;
      this.vz = dir.z * speed;
      this.facing = Math.atan2(dir.x, dir.z);
    } else {
      this.vx *= friction; this.vz *= friction;
    }

    this.vy -= 24 * dt;
    this.x  += this.vx * dt;
    this.z  += this.vz * dt;
    this.y  += this.vy * dt;

    const gh = getHeight(this.x, this.z) + 1.55;
    if (this.y <= gh) { this.y = gh; this.vy = 0; this.onGround = true; }
    else { this.onGround = false; }

    this._mesh.position.set(this.x, this.y - 0.72, this.z);
    this._mesh.rotation.y = this.facing;

    // Walk / skate animation
    if (moving) {
      this.walkPhase += dt * (this.activity === 'skate' ? 2 : 4);
      const s = Math.sin(this.walkPhase);
      const leg0 = this._mesh.getObjectByName('leg0'); if(leg0) leg0.rotation.x =  s * 0.55;
      const leg1 = this._mesh.getObjectByName('leg1'); if(leg1) leg1.rotation.x = -s * 0.55;
      const arm0 = this._mesh.getObjectByName('arm0'); if(arm0) arm0.rotation.x = -s * 0.42;
      const arm1 = this._mesh.getObjectByName('arm1'); if(arm1) arm1.rotation.x =  s * 0.42;
    }
  }

  jump(audio) {
    if (!this.onGround || this.inVehicle) return;
    this.vy = 10; this.onGround = false;
    if (audio) audio.jump();
  }

  takeDamage(amt) {
    if (this.invTimer > 0 || this.dead) return;
    this.hp = Math.max(0, this.hp - amt);
    this.invTimer = 1.4;
    if (this.hp <= 0) this.dead = true;
  }

  heal(amt) { this.hp = Math.min(this.maxHp, this.hp + amt); }

  get position() { return new THREE.Vector3(this.x, this.y, this.z); }
}
