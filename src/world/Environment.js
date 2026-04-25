import * as THREE from 'three';
import { getHeight } from './Terrain.js';

const WATER_MAT = new THREE.MeshLambertMaterial({ color: 0x1a70b8, transparent: true, opacity: 0.78 });
const TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4020 });
const LEAVES_MAT= new THREE.MeshLambertMaterial({ color: 0x286022 });
const PALM_MAT  = new THREE.MeshLambertMaterial({ color: 0x2a8844 });

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this._buildOcean();
    this._buildForest();
    this._buildBeachProps();
  }

  _buildOcean() {
    const geo = new THREE.PlaneGeometry(700, 260);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, WATER_MAT);
    mesh.position.set(0, -1.8, 320);
    this.scene.add(mesh);
  }

  _tree(x, z, scale = 1) {
    const h = getHeight(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18*scale, 0.28*scale, 2.2*scale, 6), TRUNK_MAT);
    trunk.position.set(x, h + 1.1*scale, z);
    trunk.castShadow = true; trunk.receiveShadow = true;
    this.scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.7*scale, 3.8*scale, 7), LEAVES_MAT);
    leaves.position.set(x, h + 4.2*scale, z);
    leaves.castShadow = true; leaves.receiveShadow = true;
    this.scene.add(leaves);
  }

  _palm(x, z) {
    const h = getHeight(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4, 6), TRUNK_MAT);
    trunk.position.set(x, h + 2, z); trunk.rotation.z = (Math.random()-0.5)*0.3;
    trunk.castShadow = true; trunk.receiveShadow = true;
    this.scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), PALM_MAT);
    top.position.set(x + (Math.random()-0.5)*0.6, h + 4.3, z + (Math.random()-0.5)*0.6);
    top.castShadow = true; top.receiveShadow = true;
    this.scene.add(top);
  }

  _buildForest() {
    const rng = mulberry32(99);
    for (let i = 0; i < 340; i++) {
      const x = -130 + (rng()-0.5)*260, z = -220 + rng()*380;
      if (Math.abs(x) < 110 && Math.abs(z) < 110) continue;
      if (z > 155) continue;
      const s = 0.7 + rng() * 0.9;
      this._tree(x, z, s);
    }
    // Scattered single trees around city outskirts
    for (let i = 0; i < 80; i++) {
      const x = (rng()-0.5)*220, z = (rng()-0.5)*140;
      if (Math.abs(x)<100 && Math.abs(z)<100) continue;
      if (z > 150) continue;
      this._tree(x, z, 0.6 + rng()*0.5);
    }
  }

  _buildBeachProps() {
    const rng = mulberry32(77);
    // Palm trees along beach
    for (let i = 0; i < 28; i++) {
      const x = -160 + rng()*320;
      this._palm(x, 158 + rng()*18);
    }
    // Beach umbrellas
    const UMB_MAT = new THREE.MeshLambertMaterial({ color: 0xee4422 });
    for (let i = 0; i < 12; i++) {
      const x = -120 + rng()*240, z = 165 + rng()*15;
      const h = getHeight(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), new THREE.MeshLambertMaterial({color:0xaaaaaa}));
      pole.position.set(x, h+1.25, z); this.scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.5, 8), UMB_MAT);
      top.position.set(x, h+2.8, z); this.scene.add(top);
    }
    // Pier
    const PLANK = new THREE.MeshLambertMaterial({ color: 0xb88040 });
    for (let pz = 175; pz < 230; pz += 2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.6), PLANK);
      plank.position.set(60, -0.2, pz); this.scene.add(plank);
    }
    const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,4,6), PLANK);
    [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([ox,oz])=>{
      const p = pilar.clone(); p.position.set(60+ox, -2, 200+oz); this.scene.add(p);
    });
  }
}

function mulberry32(a) {
  return function() { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
