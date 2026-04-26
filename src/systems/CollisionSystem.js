import * as THREE from 'three';

export class CollisionSystem {
  constructor() {
    this.boxes = []; // stored as plain {min,max} objects for fast XZ tests
  }

  register(mesh) {
    const b = new THREE.Box3().setFromObject(mesh);
    this.boxes.push({ min: b.min.clone(), max: b.max.clone() });
  }

  // Returns resolved position + whether each axis was blocked.
  // Uses wall-slide: if full move collides, try X-only then Z-only independently.
  resolve(px, pz, nx, nz) {
    const R = 0.52;
    const hit = (x, z) => {
      for (const b of this.boxes) {
        if (x+R > b.min.x && x-R < b.max.x &&
            z+R > b.min.z && z-R < b.max.z) return true;
      }
      return false;
    };

    if (!hit(nx, nz)) return { x: nx, z: nz, hitX: false, hitZ: false };
    const hitX = hit(nx, pz);
    const hitZ = hit(px, nz);
    return { x: hitX ? px : nx, z: hitZ ? pz : nz, hitX, hitZ };
  }
}
