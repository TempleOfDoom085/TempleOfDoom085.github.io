import * as THREE from 'three';
import { getHeight } from './Terrain.js';

const WATER_VERT = `
uniform float uTime;
varying float vElev;
void main(){
  vec4 p=modelMatrix*vec4(position,1.0);
  float e=sin(p.x*0.038+uTime*0.88)*0.46
         +sin(p.z*0.062+uTime*0.64)*0.32
         +sin(p.x*0.10+p.z*0.08+uTime*1.25)*0.18;
  p.y+=e; vElev=e;
  gl_Position=projectionMatrix*viewMatrix*p;
}`;

const WATER_FRAG = `
varying float vElev;
void main(){
  vec3 deep=vec3(0.04,0.17,0.48);
  vec3 mid=vec3(0.14,0.48,0.74);
  vec3 foam=vec3(0.80,0.90,0.98);
  float t=clamp((vElev+0.55)/0.82,0.0,1.0);
  vec3 c=mix(deep,mid,t);
  c=mix(c,foam,smoothstep(0.58,0.80,t)*0.58);
  gl_FragColor=vec4(c,0.88);
}`;

const TRUNK_MAT  = new THREE.MeshStandardMaterial({ color: 0x6b4020, roughness: 0.92, metalness: 0.0 });
const LEAVES_MAT = new THREE.MeshStandardMaterial({ color: 0x286022, roughness: 0.95, metalness: 0.0 });
const PALM_MAT   = new THREE.MeshStandardMaterial({ color: 0x2a8844, roughness: 0.94, metalness: 0.0 });
const ROCK_MAT   = new THREE.MeshStandardMaterial({ color: 0x5a5452, roughness: 0.90, metalness: 0.06 });
const SAND_MAT   = new THREE.MeshStandardMaterial({ color: 0xe8d89a, roughness: 0.98, metalness: 0.0 });
const PLANK_MAT  = new THREE.MeshStandardMaterial({ color: 0xb88040, roughness: 0.88, metalness: 0.0 });

export class Environment {
  constructor(scene) {
    this.scene    = scene;
    this._waterUni = null;
    this._buildOcean();
    this._buildForest();
    this._buildBeachProps();
    this._buildRocks();
  }

  _buildOcean() {
    const geo = new THREE.PlaneGeometry(700, 260, 52, 52);
    geo.rotateX(-Math.PI / 2);
    this._waterUni = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this._waterUni,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -1.8, 320);
    this.scene.add(mesh);
  }

  update(time) {
    if (this._waterUni) this._waterUni.uTime.value = time;
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
      this._tree(x, z, 0.7 + rng()*0.9);
    }
    for (let i = 0; i < 80; i++) {
      const x = (rng()-0.5)*220, z = (rng()-0.5)*140;
      if (Math.abs(x)<100 && Math.abs(z)<100) continue;
      if (z > 150) continue;
      this._tree(x, z, 0.6 + rng()*0.5);
    }
  }

  _buildRocks() {
    const rng = mulberry32(33);
    for (let i = 0; i < 110; i++) {
      const x = -170 + rng()*340, z = -210 + rng()*340;
      if (Math.abs(x) < 115 && Math.abs(z) < 115) continue;
      if (z > 158) continue;
      const h = getHeight(x, z);
      const s = 0.35 + rng()*1.4;
      const geo = rng() > 0.5
        ? new THREE.DodecahedronGeometry(s, 0)
        : new THREE.OctahedronGeometry(s * 1.1, 0);
      const rock = new THREE.Mesh(geo, ROCK_MAT);
      rock.position.set(x, h + s * 0.35, z);
      rock.rotation.set(rng()*Math.PI*2, rng()*Math.PI*2, rng()*Math.PI*2);
      rock.scale.set(1, 0.55 + rng()*0.7, 1);
      rock.castShadow = true; rock.receiveShadow = true;
      this.scene.add(rock);
    }
    // Larger boulders in forest zone
    for (let i = 0; i < 22; i++) {
      const x = -180 + rng()*120, z = -160 + rng()*280;
      if (z > 155) continue;
      const h = getHeight(x, z);
      const s = 1.2 + rng()*2.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), ROCK_MAT);
      rock.position.set(x, h + s*0.4, z);
      rock.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
      rock.scale.set(1, 0.55, 1.1 + rng()*0.4);
      rock.castShadow = true; rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  _buildBeachProps() {
    const rng = mulberry32(77);
    for (let i = 0; i < 28; i++) {
      this._palm(-160 + rng()*320, 158 + rng()*18);
    }
    const UMB = new THREE.MeshStandardMaterial({ color: 0xee4422, roughness: 0.88 });
    for (let i = 0; i < 12; i++) {
      const x = -120 + rng()*240, z = 165 + rng()*15;
      const h = getHeight(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6),
        new THREE.MeshStandardMaterial({color:0xaaaaaa, roughness:0.4, metalness:0.6}));
      pole.position.set(x, h+1.25, z); this.scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.5, 8), UMB);
      top.position.set(x, h+2.8, z); this.scene.add(top);
    }
    // Sand mounds / dunes
    for (let i = 0; i < 18; i++) {
      const x = -140 + rng()*280, z = 162 + rng()*25;
      const h = getHeight(x, z);
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1.5 + rng()*2, 8, 5), SAND_MAT);
      dune.scale.y = 0.22;
      dune.position.set(x, h + 0.1, z);
      dune.receiveShadow = true;
      this.scene.add(dune);
    }
    // Pier
    for (let pz = 175; pz < 230; pz += 2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.6), PLANK_MAT);
      plank.position.set(60, -0.2, pz); this.scene.add(plank);
    }
    const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,4,6), PLANK_MAT);
    [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([ox,oz])=>{
      const p = pilar.clone(); p.position.set(60+ox, -2, 200+oz); this.scene.add(p);
    });
    // Sailboat offshore
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 8),
      new THREE.MeshStandardMaterial({color:0xdddddd, roughness:0.45, metalness:0.05}));
    hull.position.set(-80, -1.2, 240); this.scene.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,8,6),
      new THREE.MeshStandardMaterial({color:0x8B6040, roughness:0.85}));
    mast.position.set(-80, 3.2, 238); this.scene.add(mast);
    const sail = new THREE.Mesh(new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.8, side:THREE.DoubleSide}));
    const sv = new Float32Array([-0.1,0,0,  0,7.5,0,  2.8,0,-3]);
    sail.geometry.setAttribute('position', new THREE.BufferAttribute(sv,3));
    sail.geometry.computeVertexNormals();
    sail.position.set(-80, -0.3, 238); this.scene.add(sail);
  }
}

function mulberry32(a) {
  return function() { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
