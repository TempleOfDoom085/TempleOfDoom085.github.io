import * as THREE from 'three';

function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const h = (a, b) => (Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1;
  return (h(xi,zi)*(1-u)+h(xi+1,zi)*u)*(1-v) + (h(xi,zi+1)*(1-u)+h(xi+1,zi+1)*u)*v;
}
function fbm(x, z, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise2(x*f, z*f); a *= 0.5; f *= 2.1; }
  return v;
}

export function getHeight(x, z) {
  const cx = Math.abs(x), cz = Math.abs(z);
  // Flat city centre
  const cityFade = 1 - THREE.MathUtils.clamp((Math.max(cx, cz) - 62) / 36, 0, 1);
  // Airfield: flat strip north
  const airfade  = THREE.MathUtils.clamp(1 - Math.max(Math.abs(x)/45, Math.abs(z+185)/40), 0, 1);
  // Beach south
  if (z > 168) return Math.max(-4, -(z - 168) * 0.05);
  if (z > 230) return -4;
  const base = fbm(x * 0.016, z * 0.016, 4) * 20 - 3;
  return base * (1 - Math.max(cityFade, airfade));
}

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this._build();
  }

  _build() {
    const N = 240, S = 700;
    const geo = new THREE.PlaneGeometry(S, S, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = getHeight(x, z);
      pos.setY(i, h);
      let r, g, b;
      const sand = z > 155 && h < 3;
      if (sand)                              { r=0.90; g=0.82; b=0.60; }
      else if (Math.abs(x)<68&&Math.abs(z)<68) { r=0.28; g=0.30; b=0.22; } // city ground
      else if (h < 0)                        { r=0.55; g=0.72; b=0.46; }
      else if (h < 4)                        { r=0.28; g=0.52; b=0.20; }
      else if (h < 9)                        { r=0.20; g=0.42; b=0.14; }
      else if (h < 14)                       { r=0.40; g=0.34; b=0.26; }
      else                                   { r=0.74; g=0.70; b=0.62; }
      col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }
}
