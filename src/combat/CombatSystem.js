import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

function banditMesh(scene, x, z) {
  const g   = new THREE.Group();
  const bdy = new THREE.MeshLambertMaterial({color:0x442222});
  const hat = new THREE.MeshLambertMaterial({color:0xcc3300});
  const add = (geo,mat,px,py,pz,name)=>{ const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);if(name)m.name=name;g.add(m); };
  add(new THREE.BoxGeometry(0.50,0.85,0.35),bdy, 0,0.22,0);
  add(new THREE.BoxGeometry(0.44,0.44,0.44),bdy, 0,0.92,0);
  add(new THREE.CylinderGeometry(0.28,0.32,0.35,8),hat,0,1.22,0);
  add(new THREE.BoxGeometry(0.22,0.65,0.22),bdy,-0.13,-0.33,0,'bl0');
  add(new THREE.BoxGeometry(0.22,0.65,0.22),bdy, 0.13,-0.33,0,'bl1');
  const h = getHeight(x, z);
  g.position.set(x, h+0.9, z);
  g.castShadow = true;
  scene.add(g);
  return g;
}

export class CombatSystem {
  constructor(scene, player, particles) {
    this.scene    = scene;
    this.player   = player;
    this.particles= particles;
    this.enemies  = [];
    this.bullets  = [];
    this._spawnBandits();
  }

  _spawnBandits() {
    const spots = [[-145,-40],[-160,20],[-130,-80],[-155,60],[-140,10],[-170,-50],[-125,80],[-150,-100]];
    spots.forEach(([x,z])=>{
      const mesh = banditMesh(this.scene, x, z);
      this.enemies.push({ mesh, x, z, hp:3, maxHp:3, speed:3.5, alive:true, aggro:false, walkPhase:Math.random()*Math.PI*2 });
    });
  }

  punch(camera) {
    const dir  = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const orig = new THREE.Vector3(this.player.x, this.player.y, this.player.z);
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const d = Math.hypot(this.player.x-e.x, this.player.z-e.z);
      if (d < 3.5) this._hit(e, this.player.weapon==='sword' ? 2 : 1);
    });
  }

  shoot(camera) {
    if (this.player.weapon!=='pistol' || this.player.ammo<=0) return false;
    this.player.ammo--;
    const dir   = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const start = camera.position.clone().add(dir.clone().multiplyScalar(1.5));
    const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1,4,4),new THREE.MeshLambertMaterial({color:0xffff44,emissive:0xff8800}));
    bMesh.position.copy(start);
    this.scene.add(bMesh);
    const spd = 90;
    this.bullets.push({mesh:bMesh, x:start.x,y:start.y,z:start.z, vx:dir.x*spd,vy:dir.y*spd,vz:dir.z*spd, life:3});
    return true;
  }

  _hit(e, dmg) {
    e.hp -= dmg;
    this.particles.burst(e.mesh.position.clone(), 0xff4422, 10, 6);
    if (e.hp <= 0) this._kill(e);
  }

  _kill(e) {
    e.alive = false;
    this.scene.remove(e.mesh);
    this.particles.burst(e.mesh.position.clone(), 0xff2200, 20, 10);
    this.player.money += 55;
    this.player.addXP(25);
    return true;
  }

  update(dt, questSystem) {
    const pp = this.player;
    // Update enemies
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const dx = pp.x-e.x, dz = pp.z-e.z, dist=Math.hypot(dx,dz);
      if (dist < 35) e.aggro=true;
      if (!e.aggro) return;
      if (dist > 1.9) { e.x+=(dx/dist)*e.speed*dt; e.z+=(dz/dist)*e.speed*dt; }
      const h = getHeight(e.x,e.z);
      e.mesh.position.set(e.x,h+0.9,e.z); e.mesh.rotation.y=Math.atan2(dx,dz);
      e.walkPhase+=dt*e.speed*2;
      const l0=e.mesh.getObjectByName('bl0'),l1=e.mesh.getObjectByName('bl1');
      if(l0)l0.rotation.x=Math.sin(e.walkPhase)*0.5;
      if(l1)l1.rotation.x=-Math.sin(e.walkPhase)*0.5;
      if (dist < 2.2) pp.takeDamage(12);
    });
    // Update bullets
    for (let i=this.bullets.length-1;i>=0;i--) {
      const b=this.bullets[i];
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt;
      b.mesh.position.set(b.x,b.y,b.z);
      b.life-=dt;
      let hit = b.life<=0 || b.y < getHeight(b.x,b.z);
      this.enemies.forEach(e=>{
        if(!e.alive) return;
        if(Math.hypot(b.x-e.x,b.z-e.z)<1.1){ this._hit(e,1); hit=true; }
      });
      if (hit) { this.scene.remove(b.mesh); this.bullets.splice(i,1); }
    }
    // Report kills to quest system
    const prevAlive = this.enemies.filter(e=>!e.alive).length;
    this.enemies.forEach(e=>{ if(!e.alive && !e._reported){ e._reported=true; if(questSystem) questSystem.onKill(); } });
  }

  get aliveCount() { return this.enemies.filter(e=>e.alive).length; }
}
