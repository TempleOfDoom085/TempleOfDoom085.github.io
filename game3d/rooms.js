/* Knights Templar 3D — room sets.
   Each builder returns a THREE.Group plus a description the engine uses for
   camera framing, lighting, fog, colour grade and particles. Rooms are laid
   out with the camera near z≈+4 looking down -z. */
(function () {
  'use strict';
  const G3D = window.G3D, P = G3D.props;
  const { mesh } = G3D;

  function place(parent, obj, x, y, z, ry, s) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    if (s) obj.scale.setScalar(s);
    parent.add(obj);
    return obj;
  }

  // A torch on a wall. side: 'L' | 'R' | 'B' (back)
  function wallTorch(g, side, x, y, z, s) {
    const outer = new THREE.Group();
    const t = P.torch(s); t.rotation.x = 0.28; outer.add(t);
    outer.rotation.y = side === 'L' ? Math.PI / 2 : side === 'R' ? -Math.PI / 2 : 0;
    outer.position.set(x, y, z);
    g.add(outer);
    return outer;
  }

  // Pointed-vault ceiling surface swept along z (inside faces lit).
  function vaultGeo(span, rise, len) {
    const half = span / 2, c = (rise * rise - half * half) / (2 * half), R = half + c;
    const apex = Math.atan2(Math.sqrt(Math.max(0, R * R - c * c)), -c);
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) { const a = Math.PI + (apex - Math.PI) * i / N; pts.push([c + Math.cos(a) * R, Math.sin(a) * R]); }
    for (let i = N - 1; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]);
    const segZ = Math.max(2, Math.round(len / 2));
    const pos = [], uv = [], idx = [];
    let acc = 0; const along = [0];
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); along.push(acc); }
    for (let j = 0; j <= segZ; j++) {
      const z = -len * j / segZ;
      for (let i = 0; i < pts.length; i++) { pos.push(pts[i][0], pts[i][1], z); uv.push(along[i] / 3, -z / 3); }
    }
    const W = pts.length;
    for (let j = 0; j < segZ; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c2 = a + W, d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  // Interior shell: floor, walls, vault/beams, pillars and ribs.
  function shell(o) {
    const g = new THREE.Group();
    const w = o.w, d = o.d, h = o.h, zF = o.zFront == null ? 6 : o.zFront, zB = zF - d;
    const tint = o.tint || '';
    const floor = mesh(new THREE.PlaneGeometry(w, d), G3D.floorMat(o.floorTint || tint, [w / 3.5, d / 3.5]), false, true);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, zF - d / 2); g.add(floor);
    const wallMat = (len) => G3D.stoneMat(tint, [len / 3, h / 3], 'w' + len + 'h' + h);
    if (!o.noBack) { const b = mesh(new THREE.PlaneGeometry(w, h), wallMat(w), false, true); b.position.set(0, h / 2, zB); g.add(b); }
    if (!o.openLeft) { const l = mesh(new THREE.PlaneGeometry(d, h), wallMat(d), false, true); l.rotation.y = Math.PI / 2; l.position.set(-w / 2, h / 2, zF - d / 2); g.add(l); }
    if (!o.openRight) { const r = mesh(new THREE.PlaneGeometry(d, h), wallMat(d), false, true); r.rotation.y = -Math.PI / 2; r.position.set(w / 2, h / 2, zF - d / 2); g.add(r); }
    // Plinth along the walls
    const plinthMat = G3D.stoneMat(tint, [d / 2, 0.2], 'pl' + d);
    if (!o.openLeft) { const p = mesh(new THREE.BoxGeometry(0.25, 0.4, d), plinthMat); p.position.set(-w / 2 + 0.12, 0.2, zF - d / 2); g.add(p); }
    if (!o.openRight) { const p = mesh(new THREE.BoxGeometry(0.25, 0.4, d), plinthMat); p.position.set(w / 2 - 0.12, 0.2, zF - d / 2); g.add(p); }
    // Ceiling
    const vm = G3D.stoneMat(tint, [1, 1], 'vault' + tint);
    if (o.vault === 'pointed' || o.vault === 'barrel') {
      const rise = o.rise || w * 0.45;
      const geo = vaultGeo(w, o.vault === 'barrel' ? w / 2 : rise, d);
      const vMat = G3D.mat('vaultmat' + tint, () => { const m = vm.clone(); m.side = THREE.DoubleSide; return m; });
      const v = mesh(geo, vMat, false, true); v.position.set(0, h, zF); g.add(v);
      if (!o.noBack) {
        // Tympanum: close the arch-shaped gap between the back wall and the vault.
        const half = w / 2, r2 = o.vault === 'barrel' ? w / 2 : rise, c = (r2 * r2 - half * half) / (2 * half), Rr = half + c;
        const apex = Math.atan2(Math.sqrt(Math.max(0, Rr * Rr - c * c)), -c), sh = new THREE.Shape();
        sh.moveTo(-half, 0);
        for (let i = 1; i <= 16; i++) { const a2 = Math.PI + (apex - Math.PI) * i / 16; sh.lineTo(c + Math.cos(a2) * Rr, Math.sin(a2) * Rr); }
        for (let i = 15; i >= 0; i--) { const a2 = Math.PI + (apex - Math.PI) * i / 16; sh.lineTo(-(c + Math.cos(a2) * Rr), Math.sin(a2) * Rr); }
        sh.closePath();
        const tg = new THREE.ShapeGeometry(sh, 16), tu = tg.attributes.uv;
        for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) / 3, tu.getY(i) / 3);
        const ty = mesh(tg, G3D.stoneMat(tint, [1, 1], 'tymp' + tint), false, true); ty.position.set(0, h, zB + 0.01); g.add(ty);
      }
      // Transverse ribs
      const rs = o.ribSpacing || 4;
      for (let z = zF - 1; z > zB; z -= rs) {
        const rib = P.gothicArch(w - 0.1, o.vault === 'barrel' ? w / 2 - 0.05 : rise - 0.05, 0.28, vm);
        rib.position.set(0, h - 0.02, z); g.add(rib);
      }
    } else if (o.vault === 'beams') {
      const c = mesh(new THREE.PlaneGeometry(w, d), G3D.woodMat(true, [w / 2, d / 2]), false, true); c.rotation.x = Math.PI / 2; c.position.set(0, h, zF - d / 2); g.add(c);
      for (let z = zF - 1; z > zB; z -= 2.2) { const b = mesh(new THREE.BoxGeometry(w, 0.35, 0.3), G3D.woodMat(true)); b.position.set(0, h - 0.18, z); g.add(b); }
    } else if (o.vault === 'flat') {
      const c = mesh(new THREE.PlaneGeometry(w, d), vm, false, true); c.rotation.x = Math.PI / 2; c.position.set(0, h, zF - d / 2); g.add(c);
    }
    // Pillars down both sides
    const pillarZ = [];
    if (o.pillars) {
      const sp = o.pillars.spacing || 4, r = o.pillars.r || 0.32, inset = o.pillars.inset || 0.7;
      for (let z = zF - 1; z > zB + 1; z -= sp) {
        pillarZ.push(z);
        [-1, 1].forEach(s => {
          if ((s < 0 && o.pillars.skipLeft) || (s > 0 && o.pillars.skipRight)) return;
          const p = P.pillar(h, r, tint); p.position.set(s * (w / 2 - inset), 0, z); g.add(p);
        });
      }
    }
    return { g, w, d, h, zF, zB, pillarZ };
  }

  // Sky dome: gradient, stars, moon glow (and optional storm clouds).
  function sky(g, o) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        time: G3D.uniforms.time, top: { value: new THREE.Color(o.top || '#05070f') }, horizon: { value: new THREE.Color(o.horizon || '#1a2234') },
        moonDir: { value: new THREE.Vector3(...(o.moon || [-0.4, 0.45, -0.8])).normalize() }, flash: G3D.uniforms.lightning || (G3D.uniforms.lightning = { value: 0 }),
        clouds: { value: o.clouds ? 1 : 0 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, horizon, moonDir; uniform float time, flash, clouds; varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          float a=h(vec3(i,0)), b=h(vec3(i+vec2(1,0),0)), c=h(vec3(i+vec2(0,1),0)), d=h(vec3(i+vec2(1,1),0));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
        void main(){
          float y = max(vDir.y, 0.0);
          vec3 col = mix(horizon, top, pow(y, 0.55));
          // Stars
          vec3 sp = floor(vDir * 380.0); float s = h(sp);
          float tw = 0.6 + 0.4 * sin(time * 2.0 + s * 50.0);
          col += vec3(0.9, 0.95, 1.0) * step(0.9975, s) * tw * smoothstep(0.05, 0.4, y) * 1.4;
          // Moon + halo
          float md = dot(normalize(vDir), moonDir);
          col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, md) * 6.0;
          col += vec3(0.5, 0.6, 0.8) * pow(max(md, 0.0), 60.0) * 0.6 + vec3(0.25, 0.3, 0.45) * pow(max(md, 0.0), 8.0) * 0.25;
          // Drifting clouds
          if (clouds > 0.5) {
            vec2 cp = vDir.xz / (vDir.y + 0.15) * 1.6 + vec2(time * 0.02, 0.0);
            float c = n(cp) * 0.55 + n(cp * 2.3) * 0.3 + n(cp * 5.1) * 0.15;
            c = smoothstep(0.45, 0.85, c) * smoothstep(0.0, 0.25, y);
            vec3 cc = mix(vec3(0.03, 0.035, 0.05), vec3(0.18, 0.2, 0.28), pow(max(md, 0.0), 6.0));
            col = mix(col, cc + flash * vec3(0.6, 0.65, 0.8), c * 0.9);
          }
          col += flash * vec3(0.25, 0.28, 0.4) * (1.0 - y * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), m);
    s.renderOrder = -10;
    g.add(s);
    return s;
  }

  // Distant hills silhouette ring for outdoor rooms.
  function hills(g, color) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#06080c'), fog: true });
    const R = G3D.rng(12), pts = [];
    for (let i = 0; i <= 64; i++) pts.push(new THREE.Vector2(i / 64, 0.2 + G3D.fbm(i / 8, 0, 8, 4, 3) * 0.8 + R() * 0.05));
    const geo = new THREE.CylinderGeometry(90, 90, 14, 64, 1, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 64); p.setY(i, -7 + pts[k].y * 18); }
    const h = new THREE.Mesh(geo, m); h.material.side = THREE.BackSide; h.position.y = 2; g.add(h);
  }

  const R = {};
  G3D.rooms = R;

  // Shared defaults
  const base = {
    cam: { pos: [0.35, 1.65, 4.7], look: [-0.15, 2.1, -4], fovH: 84 },
    knight: { pos: [-1.35, 0, -0.1], rot: 0.6 },
    npc: { pos: [2.4, 0, -1.4], rot: -0.5 },
    relic: [-2.6, 0, -2.2], scroll: [2.2, 0, -0.4],
    grade: { exposure: 1.0, tint: [1, 1, 1], sat: 1.0, contrast: 1.05 },
  };
  function spec(o) {
    const r = Object.assign({}, base, o, { grade: Object.assign({}, base.grade, o.grade || {}) });
    // The foe stands ahead and to the right of the knight unless a room says otherwise.
    if (!o.enemy) { const k = r.knight.pos; r.enemy = { pos: [k[0] + 2.5, 0, k[2] - 1.0], rot: -2.2 }; }
    return r;
  }

  // ── 1. Templar Chapel ──────────────────────────────────────────────────────
  R.chapel = () => {
    const s = shell({ w: 12, d: 22, h: 6.5, tint: 'warm', vault: 'pointed', rise: 5, pillars: { spacing: 4, r: 0.36, inset: 0.9 } });
    const g = s.g;
    const dais = mesh(new THREE.BoxGeometry(8, 0.3, 4), G3D.stoneMat('warm', [2, 1], 'dais')); dais.position.set(0, 0.15, s.zB + 2.2); g.add(dais);
    place(g, P.altar(), 0, 0.3, s.zB + 2.4);
    const rose = P.stainedWindow('rose', 4.6); rose.position.set(0, 8.3, s.zB + 0.06); g.add(rose);
    // Lancets either side of the altar
    [-3.6, 3.6].forEach(x => { const l = P.stainedWindow('lancet', 3.6, '#ffd8b0'); l.position.set(x, 5.2, s.zB + 0.06); g.add(l); });
    // God-ray from the rose window down across the nave
    const shaft = P.lightShaft(1.8, 4.2, 16, '#ffb070', 0.32); shaft.position.set(0, 8.3, s.zB + 0.4);
    shaft.lookAt(0, 0, -2); shaft.rotateX(-Math.PI / 2); g.add(shaft);
    const sh2 = P.lightShaft(0.5, 1.8, 11, '#c8a0ff', 0.18); sh2.position.set(-3.6, 5.6, s.zB + 0.4); sh2.lookAt(-2.4, 0, -3); sh2.rotateX(-Math.PI / 2); g.add(sh2);
    // Broken pews
    for (let z = -6; z > s.zB + 5; z -= 1.6) { place(g, P.pew(z < -9, Math.floor(-z * 7)), -2.6, 0, z); place(g, P.pew(z > -8, Math.floor(-z * 5)), 2.6, 0, z); }
    s.pillarZ.forEach((z, i) => {
      if (i % 2 === 0) { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.7, z - 2); wallTorch(g, 'R', s.w / 2 - 0.25, 2.7, z - 2); }
      const b = P.banner(1.0, 2.6, i % 2 ? 'white' : 'red'); b.position.set(-s.w / 2 + 1.25, 4.6, z); b.rotation.y = Math.PI / 2; g.add(b);
      const b2 = P.banner(1.0, 2.6, i % 2 ? 'red' : 'white'); b2.position.set(s.w / 2 - 1.25, 4.6, z); b2.rotation.y = -Math.PI / 2; g.add(b2);
    });
    place(g, P.candles(9, 0.5, 31), -2.4, 0.3, s.zB + 3.4);
    place(g, P.candles(7, 0.4, 32), 2.6, 0.3, s.zB + 3.0);
    place(g, P.bonePile(10, 0.5, 4), 3.2, 0, -1.5);
    return spec({
      group: g, fog: ['#120c08', 0.045], bg: '#0b0806',
      hemi: ['#4a3a30', '#120c08', 0.35],
      key: { type: 'spot', pos: [0, 8.2, s.zB + 0.8], target: [-0.6, 0, -1], color: '#ffc890', intensity: 3.2, angle: 0.55, penumbra: 0.7, distance: 34 },
      grade: { exposure: 1.1, tint: [1.06, 0.98, 0.9], sat: 1.05 },
      particles: [{ type: 'dust', count: 260, box: [-4, 4, 0.2, 7, s.zB + 1, 4], color: '#ffd6a0' }],
      relic: [-3.0, 0, -3.0], scroll: [2.3, 0, -1.2],
    });
  };

  // ── 2. Cloister (moonlit arcade) ───────────────────────────────────────────
  R.cloister = () => {
    const s = shell({ w: 7, d: 24, h: 5, tint: 'cold', vault: 'pointed', rise: 3, openLeft: true, pillars: { spacing: 3.2, r: 0.28, inset: 0.35, skipRight: true } });
    const g = s.g;
    // Arcade arches between the left pillars, opening onto the garth
    for (let z = s.zF - 1; z > s.zB + 1; z -= 3.2) {
      const a = P.gothicArch(2.9, 1.9, 0.5, G3D.stoneMat('cold', [1, 1], 'arc'));
      a.rotation.y = Math.PI / 2; a.position.set(-3.15, 3.0, z - 1.6); g.add(a);
      const spandrel = mesh(new THREE.BoxGeometry(0.5, 2.1, 3.2), G3D.stoneMat('cold', [1, 1], 'span')); spandrel.position.set(-3.15, 4.05 + 0.9, z - 1.6); g.add(spandrel);
    }
    const sill = mesh(new THREE.BoxGeometry(0.6, 0.7, s.d), G3D.stoneMat('cold', [s.d / 3, 0.3], 'sill')); sill.position.set(-3.2, 0.35, s.zF - s.d / 2); g.add(sill);
    // Garth (garden) beyond the arcade
    const grass = mesh(new THREE.PlaneGeometry(14, 30), G3D.flatMat('grass', '#141a10', 1), false, true); grass.rotation.x = -Math.PI / 2; grass.position.set(-10.5, -0.05, -6); g.add(grass);
    place(g, P.deadTree(4), -9, 0, -6);
    place(g, P.well(), -8.5, 0, 1.5);
    const far = P.battlements(30, 7, 'cold'); far.rotation.y = Math.PI / 2; far.position.set(-17, 0, -6); g.add(far);
    sky(g, { moon: [-0.65, 0.5, -0.4], horizon: '#141c30' });
    s.pillarZ.forEach((z, i) => { if (i % 2) wallTorch(g, 'R', s.w / 2 - 0.25, 2.5, z); });
    for (let i = 0; i < 3; i++) { const b = P.banner(0.9, 2.2, 'white'); b.position.set(s.w / 2 - 0.15, 3.8, -2 - i * 6); b.rotation.y = -Math.PI / 2; g.add(b); }
    return spec({
      group: g, fog: ['#0c1220', 0.04], bg: '#070a12',
      vol: { key: 1.0 },   // Ultra: moonlight shafts between the arches
      hemi: ['#40506e', '#0a0c10', 0.4],
      key: { type: 'dir', dir: [-0.75, 0.55, -0.35], color: '#a8c0ff', intensity: 1.5, area: 14, center: [0, 0, -4] },
      grade: { exposure: 1.15, tint: [0.9, 0.98, 1.12], sat: 0.85 },
      particles: [{ type: 'fog', count: 26, box: [-12, 3, 0, 1.2, s.zB, 4], color: '#7a90c0', opacity: 0.07 }, { type: 'dust', count: 120, box: [-3, 3, 0.3, 4.5, s.zB, 4], color: '#c0d0ff' }],
      knight: { pos: [-0.9, 0, 0.1], rot: 0.45 },
      cam: { pos: [1.6, 1.7, 4.4], look: [-1.2, 1.7, -4], fovH: 76 },
      relic: [1.8, 0, -3], scroll: [1.9, 0, -1],
    });
  };

  // ── 3. Armory ──────────────────────────────────────────────────────────────
  R.armory = () => {
    const s = shell({ w: 10, d: 16, h: 5, tint: '', vault: 'barrel', pillars: { spacing: 4.5, r: 0.3, inset: 0.6 } });
    const g = s.g;
    place(g, P.weaponRack(1), -4.4, 0, -3, Math.PI / 2);
    place(g, P.weaponRack(2), -4.4, 0, -7.5, Math.PI / 2);
    place(g, P.weaponRack(3), 4.4, 0, -5, -Math.PI / 2);
    place(g, P.weaponRack(4), 0, 0, s.zB + 0.4);
    place(g, P.armorStand(), -2.2, 0, s.zB + 1.2, 0.3);
    place(g, P.armorStand(), 2.2, 0, s.zB + 1.2, -0.3);
    // Shields hung along the back wall
    for (let i = 0; i < 5; i++) { const sh = P.shieldMesh(i % 2 ? 'knight' : 'gold'); sh.position.set(-3 + i * 1.5, 3.4, s.zB + 0.06); sh.scale.setScalar(1.3); g.add(sh); }
    place(g, P.barrel(), 3.6, 0, -1); place(g, P.barrel(), 4.1, 0, -1.9); place(g, P.crate(), 3.8, 0.35, 0.3, 0.3);
    s.pillarZ.forEach(z => { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.6, z - 2.2); wallTorch(g, 'R', s.w / 2 - 0.25, 2.6, z - 2.2); });
    place(g, P.brazier('#ff7a20', 0.9), 1.2, 0, -6.5);
    return spec({
      group: g, fog: ['#100c0a', 0.05], bg: '#0a0806',
      hemi: ['#3a3028', '#0e0a08', 0.3],
      key: { type: 'spot', pos: [2.5, 4.6, 1.5], target: [-1, 0, -3], color: '#ffb070', intensity: 1.6, angle: 0.8, penumbra: 0.9, distance: 18 },
      grade: { exposure: 1.1, tint: [1.05, 0.98, 0.9] },
      particles: [{ type: 'dust', count: 160, box: [-4, 4, 0.2, 4.5, s.zB, 4], color: '#ffcf9a' }, { type: 'ember', count: 40, box: [0.8, 1.6, 1.2, 1.6, -6.9, -6.1], color: '#ff8a30' }],
      relic: [0.4, 0, -3.4],
    });
  };

  // ── 4. Scriptorium ─────────────────────────────────────────────────────────
  R.scriptorium = () => {
    const s = shell({ w: 10, d: 16, h: 5.5, tint: 'warm', vault: 'pointed', rise: 3.5, pillars: { spacing: 4, r: 0.28, inset: 0.6 } });
    const g = s.g;
    for (let z = -1; z > s.zB + 1; z -= 2.2) { place(g, P.bookshelf(2.0, 3.4, Math.floor(-z * 3)), -4.75, 0, z, Math.PI / 2); place(g, P.bookshelf(2.0, 3.4, Math.floor(-z * 5) + 1), 4.75, 0, z, -Math.PI / 2); }
    place(g, P.bookshelf(4, 3.6, 77), 0, 0, s.zB + 0.25);
    for (let i = 0; i < 3; i++) { place(g, P.desk(), -1.6, 0, -1.5 - i * 2.6, 0.1); place(g, P.desk(), 1.8, 0, -2.6 - i * 2.6, -0.1); }
    [-2.5, 2.5].forEach(x => { const l = P.stainedWindow('lancet', 2.6, '#c8d8ff'); l.position.set(x, 4.2, s.zB + 0.06); g.add(l); });
    const shaft = P.lightShaft(0.4, 1.6, 8, '#a8c0ff', 0.2); shaft.position.set(2.5, 4.5, s.zB + 0.3); shaft.lookAt(1.5, 0, -6); shaft.rotateX(-Math.PI / 2); g.add(shaft);
    const ch = P.chandelier(0.9); ch.position.set(0, 3.2, -5); g.add(ch);
    return spec({
      group: g, fog: ['#140e08', 0.045], bg: '#0c0806',
      hemi: ['#4a3a28', '#100a06', 0.3],
      key: { type: 'spot', pos: [0, 5, 2], target: [0, 0, -4], color: '#ffc080', intensity: 1.2, angle: 0.9, penumbra: 1, distance: 16 },
      grade: { exposure: 1.15, tint: [1.08, 1.0, 0.86], sat: 1.05 },
      particles: [{ type: 'dust', count: 220, box: [-4, 4, 0.3, 5, s.zB, 4], color: '#ffe0b0' }],
      relic: [0.2, 0, -2.0], npc: { pos: [2.6, 0, -0.8], rot: -0.6 },
    });
  };

  // ── 5. Barracks ────────────────────────────────────────────────────────────
  R.barracks = () => {
    const s = shell({ w: 11, d: 15, h: 4.4, tint: '', floorTint: 'warm', vault: 'beams' });
    const g = s.g;
    for (let i = 0; i < 4; i++) { place(g, P.bed(i), -4.3, 0, -1 - i * 2.6, Math.PI / 2); place(g, P.bed(i + 1), 4.3, 0, -1.6 - i * 2.6, -Math.PI / 2); }
    place(g, P.fireplace(), 0, 0, s.zB + 0.5);
    place(g, P.chest(false), -2.6, 0, -3.2, 0.2); place(g, P.chest(false), 2.8, 0, -6, -0.3);
    place(g, P.weaponRack(9), -2.2, 0, s.zB + 0.4);
    place(g, P.longTable(2.6), 0.6, 0, -4.2);
    wallTorch(g, 'L', -s.w / 2 + 0.25, 2.4, -4.5); wallTorch(g, 'R', s.w / 2 - 0.25, 2.4, -7.5);
    return spec({
      group: g, fog: ['#140c06', 0.045], bg: '#0c0604',
      hemi: ['#4a3426', '#0c0806', 0.3],
      key: { type: 'spot', pos: [0, 2.0, s.zB + 2.6], target: [-1, 0, 0], color: '#ff9a50', intensity: 1.6, angle: 1.0, penumbra: 1, distance: 18 },
      grade: { exposure: 1.1, tint: [1.08, 0.96, 0.86] },
      particles: [{ type: 'ember', count: 70, box: [-0.8, 0.8, 0.3, 1.2, s.zB + 0.3, s.zB + 1.1], color: '#ff8a30' }, { type: 'dust', count: 120, box: [-4, 4, 0.3, 4, s.zB, 4], color: '#ffd0a0' }],
      relic: [-2.6, 0, -6.2], npc: { pos: [2.0, 0, -1.8], rot: -0.7 },
    });
  };

  // ── 6. Infirmary ───────────────────────────────────────────────────────────
  R.infirmary = () => {
    const s = shell({ w: 10, d: 15, h: 5, tint: '', vault: 'pointed', rise: 3, pillars: { spacing: 5, r: 0.28, inset: 0.6 } });
    const g = s.g;
    for (let i = 0; i < 3; i++) { place(g, P.bed(1), -3.9, 0, -2 - i * 3, Math.PI / 2); place(g, P.bed(1), 3.9, 0, -3.5 - i * 3, -Math.PI / 2); }
    place(g, P.shelfBottles(3.2, 2), 0, 0, s.zB + 0.25);
    const herbs = P.herbs(6, 3); herbs.position.set(0, 4.2, -5); g.add(herbs);
    const herbs2 = P.herbs(6, 4); herbs2.position.set(0, 4.2, -8); g.add(herbs2);
    [-2.3, 2.3].forEach(x => { const l = P.stainedWindow('lancet', 2.4, '#d0ffd8'); l.position.set(x, 3.8, s.zB + 0.06); g.add(l); });
    const shaft = P.lightShaft(0.4, 1.6, 9, '#b8ffd0', 0.22); shaft.position.set(-2.3, 4.0, s.zB + 0.3); shaft.lookAt(-1, 0, -4); shaft.rotateX(-Math.PI / 2); g.add(shaft);
    place(g, P.candles(6, 0.3, 61), 1.6, 0, -1.2);
    wallTorch(g, 'L', -s.w / 2 + 0.25, 2.4, -6); wallTorch(g, 'R', s.w / 2 - 0.25, 2.4, -1.8);
    const basin = mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.3, 16), G3D.metalMat('bronze')); basin.position.set(-1.6, 0.85, -4); g.add(basin);
    const stand = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 8), G3D.woodMat(true)); stand.position.set(-1.6, 0.35, -4); g.add(stand);
    return spec({
      group: g, fog: ['#0c120e', 0.045], bg: '#060a08',
      hemi: ['#3a4a40', '#0a0c0a', 0.35],
      key: { type: 'spot', pos: [-2.3, 4.2, s.zB + 0.8], target: [-0.5, 0, -2], color: '#d8ffe0', intensity: 2.0, angle: 0.6, penumbra: 0.8, distance: 20 },
      grade: { exposure: 1.15, tint: [0.96, 1.04, 0.98], sat: 0.9 },
      particles: [{ type: 'dust', count: 180, box: [-4, 4, 0.3, 4.5, s.zB, 4], color: '#e0ffe8' }],
      relic: [0.3, 0, -2.6], npc: { pos: [2.2, 0, -1.4], rot: -0.6 },
    });
  };

  // ── 7. Bell Tower ──────────────────────────────────────────────────────────
  R.tower = () => {
    const s = shell({ w: 8, d: 10, h: 18, tint: 'cold', vault: 'flat', zFront: 6 });
    const g = s.g;
    // Great bell hangs in the open shaft from a heavy oak frame
    const bell = P.bell(); bell.position.set(0.4, 2.7, -1.6); bell.scale.setScalar(1.3); g.add(bell); bell.userData.swing = 0.1;
    for (let k = -1; k <= 1; k += 2) { const b = mesh(new THREE.BoxGeometry(0.35, 0.4, 10), G3D.woodMat(true)); b.position.set(0.4 + k * 2.2, 5.1, 1); g.add(b); }
    const cross = mesh(new THREE.BoxGeometry(8, 0.35, 0.35), G3D.woodMat(true)); cross.position.set(0, 4.85, -1.6); g.add(cross);
    [-1.6, 2.4].forEach(x => { const post = mesh(new THREE.BoxGeometry(0.3, 4.9, 0.3), G3D.woodMat(true)); post.position.set(x, 2.45, -1.6); g.add(post); });
    // Narrow landing against the back wall with a ladder up to it
    const pl = mesh(new THREE.BoxGeometry(8, 0.2, 1.4), G3D.woodMat(true, [3, 1])); pl.position.set(0, 4.6, s.zB + 0.7); g.add(pl);
    for (let x = -3.6; x <= 3.6; x += 1.2) { const post = mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), G3D.woodMat(true)); post.position.set(x, 5.1, s.zB + 1.35); g.add(post); }
    const rail = mesh(new THREE.BoxGeometry(8, 0.08, 0.08), G3D.woodMat(true)); rail.position.set(0, 5.55, s.zB + 1.35); g.add(rail);
    const lad = new THREE.Group();
    [-0.3, 0.3].forEach(x => { const r = mesh(new THREE.BoxGeometry(0.07, 4.9, 0.07), G3D.woodMat(true)); r.position.set(x, 2.45, 0); lad.add(r); });
    for (let y = 0.3; y < 4.8; y += 0.4) { const r = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), G3D.woodMat(true)); r.position.y = y; lad.add(r); }
    lad.position.set(-2.9, 0, s.zB + 1.6); lad.rotation.x = -0.18; g.add(lad);
    const rope = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), G3D.flatMat('rope', '#6a5a3a', 1)); rope.position.set(0.7, 1.4, -1.6); g.add(rope);
    // Tall window slits; moonlight pours in across the shaft
    [[-3.95, 9.5, 0.5, Math.PI / 2], [3.95, 7, -2.2, -Math.PI / 2]].forEach(([x, y, z, r]) => {
      const w = mesh(new THREE.PlaneGeometry(0.45, 2.4), G3D.emissiveMat('moonwin', '#9ab0ff', 1.8)); w.position.set(x, y, z); w.rotation.y = r; g.add(w);
      const sh = P.lightShaft(0.2, 1.2, 11, '#a8c0ff', 0.16); sh.position.set(x * 0.98, y, z); sh.lookAt(-x * 0.3, 0, z + 1.5); sh.rotateX(-Math.PI / 2); g.add(sh);
    });
    wallTorch(g, 'R', s.w / 2 - 0.25, 2.5, 2.0);
    place(g, P.candles(5, 0.3, 71), 2.2, 0, -2.6);
    place(g, P.bonePile(10, 0.5, 72), -1.6, 0, -2.4);
    return spec({
      group: g, fog: ['#0a0e18', 0.03], bg: '#06080e',
      hemi: ['#405070', '#0a0a0c', 0.35],
      key: { type: 'spot', pos: [-3.6, 9.6, 0.5], target: [0.8, 0, -1.5], color: '#a8c0ff', intensity: 2.6, angle: 0.5, penumbra: 0.8, distance: 24 },
      grade: { exposure: 1.2, tint: [0.92, 0.98, 1.1], sat: 0.85 },
      particles: [{ type: 'dust', count: 220, box: [-3.5, 3.5, 0.3, 12, s.zB, 4], color: '#c8d8ff' }],
      cam: { pos: [1.2, 1.6, 5.0], look: [0.0, 2.7, -2.0], fovH: 84 },
      knight: { pos: [-1.0, 0, 0.6], rot: 0.5 },
      relic: [2.0, 0, -0.8], scroll: [-2.0, 0, -0.2],
    });
  };

  // ── 8. Courtyard (storm, burning cart) ─────────────────────────────────────
  R.courtyard = () => {
    const g = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(70, 70), G3D.floorMat('cold', [16, 16]), false, true); ground.rotation.x = -Math.PI / 2; ground.position.z = -14; g.add(ground);
    const wallB = P.battlements(44, 6, 'cold'); wallB.position.set(0, 0, -26); g.add(wallB);
    const wallL = P.battlements(36, 6, 'cold'); wallL.rotation.y = Math.PI / 2; wallL.position.set(-17, 0, -8); g.add(wallL);
    const wallR = P.battlements(36, 6, 'cold'); wallR.rotation.y = -Math.PI / 2; wallR.position.set(17, 0, -8); g.add(wallR);
    // Keep tower on the left, gatehouse ahead
    const keep = mesh(new THREE.CylinderGeometry(3, 3.4, 16, 20), G3D.stoneMat('cold', [6, 5], 'keep')); keep.position.set(-11, 8, -20); g.add(keep);
    const roof = mesh(new THREE.ConeGeometry(3.6, 5, 20), G3D.flatMat('slate', '#1a1c22', 0.8)); roof.position.set(-11, 18.5, -20); g.add(roof);
    const kw = mesh(new THREE.PlaneGeometry(0.5, 1.2), G3D.emissiveMat('keepwin', '#ffaa50', 2.2)); kw.position.set(-9.2, 9, -17.7); kw.rotation.y = 0.5; g.add(kw);
    const gt = new THREE.Group();
    [-3.2, 3.2].forEach(x => { const t = mesh(new THREE.BoxGeometry(2.4, 9, 2.4), G3D.stoneMat('cold', [1, 3], 'gt')); t.position.set(x, 4.5, 0); gt.add(t); });
    const arch = P.gothicArch(4, 4.5, 1.4, G3D.stoneMat('cold', [1, 1], 'gate')); gt.add(arch);
    const port = mesh(new THREE.PlaneGeometry(4, 4.4), G3D.flatMat('void', '#020203', 1)); port.position.set(0, 2.2, -0.3); gt.add(port);
    const top = mesh(new THREE.BoxGeometry(9, 2.5, 2.4), G3D.stoneMat('cold', [3, 1], 'gtop')); top.position.set(0, 7.75, 0); gt.add(top);
    gt.position.set(3, 0, -25.4); g.add(gt);
    place(g, P.well(), -4.2, 0, -8);
    place(g, P.deadTree(11), 7.5, 0, -13, 0, 1.3);
    // Burning cart, mid-ground right
    const cart = new THREE.Group();
    const bed = mesh(new THREE.BoxGeometry(1.6, 0.15, 2.4), G3D.woodMat(true)); bed.position.y = 0.7; bed.rotation.z = 0.15; cart.add(bed);
    [-1, 1].forEach(z => { const w = mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16), G3D.woodMat(true)); w.position.set(-0.85, 0.45, z * 0.8); w.rotation.y = Math.PI / 2; cart.add(w); });
    [-0.3, 0.2, 0.6].forEach((x, i) => { const f = G3D.flame('#ff5a10', 0.8, 1.4 + i * 0.35, 1.0); f.position.set(x * 0.6, 0.8, (i - 1) * 0.6); cart.add(f); });
    const gl = G3D.glow('#ff6a20', 4, 0.5); gl.position.y = 1.4; cart.add(gl);
    const a = new THREE.Object3D(); a.position.y = 1.8; cart.add(a); G3D.anchor(a, '#ff6a1a', 3.2, 14, { flicker: 1.6, priority: 4 });
    cart.position.set(4.2, 0, -6.5); cart.rotation.y = -0.4; g.add(cart);
    place(g, P.bonePile(20, 1.0, 9), -0.6, 0, -4.2);
    place(g, P.barrel(), -7.5, 0, -4); place(g, P.barrel(), -8.2, 0, -4.6); place(g, P.crate(), -7.8, 0.35, -3.0, 0.5);
    for (let i = 0; i < 3; i++) { const b = P.banner(1.2, 3.0, 'black'); b.position.set(-12 + i * 9, 5.6, -25.3); g.add(b); }
    place(g, P.brazier('#ff7a20'), -6, 0, -14);
    sky(g, { moon: [0.35, 0.42, -0.85], horizon: '#141a2a', clouds: true });
    hills(g);
    g.add(P.rain({ box: [-14, 14, -22, 5], top: 12, count: 2200, splashBox: [-5, 7, -9, 2.5], splashes: 320, wind: [1.4, 0.4] }));
    return spec({
      group: g, fog: ['#0a0e16', 0.022], bg: '#06080e', outdoor: true, lightning: true, vol: { wet: 1, puddles: 1 },
      hemi: ['#3a4a6a', '#0a0a0c', 0.4],
      key: { type: 'dir', dir: [0.4, 0.55, -0.75], color: '#8ea8e0', intensity: 1.1, area: 20, center: [0, 0, -6] },
      grade: { exposure: 1.15, tint: [0.92, 0.98, 1.1], sat: 0.95 },
      particles: [{ type: 'ember', count: 120, box: [3.4, 5.0, 0.6, 3, -7.4, -5.6], color: '#ff8a30' }, { type: 'fog', count: 30, box: [-16, 16, 0, 1.4, -24, 2], color: '#4a5a80', opacity: 0.08 }, { type: 'ash', count: 200, box: [-8, 8, 0, 9, -14, 4], color: '#9aa0b0' }],
      cam: { pos: [0.4, 1.7, 4.8], look: [0.6, 3.2, -10], fovH: 84 },
      knight: { pos: [-1.5, 0, 0.4], rot: 0.5 },
      relic: [-3.2, 0, -2.5],
    });
  };

  // ── 9. Crypt Entrance ──────────────────────────────────────────────────────
  R.crypt = () => {
    const s = shell({ w: 8, d: 15, h: 4.6, tint: 'cold', vault: 'barrel', pillars: { spacing: 4, r: 0.26, inset: 0.5 } });
    const g = s.g;
    // Opening with stairs down into darkness
    const hole = mesh(new THREE.PlaneGeometry(3, 4), G3D.flatMat('void', '#010102', 1)); hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.01, s.zB + 3); g.add(hole);
    const st = P.stairsDown(2.8, 8); st.position.set(0, 0, s.zB + 4.8); g.add(st);
    const gate = P.gothicArch(3.2, 3.6, 0.6, G3D.stoneMat('cold', [1, 1], 'cg')); gate.position.set(0, 0, s.zB + 5.1); g.add(gate);
    const bars = P.bars(2.8, 2.6); bars.position.set(0, 0, s.zB + 5.1); bars.rotation.y = 0.9; bars.position.x = -1.2; g.add(bars);
    place(g, P.sarcophagus('cold'), -2.6, 0, -2.2, 0.0);
    place(g, P.sarcophagus('cold'), 2.6, 0, -4.2, 0.0);
    place(g, P.bonePile(14, 0.7, 3), 1.6, 0, -0.6);
    s.pillarZ.forEach(z => { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.4, z - 2); });
    const cyan = new THREE.Object3D(); cyan.position.set(0, 0.6, s.zB + 3); g.add(cyan); G3D.anchor(cyan, '#40d8ff', 3.2, 10, { flicker: 0.3, priority: 4 });
    const cg = G3D.glow('#40d8ff', 4, 0.35); cg.position.set(0, 0.4, s.zB + 3); g.add(cg);
    return spec({
      group: g, fog: ['#081218', 0.06], bg: '#04080a',
      hemi: ['#2a4250', '#060808', 0.3],
      key: { type: 'spot', pos: [2, 4.4, 2], target: [-1, 0, -4], color: '#9ad8ff', intensity: 0.9, angle: 0.9, penumbra: 1, distance: 16 },
      grade: { exposure: 1.2, tint: [0.88, 1.0, 1.1], sat: 0.85 },
      particles: [{ type: 'fog', count: 30, box: [-3.5, 3.5, 0, 1.0, s.zB, 3], color: '#2a90b0', opacity: 0.08 }, { type: 'wisp', count: 40, box: [-3, 3, 0.2, 2.5, s.zB + 1, -2], color: '#60e0ff' }],
      relic: [-2.4, 0, 0.2],
    });
  };

  // ── 10. Catacombs ──────────────────────────────────────────────────────────
  R.catacombs = () => {
    const s = shell({ w: 5.2, d: 22, h: 3.2, tint: 'cold', vault: 'barrel', ribSpacing: 3, noBack: false });
    const g = s.g;
    const L = P.ossuaryWall(s.d - 0.5, 3.2, 1); L.rotation.y = Math.PI / 2; L.position.set(-2.55, 0, s.zF - s.d / 2); g.add(L);
    const Rw = P.ossuaryWall(s.d - 0.5, 3.2, 2); Rw.rotation.y = -Math.PI / 2; Rw.position.set(2.55, 0, s.zF - s.d / 2); g.add(Rw);
    place(g, P.bonePile(26, 0.9, 11), 1.2, 0, -3.5);
    place(g, P.bonePile(18, 0.7, 12), -1.0, 0, -8);
    // Skull candles in niches
    [[-1.9, -1.5], [1.9, -5.5], [-1.9, -9.5], [1.9, -13]].forEach(([x, z], i) => { const c = P.candles(3, 0.08, 90 + i); c.position.set(x, 1.0, z); g.add(c); });
    return spec({
      group: g, fog: ['#081014', 0.085], bg: '#030607', vol: { wet: 0.55, puddles: 0.8 },
      hemi: ['#2a3a44', '#040606', 0.3],
      key: { type: 'spot', pos: [0.5, 3.0, 2.5], target: [0, 0, -6], color: '#88d0ff', intensity: 1.1, angle: 0.7, penumbra: 1, distance: 18 },
      grade: { exposure: 1.25, tint: [0.88, 1.0, 1.08], sat: 0.85 },
      particles: [{ type: 'fog', count: 26, box: [-2.2, 2.2, 0, 0.8, s.zB, 3], color: '#2a90b0', opacity: 0.08 }, { type: 'dust', count: 140, box: [-2, 2, 0.2, 3, s.zB, 4], color: '#a8e0ff' }],
      knight: { pos: [-0.75, 0, 0.2], rot: 0.35 }, enemy: { pos: [0.9, 0, -1.2], rot: -2.5 },
      cam: { pos: [0.6, 1.6, 4.3], look: [-0.1, 1.5, -6], fovH: 74 },
      relic: [1.3, 0, -1.4],
    });
  };

  // ── 11. Necromancer's Lair ─────────────────────────────────────────────────
  R.lair = () => {
    const s = shell({ w: 16, d: 22, h: 8, tint: 'cold', floorTint: 'cold', vault: 'pointed', rise: 6, zFront: 8, pillars: { spacing: 5, r: 0.45, inset: 1.2 } });
    const g = s.g;
    const circle = P.runeCircle(3.6, '#38ff5a'); circle.position.set(0.4, 0.02, -1.0); g.add(circle);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
      place(g, P.brazier('#38ff5a', 0.65), 0.4 + Math.cos(a) * 4.6, 0, -1.0 + Math.sin(a) * 4.6);
    }
    place(g, P.bonePile(40, 1.4, 21), -4.5, 0, -6.5);
    place(g, P.bonePile(30, 1.1, 22), 5, 0, -3.5);
    // Dark altar with a skull
    const alt = mesh(new THREE.BoxGeometry(2.4, 1.1, 1.1), G3D.stoneMat('blood', [1, 1], 'nalt')); alt.position.set(0.4, 0.55, s.zB + 2.5); g.add(alt);
    place(g, P.skull(), 0.4, 1.2, s.zB + 2.5, 0, 2);
    for (let i = 0; i < 3; i++) { const b = P.banner(1.3, 4.2, 'black'); b.position.set(-4 + i * 4.4, 6.6, s.zB + 0.1); g.add(b); }
    place(g, P.candles(14, 0.9, 66), -2.4, 0, s.zB + 3.0);
    const chains = [[-3, -3], [3.5, -6], [-1, -9]];
    chains.forEach(([x, z], i) => { const c = P.chain(3.5, i); c.position.set(x, 8, z); g.add(c); });
    return spec({
      group: g, fog: ['#020805', 0.03], bg: '#010302', vol: { light: 0.32 },
      hemi: ['#1a3020', '#020302', 0.25],
      key: { type: 'spot', pos: [0.4, 7.6, 1], target: [0.4, 0, -1], color: '#7aff90', intensity: 1.3, angle: 0.45, penumbra: 0.8, distance: 20 },
      grade: { exposure: 1.0, tint: [0.96, 1.03, 0.96], sat: 0.82, contrast: 1.15 },
      particles: [{ type: 'wisp', count: 50, box: [-3.5, 4.5, 0.2, 3, -5, 2], color: '#3ad04a' }, { type: 'fog', count: 22, box: [-7, 7, 0, 0.8, s.zB, 3], color: '#1a6a30', opacity: 0.06 }, { type: 'ember', count: 50, box: [-4.5, 5.3, 1.2, 2, -5.6, 3.6], color: '#4dff5a' }],
      cam: { pos: [0.8, 2.3, 6.4], look: [0.2, 1.4, -4], fovH: 84 },
      knight: { pos: [-1.5, 0, 1.6], rot: 0.55 }, enemy: { pos: [1.4, 0, -0.6], rot: -2.4 },
    });
  };

  // ── 12. Grand Hall ─────────────────────────────────────────────────────────
  R.hall = () => {
    const s = shell({ w: 14, d: 26, h: 8, tint: 'warm', vault: 'pointed', rise: 6, pillars: { spacing: 4.4, r: 0.45, inset: 1.0 } });
    const g = s.g;
    place(g, P.longTable(12), 0, 0, -8);
    place(g, P.fireplace(), 0, 0, s.zB + 0.55, 0, 1.3);
    s.pillarZ.forEach((z, i) => {
      [-1, 1].forEach(sd => { const b = P.banner(1.1, 3.6, (i + (sd > 0 ? 1 : 0)) % 2 ? 'red' : 'white'); b.position.set(sd * (s.w / 2 - 2.0), 6.6, z - 2.2); g.add(b); });
      wallTorch(g, 'L', -s.w / 2 + 0.25, 3.0, z); wallTorch(g, 'R', s.w / 2 - 0.25, 3.0, z);
    });
    [-4, -12].forEach(z => { const c = P.chandelier(1.3); c.position.set(0, 5.4, z); g.add(c); });
    [-3.5, 3.5].forEach(x => { const l = P.stainedWindow('lancet', 4, '#ffd8b0'); l.position.set(x, 5.8, s.zB + 0.06); g.add(l); });
    return spec({
      group: g, fog: ['#140c08', 0.035], bg: '#0a0604', vol: { wet: 0.45, puddles: 0 },
      hemi: ['#4a3426', '#100806', 0.35],
      key: { type: 'spot', pos: [0, 3.5, s.zB + 3], target: [0, 0, -2], color: '#ff9a50', intensity: 2.2, angle: 0.9, penumbra: 1, distance: 30 },
      grade: { exposure: 1.1, tint: [1.08, 0.98, 0.88], sat: 1.05 },
      particles: [{ type: 'dust', count: 220, box: [-6, 6, 0.3, 7, s.zB, 4], color: '#ffd8a8' }, { type: 'ember', count: 50, box: [-1, 1, 0.3, 1.5, s.zB + 0.5, s.zB + 1.4], color: '#ff8a30' }],
      cam: { pos: [0.6, 1.8, 4.8], look: [-0.2, 2.2, -8], fovH: 76 },
      npc: { pos: [2.4, 0, -1.6], rot: -0.6 },
    });
  };

  // ── 13. Treasury ───────────────────────────────────────────────────────────
  R.treasury = () => {
    const s = shell({ w: 10, d: 13, h: 5, tint: 'warm', vault: 'barrel', pillars: { spacing: 4, r: 0.3, inset: 0.6 } });
    const g = s.g;
    place(g, P.coinPile(1.4, 1), -2.5, 0, -4.5);
    place(g, P.coinPile(1.0, 2), 2.8, 0, -3.2);
    place(g, P.coinPile(1.8, 3), 0.4, 0, s.zB + 2.0);
    place(g, P.chest(true), -3.2, 0, -1.6, 0.5); place(g, P.chest(true), 3.4, 0, -6.0, -0.6); place(g, P.chest(false), 1.4, 0, -1.2, -0.2);
    for (let i = 0; i < 6; i++) { const gob = mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.22, 10), G3D.metalMat('gold')); gob.position.set(-1 + i * 0.5, 0.11, -2.4 - (i % 2) * 0.6); if (i % 3 === 0) { gob.rotation.z = 1.4; gob.position.y = 0.06; } g.add(gob); }
    s.pillarZ.forEach(z => { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.6, z - 2); wallTorch(g, 'R', s.w / 2 - 0.25, 2.6, z - 2); });
    return spec({
      group: g, fog: ['#140e04', 0.045], bg: '#0a0702', vol: { wet: 0.5, puddles: 0 },
      hemi: ['#5a4520', '#100a04', 0.35],
      key: { type: 'spot', pos: [0, 4.8, 0], target: [0, 0, -4], color: '#ffd080', intensity: 1.4, angle: 0.7, penumbra: 0.9, distance: 16 },
      grade: { exposure: 0.88, tint: [1.06, 1.0, 0.86], sat: 1.05, contrast: 1.1 },
      particles: [{ type: 'spark', count: 120, box: [-4, 4, 0.1, 3, s.zB, 1], color: '#ffd870' }, { type: 'dust', count: 140, box: [-4, 4, 0.3, 4.5, s.zB, 4], color: '#ffe0a0' }],
      relic: [-0.6, 0, -2.6], npc: { pos: [2.4, 0, -0.8], rot: -0.6 },
    });
  };

  // ── 14. Bone Throne ────────────────────────────────────────────────────────
  R.throne = () => {
    const s = shell({ w: 13, d: 18, h: 7.5, tint: 'blood', vault: 'pointed', rise: 5.5, pillars: { spacing: 4.5, r: 0.42, inset: 1.0 } });
    const g = s.g;
    place(g, P.boneThrone(), 0, 0, s.zB + 2.6, 0, 1.45);
    wallTorch(g, 'L', -s.w / 2 + 0.25, 2.6, 1.0); wallTorch(g, 'R', s.w / 2 - 0.25, 2.6, -1.5);
    [-3.4, 3.4].forEach(x => place(g, P.brazier('#ff3a14', 0.75), x, 0, s.zB + 4.6));
    place(g, P.bonePile(36, 1.3, 31), -4, 0, -3); place(g, P.bonePile(30, 1.1, 32), 4.2, 0, -5.5);
    s.pillarZ.forEach((z, i) => { const b = P.banner(1.0, 3.2, 'black'); b.position.set((i % 2 ? -1 : 1) * (s.w / 2 - 1.5), 6, z - 2.2); b.rotation.y = (i % 2 ? 1 : -1) * Math.PI / 2; g.add(b); });
    const carpet = mesh(new THREE.PlaneGeometry(2.2, 12), redCarpet()); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, -3); g.add(carpet);
    return spec({
      group: g, fog: ['#160406', 0.05], bg: '#0a0203', vol: { wet: 0.6, puddles: 0 },
      hemi: ['#5a2a2a', '#100606', 0.45],
      key: { type: 'spot', pos: [0, 7.2, -1], target: [0, 1.8, s.zB + 2], color: '#ff4a32', intensity: 2.0, angle: 0.42, penumbra: 0.7, distance: 22 },
      grade: { exposure: 1.2, tint: [1.08, 0.94, 0.92], sat: 0.95, contrast: 1.12 },
      particles: [{ type: 'ember', count: 80, box: [-3.8, 3.8, 1.0, 1.8, s.zB + 4.2, s.zB + 5.0], color: '#ff4020' }, { type: 'ash', count: 160, box: [-6, 6, 0, 7, s.zB, 4], color: '#a08080' }],
      cam: { pos: [0.5, 1.8, 4.6], look: [-0.2, 2.2, -8], fovH: 84 },
    });
  };
  function redCarpet() { return G3D.mat('carpet', () => new THREE.MeshStandardMaterial({ map: G3D.clothTex('carpet', { base: [96, 12, 16], trim: [170, 130, 50], stain: 0.3 }), roughness: 1 })); }

  // ── 15. Portrait Gallery ───────────────────────────────────────────────────
  R.gallery = () => {
    const s = shell({ w: 8, d: 24, h: 6, tint: 'warm', vault: 'barrel', ribSpacing: 3.5 });
    const g = s.g;
    let k = 0;
    for (let z = -1.5; z > s.zB + 2; z -= 3.6) {
      const pl = P.portrait(k++, 1.3, 1.7); pl.position.set(-3.95, 3.0, z); pl.rotation.y = Math.PI / 2; g.add(pl);
      const pr = P.portrait(k++, 1.3, 1.7); pr.position.set(3.95, 3.0, z - 1.8); pr.rotation.y = -Math.PI / 2; g.add(pr);
      const sl = G3D.makeKnight({ statue: true, tint: 'warm' }).root; sl.position.set(-3.2, 0.6, z - 1.8); sl.rotation.y = Math.PI / 2; g.add(sl);
      const ped = mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), G3D.stoneMat('warm', [1, 1], 'gped')); ped.position.set(-3.2, 0.3, z - 1.8); g.add(ped);
      const c = P.candles(4, 0.12, 120 + k, k % 2 === 0); c.position.set(3.3, 0, z); g.add(c);
    }
    const carpet = mesh(new THREE.PlaneGeometry(2, s.d - 1), redCarpet()); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, s.zF - s.d / 2); g.add(carpet);
    [-4, -12].forEach(z => { const c = P.chandelier(1.0); c.position.set(0, 4.0, z); g.add(c); });
    const l = P.stainedWindow('rose', 3.0, '#c8d8ff'); l.position.set(0, 4.4, s.zB + 0.06); g.add(l);
    return spec({
      group: g, fog: ['#120c08', 0.045], bg: '#0a0604',
      hemi: ['#4a3828', '#0c0806', 0.3],
      key: { type: 'spot', pos: [0, 4.4, s.zB + 0.8], target: [0, 0, -2], color: '#b0c0ff', intensity: 2.2, angle: 0.45, penumbra: 0.8, distance: 28 },
      grade: { exposure: 1.15, tint: [1.04, 0.98, 0.94], sat: 1.0 },
      particles: [{ type: 'dust', count: 200, box: [-3, 3, 0.3, 5, s.zB, 4], color: '#ffe0c0' }],
      knight: { pos: [-0.9, 0, 0.3], rot: 0.45 },
      cam: { pos: [0.9, 1.7, 4.6], look: [-0.4, 2.2, -8], fovH: 74 },
    });
  };

  // ── 16. Dungeon Depths ─────────────────────────────────────────────────────
  R.dungeon = () => {
    const s = shell({ w: 10, d: 15, h: 4.2, tint: 'blood', floorTint: 'blood', vault: 'barrel', pillars: { spacing: 4, r: 0.3, inset: 0.6 } });
    const g = s.g;
    for (let i = 0; i < 3; i++) {
      const bl = P.bars(3, 3.2); bl.position.set(-3.2, 0, -1.5 - i * 3.6); bl.rotation.y = Math.PI / 2; g.add(bl);
      const br = P.bars(3, 3.2); br.position.set(3.2, 0, -3.2 - i * 3.6); br.rotation.y = -Math.PI / 2; g.add(br);
      place(g, P.bonePile(8, 0.4, 40 + i), -4.2, 0, -1.5 - i * 3.6);
    }
    [[-1, -2], [1.2, -5], [-0.6, -8.5], [1.6, -10]].forEach(([x, z], i) => { const c = P.chain(2.2 + i * 0.4, i + 4); c.position.set(x, 4.1, z); g.add(c); });
    // Puddles
    [[0.5, -3], [-1.5, -6], [1.8, -8.5]].forEach(([x, z]) => { const p = mesh(new THREE.CircleGeometry(0.6 + Math.random() * 0.5, 20), G3D.flatMat('puddle', '#100406', 0.02, 0.3)); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.012, z); g.add(p); });
    s.pillarZ.forEach(z => { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.4, z - 2); });
    wallTorch(g, 'B', 0, 2.4, s.zB + 0.25);
    return spec({
      group: g, fog: ['#120406', 0.06], bg: '#080203', vol: { wet: 0.8, puddles: 0.9 },
      hemi: ['#3a1a1a', '#080303', 0.28],
      key: { type: 'spot', pos: [1.5, 4.0, 2.5], target: [-0.5, 0, -4], color: '#ff6a40', intensity: 1.2, angle: 0.9, penumbra: 1, distance: 16 },
      grade: { exposure: 1.2, tint: [1.1, 0.92, 0.9], sat: 0.95, contrast: 1.1 },
      particles: [{ type: 'dust', count: 140, box: [-4, 4, 0.2, 4, s.zB, 4], color: '#ffb0a0' }, { type: 'drip', count: 30, box: [-4, 4, 3.9, 4.1, s.zB, 3], color: '#88a0c0' }],
    });
  };

  // ── 17. Watchtower (rooftop at night) ──────────────────────────────────────
  R.watchtower = () => {
    const g = new THREE.Group();
    const deck = mesh(new THREE.CylinderGeometry(6, 6, 0.4, 32), G3D.floorMat('cold', [3, 3])); deck.position.set(0, -0.2, -2); g.add(deck);
    const R2 = G3D.stoneMat('cold', [8, 1], 'twall');
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const wseg = mesh(new THREE.BoxGeometry(1.9, 1.1, 0.6), R2); wseg.position.set(Math.cos(a) * 6, 0.55, -2 + Math.sin(a) * 6); wseg.rotation.y = -a + Math.PI / 2; g.add(wseg);
      if (i % 2 === 0) { const m = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.6), R2); m.position.set(Math.cos(a) * 6, 1.5, -2 + Math.sin(a) * 6); m.rotation.y = -a + Math.PI / 2; g.add(m); }
    }
    const tower = mesh(new THREE.CylinderGeometry(6.2, 7, 30, 32, 1, true), G3D.stoneMat('cold', [12, 10], 'tw')); tower.position.set(0, -15.4, -2); g.add(tower);
    place(g, P.brazier('#ff7a20', 1.2), 2.6, 0, -4.4);
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), G3D.woodMat(true)); pole.position.set(-3, 3, -5); g.add(pole);
    const flag = P.banner(1.8, 1.2, 'white'); flag.position.set(-3, 5.05, -5); flag.rotation.z = Math.PI / 2; flag.children[0].userData.sway.amp = 0.18; g.add(flag);
    // Distant fortress silhouettes and the valley
    for (let i = 0; i < 5; i++) { const t = mesh(new THREE.CylinderGeometry(1.5, 1.8, 12 + i * 2, 10), G3D.flatMat('far', '#0a0c12', 1)); t.position.set(-30 + i * 14, -6, -46 - (i % 2) * 8); g.add(t); }
    const valley = mesh(new THREE.PlaneGeometry(300, 300), G3D.flatMat('valley', '#05070a', 1), false, true); valley.rotation.x = -Math.PI / 2; valley.position.y = -16; g.add(valley);
    sky(g, { moon: [-0.25, 0.32, -0.92], horizon: '#1c2640', clouds: true });
    hills(g, '#070a10');
    g.add(P.rain({ box: [-12, 12, -16, 5], top: 11, count: 1800, splashBox: [-4.5, 4.5, -6.5, 2.5], splashes: 220, wind: [2.2, 0.2] }));
    return spec({
      group: g, fog: ['#0c1424', 0.018], bg: '#080c18', outdoor: true, vol: { wet: 0.7, puddles: 0.8 },
      hemi: ['#3a4a6e', '#08080c', 0.42],
      key: { type: 'dir', dir: [-0.3, 0.45, -0.85], color: '#9ab4f0', intensity: 1.2, area: 10, center: [0, 0, -2] },
      grade: { exposure: 1.25, tint: [0.92, 0.98, 1.1], sat: 0.9 },
      particles: [{ type: 'ember', count: 80, box: [2.2, 3.0, 1.2, 3.5, -4.8, -4.0], color: '#ff8a30' }, { type: 'fog', count: 30, box: [-30, 30, -6, -2, -60, -10], color: '#4a5a80', size: 26, opacity: 0.12 }],
      cam: { pos: [0.6, 1.8, 4.6], look: [-0.6, 1.6, -12], fovH: 80 },
      knight: { pos: [-1.4, 0, 0.5], rot: 0.4 },
      relic: [2.0, 0, -1.2],
    });
  };


  // ── 18–20. The Sunken Crypt (v14) ──────────────────────────────────────────
  // Rising steps toward an arch in the back wall: the way back up.
  function stairsUp(g, w, steps, zStart, tint) {
    const sm = G3D.stoneMat(tint || 'cold', [1, 1], 'stepup');
    for (let i = 0; i < steps; i++) { const st = mesh(new THREE.BoxGeometry(w, 0.25 * (i + 1), 0.55), sm); st.position.set(0, 0.125 * (i + 1), zStart - i * 0.55); g.add(st); }
  }
  function floatCandles(g, n, box, seed) {
    const Rr = G3D.rng(seed);
    for (let i = 0; i < n; i++) place(g, P.floatCandle(i + seed), box[0] + Rr() * (box[1] - box[0]), box[4], box[2] + Rr() * (box[3] - box[2]));
  }

  R.flooded = () => {
    const s = shell({ w: 9, d: 18, h: 5.2, tint: 'cold', vault: 'barrel', ribSpacing: 3.5, pillars: { spacing: 3.6, r: 0.3, inset: 0.6 } });
    const g = s.g;
    // A dry landing in front, then black water to the stair at the back.
    const land = mesh(new THREE.BoxGeometry(9, 0.3, 3.2), G3D.stoneMat('cold', [3, 1], 'landing')); land.position.set(0, 0.15, s.zF - 1.6); g.add(land);
    const water = P.water(9, s.d - 3.2, '#06100f'); water.position.set(0, 0.24, s.zF - 3.2 - (s.d - 3.2) / 2); g.add(water);
    stairsUp(g, 4.2, 8, s.zB + 4.6);
    const arch = P.gothicArch(4.4, 2.6, 0.6, G3D.stoneMat('cold', [1, 1], 'fsarch')); arch.position.set(0, 2.0, s.zB + 0.35); g.add(arch);
    const dark = mesh(new THREE.PlaneGeometry(3.6, 2.6), G3D.flatMat('void', '#010102', 1)); dark.position.set(0, 3.2, s.zB + 0.05); g.add(dark);
    // Side arch on the right: the way on to the ossuary
    const sideArch = P.gothicArch(2.4, 3.0, 0.5, G3D.stoneMat('cold', [1, 1], 'fsside')); sideArch.rotation.y = -Math.PI / 2; sideArch.position.set(s.w / 2 - 0.05, 0, -5); g.add(sideArch);
    const sideDark = mesh(new THREE.PlaneGeometry(2.2, 3.0), G3D.flatMat('void', '#010102', 1)); sideDark.rotation.y = -Math.PI / 2; sideDark.position.set(s.w / 2 - 0.02, 1.5, -5); g.add(sideDark);
    s.pillarZ.forEach((z, i) => { if (i % 2 === 0) { wallTorch(g, 'L', -s.w / 2 + 0.25, 2.6, z - 1.8, 0.9); } });
    floatCandles(g, 16, [-3.6, 3.6, s.zB + 5, -1.2, 0.25], 7);
    place(g, P.bonePile(12, 0.6, 41), -3.2, 0.24, -7.5);
    const glow = G3D.glow('#6ad0ff', 5, 0.25); glow.position.set(0, 2.6, s.zB + 1.4); g.add(glow);
    const top = new THREE.Object3D(); top.position.set(0, 3.4, s.zB + 1.2); g.add(top); G3D.anchor(top, '#6ad0ff', 2.4, 12, { flicker: 0.3, priority: 4 });
    return spec({
      group: g, fog: ['#061014', 0.055], bg: '#020506', vol: { wet: 1, puddles: 2, light: 1.4 },
      hemi: ['#2a4a54', '#040606', 0.3],
      key: { type: 'spot', pos: [0, 4.6, s.zB + 1.6], target: [0, 0, -2], color: '#8ad8ff', intensity: 1.6, angle: 0.75, penumbra: 0.9, distance: 22 },
      grade: { exposure: 1.2, tint: [0.88, 1.0, 1.08], sat: 0.85, contrast: 1.1 },
      particles: [{ type: 'fog', count: 30, box: [-4, 4, 0.2, 1.0, s.zB + 2, 3], color: '#2a8090', opacity: 0.09 }, { type: 'dust', count: 120, box: [-3.5, 3.5, 0.4, 4, s.zB, 4], color: '#a8e0ff' }],
      knight: { pos: [-1.2, 0.3, 1.6], rot: 0.4 },
      npc: { pos: [1.7, 0.24, -1.6], rot: -0.6 },
      cam: { pos: [0.5, 1.95, 5.6], look: [-0.1, 1.5, -6], fovH: 76 },
    });
  };

  R.ossuary = () => {
    const s = shell({ w: 9, d: 18, h: 4.4, tint: 'cold', vault: 'pointed', rise: 3.2, ribSpacing: 3 });
    const g = s.g;
    const L = P.ossuaryWall(s.d - 0.5, 4.2, 5); L.rotation.y = Math.PI / 2; L.position.set(-4.45, 0, s.zF - s.d / 2); g.add(L);
    const Rw = P.ossuaryWall(s.d - 0.5, 4.2, 6); Rw.rotation.y = -Math.PI / 2; Rw.position.set(4.45, 0, s.zF - s.d / 2); g.add(Rw);
    const water = P.water(9, s.d, '#051010'); water.position.set(0, 0.26, s.zF - s.d / 2); g.add(water);
    // Bone islands breaking the surface
    place(g, P.bonePile(36, 1.1, 51), -2.4, 0.15, -6);
    place(g, P.bonePile(28, 0.9, 52), 2.6, 0.15, -9.5);
    place(g, P.bonePile(22, 0.8, 53), -1.0, 0.15, -12);
    for (let i = 0; i < 4; i++) { const p = P.pillar(4.4, 0.34, 'cold'); p.position.set(i % 2 ? 2.2 : -2.2, 0, -3 - i * 3.2); g.add(p); }
    // Skull candles in the alcoves
    [[-3.9, -2.5], [3.9, -5], [-3.9, -8.5], [3.9, -12]].forEach(([x, z], i) => { const c = P.candles(3, 0.1, 140 + i); c.position.set(x, 1.6, z); g.add(c); });
    floatCandles(g, 8, [-3, 3, -14, -2, 0.27], 19);
    const eerie = new THREE.Object3D(); eerie.position.set(0.5, 1.6, -7); g.add(eerie); G3D.anchor(eerie, '#40ffd8', 2.2, 12, { flicker: 0.5, priority: 4 });
    const eg = G3D.glow('#40ffd8', 6, 0.18); eg.position.set(0.5, 1.2, -7); g.add(eg);
    return spec({
      group: g, fog: ['#04100e', 0.07], bg: '#020606', vol: { wet: 1, puddles: 2, light: 1.2 },
      hemi: ['#244a44', '#030505', 0.28],
      key: { type: 'spot', pos: [1, 4.2, 2.5], target: [0, 0, -7], color: '#7affe0', intensity: 1.2, angle: 0.75, penumbra: 1, distance: 20 },
      grade: { exposure: 1.25, tint: [0.86, 1.04, 1.02], sat: 0.8, contrast: 1.12 },
      particles: [{ type: 'fog', count: 34, box: [-4, 4, 0.2, 1.0, s.zB, 3], color: '#1a8070', opacity: 0.1 }, { type: 'wisp', count: 40, box: [-3, 3, 0.4, 3, -12, -1], color: '#60ffd8' }],
      knight: { pos: [-1.0, 0, 1.4], rot: 0.45 }, enemy: { pos: [1.3, 0, -1.4], rot: -2.4 },
      cam: { pos: [0.6, 1.8, 5.4], look: [-0.1, 1.6, -6], fovH: 76 },
    });
  };

  R.sanctum = () => {
    const s = shell({ w: 12, d: 20, h: 9, tint: 'cold', vault: 'pointed', rise: 6, pillars: { spacing: 4.5, r: 0.42, inset: 1.0 } });
    const g = s.g;
    const water = P.water(12, s.d, '#060c12'); water.position.set(0, 0.25, s.zF - s.d / 2); g.add(water);
    // The saint's tomb on a stepped island in a shaft of moonlight
    const isle = mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.5, 40), G3D.stoneMat('cold', [3, 1], 'isle')); isle.position.set(0, 0.25, -5.5); g.add(isle);
    const isle2 = mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.25, 36), G3D.stoneMat('cold', [2, 1], 'isle2')); isle2.position.set(0, 0.62, -5.5); g.add(isle2);
    const tomb = P.sarcophagus('cold'); tomb.position.set(0, 0.74, -5.5); tomb.rotation.y = Math.PI / 2; g.add(tomb);
    place(g, P.candles(10, 1.3, 77), 0, 0.74, -5.5);
    const oculus = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), G3D.emissiveMat('oculus', '#b8d0ff', 3)); oculus.rotation.x = Math.PI / 2; oculus.position.set(0, 8.95 + 3.3, -5.5); g.add(oculus);
    const shaft = P.lightShaft(1.0, 2.4, 11.5, '#b8d4ff', 0.22); shaft.position.set(0, 12, -5.5); shaft.lookAt(0, 0, -5.5); shaft.rotateX(-Math.PI / 2); g.add(shaft);
    const rose = P.stainedWindow('rose', 4.0, '#9ab8ff'); rose.position.set(0, 6.4, s.zB + 0.06); g.add(rose);
    // Half-drowned pews
    for (let z = -1; z > -4; z -= 1.6) { place(g, P.pew(true, Math.floor(-z * 9)), -3.2, -0.15, z); place(g, P.pew(z < -2, Math.floor(-z * 4)), 3.2, -0.15, z); }
    s.pillarZ.forEach((z, i) => { if (i % 2 === 0) { wallTorch(g, 'L', -s.w / 2 + 0.25, 3.0, z - 2, 0.9); wallTorch(g, 'R', s.w / 2 - 0.25, 3.0, z - 2, 0.9); } });
    floatCandles(g, 18, [-4.5, 4.5, -12, -1, 0.26], 31);
    return spec({
      group: g, fog: ['#060a12', 0.04], bg: '#020306', vol: { wet: 1, puddles: 2, key: 3.5, density: 0.05, ambient: 0.3 },
      hemi: ['#2a3450', '#040406', 0.45],
      key: { type: 'spot', pos: [0, 12, -5.5], target: [0, 0, -5.5], color: '#c0d4ff', intensity: 3.4, angle: 0.24, penumbra: 0.6, distance: 30 },
      grade: { exposure: 1.4, tint: [0.92, 0.98, 1.1], sat: 0.85, contrast: 1.1 },
      particles: [{ type: 'dust', count: 220, box: [-1.6, 1.6, 0.5, 8, -7, -4], color: '#d8e4ff' }, { type: 'fog', count: 24, box: [-5, 5, 0.2, 1.0, s.zB, 3], color: '#304a70', opacity: 0.08 }],
      knight: { pos: [-1.2, 0, 1.8], rot: 0.3 },
      cam: { pos: [0.4, 2.0, 6.2], look: [0, 2.2, -6], fovH: 78 },
    });
  };


  // ── Cinematic set: the whole fortress from outside (v15) ───────────────────
  // '@exterior' (night, storm, the Necromancer's glow) for the opening and
  // '@exteriorDawn' (sunrise, clear) for the ending. Centre of the bailey at 0,0.
  function exterior(dawn) {
    const g = new THREE.Group();
    const earth = G3D.flatMat(dawn ? 'hillD' : 'hillN', dawn ? '#2a2420' : '#101216', 1);
    const hill = mesh(new THREE.CylinderGeometry(30, 58, 9, 48, 1), earth); hill.position.y = -4.5; g.add(hill);
    const valley = mesh(new THREE.PlaneGeometry(500, 500), G3D.flatMat('valley2', dawn ? '#1a1612' : '#05070a', 1), false, true); valley.rotation.x = -Math.PI / 2; valley.position.y = -9; g.add(valley);
    const bailey = mesh(new THREE.PlaneGeometry(36, 36), G3D.floorMat('cold', [10, 10]), false, true); bailey.rotation.x = -Math.PI / 2; bailey.position.y = 0.02; g.add(bailey);
    // Curtain walls with a gatehouse in the south wall
    const H = 7, half = 18;
    const wN = P.battlements(36, H, 'cold'); wN.position.set(0, 0, -half); g.add(wN);
    const wW = P.battlements(36, H, 'cold'); wW.rotation.y = Math.PI / 2; wW.position.set(-half, 0, 0); g.add(wW);
    const wE = P.battlements(36, H, 'cold'); wE.rotation.y = Math.PI / 2; wE.position.set(half, 0, 0); g.add(wE);
    [-1, 1].forEach(sx => { const w = P.battlements(14, H, 'cold'); w.position.set(sx * 11, 0, half); g.add(w); });
    const towerMat = G3D.stoneMat('cold', [6, 4], 'xtower'), slate = G3D.flatMat('slate', '#1a1c22', 0.8);
    const tower = (x, z, r, h) => {
      const t = mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 20), towerMat); t.position.set(x, h / 2, z); g.add(t);
      const roof = mesh(new THREE.ConeGeometry(r * 1.2, r * 1.9, 20), slate); roof.position.set(x, h + r * 0.95, z); g.add(roof);
      return t;
    };
    [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([x, z]) => tower(x, z, 2.8, 12));
    // Gatehouse
    [-3, 3].forEach(x => tower(x, half, 2.0, 11));
    const gate = mesh(new THREE.PlaneGeometry(3.6, 4.4), G3D.flatMat('void', '#010102', 1)); gate.position.set(0, 2.2, half + 0.62); g.add(gate);
    const lintel = mesh(new THREE.BoxGeometry(6, 3, 1.6), towerMat); lintel.position.set(0, H - 1.0, half); g.add(lintel);
    // The keep, its windows lit
    tower(-8, -8, 4.2, 22);
    const winMat = G3D.emissiveMat(dawn ? 'keepwinD' : 'keepwinN', '#ffaa50', dawn ? 0.6 : 2.4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, wv = mesh(new THREE.PlaneGeometry(0.6, 1.3), winMat, false, false); wv.position.set(-8 + Math.cos(a) * 4.25, 8 + (i % 3) * 4, -8 + Math.sin(a) * 4.25); wv.lookAt(-8 + Math.cos(a) * 9, wv.position.y, -8 + Math.sin(a) * 9); g.add(wv); }
    // The chapel: nave, gabled roof, glowing rose window over the doors (doors face +z at z=5)
    const cx = 5, cz0 = 5, len = 14, cw = 8, ch = 7;
    const nave = mesh(new THREE.BoxGeometry(cw, ch, len), G3D.stoneMat('warm', [5, 3.5], 'xnave')); nave.position.set(cx, ch / 2, cz0 - len / 2); g.add(nave);
    const gable = new THREE.Shape(); gable.moveTo(-cw / 2 - 0.3, 0); gable.lineTo(0, 4); gable.lineTo(cw / 2 + 0.3, 0); gable.closePath();
    const roof = mesh(new THREE.ExtrudeGeometry(gable, { depth: len + 0.6, bevelEnabled: false }), slate); roof.position.set(cx, ch, cz0 + 0.3); roof.rotation.y = Math.PI; g.add(roof);
    const rose = P.stainedWindow('rose', 3.0, dawn ? '#ffd8a0' : '#ffb070'); rose.position.set(cx, ch - 0.3, cz0 + 0.03); g.add(rose);
    const door = mesh(new THREE.PlaneGeometry(2.2, 3.4), G3D.flatMat('void', '#010102', 1)); door.position.set(cx, 1.7, cz0 + 0.02); g.add(door);
    const doorArch = P.gothicArch(2.6, 3.6, 0.5, G3D.stoneMat('warm', [1, 1], 'xdoor')); doorArch.position.set(cx, 0, cz0 + 0.15); g.add(doorArch);
    const spire = mesh(new THREE.ConeGeometry(1.2, 6, 8), slate); spire.position.set(cx, ch + 6.5, cz0 - 2); g.add(spire);
    const glowIn = new THREE.Object3D(); glowIn.position.set(cx, 3, cz0 + 1.5); g.add(glowIn); G3D.anchor(glowIn, '#ffb070', 2.2, 12, { flicker: 0.5, priority: 4 });
    // Braziers along the walk to the chapel
    [[cx - 2.6, cz0 + 4], [cx + 2.6, cz0 + 4]].forEach(([x, z]) => place(g, P.brazier('#ff8a30', 0.9), x, 0, z));
    place(g, P.well(), -4, 0, 9);
    place(g, P.deadTree(5), 10, 0, 10, 0, 1.3);
    if (!dawn) {
      // The Necromancer's corruption rising from the crypt
      const pit = new THREE.Vector3(-6, 0, 6);
      const beam = P.lightShaft(1.4, 3.2, 30, '#3aff5a', 0.32); beam.position.set(pit.x, 30, pit.z); beam.lookAt(pit.x, 0, pit.z); beam.rotateX(-Math.PI / 2); g.add(beam);
      const rc = P.runeCircle(3.4, '#38ff5a'); rc.position.set(pit.x, 0.04, pit.z); g.add(rc);
      const cg = G3D.glow('#3aff5a', 9, 0.45); cg.position.set(pit.x, 2, pit.z); g.add(cg);
      const ca = new THREE.Object3D(); ca.position.set(pit.x, 2.5, pit.z); g.add(ca); G3D.anchor(ca, '#3aff5a', 4, 22, { flicker: 1.2, priority: 6 });
      g.add(P.rain({ box: [-34, 34, -34, 40], top: 28, floor: 0, count: 5200, splashBox: [-14, 14, -10, 16], splashes: 300, wind: [1.6, 0.4] }));
      sky(g, { moon: [0.35, 0.42, -0.85], horizon: '#141a2a', clouds: true });
    } else {
      sky(g, { top: '#2a4a7a', horizon: '#ffae6a', moon: [0.55, 0.12, -0.83], clouds: true });
    }
    hills(g, dawn ? '#1a1418' : '#06080c');
    return spec({
      group: g, outdoor: true, lightning: !dawn,
      fog: dawn ? ['#3a2c30', 0.006] : ['#0a0e16', 0.012], bg: dawn ? '#2a2030' : '#06080e',
      vol: dawn ? { key: 1.2, density: 0.012, ambient: 0.5 } : { density: 0.012, key: 0.6, wet: 1, puddles: 1 },
      hemi: dawn ? ['#ffc8a0', '#3a2a28', 0.7] : ['#3a4a6a', '#0a0a0c', 0.4],
      key: dawn ? { type: 'dir', dir: [0.55, 0.22, -0.8], color: '#ffc080', intensity: 2.4, area: 34, center: [0, 0, 0] }
                : { type: 'dir', dir: [0.4, 0.55, -0.75], color: '#8ea8e0', intensity: 1.0, area: 34, center: [0, 0, 0] },
      grade: dawn ? { exposure: 1.2, tint: [1.08, 0.98, 0.9], sat: 1.05 } : { exposure: 1.15, tint: [0.92, 0.98, 1.1], sat: 0.95 },
      particles: dawn ? [{ type: 'dust', count: 160, box: [-14, 14, 1, 10, -10, 16], color: '#ffd8a0' }] : [{ type: 'ash', count: 200, box: [-16, 16, 0, 14, -14, 18], color: '#9aa0b0' }],
      cam: { pos: [0, 8, 50], look: [0, 4, 0], fovH: 70 },
      knight: { pos: [cx, 0, cz0 + 6], rot: Math.PI },
    });
  }
  R.exterior = () => exterior(false);
  R.exteriorDawn = () => exterior(true);

  // Map game room types to builders.
  G3D.roomTypeMap = {
    chapel: 'chapel', cloister: 'cloister', armory: 'armory', scriptorium: 'scriptorium', barracks: 'barracks',
    infirmary: 'infirmary', tower: 'tower', courtyard: 'courtyard', crypt: 'crypt', catacombs: 'catacombs',
    lair: 'lair', hall: 'hall', treasury: 'treasury', throne: 'throne', gallery: 'gallery', dungeon: 'dungeon', watchtower: 'watchtower',
    flooded: 'flooded', ossuary: 'ossuary', sanctum: 'sanctum',
  };
})();
