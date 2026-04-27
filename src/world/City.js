import * as THREE from 'three';

// ── Shared PBR materials ───────────────────────────────────────
const ROAD  = new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.94, metalness: 0.0 });
const SIDE  = new THREE.MeshStandardMaterial({ color: 0x585048, roughness: 0.90, metalness: 0.0 });
const LINE  = new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0x886600, roughness: 0.70, metalness: 0.0 });
const GRASS = new THREE.MeshStandardMaterial({ color: 0x338833, roughness: 0.95, metalness: 0.0 });
const WOOD  = new THREE.MeshStandardMaterial({ color: 0x8B6040, roughness: 0.88, metalness: 0.0 });
const POLE  = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.45, metalness: 0.65 });
const BULB  = new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffcc00, roughness: 0.25, metalness: 0.0 });
const WIN   = new THREE.MeshStandardMaterial({ color: 0x88aacc, emissive: 0x223344, transparent: true, opacity: 0.72, roughness: 0.05, metalness: 0.08 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.38, metalness: 0.72 });
const HYDR  = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.52, metalness: 0.20 });
const DARK  = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85, metalness: 0.10 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x99bbdd, transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0.0 });

const BLDG_COLORS = [0xcc4444,0x4466cc,0xcc9933,0x44aa55,0x999999,0x8844bb,0xdd7733,0x44aacc];
const AWNING_COLORS = [0xcc3311,0x2244aa,0x228833,0xddaa11,0x882288];

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export class City {
  constructor(scene, collision = null) {
    this.scene        = scene;
    this.collision    = collision;
    this.streetLights = [];
    this._winDay   = new THREE.Color(0x223344);
    this._winNight = new THREE.Color(0xffcc44);
    this._build();
  }

  update(dayFrac) {
    const night = Math.max(0, 1 - dayFrac * 2.2);
    WIN.emissive.lerpColors(this._winDay, this._winNight, night);
    WIN.emissiveIntensity = 0.15 + night * 1.8;
    this.streetLights.forEach(pl => { pl.intensity = 0.05 + night * 2.8; });
  }

  _build() {
    const streets = [-84, -56, -28, 0, 28, 56, 84];
    const rng = mulberry32(42);

    // Road strips
    streets.forEach(s => {
      const xRoad = box(5.5, 0.06, 188, ROAD); xRoad.position.set(s, 0.03, 0); this.scene.add(xRoad);
      const zRoad = box(188, 0.06, 5.5, ROAD); zRoad.position.set(0, 0.03, s); this.scene.add(zRoad);
    });
    // Dashed centre lines
    streets.forEach(s => {
      for (let p = -88; p < 88; p += 10) {
        const d  = box(0.18, 0.07, 5, LINE); d.position.set(s, 0.05, p);   this.scene.add(d);
        const d2 = box(5, 0.07, 0.18, LINE); d2.position.set(p, 0.05, s);  this.scene.add(d2);
      }
    });
    // Sidewalk blocks
    for (let bx = -3; bx <= 3; bx++) {
      for (let bz = -3; bz <= 3; bz++) {
        const sw = box(21, 0.12, 21, SIDE); sw.position.set(bx*28, 0.04, bz*28); this.scene.add(sw);
      }
    }

    // Buildings
    for (let bx = -3; bx <= 2; bx++) {
      for (let bz = -3; bz <= 2; bz++) {
        const cx = bx * 28 + 14, cz = bz * 28 + 14;
        if (bx === 0 && bz === 0) continue;
        const count = 1 + Math.floor(rng() * 2);
        for (let n = 0; n < count; n++) {
          const w = 5 + rng()*10, d = 5 + rng()*10, h = 4 + rng()*30;
          const ox = (rng()-0.5)*8, oz = (rng()-0.5)*8;
          const color = BLDG_COLORS[Math.floor(rng()*BLDG_COLORS.length)];
          const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 + rng()*0.1, metalness: 0.0 });
          const bldg = box(w, h, d, bMat); bldg.position.set(cx+ox, h/2, cz+oz); bldg.castShadow = true; this.scene.add(bldg);
          if (this.collision) this.collision.register(bldg);
          // Windows
          for (let wy = 1; wy < h - 1; wy += 2.8) {
            for (let side = 0; side < 4; side++) {
              const wm = box(1.1, 1.4, 0.1, WIN);
              if (side===0)      wm.position.set(cx+ox,          h/2-h/2+wy+0.9, cz+oz+d/2+0.11);
              else if (side===1) wm.position.set(cx+ox,          h/2-h/2+wy+0.9, cz+oz-d/2-0.11);
              else if (side===2) { wm.rotation.y=Math.PI/2; wm.position.set(cx+ox+w/2+0.11, h/2-h/2+wy+0.9, cz+oz); }
              else               { wm.rotation.y=Math.PI/2; wm.position.set(cx+ox-w/2-0.11, h/2-h/2+wy+0.9, cz+oz); }
              this.scene.add(wm);
            }
          }
          // Random awning on ground floor
          if (rng() > 0.55) {
            const aMat = new THREE.MeshStandardMaterial({ color: AWNING_COLORS[Math.floor(rng()*AWNING_COLORS.length)], roughness: 0.9 });
            const aw = box(w * 0.7, 0.14, 1.6, aMat);
            aw.position.set(cx+ox, 2.6, cz+oz + d/2 + 0.8);
            aw.rotation.x = -0.2;
            this.scene.add(aw);
          }
        }
      }
    }

    // Central park
    const park = box(21, 0.15, 21, GRASS); park.position.set(14, 0.06, 14); this.scene.add(park);
    // Park path (gravel ring)
    const path = box(18, 0.10, 18, SIDE); path.position.set(14, 0.08, 14); this.scene.add(path);
    const inner = box(12, 0.11, 12, GRASS); inner.position.set(14, 0.09, 14); this.scene.add(inner);
    // Benches
    [[12,12],[12,16],[16,12],[16,16]].forEach(([bx,bz]) => {
      const bench = box(2, 0.2, 0.5, WOOD); bench.position.set(bx, 0.28, bz); this.scene.add(bench);
      const bback = box(2, 0.8, 0.12, WOOD); bback.position.set(bx, 0.65, bz+0.28); this.scene.add(bback);
    });
    // Fountain base
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.5, 12), STEEL);
    fBase.position.set(14, 0.25, 14); this.scene.add(fBase);
    const fWater = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.15, 12),
      new THREE.MeshStandardMaterial({color:0x44aaff, roughness:0.05, metalness:0.0, transparent:true, opacity:0.82}));
    fWater.position.set(14, 0.52, 14); this.scene.add(fWater);
    const fPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8), STEEL);
    fPillar.position.set(14, 1.2, 14); this.scene.add(fPillar);

    // Street lights
    streets.forEach(s => {
      for (let p = -70; p <= 70; p += 28) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.5, 7), POLE);
        pole.position.set(s + 3.2, 2.75, p); this.scene.add(pole);
        const arm  = box(1.2, 0.08, 0.08, POLE); arm.position.set(s+3.8, 5.55, p); this.scene.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 7), BULB);
        bulb.position.set(s + 4.4, 5.5, p); this.scene.add(bulb);
        const pl = new THREE.PointLight(0xffee88, 0.05, 22);
        pl.position.set(s + 4.4, 5.3, p); this.scene.add(pl);
        this.streetLights.push(pl);
      }
    });

    // Fire hydrants (every intersection, offset to sidewalk)
    streets.forEach(s => {
      for (let p = -70; p <= 70; p += 28) {
        const hx = s + 4.5, hz = p + 5;
        const hBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.62, 8), HYDR);
        hBody.position.set(hx, 0.31, hz); hBody.castShadow = true; this.scene.add(hBody);
        const hTop = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.18, 8), HYDR);
        hTop.position.set(hx, 0.71, hz); this.scene.add(hTop);
        const hCap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), STEEL);
        hCap.position.set(hx, 0.84, hz); this.scene.add(hCap);
      }
    });

    // Trash cans (scattered along sidewalks)
    const trng = mulberry32(13);
    streets.forEach(s => {
      for (let p = -60; p <= 60; p += 14) {
        if (trng() > 0.6) continue;
        const tx = s + 5.2, tz = p + trng()*8 - 4;
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.75, 8), DARK);
        can.position.set(tx, 0.37, tz); can.castShadow = true; this.scene.add(can);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8), STEEL);
        lid.position.set(tx, 0.79, tz); this.scene.add(lid);
      }
    });

    // Bus stops (5 locations around city)
    [[-56,28],[56,-28],[0,56],[-28,-56],[28,0]].forEach(([bsx,bsz]) => {
      const ox = bsx + 6;
      [[0],[2.6]].forEach(([pz]) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,3.2,6), STEEL);
        p.position.set(ox, 1.6, bsz+pz); p.castShadow=true; this.scene.add(p);
      });
      const roof = box(0.7, 0.1, 3.0, STEEL); roof.position.set(ox, 3.25, bsz+1.3); this.scene.add(roof);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.07,2.8,2.9), GLASS);
      back.position.set(ox-0.3, 1.8, bsz+1.3); this.scene.add(back);
      // Bench inside stop
      const sb = box(0.4, 0.15, 2.2, WOOD); sb.position.set(ox-0.1, 0.5, bsz+1.3); this.scene.add(sb);
    });

    // Beach boardwalk
    const bw = box(190, 0.35, 9, WOOD); bw.position.set(0, 0.15, 172); this.scene.add(bw);

    // Airfield runway
    const runway = box(22, 0.08, 110, ROAD); runway.position.set(0, 0.05, -188); this.scene.add(runway);
    const rcl = box(0.5, 0.09, 110, LINE); rcl.position.set(0, 0.06, -188); this.scene.add(rcl);
  }
}

function mulberry32(a) {
  return function() { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
