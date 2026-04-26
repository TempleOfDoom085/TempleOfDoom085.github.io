import * as THREE from 'three';

const BLDG_COLORS = [0xcc4444,0x4466cc,0xcc9933,0x44aa55,0x999999,0x8844bb,0xdd7733,0x44aacc];
const ROAD  = new THREE.MeshLambertMaterial({ color: 0x2a2c35 });
const SIDE  = new THREE.MeshLambertMaterial({ color: 0x666055 });
const LINE  = new THREE.MeshLambertMaterial({ color: 0xffee88, emissive: 0x886600 });
const GRASS = new THREE.MeshLambertMaterial({ color: 0x338833 });
const WOOD  = new THREE.MeshLambertMaterial({ color: 0x8B6040 });
const POLE  = new THREE.MeshLambertMaterial({ color: 0x777777 });
const BULB  = new THREE.MeshLambertMaterial({ color: 0xffee88, emissive: 0xffcc00 });
const WIN   = new THREE.MeshLambertMaterial({ color: 0x88aacc, emissive: 0x223344, transparent: true, opacity: 0.7 });

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return m;
}

export class City {
  constructor(scene, collision = null) {
    this.scene     = scene;
    this.collision = collision;
    this._build();
  }

  _build() {
    const streets = [-84, -56, -28, 0, 28, 56, 84];
    // Road strips
    streets.forEach(s => {
      const xRoad = box(5.5, 0.06, 188, ROAD); xRoad.position.set(s, 0.03, 0); this.scene.add(xRoad);
      const zRoad = box(188, 0.06, 5.5, ROAD); zRoad.position.set(0, 0.03, s); this.scene.add(zRoad);
    });
    // Dashed centre lines
    streets.forEach(s => {
      for (let p = -88; p < 88; p += 10) {
        const d = box(0.18, 0.07, 5, LINE); d.position.set(s, 0.05, p); this.scene.add(d);
        const d2 = box(5, 0.07, 0.18, LINE); d2.position.set(p, 0.05, s); this.scene.add(d2);
      }
    });
    // Sidewalk blocks per city block
    for (let bx = -3; bx <= 3; bx++) {
      for (let bz = -3; bz <= 3; bz++) {
        const cx = bx * 28, cz = bz * 28;
        const sw = box(21, 0.12, 21, SIDE); sw.position.set(cx, 0.04, cz); this.scene.add(sw);
      }
    }
    // Buildings
    const rng = mulberry32(42);
    for (let bx = -3; bx <= 2; bx++) {
      for (let bz = -3; bz <= 2; bz++) {
        const cx = bx * 28 + 14, cz = bz * 28 + 14;
        // Skip park block
        if (bx === 0 && bz === 0) continue;
        const count = 1 + Math.floor(rng() * 2);
        for (let n = 0; n < count; n++) {
          const w = 5 + rng() * 10, d = 5 + rng() * 10, h = 4 + rng() * 30;
          const ox = (rng() - 0.5) * 8, oz = (rng() - 0.5) * 8;
          const color = BLDG_COLORS[Math.floor(rng() * BLDG_COLORS.length)];
          const bMat = new THREE.MeshLambertMaterial({ color });
          const bldg = box(w, h, d, bMat); bldg.position.set(cx+ox, h/2, cz+oz); bldg.castShadow = true; this.scene.add(bldg);
          if (this.collision) this.collision.register(bldg);
          // Windows
          for (let wy = 1; wy < h - 1; wy += 2.8) {
            for (let side = 0; side < 4; side++) {
              const wm = box(1.1, 1.4, 0.1, WIN);
              if (side===0) wm.position.set(cx+ox, h/2-h/2+wy+0.9, cz+oz+d/2+0.11);
              else if (side===1) wm.position.set(cx+ox, h/2-h/2+wy+0.9, cz+oz-d/2-0.11);
              else if (side===2) { wm.rotation.y=Math.PI/2; wm.position.set(cx+ox+w/2+0.11, h/2-h/2+wy+0.9, cz+oz); }
              else { wm.rotation.y=Math.PI/2; wm.position.set(cx+ox-w/2-0.11, h/2-h/2+wy+0.9, cz+oz); }
              this.scene.add(wm);
            }
          }
        }
      }
    }
    // Central park
    const park = box(21, 0.15, 21, GRASS); park.position.set(14, 0.06, 14); this.scene.add(park);
    // Bench in park
    const bench = box(2, 0.2, 0.5, WOOD); bench.position.set(12, 0.28, 12); this.scene.add(bench);
    const bback = box(2, 0.8, 0.12, WOOD); bback.position.set(12, 0.65, 12.28); this.scene.add(bback);
    // Street lights
    streets.forEach(s => {
      for (let p = -70; p <= 70; p += 28) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.5, 7), POLE);
        pole.position.set(s + 3.2, 2.75, p); this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 7), BULB);
        bulb.position.set(s + 3.2, 5.7, p); this.scene.add(bulb);
        const pl = new THREE.PointLight(0xffee88, 0.9, 22);
        pl.position.set(s + 3.2, 5.4, p); this.scene.add(pl);
      }
    });
    // Beach boardwalk
    const bw = box(190, 0.35, 9, WOOD); bw.position.set(0, 0.15, 172); this.scene.add(bw);
    // Airfield runway north
    const runway = box(22, 0.08, 110, ROAD); runway.position.set(0, 0.05, -188); this.scene.add(runway);
    const rcl = box(0.5, 0.09, 110, LINE); rcl.position.set(0, 0.06, -188); this.scene.add(rcl);
  }
}

function mulberry32(a) {
  return function() { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
