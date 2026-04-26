import * as THREE from 'three';
import { getHeight } from '../world/Terrain.js';

// ── mesh builders ──────────────────────────────────────────────

function carMesh(color = 0xff3333) {
  const g = new THREE.Group();
  const add = (geo, mat, px,py,pz, rx=0,ry=0,rz=0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(px,py,pz); m.rotation.set(rx,ry,rz); g.add(m); return m;
  };
  const body  = new THREE.MeshLambertMaterial({color});
  const glass = new THREE.MeshLambertMaterial({color:0xaaccee,transparent:true,opacity:0.55});
  const black = new THREE.MeshLambertMaterial({color:0x111111});
  const hl    = new THREE.MeshLambertMaterial({color:0xffffcc,emissive:0xffff00});
  add(new THREE.BoxGeometry(3.6,0.85,6.5), body,  0,0.75,0);
  add(new THREE.BoxGeometry(2.8,0.75,3.2), glass, 0,1.58,-0.3);
  [[-1.7,-2.2],[-1.7,1.9],[1.7,-2.2],[1.7,1.9]].forEach(([wx,wz])=>{
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.56,0.38,10),black);
    w.rotation.z=Math.PI/2; w.position.set(wx,0.28,wz); g.add(w);
  });
  [[-1.1,3.1],[1.1,3.1]].forEach(([hx,hz])=>add(new THREE.BoxGeometry(0.5,0.28,0.08),hl,hx,0.72,hz));
  return g;
}

function bikeMesh(color = 0x111122) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({color});
  const black= new THREE.MeshLambertMaterial({color:0x111111});
  const red  = new THREE.MeshLambertMaterial({color:0xcc2200});
  const add  = (geo,mat,px,py,pz,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.rotation.set(rx,ry,rz);g.add(m);return m;};
  add(new THREE.BoxGeometry(0.48,0.62,2.2), body, 0,0.65,0);
  add(new THREE.BoxGeometry(0.42,0.32,0.9), red,  0,1.02,-0.15);
  [-1.05,1.05].forEach(wz=>{
    const w=new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,0.22,12),black);
    w.rotation.z=Math.PI/2; w.position.set(0,0.38,wz); g.add(w);
  });
  const bar=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.07,0.07),new THREE.MeshLambertMaterial({color:0x888888}));
  bar.position.set(0,1.12,0.85); g.add(bar);
  return g;
}

function horseMesh() {
  const g = new THREE.Group();
  const h  = new THREE.MeshLambertMaterial({color:0x8B4513});
  const m  = new THREE.MeshLambertMaterial({color:0x3a1f00});
  const add= (geo,mat,px,py,pz,rx=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(px,py,pz);mesh.rotation.x=rx;g.add(mesh);return mesh;};
  add(new THREE.BoxGeometry(1.2,1.0,2.8), h,  0,1.2,0);
  add(new THREE.BoxGeometry(0.5,1.0,0.5), h,  0,1.95,1.0,-0.35);
  add(new THREE.BoxGeometry(0.52,0.58,1.0),h,  0,2.55,1.55);
  [[-0.4,-0.9],[-0.4,0.8],[0.4,-0.9],[0.4,0.8]].forEach(([lx,lz],i)=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.28,1.0,0.28),h);
    leg.position.set(lx,0.5,lz); leg.name=`hl${i}`; g.add(leg);
  });
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.04,0.75,5),m);
  tail.position.set(0,1.3,-1.55); tail.rotation.x=0.5; g.add(tail);
  return g;
}

function planeMesh() {
  const g = new THREE.Group();
  const wh  = new THREE.MeshLambertMaterial({color:0xdddddd});
  const red = new THREE.MeshLambertMaterial({color:0xdd2222});
  const gls = new THREE.MeshLambertMaterial({color:0x88aadd,transparent:true,opacity:0.55});
  const add = (geo,mat,px,py,pz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);g.add(m);return m;};
  add(new THREE.BoxGeometry(1.4,1.0,8), wh, 0,0,0);
  add(new THREE.BoxGeometry(11,0.18,2.8), wh, 0,0,0.4);
  add(new THREE.BoxGeometry(0.18,1.5,1.8), wh, 0,0.9,-3.5);
  add(new THREE.BoxGeometry(4.2,0.14,1.5), wh, 0,0,-3.5);
  const prop=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.12,0.12),red);
  prop.position.set(0,0,4.2); prop.name='prop'; g.add(prop);
  add(new THREE.BoxGeometry(1.0,0.7,1.4), gls, 0,0.55,1.4);
  return g;
}

// ── VehicleSystem ──────────────────────────────────────────────

export class VehicleSystem {
  constructor(scene, collision = null) {
    this.scene     = scene;
    this.collision = collision;
    this.list      = [];
    this.active    = null;
  }

  spawn(type, x, z, color) {
    const h = getHeight(x, z);
    let mesh;
    if      (type==='car')   mesh = carMesh(color);
    else if (type==='bike')  mesh = bikeMesh(color);
    else if (type==='horse') mesh = horseMesh();
    else                     mesh = planeMesh();
    mesh.position.set(x, h + 0.9, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const v = { type, mesh, x, y: h+0.9, z, angle: 0, speed: 0, vy: 0, pitch: 0, bobPhase: 0, occupied: false };
    this.list.push(v);
    return v;
  }

  nearest(px, pz, maxDist = 6) {
    let best = null, bd = maxDist;
    this.list.forEach(v => {
      if (v.occupied) return;
      const d = Math.hypot(px - v.x, pz - v.z);
      if (d < bd) { bd = d; best = v; }
    });
    return best;
  }

  enter(v, player) {
    v.occupied = true; this.active = v; player.inVehicle = v;
    v.angle = player.facing;
    player.mesh.visible = false;
  }

  exit(player) {
    if (!this.active) return;
    const v = this.active;
    v.occupied = false; this.active = null; player.inVehicle = null;
    player.x = v.x + Math.sin(v.angle + 1.5) * 3.5;
    player.z = v.z + Math.cos(v.angle + 1.5) * 3.5;
    player.y = getHeight(player.x, player.z) + 1.6;
    player.vx = player.vz = 0;
    player.mesh.position.set(player.x, player.y - 0.72, player.z);
    player.mesh.visible = true;
  }

  update(dt, time, input, audio) {
    this.list.forEach(v => {
      if (!v.occupied) {
        if (v.type === 'horse') v.mesh.position.y = getHeight(v.x, v.z)+0.9+Math.sin(time*0.8)*0.04;
        if (v.type === 'plane') { const p=v.mesh.getObjectByName('prop'); if(p) p.rotation.z+=dt*2; }
        return;
      }
      const gas   = (input.is('w')||input.is('ArrowUp'))   ?  1 : (input.is('s')||input.is('ArrowDown'))  ? -0.5 : 0;
      const turn  = (input.is('d')||input.is('ArrowRight')) ?  1 : (input.is('a')||input.is('ArrowLeft'))  ? -1  : 0;
      const brake = input.is(' ');

      if (v.type==='car' || v.type==='bike') {
        const maxSpd = v.type==='bike' ? 55 : 38;
        const accel  = v.type==='bike' ? 24 : 16;
        if (!brake) v.speed += gas * accel * dt;
        v.speed *= brake ? 0.86 : 0.965;
        v.speed  = THREE.MathUtils.clamp(v.speed, -9, maxSpd);
        const turnRate = (v.type==='bike' ? 3.0 : 2.2) * Math.sign(v.speed||1);
        if (Math.abs(v.speed) > 0.4) v.angle += turn * turnRate * dt;
        const oldX = v.x, oldZ = v.z;
        v.x += Math.sin(v.angle) * v.speed * dt;
        v.z += Math.cos(v.angle) * v.speed * dt;
        if (this.collision) {
          const r = this.collision.resolve(oldX, oldZ, v.x, v.z);
          if (r.hitX || r.hitZ) v.speed *= 0.25; // crunch on impact
          v.x = r.x; v.z = r.z;
        }
        v.y  = getHeight(v.x, v.z) + (v.type==='bike' ? 0.55 : 0.9);
        v.mesh.position.set(v.x, v.y, v.z);
        v.mesh.rotation.y = v.angle;
        if (v.type==='bike') v.mesh.rotation.z = -turn * 0.2 * THREE.MathUtils.clamp(Math.abs(v.speed)/30,0,1);
        if (audio) audio.engine(Math.abs(v.speed));
      }

      if (v.type==='horse') {
        v.speed += gas * 12 * dt; v.speed *= 0.91;
        v.speed  = THREE.MathUtils.clamp(v.speed, -7, 22);
        if (Math.abs(v.speed) > 0.3) v.angle += turn * 2.4 * dt * Math.sign(v.speed);
        v.x += Math.sin(v.angle) * v.speed * dt;
        v.z += Math.cos(v.angle) * v.speed * dt;
        if (brake && v.vy === 0) v.vy = 8;
        v.vy -= 22 * dt;
        v.y  += v.vy * dt;
        const gh = getHeight(v.x, v.z) + 1.0;
        if (v.y <= gh) { v.y = gh; v.vy = 0; }
        v.bobPhase += dt * Math.abs(v.speed) * 0.45;
        v.mesh.position.set(v.x, v.y + Math.abs(Math.sin(v.bobPhase))*0.18*Math.min(1,Math.abs(v.speed)/5), v.z);
        v.mesh.rotation.y = v.angle;
        for (let i=0;i<4;i++){const leg=v.mesh.getObjectByName(`hl${i}`);if(leg)leg.rotation.x=Math.sin(v.bobPhase+i*Math.PI/2)*0.45;}
      }

      if (v.type==='plane') {
        v.speed += gas * 32 * dt; v.speed *= 0.986;
        v.speed  = THREE.MathUtils.clamp(v.speed, 0, 88);
        v.angle += turn * 0.85 * dt;
        const flying = v.y > getHeight(v.x,v.z)+1.5 || v.speed > 26;
        if (flying) { v.pitch += gas * 0.5 * dt; v.pitch = THREE.MathUtils.clamp(v.pitch*0.97,-0.48,0.55); }
        v.x  += Math.sin(v.angle)*Math.cos(v.pitch)*v.speed*dt;
        v.z  += Math.cos(v.angle)*Math.cos(v.pitch)*v.speed*dt;
        v.y  += (Math.sin(v.pitch)*v.speed - (flying?1.8:5))*dt;
        const gh = getHeight(v.x,v.z)+0.7;
        if (v.y < gh) { v.y=gh; if(!flying) v.speed*=0.75; }
        v.mesh.position.set(v.x,v.y,v.z);
        v.mesh.rotation.y = v.angle;
        v.mesh.rotation.x = -v.pitch;
        v.mesh.rotation.z = -turn*0.18*Math.min(1,v.speed/50);
        const prop=v.mesh.getObjectByName('prop'); if(prop) prop.rotation.z+=dt*(3+v.speed*0.06);
        if (audio) audio.engine(v.speed);
      }
    });
  }
}
