/* Knights Templar 3D — characters and props.
   Characters are rigged from primitives (hips/torso/head/arms/legs pivots) so
   they can be posed and animated procedurally; props register light anchors
   that the engine's light pool picks up. */
(function () {
  'use strict';
  const G3D = window.G3D;
  const { mat, mesh, merge, mtx } = G3D;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  G3D.uniforms = { time: { value: 0 } };

  // ── Flame (camera-facing, noise-animated, HDR for bloom) ───────────────────
  const FLAME_VS = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
      mv.xy += position.xy * sc;
      gl_Position = projectionMatrix * mv;
    }`;
  const FLAME_FS = `
    uniform float time; uniform vec3 color; uniform float seed; uniform float power;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main() {
      vec2 uv = vUv; uv.x -= 0.5;
      float t = time * 2.4 + seed * 17.0;
      float nz = n(vec2(uv.x * 5.0, uv.y * 4.0 - t * 2.2)) * 0.6 + n(vec2(uv.x * 11.0, uv.y * 9.0 - t * 3.7)) * 0.4;
      float w = (1.0 - uv.y) * 0.36 + 0.03;
      float x = uv.x + (nz - 0.5) * 0.32 * uv.y;
      float shape = smoothstep(w, w * 0.15, abs(x));
      shape *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.3 + nz * 0.35, uv.y);
      float core = smoothstep(w * 0.55, 0.0, abs(x)) * smoothstep(0.62, 0.05, uv.y);
      vec3 c = mix(color, vec3(1.0, 0.92, 0.7), core * 0.8);
      gl_FragColor = vec4(c * (shape * 1.5 + core * 2.1) * power, shape);
    }`;
  const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  flameGeo.userData.shared = true;
  G3D.flame = function (color, w, h, power) {
    const m = new THREE.ShaderMaterial({
      uniforms: { time: G3D.uniforms.time, color: { value: new THREE.Color(color) }, seed: { value: Math.random() }, power: { value: power || 1 } },
      vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const f = new THREE.Mesh(flameGeo, m);
    f.scale.set(w, h, 1);
    f.frustumCulled = false;
    f.renderOrder = 5;
    return f;
  };

  // Soft additive glow sprite.
  G3D.glow = function (color, size, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: G3D.glowTex(), color: new THREE.Color(color), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: (opacity == null ? 1 : opacity) * 0.42,
    }));
    s.scale.set(size, size, 1);
    s.renderOrder = 4;
    return s;
  };

  // Attach a light anchor the engine's light pool can claim.
  function anchor(obj, color, intensity, distance, opts) {
    obj.userData.light = Object.assign({ color: new THREE.Color(color), intensity, distance, flicker: 1, priority: 1 }, opts);
    return obj;
  }
  G3D.anchor = anchor;

  // ── Props ──────────────────────────────────────────────────────────────────
  G3D.props = {};
  const P = G3D.props;
  const iron = () => G3D.flatMat('iron', '#2a2826', 0.55, 0.85);
  const wax = () => G3D.flatMat('wax', '#e8dcc0', 0.6, 0, { emissive: new THREE.Color('#3a2a10'), emissiveIntensity: 0.6 });
  const bone = () => G3D.flatMat('bone', '#cbbf9f', 0.75, 0);
  const redCloth = () => G3D.mat('redcloth', () => new THREE.MeshStandardMaterial({ map: G3D.clothTex('red', { base: [130, 18, 22], trim: [180, 140, 60] }), roughness: 0.9, side: THREE.DoubleSide }));

  P.torch = function (flameScale) {
    const g = new THREE.Group();
    const s = flameScale || 1;
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.5, 8), G3D.woodMat(true)));
    const cup = mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.12, 10, 1, true), iron());
    cup.position.y = 0.27; g.add(cup);
    const brk = mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), iron()); brk.position.set(0, 0.05, -0.16); g.add(brk);
    const f = G3D.flame('#ff7a1a', 0.26 * s, 0.5 * s, 1.2); f.position.y = 0.3; g.add(f);
    const gl = G3D.glow('#ff8a30', 1.6 * s, 0.55); gl.position.y = 0.48; g.add(gl);
    const a = new THREE.Object3D(); a.position.set(0, 0.55, 0.15); g.add(a);
    anchor(a, '#ff8c3a', 2.4 * s, 9 * s);
    g.rotation.x = -0.25;
    return g;
  };

  P.candle = function (h) {
    h = h || 0.18;
    const g = new THREE.Group();
    const c = mesh(new THREE.CylinderGeometry(0.022, 0.025, h, 8), wax()); c.position.y = h / 2; g.add(c);
    const f = G3D.flame('#ffaa40', 0.06, 0.13, 1.1); f.position.y = h; g.add(f);
    return g;
  };
  P.candles = function (n, r, seed, lit) {
    const g = new THREE.Group(), R = G3D.rng(seed || 3);
    for (let i = 0; i < n; i++) {
      const c = P.candle(0.1 + R() * 0.25);
      const a = R() * 6.283, d = Math.sqrt(R()) * r;
      c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); g.add(c);
    }
    const gl = G3D.glow('#ffb050', r * 4 + 0.8, 0.5); gl.position.y = 0.3; g.add(gl);
    if (lit !== false) { const a = new THREE.Object3D(); a.position.y = 0.45; g.add(a); anchor(a, '#ffa64a', 1.6, 6, { flicker: 0.6 }); }
    return g;
  };

  P.pillar = function (h, r, tint) {
    const g = new THREE.Group();
    const sm = G3D.stoneMat(tint || '', [1, Math.max(1, Math.round(h / 3))], 'pil' + h);
    const shaft = mesh(new THREE.CylinderGeometry(r, r * 1.04, h - 0.7, 16), sm); shaft.position.y = h / 2; g.add(shaft);
    // Clustered shafts (gothic compound pier)
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const s = mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, h - 0.7, 10), sm);
      s.position.set(Math.cos(a) * r * 0.95, h / 2, Math.sin(a) * r * 0.95); g.add(s);
    }
    const base = mesh(new THREE.BoxGeometry(r * 2.9, 0.35, r * 2.9), sm); base.position.y = 0.175; g.add(base);
    const cap = mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.05, 0.35, 16), sm); cap.position.y = h - 0.35; g.add(cap);
    const ab = mesh(new THREE.BoxGeometry(r * 3, 0.18, r * 3), sm); ab.position.y = h - 0.09; g.add(ab);
    return g;
  };

  // Pointed (gothic) arch: two arcs whose centres sit on the springing line.
  P.gothicArch = function (span, rise, thick, matl) {
    const half = span / 2;
    const c = (rise * rise - half * half) / (2 * half); // offset of each arc centre
    const R = half + c;
    const arc = (radius, fromLeft) => {
      // Left arc is centred at (+c, 0); sample from the springing up to the apex.
      const apexY = Math.sqrt(Math.max(0, radius * radius - c * c));
      const a0 = Math.PI, a1 = Math.atan2(apexY, -c), out = [];
      for (let i = 0; i <= 20; i++) {
        const a = a0 + (a1 - a0) * (i / 20);
        const x = c + Math.cos(a) * radius, y = Math.sin(a) * radius;
        out.push(fromLeft ? [x, y] : [-x, y]);
      }
      return out;
    };
    const outerL = arc(R + thick, true), outerR = arc(R + thick, false).reverse();
    const innerR = arc(R, false), innerL = arc(R, true).reverse();
    const shape = new THREE.Shape();
    shape.moveTo(outerL[0][0], 0);
    outerL.forEach(p => shape.lineTo(p[0], p[1]));
    outerR.forEach(p => shape.lineTo(p[0], p[1]));
    innerR.forEach(p => shape.lineTo(p[0], p[1]));
    innerL.forEach(p => shape.lineTo(p[0], p[1]));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -thick / 2);
    return mesh(geo, matl);
  };

  P.altar = function () {
    const g = new THREE.Group();
    const sm = G3D.stoneMat('warm', [1, 1], 'altar');
    const base = mesh(new THREE.BoxGeometry(2.2, 1.0, 1.0), sm); base.position.y = 0.5; g.add(base);
    const top = mesh(new THREE.BoxGeometry(2.5, 0.14, 1.2), sm); top.position.y = 1.07; g.add(top);
    const cloth = mesh(new THREE.BoxGeometry(0.7, 0.02, 1.22), redCloth()); cloth.position.y = 1.15; g.add(cloth);
    const hang = mesh(new THREE.PlaneGeometry(0.7, 0.7), redCloth()); hang.position.set(0, 0.8, 0.611); g.add(hang);
    const c1 = P.candles(5, 0.18, 4); c1.position.set(-0.85, 1.14, 0); g.add(c1);
    const c2 = P.candles(5, 0.18, 9, false); c2.position.set(0.85, 1.14, 0); g.add(c2);
    // Golden cross
    const gold = G3D.metalMat('gold');
    const cr = new THREE.Group();
    const v = mesh(new THREE.BoxGeometry(0.07, 0.7, 0.05), gold); v.position.y = 0.35; cr.add(v);
    const hz = mesh(new THREE.BoxGeometry(0.4, 0.07, 0.05), gold); hz.position.y = 0.5; cr.add(hz);
    cr.position.set(0, 1.14, -0.25); g.add(cr);
    return g;
  };

  P.pew = function (broken, seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 1), wm = G3D.woodMat(true);
    const seat = mesh(new THREE.BoxGeometry(2.4, 0.08, 0.45), wm); seat.position.y = 0.45; g.add(seat);
    const back = mesh(new THREE.BoxGeometry(2.4, 0.6, 0.06), wm); back.position.set(0, 0.8, -0.22); g.add(back);
    [-1.1, 1.1].forEach(x => { const l = mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), wm); l.position.set(x, 0.22, 0); g.add(l); });
    if (broken) { g.rotation.z = (R() - 0.5) * 0.5; g.rotation.y = (R() - 0.5) * 0.6; g.position.y = -0.05; back.rotation.x = 0.6; }
    return g;
  };

  P.banner = function (w, h, kind) {
    const g = new THREE.Group();
    const tex = kind === 'black'
      ? G3D.clothTex('banblack', { base: [22, 18, 20], cross: [110, 14, 18], crossSize: 0.22, crossY: 0.38, tattered: true, stain: 0.6 })
      : kind === 'white'
        ? G3D.clothTex('banwhite', { base: [214, 206, 188], cross: [150, 16, 22], crossSize: 0.26, crossY: 0.4, trim: [160, 120, 50], tattered: true, stain: 0.35 })
        : G3D.clothTex('banred', { base: [118, 16, 20], cross: [200, 160, 70], crossSize: 0.24, crossY: 0.4, trim: [190, 150, 60], tattered: true, stain: 0.3 });
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.5 });
    const geo = new THREE.PlaneGeometry(w, h, 6, 12); geo.translate(0, -h / 2, 0);
    const cloth = mesh(geo, m); g.add(cloth);
    cloth.userData.sway = { base: geo.attributes.position.array.slice(), amp: 0.06, h, banner: true };
    const rod = mesh(new THREE.CylinderGeometry(0.025, 0.025, w + 0.2, 8), G3D.metalMat('gold')); rod.rotation.z = Math.PI / 2; g.add(rod);
    return g;
  };

  P.stainedWindow = function (kind, size, tint) {
    const g = new THREE.Group();
    const isRose = kind === 'rose';
    const tex = isRose ? G3D.stainedGlassTex() : G3D.lancetGlassTex();
    const glass = new THREE.Mesh(isRose ? new THREE.CircleGeometry(size / 2, 48) : new THREE.PlaneGeometry(size * 0.35, size),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(tint || '#ffffff').multiplyScalar(2.2), toneMapped: false }));
    g.add(glass);
    const sm = G3D.stoneMat('', [1, 1], 'win');
    if (isRose) {
      const ring = mesh(new THREE.TorusGeometry(size / 2 + 0.08, 0.14, 8, 48), sm); g.add(ring);
      for (let i = 0; i < 12; i++) {
        const sp = mesh(new THREE.BoxGeometry(0.05, size / 2, 0.06), sm);
        const a = i / 12 * Math.PI * 2; sp.position.set(Math.cos(a) * size / 4, Math.sin(a) * size / 4, 0.02); sp.rotation.z = a - Math.PI / 2; g.add(sp);
      }
    } else {
      const fr = mesh(new THREE.BoxGeometry(size * 0.35 + 0.3, 0.2, 0.3), sm); fr.position.y = -size / 2 - 0.1; g.add(fr);
      [-1, 1].forEach(s => { const side = mesh(new THREE.BoxGeometry(0.15, size + 0.2, 0.3), sm); side.position.x = s * (size * 0.175 + 0.075); g.add(side); });
      const arch = P.gothicArch(size * 0.35 + 0.3, size * 0.25, 0.3, sm); arch.position.y = size / 2; g.add(arch);
    }
    return g;
  };

  // Fake volumetric light shaft (additive, soft edges, drifting dust noise).
  const SHAFT_FS = `
    uniform float time; uniform vec3 color; uniform float strength;
    varying vec2 vUv; varying float vFade;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){
      float edge = 1.0;
      float along = smoothstep(0.0, 0.35, vUv.y) * pow(1.0 - vUv.y, 1.6);
      float dust = 0.65 + 0.35 * n(vec2(vUv.x * 8.0 + time * 0.05, vUv.y * 4.0 - time * 0.12));
      gl_FragColor = vec4(color * edge * along * dust * strength * vFade, 1.0);
    }`;
  const SHAFT_VS = `
    varying vec2 vUv; varying float vFade;
    void main(){
      vUv = uv;
      vec3 n = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vFade = pow(abs(dot(n, normalize(-mv.xyz))), 3.0);
      gl_Position = projectionMatrix * mv;
    }`;
  P.lightShaft = function (topW, botW, len, color, strength) {
    // Open cone from the light source: uv.y runs along the beam.
    const geo = new THREE.CylinderGeometry(topW, botW, len, 24, 1, true);
    geo.translate(0, -len / 2, 0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const m = new THREE.ShaderMaterial({
      uniforms: { time: G3D.uniforms.time, color: { value: new THREE.Color(color) }, strength: { value: strength || 0.35 } },
      vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const s = new THREE.Mesh(geo, m); s.renderOrder = 3;
    return s;
  };

  P.bookshelf = function (w, h, seed) {
    const g = new THREE.Group(), wm = G3D.woodMat(true), R = G3D.rng(seed || 2);
    const d = 0.4, shelves = Math.floor(h / 0.45);
    const back = mesh(new THREE.BoxGeometry(w, h, 0.04), wm); back.position.set(0, h / 2, -d / 2); g.add(back);
    [-1, 1].forEach(s => { const side = mesh(new THREE.BoxGeometry(0.06, h, d), wm); side.position.set(s * w / 2, h / 2, 0); g.add(side); });
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    const books = new THREE.InstancedMesh(bookGeo, G3D.flatMat('book', '#ffffff', 0.8), shelves * 22);
    books.castShadow = true; books.receiveShadow = true;
    const cols = ['#5a1a14', '#1e2a44', '#3a2a14', '#24361e', '#6a4a20', '#2a1a2a', '#4a3020'];
    let k = 0; const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let s = 0; s < shelves; s++) {
      const y = s * 0.45 + 0.05;
      const sh = mesh(new THREE.BoxGeometry(w, 0.04, d), wm); sh.position.set(0, y, 0); g.add(sh);
      let x = -w / 2 + 0.06;
      while (x < w / 2 - 0.1 && k < books.count) {
        const bw = 0.04 + R() * 0.05, bh = 0.25 + R() * 0.13, tilt = R() < 0.1 ? 0.25 : 0;
        if (R() < 0.08) { x += 0.12; continue; }
        m4.compose(V3(x + bw / 2, y + 0.02 + bh / 2, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)), V3(bw, bh, 0.26 + R() * 0.06));
        books.setMatrixAt(k, m4); books.setColorAt(k, col.set(cols[Math.floor(R() * cols.length)]));
        k++; x += bw + 0.004;
      }
    }
    books.count = k; g.add(books);
    return g;
  };

  P.desk = function () {
    const g = new THREE.Group(), wm = G3D.woodMat(false);
    const top = mesh(new THREE.BoxGeometry(1.4, 0.06, 0.8), wm); top.position.y = 0.9; top.rotation.x = 0.12; g.add(top);
    [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]].forEach(([x, z]) => { const l = mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), wm); l.position.set(x, 0.45, z); g.add(l); });
    const page = mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ map: G3D.parchmentTex(), roughness: 0.9, side: THREE.DoubleSide }));
    page.rotation.x = -Math.PI / 2 + 0.12; page.position.set(-0.1, 0.94, 0.02); g.add(page);
    const ink = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10), G3D.flatMat('ink', '#101010', 0.2)); ink.position.set(0.45, 0.97, -0.1); g.add(ink);
    const c = P.candles(2, 0.06, 12); c.position.set(0.5, 0.93, 0.15); g.add(c);
    return g;
  };

  P.bed = function (seed) {
    const g = new THREE.Group(), wm = G3D.woodMat(true), R = G3D.rng(seed || 4);
    const frame = mesh(new THREE.BoxGeometry(1.0, 0.3, 2.1), wm); frame.position.y = 0.3; g.add(frame);
    const matt = mesh(new THREE.BoxGeometry(0.92, 0.16, 2.0), G3D.flatMat('straw', '#8a7a56', 0.95)); matt.position.y = 0.53; g.add(matt);
    const blanket = mesh(new THREE.BoxGeometry(0.96, 0.08, 1.3), G3D.flatMat('blanket' + (seed % 3), ['#5a4a3a', '#d8d2c0', '#3a3028'][seed % 3], 0.95));
    blanket.position.set(0, 0.63, 0.3); blanket.rotation.z = (R() - 0.5) * 0.08; g.add(blanket);
    const head = mesh(new THREE.BoxGeometry(1.0, 0.7, 0.08), wm); head.position.set(0, 0.5, -1.05); g.add(head);
    return g;
  };

  P.barrel = function () {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.32 + Math.sin(t * Math.PI) * 0.07, t * 0.9)); }
    const g = new THREE.Group();
    g.add(mesh(new THREE.LatheGeometry(pts, 16), G3D.woodMat(false, [3, 1])));
    [0.15, 0.75].forEach(y => { const h = mesh(new THREE.TorusGeometry(0.36, 0.015, 6, 20), iron()); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); });
    const lid = mesh(new THREE.CircleGeometry(0.32, 16), G3D.woodMat(true)); lid.rotation.x = -Math.PI / 2; lid.position.y = 0.9; g.add(lid);
    return g;
  };
  P.crate = function (s) {
    s = s || 0.7;
    return mesh(new THREE.BoxGeometry(s, s, s), G3D.woodMat(false));
  };

  P.sword = function (metal, len) {
    const g = new THREE.Group(); len = len || 0.9;
    const sh = new THREE.Shape();
    sh.moveTo(-0.025, 0); sh.lineTo(-0.022, len * 0.85); sh.lineTo(0, len); sh.lineTo(0.022, len * 0.85); sh.lineTo(0.025, 0); sh.closePath();
    const blade = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1 }), metal);
    blade.position.z = -0.004; g.add(blade);
    const guard = mesh(new THREE.BoxGeometry(0.24, 0.025, 0.03), metal); g.add(guard);
    const grip = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), G3D.flatMat('leather', '#3a2416', 0.8)); grip.position.y = -0.09; g.add(grip);
    const pom = mesh(new THREE.SphereGeometry(0.03, 10, 8), metal); pom.position.y = -0.18; g.add(pom);
    return g;
  };

  P.weaponRack = function (seed) {
    const g = new THREE.Group(), wm = G3D.woodMat(true), R = G3D.rng(seed || 8);
    [-0.9, 0.9].forEach(x => { const p = mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), wm); p.position.set(x, 0.85, 0); g.add(p); });
    [0.35, 1.45].forEach(y => { const b = mesh(new THREE.BoxGeometry(1.9, 0.06, 0.1), wm); b.position.set(0, y, 0); g.add(b); });
    const steel = G3D.metalMat('steel');
    for (let i = 0; i < 5; i++) {
      const s = P.sword(steel, 1.0 + R() * 0.2); s.position.set(-0.7 + i * 0.35, 0.4, 0.06); s.rotation.z = (R() - 0.5) * 0.08; g.add(s);
    }
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Group();
      sp.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 6), wm));
      const tip = mesh(new THREE.ConeGeometry(0.045, 0.25, 4), steel); tip.position.y = 1.15; sp.add(tip);
      sp.position.set(-0.95 + i * 1.9, 1.05, 0.12); sp.rotation.z = (i ? -1 : 1) * 0.12; g.add(sp);
    }
    return g;
  };

  P.shieldMesh = function (kind) {
    const s = new THREE.Shape();
    s.moveTo(-0.26, 0.32); s.lineTo(0.26, 0.32); s.lineTo(0.26, 0.05);
    s.quadraticCurveTo(0.24, -0.28, 0, -0.42); s.quadraticCurveTo(-0.24, -0.28, -0.26, 0.05); s.closePath();
    const front = new THREE.ShapeGeometry(s, 12);
    const uv = front.attributes.uv, p = front.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.26) / 0.52, (p.getY(i) + 0.42) / 0.74);
    const tex = kind === 'gold'
      ? G3D.clothTex('shieldgold', { base: [235, 226, 205], cross: [180, 140, 40], crossSize: 0.3, crossY: 0.45 })
      : kind === 'risen'
        ? G3D.clothTex('shieldrisen', { base: [70, 66, 58], cross: [70, 14, 14], crossSize: 0.3, crossY: 0.45, stain: 0.9 })
        : G3D.clothTex('shield', { base: [200, 192, 176], cross: [150, 12, 18], crossSize: 0.3, crossY: 0.45, stain: 0.25 });
    const g = new THREE.Group();
    const f = mesh(front, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 })); f.position.z = 0.042; g.add(f);
    const body = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 }),
      kind === 'gold' ? G3D.metalMat('gold') : kind === 'risen' ? G3D.metalMat('rust') : G3D.metalMat('steel'));
    body.position.z = -0.025; g.add(body);
    return g;
  };

  P.armorStand = function () {
    const g = new THREE.Group(), wm = G3D.woodMat(true);
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), wm); post.position.y = 0.75; g.add(post);
    const base = mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.08, 12), wm); base.position.y = 0.04; g.add(base);
    const torso = mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 14), G3D.mailMat(false)); torso.position.y = 1.35; torso.scale.set(1.2, 1, 0.8); g.add(torso);
    const helm = makeGreatHelm(G3D.metalMat('steel')); helm.position.y = 1.85; g.add(helm);
    return g;
  };

  // Skull: cranium + jaw + dark sockets, vertex-coloured so many can be instanced.
  let skullGeo = null;
  function getSkullGeo() {
    if (skullGeo) return skullGeo;
    const parts = [
      [new THREE.SphereGeometry(0.1, 10, 7), mtx(0, 0.02, 0, 0, 0, 0, 1, 0.95, 1.12), [0.8, 0.75, 0.62]],
      [new THREE.BoxGeometry(0.11, 0.06, 0.08), mtx(0, -0.07, 0.045), [0.76, 0.7, 0.58]],
      [new THREE.SphereGeometry(0.03, 6, 4), mtx(-0.038, 0.0, 0.085), [0.05, 0.04, 0.03]],
      [new THREE.SphereGeometry(0.03, 6, 4), mtx(0.038, 0.0, 0.085), [0.05, 0.04, 0.03]],
      [new THREE.ConeGeometry(0.014, 0.03, 3), mtx(0, -0.035, 0.1, Math.PI, 0, 0), [0.08, 0.06, 0.05]],
    ];
    const geo = merge(parts.map(p => [p[0], p[1]]));
    const cols = []; parts.forEach(p => { const n = (p[0].index ? p[0].index.count : p[0].attributes.position.count); for (let i = 0; i < n; i++) cols.push(...p[2]); });
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.userData.shared = true;
    skullGeo = geo;
    return geo;
  }
  const skullMat = () => G3D.mat('skull', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  P.skull = function () { return mesh(getSkullGeo(), skullMat()); };

  // Instanced skulls/bones from a list of transforms.
  P.skullInstances = function (list) {
    const im = new THREE.InstancedMesh(getSkullGeo(), skullMat(), list.length);
    im.castShadow = true; im.receiveShadow = true;
    list.forEach((m, i) => im.setMatrixAt(i, m));
    return im;
  };
  let boneGeo = null;
  P.boneInstances = function (list) {
    if (!boneGeo) boneGeo = merge([
      [new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), null],
      [new THREE.SphereGeometry(0.035, 6, 5), mtx(0.015, 0.2, 0)], [new THREE.SphereGeometry(0.035, 6, 5), mtx(-0.015, 0.2, 0)],
      [new THREE.SphereGeometry(0.035, 6, 5), mtx(0.015, -0.2, 0)], [new THREE.SphereGeometry(0.035, 6, 5), mtx(-0.015, -0.2, 0)],
    ]);
    if (boneGeo) boneGeo.userData.shared = true;
    const im = new THREE.InstancedMesh(boneGeo, bone(), list.length);
    im.castShadow = true; im.receiveShadow = true;
    list.forEach((m, i) => im.setMatrixAt(i, m));
    return im;
  };
  P.bonePile = function (n, r, seed) {
    const R = G3D.rng(seed || 5), bones = [], skulls = [];
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * r, h = (1 - d / r) * r * 0.35;
      bones.push(mtx(Math.cos(a) * d, h + 0.03, Math.sin(a) * d, R() * 3, R() * 3, Math.PI / 2 + (R() - 0.5), 1));
      if (i % 4 === 0) skulls.push(mtx(Math.cos(a + 1) * d * 0.8, h + 0.08, Math.sin(a + 1) * d * 0.8, (R() - 0.5) * 0.8, R() * 6, (R() - 0.5) * 0.8, 1));
    }
    const g = new THREE.Group(); g.add(P.boneInstances(bones)); g.add(P.skullInstances(skulls));
    return g;
  };

  // Wall of niches packed with skulls (catacombs).
  P.ossuaryWall = function (len, h, seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 13);
    const sm = G3D.stoneMat('cold', [len / 3, h / 3], 'oss' + len);
    const wall = mesh(new THREE.BoxGeometry(len, h, 0.5), sm); wall.position.set(0, h / 2, -0.25); g.add(wall);
    const rows = Math.floor(h / 0.75), cols = Math.floor(len / 0.9), skulls = [];
    const niche = G3D.flatMat('niche', '#0a0908', 1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -len / 2 + 0.45 + c * 0.9, y = 0.5 + r * 0.75;
      const n = mesh(new THREE.BoxGeometry(0.72, 0.5, 0.06), niche, false, true); n.position.set(x, y, 0.005); g.add(n);
      const cnt = 2 + Math.floor(R() * 3);
      for (let k = 0; k < cnt; k++) skulls.push(mtx(x - 0.22 + k * 0.15 + (R() - 0.5) * 0.04, y - 0.12, 0.08, (R() - 0.5) * 0.3, (R() - 0.5) * 0.6, (R() - 0.5) * 0.2, 0.95 + R() * 0.15));
    }
    g.add(P.skullInstances(skulls));
    return g;
  };

  P.sarcophagus = function (tint) {
    const g = new THREE.Group(), sm = G3D.stoneMat(tint || 'cold', [1, 1], 'sarc');
    const box = mesh(new THREE.BoxGeometry(1.0, 0.8, 2.2), sm); box.position.y = 0.4; g.add(box);
    const lid = mesh(new THREE.BoxGeometry(1.1, 0.15, 2.3), sm); lid.position.y = 0.88; g.add(lid);
    // Carved effigy: a knight lying in state.
    const eff = G3D.makeKnight({ statue: true, tint: tint || 'cold' }).root;
    eff.rotation.x = -Math.PI / 2; eff.scale.setScalar(0.55); eff.position.set(0, 1.02, 0.5); g.add(eff);
    return g;
  };

  P.bell = function () {
    const g = new THREE.Group(), bronze = G3D.metalMat('bronze');
    const pts = [];
    const prof = [[0.05, 1.3], [0.35, 1.28], [0.5, 1.15], [0.55, 0.85], [0.6, 0.45], [0.75, 0.12], [0.82, 0.02], [0.78, 0]];
    prof.forEach(p => pts.push(new THREE.Vector2(p[0], p[1])));
    const b = mesh(new THREE.LatheGeometry(pts, 32), bronze); b.material.side = THREE.DoubleSide; g.add(b);
    const clap = mesh(new THREE.SphereGeometry(0.12, 12, 10), iron()); clap.position.y = 0.22; g.add(clap);
    const yoke = mesh(new THREE.BoxGeometry(2.6, 0.3, 0.3), G3D.woodMat(true)); yoke.position.y = 1.45; g.add(yoke);
    return g;
  };

  // Glowing runic circle (rotating, pulsing).
  P.runeCircle = function (r, color) {
    const m = new THREE.ShaderMaterial({
      uniforms: { time: G3D.uniforms.time, map: { value: G3D.runeTex() }, color: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float time; varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5; float a = time * 0.08; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
          float m = texture2D(map, r * c + 0.5).a;
          float pulse = 0.75 + 0.25 * sin(time * 2.0 + length(c) * 18.0);
          float halo = smoothstep(0.5, 0.0, length(c)) * 0.12;
          gl_FragColor = vec4(color * (m * 3.0 * pulse + halo), 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const c = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m);
    c.rotation.x = -Math.PI / 2; c.position.y = 0.02; c.renderOrder = 2;
    return c;
  };

  P.brazier = function (color, scale) {
    const g = new THREE.Group(), s = scale || 1;
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), iron());
      const a = i / 3 * Math.PI * 2; leg.position.set(Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2); leg.rotation.z = Math.cos(a) * 0.2; leg.rotation.x = -Math.sin(a) * 0.2; g.add(leg);
    }
    const bowl = mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), iron()); bowl.position.y = 1.15; g.add(bowl);
    const coals = mesh(new THREE.CircleGeometry(0.29, 16), G3D.emissiveMat('coal' + color, color, 1.5)); coals.rotation.x = -Math.PI / 2; coals.position.y = 1.12; g.add(coals);
    const f = G3D.flame(color, 0.7 * s, 1.1 * s, 1.3); f.position.y = 1.1; g.add(f);
    const gl = G3D.glow(color, 3.2 * s, 0.5); gl.position.y = 1.5; g.add(gl);
    const a = new THREE.Object3D(); a.position.y = 1.6; g.add(a);
    anchor(a, color, 2.0 * s, 11 * s, { flicker: 1.2 });
    g.scale.setScalar(s);
    return g;
  };

  P.coinPile = function (r, seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 21), n = Math.floor(r * r * 110);
    const gold = G3D.metalMat('gold');
    const mound = mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold); mound.scale.y = 0.42; g.add(mound);
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 8), gold, n);
    coins.castShadow = true; coins.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * r * 1.15, hh = Math.max(0, Math.sqrt(Math.max(0, r * r - d * d)) * 0.42);
      coins.setMatrixAt(i, mtx(Math.cos(a) * d, hh + 0.005, Math.sin(a) * d, (R() - 0.5) * 1.2, R() * 6, (R() - 0.5) * 1.2, 1));
    }
    g.add(coins);
    return g;
  };

  P.chest = function (open) {
    const g = new THREE.Group(), wm = G3D.woodMat(false), gold = G3D.metalMat('gold');
    const box = mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), wm); box.position.y = 0.25; g.add(box);
    const lid = new THREE.Group();
    const lm = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 12, 1, false, 0, Math.PI), wm); lm.rotation.z = Math.PI / 2; lid.add(lm);
    lid.position.set(0, 0.5, -0.3);
    lm.position.z = 0.3;
    if (open) lid.rotation.x = -1.9;
    g.add(lid);
    [-0.45, 0.45].forEach(x => { const b = mesh(new THREE.BoxGeometry(0.05, 0.52, 0.62), gold); b.position.set(x, 0.26, 0); g.add(b); });
    if (open) {
      const fill = mesh(new THREE.BoxGeometry(0.92, 0.05, 0.52), gold); fill.position.y = 0.48; g.add(fill);
      const gl = G3D.glow('#ffcc66', 1.5, 0.5); gl.position.y = 0.7; g.add(gl);
    }
    return g;
  };

  P.boneThrone = function () {
    const g = new THREE.Group(), R = G3D.rng(666);
    const sm = G3D.stoneMat('blood', [1, 1], 'throne');
    const step = mesh(new THREE.BoxGeometry(3.2, 0.3, 2.4), sm); step.position.y = 0.15; g.add(step);
    const step2 = mesh(new THREE.BoxGeometry(2.4, 0.3, 1.8), sm); step2.position.set(0, 0.45, -0.2); g.add(step2);
    const seat = mesh(new THREE.BoxGeometry(1.3, 0.6, 1.0), sm); seat.position.set(0, 0.9, -0.4); g.add(seat);
    const back = mesh(new THREE.BoxGeometry(1.4, 2.6, 0.3), sm); back.position.set(0, 2.2, -0.9); g.add(back);
    const bones = [], skulls = [];
    // Bones fan out behind the back like a crown of spikes.
    for (let i = 0; i < 26; i++) {
      const a = -1.25 + i / 25 * 2.5, L = 1.1 + R() * 1.2;
      bones.push(mtx(Math.sin(a) * 0.8, 3.0 + Math.cos(a) * 0.6, -0.95, 0, 0, -a, 1, L / 0.4 * 0.5, 1));
    }
    for (let i = 0; i < 30; i++) bones.push(mtx((R() - 0.5) * 2.6, 0.35 + R() * 0.2, 0.4 + (R() - 0.5) * 1.4, R() * 3, R() * 3, R() * 3));
    for (let i = 0; i < 9; i++) skulls.push(mtx(-0.6 + i * 0.15, 3.45 - Math.abs(i - 4) * 0.08, -0.72, 0.1, 0, 0, 1.1));
    for (let i = 0; i < 6; i++) skulls.push(mtx((i < 3 ? -0.68 : 0.68), 0.95 + (i % 3) * 0.28, -0.1 - (i % 3) * 0.25, 0, (i < 3 ? 0.6 : -0.6), 0, 1));
    for (let i = 0; i < 14; i++) skulls.push(mtx((R() - 0.5) * 3.0, 0.4, 0.9 + R() * 0.6, (R() - 0.5), R() * 6, (R() - 0.5)));
    g.add(P.boneInstances(bones)); g.add(P.skullInstances(skulls));
    // Glowing eyes on the crown skull
    const eye = G3D.glow('#ff2a1a', 0.5, 0.9); eye.position.set(0, 3.47, -0.6); g.add(eye);
    return g;
  };

  P.portrait = function (i, w, h) {
    const g = new THREE.Group(), gold = G3D.metalMat('gold', { extra: { roughness: 0.6 } });
    const pic = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: G3D.portraitTex(i), roughness: 0.55 }), false); pic.position.z = 0.03; g.add(pic);
    const t = 0.12;
    [[0, h / 2 + t / 2, w + 2 * t, t], [0, -h / 2 - t / 2, w + 2 * t, t], [-w / 2 - t / 2, 0, t, h], [w / 2 + t / 2, 0, t, h]].forEach(([x, y, fw, fh]) => {
      const f = mesh(new THREE.BoxGeometry(fw, fh, 0.1), gold); f.position.set(x, y, 0.03); g.add(f);
    });
    return g;
  };

  P.bars = function (w, h) {
    const g = new THREE.Group();
    const n = Math.floor(w / 0.18);
    const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, h, 6), iron(), n);
    bars.castShadow = true;
    for (let i = 0; i < n; i++) bars.setMatrixAt(i, mtx(-w / 2 + 0.09 + i * 0.18, h / 2, 0));
    g.add(bars);
    [0.15, h - 0.15, h / 2].forEach(y => { const b = mesh(new THREE.BoxGeometry(w, 0.05, 0.05), iron()); b.position.y = y; g.add(b); });
    return g;
  };

  P.chain = function (len, seed) {
    const n = Math.floor(len / 0.09), R = G3D.rng(seed || 3);
    const im = new THREE.InstancedMesh(new THREE.TorusGeometry(0.04, 0.012, 5, 10), iron(), n);
    im.castShadow = true;
    const sway = (R() - 0.5) * 0.1;
    for (let i = 0; i < n; i++) im.setMatrixAt(i, mtx(Math.sin(i * 0.1) * sway, -i * 0.085, 0, 0, (i % 2) * Math.PI / 2, Math.PI / 2));
    const g = new THREE.Group(); g.add(im);
    const shackle = mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 14), iron()); shackle.position.y = -n * 0.085 - 0.06; g.add(shackle);
    g.userData.swing = 0.025; g.userData.chain = { len: n * 0.085 };   // game3d/life.js lets the knight brush them
    return g;
  };

  P.longTable = function (len) {
    const g = new THREE.Group(), wm = G3D.woodMat(true, [len / 2, 1]);
    const top = mesh(new THREE.BoxGeometry(1.4, 0.1, len), wm); top.position.y = 0.95; g.add(top);
    for (let z = -len / 2 + 0.4; z <= len / 2 - 0.3; z += (len - 0.8) / 3) [-0.55, 0.55].forEach(x => { const l = mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wm); l.position.set(x, 0.45, z); g.add(l); });
    const R = G3D.rng(4);
    for (let z = -len / 2 + 0.6; z < len / 2; z += 1.1) {
      if (R() < 0.5) { const c = P.candles(3, 0.08, Math.floor(z * 10) + 50, R() < 0.35); c.position.set((R() - 0.5) * 0.4, 1.0, z); g.add(c); }
      if (R() < 0.6) { const gob = mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.14, 8), G3D.metalMat('gold')); gob.position.set((R() - 0.5) * 0.9, 1.07, z + 0.3); if (R() < 0.3) { gob.rotation.z = Math.PI / 2; gob.position.y = 1.04; } g.add(gob); }
    }
    return g;
  };

  P.chandelier = function (r) {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(r, 0.035, 6, 32), iron()); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 4; i++) { const ch = P.chain(2.4, i); ch.position.set(Math.cos(i * 1.57) * r * 0.9, 2.4, Math.sin(i * 1.57) * r * 0.9); ch.children[1].visible = false; g.add(ch); }
    for (let i = 0; i < 10; i++) { const c = P.candle(0.15); c.position.set(Math.cos(i / 10 * 6.28) * r, 0.03, Math.sin(i / 10 * 6.28) * r); g.add(c); }
    const gl = G3D.glow('#ffb050', r * 4, 0.35); g.add(gl);
    const a = new THREE.Object3D(); a.position.y = -0.2; g.add(a); anchor(a, '#ffa850', 2.2, 10, { flicker: 0.4 });
    return g;
  };

  P.fireplace = function () {
    const g = new THREE.Group(), sm = G3D.stoneMat('warm', [1, 1], 'hearth');
    [-1.3, 1.3].forEach(x => { const s = mesh(new THREE.BoxGeometry(0.5, 2.0, 0.9), sm); s.position.set(x, 1.0, 0); g.add(s); });
    const lintel = mesh(new THREE.BoxGeometry(3.2, 0.5, 1.0), sm); lintel.position.set(0, 2.2, 0); g.add(lintel);
    const hood = mesh(new THREE.BoxGeometry(2.6, 2.4, 0.7), sm); hood.position.set(0, 3.6, -0.15); g.add(hood);
    const back = mesh(new THREE.BoxGeometry(2.2, 2.0, 0.1), G3D.flatMat('soot', '#0c0a08', 1)); back.position.set(0, 1.0, -0.4); g.add(back);
    for (let i = 0; i < 3; i++) { const l = mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.2, 8), G3D.woodMat(true)); l.rotation.z = Math.PI / 2; l.rotation.y = (i - 1) * 0.4; l.position.set(0, 0.12 + (i === 1 ? 0.12 : 0), 0); g.add(l); }
    const embers = mesh(new THREE.CircleGeometry(0.7, 16), G3D.emissiveMat('embers', '#ff5a10', 2)); embers.rotation.x = -Math.PI / 2; embers.position.y = 0.03; g.add(embers);
    [-0.35, 0.05, 0.4].forEach((x, i) => { const f = G3D.flame('#ff6a10', 0.6, 1.0 + i * 0.15, 1.4); f.position.set(x, 0.1, 0.05); g.add(f); });
    const gl = G3D.glow('#ff7020', 4, 0.6); gl.position.set(0, 0.8, 0.3); g.add(gl);
    const a = new THREE.Object3D(); a.position.set(0, 0.9, 0.8); g.add(a); anchor(a, '#ff7a2a', 2.8, 12, { flicker: 1.4, priority: 3 });
    return g;
  };

  P.well = function () {
    const g = new THREE.Group(), sm = G3D.stoneMat('', [3, 1], 'well');
    const ring = mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.9, 20, 1, true), sm); ring.position.y = 0.45; ring.material.side = THREE.DoubleSide; g.add(ring);
    const rim = mesh(new THREE.TorusGeometry(0.92, 0.1, 6, 24), sm); rim.rotation.x = Math.PI / 2; rim.position.y = 0.9; g.add(rim);
    const water = mesh(new THREE.CircleGeometry(0.88, 20), G3D.flatMat('water', '#05080a', 0.05, 0.2)); water.rotation.x = -Math.PI / 2; water.position.y = 0.4; g.add(water);
    [-0.9, 0.9].forEach(x => { const p = mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), G3D.woodMat(true)); p.position.set(x, 1.5, 0); g.add(p); });
    const bar = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8), G3D.woodMat(true)); bar.rotation.z = Math.PI / 2; bar.position.y = 2.2; g.add(bar);
    const roof = mesh(new THREE.ConeGeometry(1.4, 0.9, 4), G3D.woodMat(true)); roof.position.y = 2.75; roof.rotation.y = Math.PI / 4; g.add(roof);
    return g;
  };

  P.deadTree = function (seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 9), bark = G3D.flatMat('bark', '#1c1610', 0.95);
    function branch(parent, len, rad, depth) {
      const b = mesh(new THREE.CylinderGeometry(rad * 0.65, rad, len, 6), bark);
      b.position.y = len / 2; const pivot = new THREE.Group(); pivot.add(b); parent.add(pivot);
      if (depth > 0) for (let i = 0; i < 2 + (R() < 0.4 ? 1 : 0); i++) {
        const child = new THREE.Group(); child.position.y = len * (0.7 + R() * 0.3);
        child.rotation.set((R() - 0.5) * 1.4, R() * 6.28, (R() - 0.5) * 1.4); pivot.add(child);
        branch(child, len * (0.55 + R() * 0.2), rad * 0.6, depth - 1);
      }
      return pivot;
    }
    branch(g, 2.4, 0.22, 4);
    return g;
  };

  P.battlements = function (len, h, tint) {
    const g = new THREE.Group(), sm = G3D.stoneMat(tint || '', [len / 3, h / 3], 'bat' + len + h);
    const wall = mesh(new THREE.BoxGeometry(len, h, 1.2), sm); wall.position.y = h / 2; g.add(wall);
    const n = Math.floor(len / 1.2);
    for (let i = 0; i < n; i++) { const m = mesh(new THREE.BoxGeometry(0.7, 0.8, 1.2), sm); m.position.set(-len / 2 + 0.6 + i * 1.2, h + 0.4, 0); g.add(m); }
    return g;
  };

  P.stairsDown = function (w, steps, tint) {
    const g = new THREE.Group(), sm = G3D.stoneMat(tint || 'cold', [1, 1], 'step');
    for (let i = 0; i < steps; i++) { const s = mesh(new THREE.BoxGeometry(w, 0.25, 0.5), sm); s.position.set(0, -0.125 - i * 0.25, -i * 0.5); g.add(s); }
    return g;
  };

  P.shelfBottles = function (w, seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 6), wm = G3D.woodMat(true);
    [0.9, 1.5, 2.1].forEach(y => {
      const sh = mesh(new THREE.BoxGeometry(w, 0.05, 0.35), wm); sh.position.y = y; g.add(sh);
      for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.18 + R() * 0.12) {
        const col = ['#2a5a2a', '#5a3a1a', '#2a3a5a', '#6a6a50'][Math.floor(R() * 4)];
        const b = mesh(new THREE.CylinderGeometry(0.04 + R() * 0.03, 0.05 + R() * 0.03, 0.18 + R() * 0.12, 10),
          G3D.flatMat('glass' + col, col, 0.1, 0.0, { transparent: true, opacity: 0.85, emissive: new THREE.Color(col), emissiveIntensity: 0.25 }));
        b.position.set(x, y + 0.12, (R() - 0.5) * 0.15); g.add(b);
      }
    });
    return g;
  };

  P.herbs = function (len, seed) {
    const g = new THREE.Group(), R = G3D.rng(seed || 7);
    for (let x = -len / 2; x < len / 2; x += 0.35) {
      const drop = 0.2 + R() * 0.4;
      const str = mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 3), G3D.flatMat('string', '#6a5a3a', 1), false); str.position.set(x, -drop / 2, 0); g.add(str);
      const h = mesh(new THREE.ConeGeometry(0.05, 0.22, 6), G3D.flatMat('herb' + (Math.floor(x * 3) % 2), Math.floor(x * 3) % 2 ? '#3a4a22' : '#5a4a2a', 0.95));
      h.position.set(x, -drop - 0.08, 0); h.rotation.x = Math.PI; g.add(h);
    }
    return g;
  };

  // Relic on a stone pedestal, haloed in light so it reads as "take me".
  P.relic = function (name) {
    const g = new THREE.Group(), sm = G3D.stoneMat('warm', [1, 1], 'ped');
    const ped = mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 10), sm); ped.position.y = 0.5; g.add(ped);
    const top = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 10), sm); top.position.y = 1.04; g.add(top);
    const gold = G3D.metalMat('gold', { extra: { emissive: new THREE.Color('#ffaa33'), emissiveIntensity: 0.35 } });
    const item = new THREE.Group(); item.position.y = 1.45;
    const n = (name || '').toLowerCase();
    if (n.includes('sword')) { const s = P.sword(gold, 0.9); s.rotation.z = Math.PI; s.position.y = 0.4; item.add(s); }
    else if (n.includes('map')) { const s = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 12), new THREE.MeshStandardMaterial({ map: G3D.parchmentTex(), roughness: 0.8 })); s.rotation.z = Math.PI / 2; item.add(s); }
    else if (n.includes('chainmail') || n.includes('hauberk')) { const t = mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.45, 14), G3D.mailMat(false)); t.scale.set(1.2, 1, 0.8); item.add(t); }
    else if (n.includes('water')) { const f = mesh(new THREE.SphereGeometry(0.13, 16, 12), G3D.flatMat('holy', '#88ccff', 0.05, 0, { transparent: true, opacity: 0.75, emissive: new THREE.Color('#4aa8ff'), emissiveIntensity: 1.2 })); item.add(f); const nk = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8), gold); nk.position.y = 0.16; item.add(nk); }
    else if (n.includes('candle')) { for (let i = 0; i < 3; i++) { const c = P.candle(0.25 + i * 0.05); c.position.x = (i - 1) * 0.1; c.position.y = -0.2; item.add(c); } }
    else if (n.includes('rosary')) { for (let i = 0; i < 22; i++) { const b = mesh(new THREE.SphereGeometry(0.022, 6, 5), iron()); const a = i / 22 * 6.28; b.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.2, 0); item.add(b); } const cr = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.02), gold); cr.position.y = -0.3; item.add(cr); }
    else { item.add(mesh(new THREE.OctahedronGeometry(0.16), gold)); }
    item.userData.spin = true; g.add(item);
    const gl = G3D.glow('#ffd27a', 1.8, 0.65); gl.position.y = 1.45; g.add(gl);
    const shaft = P.lightShaft(0.15, 0.5, 4, '#ffd890', 0.25); shaft.position.y = 5.2; g.add(shaft);
    const a = new THREE.Object3D(); a.position.y = 2.0; g.add(a); anchor(a, '#ffd27a', 1.8, 5, { flicker: 0.1, priority: 2 });
    return g;
  };

  P.scrollGlow = function () {
    const g = new THREE.Group();
    const s = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), new THREE.MeshStandardMaterial({ map: G3D.parchmentTex(), roughness: 0.8, emissive: new THREE.Color('#ffcc77'), emissiveIntensity: 0.3 }));
    s.rotation.z = Math.PI / 2; s.position.y = 0.06; g.add(s);
    const seal = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), G3D.flatMat('seal', '#8a1010', 0.4)); seal.rotation.x = Math.PI / 2; seal.position.set(0, 0.06, 0.055); g.add(seal);
    const gl = G3D.glow('#ffe0a0', 0.9, 0.7); gl.position.y = 0.12; g.add(gl);
    g.userData.bob = true;
    return g;
  };

  // ── Characters ─────────────────────────────────────────────────────────────
  // Lathe a profile given bottom → top as [radius, y] pairs (outward normals).
  // phi0 = π puts the texture seam at the back (u = 0.5 faces front).
  const lathe = (pts, seg, phi0) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 24, phi0 || 0);
  // Merge pieces that share a material into one mesh: [[geometry, matrix], …].
  const merged = (parts, matl, cast) => mesh(merge(parts), matl, cast);
  // A rib: a torus arc laid flat around the chest, swung `ry` round from the side.
  const ribAt = (y, z, ry, s) => new THREE.Matrix4().makeTranslation(0, y, z)
    .multiply(new THREE.Matrix4().makeScale(1.22 * s, 1, 0.8 * s))
    .multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  // Templar great helm: flat-topped barrel, a brass cross on the face (brow
  // band and nasal strip), eye slits and a cross of breaths on the right cheek.
  function makeGreatHelm(metal, eyeColor) {
    const g = new THREE.Group();
    const shell = mesh(lathe([[0.146, -0.152], [0.144, -0.09], [0.14, 0.0], [0.136, 0.08], [0.131, 0.13], [0.118, 0.158], [0.07, 0.17], [0.0, 0.172]], 36), metal);
    shell.scale.set(1, 1, 1.04); g.add(shell);
    const brass = eyeColor ? metal : G3D.metalMat('bronze');
    const dark = eyeColor ? G3D.emissiveMat('eyes' + eyeColor, eyeColor, 6) : G3D.flatMat('slit', '#020202', 1);
    // Eye slits either side of the nasal, slightly swept back.
    [-1, 1].forEach(s => { const slit = mesh(new THREE.BoxGeometry(0.09, 0.016, 0.04), dark, false); slit.position.set(s * 0.058, 0.045, 0.13); slit.rotation.y = s * 0.32; g.add(slit); });
    const trim = [];
    trim.push([new THREE.BoxGeometry(0.032, 0.3, 0.018), mtx(0, -0.004, 0.148)]);                       // nasal / face strip
    trim.push([new THREE.TorusGeometry(0.143, 0.011, 6, 36), mtx(0, 0.066, 0, Math.PI / 2, 0, 0, 1, 1.04, 1)]); // brow band
    trim.push([new THREE.TorusGeometry(0.149, 0.009, 6, 36), mtx(0, -0.15, 0, Math.PI / 2, 0, 0, 1, 1.04, 1)]); // rim
    trim.push([new THREE.TorusGeometry(0.12, 0.008, 6, 32), mtx(0, 0.158, 0, Math.PI / 2)]);                   // crown edge
    for (let i = 0; i < 10; i++) { const a = (i / 10 - 0.5) * 2.2; trim.push([new THREE.SphereGeometry(0.008, 6, 4), mtx(Math.sin(a) * 0.148, 0.066, Math.cos(a) * 0.154)]); }
    const t = merged(trim, brass); g.add(t);
    // Breaths in a cross on the right cheek.
    const holes = [];
    [[0, 0], [0, 1], [0, -1], [0, 2], [1, 0], [-1, 0]].forEach(([a, b]) => holes.push([new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 5), mtx(0.075 + a * 0.019, -0.045 + b * 0.019, 0.122, Math.PI / 2, 0, -0.5)]));
    g.add(merged(holes, G3D.flatMat('slit', '#020202', 1), false));
    return g;
  }

  // A tapered limb with a little muscle swell, hanging from its joint.
  function limb(len, r0, r1, matl) {
    const m = mesh(lathe([[r1 * 0.88, -len], [r1, -len * 0.94], [r1 * 1.02, -len * 0.75], [(r0 + r1) * 0.53, -len * 0.45], [r0 * 1.05, -len * 0.18], [r0 * 0.96, -len * 0.04], [r0 * 0.7, 0]], 16), matl);
    return m;
  }

  // Generic humanoid rig: root at the feet; hips at 0.95. o: materials and
  // options { leg, shin?, boot, greave, torso, arm, fore, hand, pauldron,
  // joint (knee and elbow cops), gauntlet, sabaton }.
  function rig(o) {
    const R = {};
    R.root = new THREE.Group();
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 0.95; R.body.add(R.hips);
    ['L', 'R'].forEach((side, i) => {
      const s = i ? 1 : -1;
      const leg = new THREE.Group(); leg.position.set(s * 0.1, 0, 0); R.hips.add(leg);
      leg.add(limb(0.46, 0.088, 0.066, o.leg));
      const shin = new THREE.Group(); shin.position.y = -0.46; leg.add(shin);
      shin.add(limb(0.44, 0.066, 0.048, o.shin || o.leg));
      shin.add(mesh(new THREE.SphereGeometry(0.066, 14, 10), o.leg));                                   // knee
      if (o.greave) { const gr = mesh(lathe([[0.058, -0.32], [0.068, -0.2], [0.076, -0.08], [0.07, 0]], 16), o.greave); gr.position.set(0, -0.06, 0.012); shin.add(gr); }
      if (o.joint) {
        // Poleyn: a domed knee cop with a side fan.
        const cop = mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), o.joint); cop.rotation.x = Math.PI / 2; cop.scale.set(1, 0.7, 1); cop.position.set(0, 0, 0.03); shin.add(cop);
        const fan = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 14), o.joint); fan.rotation.z = Math.PI / 2; fan.position.set(s * 0.065, 0, 0.01); shin.add(fan);
      }
      // Foot: a sabaton with a pointed toe for armour, a plain shoe otherwise.
      const foot = new THREE.Group(); foot.position.set(0, -0.47, 0.03); shin.add(foot);
      foot.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.17), o.boot));
      const toe = mesh(new THREE.ConeGeometry(0.052, o.sabaton ? 0.16 : 0.1, 10), o.boot); toe.rotation.x = Math.PI / 2; toe.scale.set(1, 1, 0.62); toe.position.set(0, -0.008, 0.12); foot.add(toe);
      if (o.sabaton) for (let k = 0; k < 3; k++) { const l = mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.02, 12, 1, false, -Math.PI / 2, Math.PI), o.boot); l.rotation.z = Math.PI / 2; l.rotation.y = Math.PI / 2; l.position.set(0, 0.03, 0.02 + k * 0.035); foot.add(l); }
      R['leg' + side] = leg; R['shin' + side] = shin;
    });
    R.torso = new THREE.Group(); R.hips.add(R.torso);
    // Torso: waist, ribcage and chest, rounding into the shoulders.
    const chest = mesh(lathe([[0.16, 0], [0.172, 0.08], [0.198, 0.22], [0.222, 0.37], [0.226, 0.46], [0.206, 0.54], [0.15, 0.6], [0.07, 0.645], [0.0, 0.65]], 28), o.torso);
    chest.scale.set(1.22, 1, 0.76); R.torso.add(chest);
    R.chest = chest;
    ['L', 'R'].forEach((side, i) => {
      const s = i ? 1 : -1;
      const arm = new THREE.Group(); arm.position.set(s * 0.29, 0.54, 0); R.torso.add(arm);
      arm.add(mesh(new THREE.SphereGeometry(0.068, 14, 10), o.arm));                                       // shoulder
      arm.add(limb(0.3, 0.062, 0.05, o.arm));
      if (o.pauldron) {
        // Layered pauldron: three overlapping lames.
        const lames = [];
        for (let k = 0; k < 3; k++) lames.push([new THREE.SphereGeometry(0.1 - k * 0.008, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mtx(s * (0.012 + k * 0.006), 0.035 - k * 0.04, 0, 0, 0, s * (0.25 + k * 0.12), 1.12, 0.7, 1.1)]);
        arm.add(merged(lames, o.pauldron));
      }
      const fore = new THREE.Group(); fore.position.y = -0.3; arm.add(fore);
      fore.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), o.arm));                                       // elbow
      fore.add(limb(0.27, 0.05, 0.04, o.fore || o.arm));
      if (o.joint) { const cop = mesh(new THREE.SphereGeometry(0.058, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.joint); cop.rotation.x = -Math.PI / 2; cop.scale.set(1, 0.6, 1); cop.position.z = -0.02; fore.add(cop); }
      // Hand: a gauntlet with a flared cuff, or a bare hand.
      const hand = new THREE.Group(); hand.position.y = -0.3; fore.add(hand);
      if (o.gauntlet) { const cuff = mesh(new THREE.CylinderGeometry(0.062, 0.044, 0.09, 14, 1, true), o.hand); cuff.position.y = 0.02; hand.add(cuff); }
      const palm = mesh(new THREE.BoxGeometry(0.072, 0.075, 0.05), o.hand); palm.position.y = -0.03; hand.add(palm);
      const fingers = mesh(new THREE.BoxGeometry(0.068, 0.06, 0.042), o.hand); fingers.position.set(0, -0.08, 0.012); fingers.rotation.x = 0.5; hand.add(fingers);
      const thumb = mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.055, 6), o.hand); thumb.position.set(-s * 0.04, -0.04, 0.025); thumb.rotation.set(0.6, 0, -s * 0.5); hand.add(thumb);
      const grip = new THREE.Group(); grip.position.y = -0.31; fore.add(grip);
      R['arm' + side] = arm; R['fore' + side] = fore; R['grip' + side] = grip;
    });
    R.neck = new THREE.Group(); R.neck.position.y = 0.66; R.torso.add(R.neck);
    R.head = new THREE.Group(); R.head.position.y = 0.1; R.neck.add(R.head);
    return R;
  }

  // Hang a cloth skirt / surcoat around the hips; returns the mesh.
  function skirt(R, tex, len, flare, tattered) {
    const geo = new THREE.CylinderGeometry(0.255, flare, len, 28, 6, true, Math.PI, Math.PI * 2);
    geo.translate(0, -len / 2 + 0.06, 0);
    const m = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide, alphaTest: tattered ? 0.5 : 0 }));
    m.scale.set(1.15, 1, 0.82);
    m.userData.sway = { base: geo.attributes.position.array.slice(), amp: 0.025, skirt: true };
    R.hips.add(m);
    return m;
  }

  function cape(R, tex, w, h) {
    const geo = new THREE.PlaneGeometry(w, h, 6, 10); geo.translate(0, -h / 2, 0);
    // Curve it around the back
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -Math.cos(x / w * Math.PI) * 0.12); }
    const m = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.5 }));
    m.position.set(0, 0.6, -0.17);
    m.userData.sway = { base: p.array.slice(), amp: 0.05, h, cape: true, colliders: bodyColliders(R) };
    R.torso.add(m);
    return m;
  }
  // Ellipsoids the cape drapes over (game3d/cloth.js): chest and back, the
  // skirt, thighs and shins.
  function bodyColliders(R) {
    const c = [
      { obj: R.torso, c: [0, 0.32, 0], r: [0.28, 0.44, 0.21] },
      { obj: R.hips, c: [0, -0.22, 0], r: [0.36, 0.5, 0.29] },
    ];
    ['L', 'R'].forEach(s => {
      if (R['leg' + s]) c.push({ obj: R['leg' + s], c: [0, -0.23, 0], r: [0.12, 0.3, 0.12] });
      if (R['shin' + s]) c.push({ obj: R['shin' + s], c: [0, -0.24, 0], r: [0.1, 0.3, 0.11] });
    });
    return c;
  }

  // Sword belt with a buckle, and the empty scabbard on the left hip.
  function swordBelt(R, beltMat, buckleMat, leather, chape) {
    const belt = mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 28), beltMat);
    belt.rotation.x = Math.PI / 2; belt.scale.set(1.24, 0.79, 1); belt.position.y = 0.03; R.torso.add(belt);
    const buckle = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), buckleMat); buckle.position.set(0, 0.03, 0.16); R.torso.add(buckle);
    const tongue = mesh(new THREE.BoxGeometry(0.04, 0.12, 0.012), beltMat); tongue.position.set(0.015, -0.04, 0.165); tongue.rotation.z = 0.15; R.torso.add(tongue);
    const sc = new THREE.Group(); sc.position.set(-0.25, -0.02, -0.02); sc.rotation.set(0.45, 0, 0.12); R.hips.add(sc);
    const sh = mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.78, 10), leather); sh.scale.set(1.7, 1, 0.6); sh.position.y = -0.39; sc.add(sh);
    const tip = mesh(new THREE.ConeGeometry(0.03, 0.08, 10), chape); tip.rotation.x = Math.PI; tip.scale.set(1.4, 1, 0.6); tip.position.y = -0.8; sc.add(tip);
    const locket = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), chape); locket.scale.set(1.5, 1, 0.65); locket.position.y = -0.03; sc.add(locket);
  }

  G3D.makeKnight = function (o) {
    o = o || {};
    const golden = !!o.golden, statue = !!o.statue;
    const stone = statue ? G3D.stoneMat(o.tint || 'cold', [1, 1], 'statue') : null;
    const steel = stone || (golden ? G3D.metalMat('gold', { extra: { emissive: new THREE.Color('#5a3a00'), emissiveIntensity: 0.4 } }) : G3D.metalMat('steel'));
    const mail = stone || (golden ? steel : G3D.mailMat(false));
    const R = rig({ leg: mail, boot: steel, greave: steel, torso: mail, arm: mail, fore: mail, hand: steel, pauldron: steel, joint: steel, gauntlet: true, sabaton: true });
    const surTex = statue ? null : golden
      ? G3D.clothTex('surgold', { base: [240, 234, 220], cross: [190, 140, 40], crossSize: 0.12, crossY: 0.3, trim: [200, 160, 60] })
      : G3D.clothTex('sur', { base: [196, 188, 172], cross: [150, 12, 18], crossSize: 0.12, crossY: 0.3, stain: 0.35 });
    // Sleeveless surcoat over the mail, following the chest.
    const sc = mesh(lathe([[0.19, 0.02], [0.2, 0.1], [0.215, 0.24], [0.236, 0.38], [0.238, 0.46], [0.222, 0.54], [0.18, 0.585]], 28, Math.PI),
      stone || new THREE.MeshStandardMaterial({ map: surTex, roughness: 0.9, side: THREE.DoubleSide }));
    sc.scale.set(1.22, 1, 0.78); R.torso.add(sc);
    const skirtTex = statue ? null : golden
      ? G3D.clothTex('skgold', { base: [240, 234, 220], trim: [200, 160, 60] })
      : G3D.clothTex('sk', { base: [190, 182, 166], trim: null, stain: 0.45 });
    if (statue) { const s = mesh(new THREE.CylinderGeometry(0.255, 0.33, 0.58, 20), stone); s.position.y = -0.22; s.scale.set(1.15, 1, 0.82); R.hips.add(s); }
    else skirt(R, skirtTex, 0.6, 0.34, false);
    const leather = stone || G3D.flatMat('belt', '#3a2416', 0.7);
    swordBelt(R, leather, stone || G3D.metalMat(golden ? 'gold' : 'bronze'), stone || G3D.flatMat('scabbard', '#24160e', 0.55), steel);
    // Mail aventail from the helm to the shoulders.
    const av = mesh(new THREE.CylinderGeometry(0.13, 0.25, 0.15, 26, 1, true), mail); av.position.y = -0.03; av.scale.set(1, 1, 0.86); R.neck.add(av);
    if (!statue) {
      R.cape = cape(R, golden ? G3D.clothTex('capegold', { base: [235, 228, 210], trim: [200, 160, 60] })
        : G3D.clothTex('cape', { base: [182, 176, 162], tattered: true, stain: 0.5 }), 0.62, 1.25);
      // Ailettes: shoulder boards with the red cross.
      const ail = new THREE.MeshStandardMaterial({ map: G3D.clothTex('ailette', { base: [214, 206, 190], cross: [160, 14, 20], crossSize: 0.34, crossY: 0.5, stain: 0.2 }), roughness: 0.85, side: THREE.DoubleSide });
      [-1, 1].forEach(s => { const a = mesh(new THREE.BoxGeometry(0.15, 0.17, 0.008), ail); a.position.set(s * 0.33, 0.67, -0.02); a.rotation.set(-0.15, s * 0.12, s * 0.62); R.torso.add(a); });
    }
    const helm = makeGreatHelm(steel); helm.position.y = 0.06; R.head.add(helm);
    if (golden) { // Halo
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40), G3D.emissiveMat('halo', '#ffd36a', 5));
      halo.position.set(0, 0.32, -0.08); R.head.add(halo);
      const hg = G3D.glow('#ffd36a', 1.1, 0.6); hg.position.set(0, 0.3, -0.1); R.head.add(hg);
    }
    const sword = P.sword(statue ? stone : (golden ? steel : G3D.metalMat('steel', { extra: { roughness: 0.45 } })), 0.95);
    sword.rotation.x = 2.45; R.gripR.add(sword); R.weapon = sword;
    // Heater shield carried on the left, angled toward the front.
    const sh = statue ? null : P.shieldMesh(golden ? 'gold' : 'knight');
    if (sh) { sh.position.set(-0.3, 0.28, 0.26); sh.rotation.set(0.08, -0.55, 0.06); sh.scale.setScalar(1.12); R.torso.add(sh); R.shield = sh; }
    R.kind = 'knight';
    return R;
  };

  G3D.makeRisen = function () {
    const rust = G3D.metalMat('rust'), mail = G3D.mailMat(true), rot = G3D.flatMat('rothand', '#4a4636', 0.8);
    const R = rig({ leg: mail, boot: rust, greave: rust, torso: mail, arm: mail, fore: rot, hand: rot, pauldron: rust, joint: rust, sabaton: true });
    const sc = mesh(lathe([[0.19, 0.02], [0.2, 0.1], [0.215, 0.24], [0.236, 0.38], [0.238, 0.46], [0.222, 0.54], [0.18, 0.585]], 28, Math.PI),
      new THREE.MeshStandardMaterial({ map: G3D.clothTex('risensur', { base: [68, 60, 50], cross: [86, 18, 18], crossSize: 0.12, crossY: 0.3, stain: 0.95, tattered: true }), roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 }));
    sc.scale.set(1.22, 1, 0.78); R.torso.add(sc);
    skirt(R, G3D.clothTex('risensk', { base: [60, 54, 46], stain: 0.9, tattered: true }), 0.62, 0.36, true);
    R.cape = cape(R, G3D.clothTex('risencape', { base: [40, 36, 34], tattered: true, stain: 0.8 }), 0.62, 1.15);
    const belt = mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 28), G3D.flatMat('rotbelt', '#2a1e14', 0.9)); belt.rotation.x = Math.PI / 2; belt.scale.set(1.24, 0.79, 1); belt.position.y = 0.03; R.torso.add(belt);
    const helm = makeGreatHelm(rust, '#5ef0ff'); helm.position.y = 0.06; helm.rotation.z = 0.12; R.head.add(helm);
    const eg = G3D.glow('#5ef0ff', 0.45, 0.8); eg.position.set(0, 0.1, 0.16); R.head.add(eg);
    const av = mesh(new THREE.CylinderGeometry(0.13, 0.25, 0.15, 26, 1, true), mail); av.position.y = -0.03; av.scale.set(1, 1, 0.86); R.neck.add(av);
    // A rent in the mail on the left of the chest: ribs show through.
    const ribs = [];
    for (let k = 0; k < 4; k++) ribs.push([new THREE.TorusGeometry(0.248, 0.01, 5, 14, 0.75), ribAt(0.42 - k * 0.055, 0, -0.5, 1 - k * 0.025)]);
    R.torso.add(merged(ribs, bone()));
    const gash = mesh(new THREE.CircleGeometry(0.11, 10), G3D.flatMat('gash', '#0a0806', 1), false); gash.scale.set(0.8, 1.25, 1); gash.position.set(0.205, 0.34, 0.14); gash.rotation.y = 0.6; R.torso.add(gash);
    // Arrows from a battle long past: one in the back, one in the left shoulder.
    const shaftM = G3D.woodMat(true), fl = G3D.flatMat('fletch', '#6a6258', 1, 0, { side: THREE.DoubleSide });
    [[0.08, 0.42, -0.16, -0.5, 0.2, 0], [-0.24, 0.6, 0.02, 0.2, 0, 0.9]].forEach(a => {
      const ar = new THREE.Group(); ar.position.set(a[0], a[1], a[2]); ar.rotation.set(a[3], a[4], a[5]); R.torso.add(ar);
      const s = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 5), shaftM); s.rotation.x = Math.PI / 2; s.position.z = -0.17; ar.add(s);
      for (let k = 0; k < 3; k++) { const f = mesh(new THREE.PlaneGeometry(0.03, 0.08), fl, false); f.position.z = -0.34; f.rotation.set(Math.PI / 2, 0, k * 2.09); f.translateX(0.012); ar.add(f); }
    });
    const sword = P.sword(rust, 1.0); sword.rotation.x = 2.2; R.gripR.add(sword); R.weapon = sword;
    const sh = P.shieldMesh('risen'); sh.position.set(-0.3, 0.2, 0.24); sh.rotation.set(0.3, -0.7, 0.2); R.torso.add(sh);
    R.kind = 'risen';
    return R;
  };

  // Shared with later character modules (game3d/ember.js).
  G3D.charKit = { rig, skirt, cape, makeGreatHelm, lathe, merged, swordBelt, bodyColliders, limb };

  G3D.makePeasant = function () {
    const skin = G3D.flatMat('zskin', '#6a7058', 0.75, 0, { emissive: new THREE.Color('#0a120a'), emissiveIntensity: 1 });
    const rag = new THREE.MeshStandardMaterial({ map: G3D.clothTex('rag', { base: [84, 66, 46], stain: 0.9, tattered: true }), roughness: 1, side: THREE.DoubleSide, alphaTest: 0.5 });
    const R = rig({ leg: skin, boot: G3D.flatMat('foot', '#3a3428', 0.9), torso: rag, arm: skin, hand: skin });
    skirt(R, G3D.clothTex('ragsk', { base: [72, 58, 40], stain: 0.9, tattered: true }), 0.55, 0.32, true);
    // Head: gaunt skull-like face
    const head = mesh(new THREE.SphereGeometry(0.12, 18, 14), skin); head.scale.set(0.95, 1.12, 1); head.position.y = 0.08; R.head.add(head);
    const jaw = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), skin); jaw.position.set(0, -0.04, 0.04); jaw.rotation.x = 0.35; R.head.add(jaw); R.jaw = jaw;
    [-1, 1].forEach(s => {
      const sock = mesh(new THREE.SphereGeometry(0.03, 8, 6), G3D.flatMat('socket', '#050505', 1), false); sock.position.set(s * 0.045, 0.1, 0.1); R.head.add(sock);
      const e = mesh(new THREE.SphereGeometry(0.012, 6, 5), G3D.emissiveMat('zeye', '#d8ff7a', 8), false); e.position.set(s * 0.045, 0.1, 0.122); R.head.add(e);
    });
    const hair = mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, 1.2), G3D.flatMat('hair', '#1a1612', 1)); hair.position.y = 0.1; hair.rotation.x = -0.4; R.head.add(hair);
    // A gaunt face: heavy brow, hollow nose, ears, and a jaw of broken teeth.
    const face = [];
    face.push([new THREE.BoxGeometry(0.15, 0.025, 0.04), mtx(0, 0.135, 0.095, 0.2)]);
    face.push([new THREE.ConeGeometry(0.018, 0.05, 6), mtx(0, 0.075, 0.125, 1.35)]);
    [-1, 1].forEach(e => face.push([new THREE.SphereGeometry(0.03, 8, 6), mtx(e * 0.112, 0.08, 0, 0, 0, 0, 0.35, 1, 0.75)]));
    R.head.add(merged(face, skin));
    const teeth = [];
    for (let k = 0; k < 7; k++) if (k !== 2 && k !== 5) teeth.push([new THREE.BoxGeometry(0.012, 0.018 + (k % 3) * 0.004, 0.01), mtx((k - 3) * 0.015, 0.035, 0.045)]);
    jaw.add(merged(teeth, bone()));
    // Ribs through the torn shirt.
    const ribs = [];
    for (let k = 0; k < 4; k++) ribs.push([new THREE.TorusGeometry(0.236, 0.009, 5, 14, 0.8), ribAt(0.44 - k * 0.05, 0.005, -1.95, 1 - k * 0.025)]);
    R.torso.add(merged(ribs, bone()));
    // A rusted pitchfork
    const fork = new THREE.Group();
    fork.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6), G3D.woodMat(true)));
    for (let i = -1; i <= 1; i++) { const t = mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.3, 4), G3D.metalMat('rust')); t.position.set(i * 0.05, 0.85, 0); fork.add(t); }
    fork.rotation.x = Math.PI / 2; fork.position.z = 0.1; R.gripR.add(fork); R.weapon = fork;
    R.kind = 'peasant';
    return R;
  };

  G3D.makeNecromancer = function () {
    const R = { root: new THREE.Group() };
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 0.95; R.body.add(R.hips);
    const robeTex = G3D.clothTex('robe', { base: [30, 18, 34], trim: [70, 140, 60], tattered: true, stain: 0.5 });
    const robeMat = new THREE.MeshStandardMaterial({ map: robeTex, roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5 });
    const prof = [[0.2, 0.8], [0.26, 0.6], [0.3, 0.3], [0.38, 0], [0.5, -0.5], [0.66, -0.95]].map(p => new THREE.Vector2(p[0], p[1]));
    const robe = mesh(new THREE.LatheGeometry(prof, 32), robeMat); robe.scale.set(1.15, 1, 0.9); R.hips.add(robe);
    robe.userData.sway = { base: robe.geometry.attributes.position.array.slice(), amp: 0.04, robe: true };
    R.torso = new THREE.Group(); R.hips.add(R.torso);
    R.neck = new THREE.Group(); R.neck.position.y = 0.88; R.torso.add(R.neck);
    R.head = new THREE.Group(); R.neck.add(R.head);
    const hood = mesh(new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), robeMat); hood.scale.set(1, 1.25, 1.15); hood.rotation.x = -0.5; R.head.add(hood);
    const skull = P.skull(); skull.scale.setScalar(1.25); skull.position.set(0, -0.03, 0.06); R.head.add(skull);
    [-1, 1].forEach(s => { const e = mesh(new THREE.SphereGeometry(0.018, 8, 6), G3D.emissiveMat('neye', '#4dff5a', 10), false); e.position.set(s * 0.048, -0.03, 0.17); R.head.add(e); });
    const eg = G3D.glow('#4dff5a', 0.7, 0.9); eg.position.set(0, -0.02, 0.2); R.head.add(eg);
    // A mantle of bones about the shoulders, fastened with a skull.
    const mantle = [];
    for (let k = 0; k < 11; k++) {
      const ang = (k / 10 - 0.5) * 3.4;
      mantle.push([new THREE.ConeGeometry(0.022, 0.2 + (k % 2) * 0.08, 6), mtx(Math.sin(ang) * 0.27, 0.8 + (k % 2) * 0.02, Math.cos(ang) * 0.2 - 0.02, -0.25 + Math.cos(ang) * 0.1, 0, -Math.sin(ang) * 0.9)]);
      mantle.push([new THREE.SphereGeometry(0.03, 8, 6), mtx(Math.sin(ang) * 0.25, 0.74, Math.cos(ang) * 0.19 - 0.02)]);
    }
    R.torso.add(merged(mantle, bone()));
    const clasp = P.skull(); clasp.scale.setScalar(0.55); clasp.position.set(0, 0.66, 0.2); R.torso.add(clasp);
    const chain = [];
    for (let k = 0; k < 9; k++) chain.push([new THREE.TorusGeometry(0.018, 0.005, 5, 10), mtx(-0.16 + k * 0.035, 0.28 - Math.sin(k / 8 * Math.PI) * 0.1, 0.27, 0, k % 2 ? Math.PI / 2 : 0, 0)]);
    R.torso.add(merged(chain, iron()));
    ['L', 'R'].forEach((side, i) => {
      const s = i ? 1 : -1;
      const arm = new THREE.Group(); arm.position.set(s * 0.3, 0.72, 0); R.torso.add(arm);
      const sleeve = mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.6, 12, 1, true), robeMat); sleeve.position.y = -0.3; arm.add(sleeve);
      const fore = new THREE.Group(); fore.position.y = -0.58; arm.add(fore);
      const hand = mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), bone()); hand.position.y = -0.05; fore.add(hand);
      const grip = new THREE.Group(); grip.position.y = -0.06; fore.add(grip);
      R['arm' + side] = arm; R['fore' + side] = fore; R['grip' + side] = grip;
    });
    const staff = new THREE.Group();
    staff.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.1, 8), G3D.flatMat('staff', '#14100c', 0.6)));
    const sk = P.skull(); sk.position.y = 1.12; sk.scale.setScalar(1.1); staff.add(sk);
    const fl = G3D.flame('#3dff5a', 0.42, 0.75, 1.6); fl.position.y = 1.2; staff.add(fl);
    const sg = G3D.glow('#3dff5a', 1.8, 0.7); sg.position.y = 1.35; staff.add(sg);
    const la = new THREE.Object3D(); la.position.y = 1.4; staff.add(la); anchor(la, '#3dff5a', 1.8, 8, { flicker: 1.2, priority: 5 });
    staff.position.y = 0.4; staff.rotation.x = 0.1; R.gripR.add(staff); R.weapon = staff;
    R.root.scale.setScalar(1.18);
    R.kind = 'necromancer';
    return R;
  };

  // Robed NPC (monk / healer / quartermaster) holding a candle.
  G3D.makeNPC = function (color) {
    const R = { root: new THREE.Group() };
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 0.95; R.body.add(R.hips);
    const robeMat = new THREE.MeshStandardMaterial({ map: G3D.clothTex('npc' + color.join(), { base: color, stain: 0.3 }), roughness: 0.9, side: THREE.DoubleSide });
    const prof = [[0.17, 0.72], [0.24, 0.55], [0.27, 0.25], [0.32, 0], [0.4, -0.5], [0.44, -0.95]].map(p => new THREE.Vector2(p[0], p[1]));
    const robe = mesh(new THREE.LatheGeometry(prof, 28), robeMat); robe.scale.set(1.15, 1, 0.9); R.hips.add(robe);
    R.torso = new THREE.Group(); R.hips.add(R.torso);
    R.neck = new THREE.Group(); R.neck.position.y = 0.8; R.torso.add(R.neck);
    R.head = new THREE.Group(); R.neck.add(R.head);
    const face = mesh(new THREE.SphereGeometry(0.11, 16, 12), G3D.flatMat('skin', '#b88a68', 0.65)); face.scale.set(0.95, 1.1, 1); face.position.y = 0.06; R.head.add(face);
    const beard = mesh(new THREE.ConeGeometry(0.08, 0.16, 10), G3D.flatMat('beard', '#6a6460', 1)); beard.rotation.x = Math.PI; beard.position.set(0, -0.04, 0.06); R.head.add(beard);
    const hood = mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), robeMat); hood.scale.set(1, 1.15, 1.1); hood.rotation.x = -0.6; hood.position.y = 0.05; R.head.add(hood);
    const c = P.candle(0.16); c.position.set(0.12, 0.38, 0.28); R.torso.add(c); c.userData.candle = true;
    const gl = G3D.glow('#ffb050', 0.9, 0.6); gl.position.set(0.12, 0.6, 0.28); R.torso.add(gl); gl.userData.candle = true;
    R.kind = 'npc';
    return R;
  };

  // ── Rain: GPU-animated streaks plus splash rings on the ground ────────────
  // o = { box: [x0, x1, z0, z1], top, floor, count, splashes, wind: [x, z] }
  P.rain = function (o) {
    const g = new THREE.Group();
    const [x0, x1, z0, z1] = o.box, top = o.top || 10, floor = o.floor || 0;
    const U = G3D.uniforms;
    if (!U.lightning) U.lightning = { value: 0 };
    const rnd = G3D.rng ? G3D.rng(91) : Math.random;
    const n = o.count || 1600;
    const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2), tail = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), s = rnd();
      for (let k = 0; k < 2; k++) { pos[i * 6 + k * 3] = x; pos[i * 6 + k * 3 + 1] = 0; pos[i * 6 + k * 3 + 2] = z; seed[i * 2 + k] = s; tail[i * 2 + k] = k; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('tail', new THREE.BufferAttribute(tail, 1));
    const wind = o.wind || [1.2, 0.3];
    const m = new THREE.ShaderMaterial({
      uniforms: { time: U.time, flash: U.lightning, top: { value: top }, floor: { value: floor }, wind: { value: new THREE.Vector2(wind[0], wind[1]) },
        color: { value: new THREE.Color(o.color || '#9fb4d8') }, opacity: { value: o.opacity || 0.4 } },
      vertexShader: `attribute float seed; attribute float tail; uniform float time, top, floor; uniform vec2 wind;
        varying float vA;
        void main(){
          float h = top - floor, speed = 11.0 + seed * 5.0, len = 0.35 + seed * 0.35;
          float y = top - mod(time * speed + seed * h * 13.0, h);
          vec3 p = position; p.y = y;
          p.xz += wind * (top - y) / speed;
          p += vec3(-wind.x / speed, 1.0, -wind.y / speed) * len * tail;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (1.0 - tail) * smoothstep(34.0, 6.0, -mv.z) * smoothstep(0.4, 1.6, -mv.z) * smoothstep(floor, floor + 0.3, y);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 color; uniform float opacity, flash; varying float vA;
        void main(){ gl_FragColor = vec4(color * vA * opacity * (1.0 + flash * 4.0), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(geo, m); lines.frustumCulled = false; lines.renderOrder = 7;
    g.add(lines);
    // Splashes: rings that bloom and fade where drops land, near the camera.
    const sn = o.splashes || 260, sb = o.splashBox || o.box;
    const sp = new Float32Array(sn * 3), ss = new Float32Array(sn);
    for (let i = 0; i < sn; i++) { sp[i * 3 + 1] = floor + 0.02; ss[i] = rnd(); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('seed', new THREE.BufferAttribute(ss, 1));
    const smat = new THREE.ShaderMaterial({
      uniforms: { time: U.time, flash: U.lightning, box: { value: new THREE.Vector4(sb[0], sb[1], sb[2], sb[3]) }, color: { value: new THREE.Color(o.color || '#9fb4d8') } },
      vertexShader: `attribute float seed; uniform float time; uniform vec4 box; varying float vPh; varying float vF;
        float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
        void main(){
          float rate = 1.6 + seed * 1.4, c = time * rate + seed * 17.0, cyc = floor(c);
          vPh = fract(c);
          vec3 p = position;
          p.x = mix(box.x, box.y, h1(cyc + seed * 31.7)); p.z = mix(box.z, box.w, h1(cyc * 1.37 + seed * 7.3));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vF = smoothstep(18.0, 4.0, -mv.z);
          gl_PointSize = clamp((0.25 + vPh * 0.35) * 420.0 / -mv.z, 1.0, 48.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 color; uniform float flash; varying float vPh; varying float vF;
        void main(){
          vec2 d = gl_PointCoord - 0.5; d.y *= 3.2;
          float r = length(d) * 2.0;
          float ring = smoothstep(0.18, 0.0, abs(r - vPh)) * (1.0 - vPh) * vF;
          if (ring < 0.01) discard;
          gl_FragColor = vec4(color * ring * 0.55 * (1.0 + flash * 3.0), 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const splash = new THREE.Points(sg, smat); splash.frustumCulled = false; splash.renderOrder = 7;
    g.add(splash);
    g.userData.noBatch = true;
    g.userData.rain = { mats: [m, smat], base: m.uniforms.opacity.value };
    return g;
  };

  // ── v14: the Sunken Crypt ─────────────────────────────────────────────────
  // Rippling water: a tiling normal map built from a few interfering waves.
  let rippleTex = null;
  function ripples() {
    if (rippleTex) return rippleTex;
    const S = 256, c = G3D.canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    const H = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2;
      H[y * S + x] = Math.sin(u * 3 + Math.sin(v * 2) * 0.8) * 0.5 + Math.sin(v * 5 + u * 2) * 0.3 + Math.sin((u - v) * 7) * 0.15 + G3D.fbm(x / 32, y / 32, 8, 3, 5) * 0.6;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = H[y * S + (x + 1) % S] - H[y * S + (x + S - 1) % S], dy = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
      const nx = -dx * 2.2, ny = -dy * 2.2, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    rippleTex = new THREE.CanvasTexture(c); rippleTex.wrapS = rippleTex.wrapT = THREE.RepeatWrapping;
    return rippleTex;
  }
  // Still black water; the engine drifts its ripples (userData.flow).
  P.water = function (w, d, color) {
    const nm = ripples().clone(); nm.needsUpdate = true; nm.repeat.set(w / 4, d / 4);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#071014'), roughness: 0.06, metalness: 0.1, normalMap: nm,
      normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9, envMapIntensity: 1.6, depthWrite: true });
    // Ripple rings (v18): wakes where the knight wades, drips from the vault.
    // Up to 8 sources share one uniform array, updated by game3d/elements.js.
    const U = G3D.uniforms;
    if (!U.ripples) U.ripples = { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) };
    m.onBeforeCompile = sh => {
      sh.uniforms.ripples = U.ripples; sh.uniforms.time = U.time;
      sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvRW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = 'uniform vec4 ripples[8]; uniform float time; varying vec3 vRW;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // Expanding rings: x, z, start time, strength. Each ring is a damped wave train.
          vec2 slope = vec2(0.0);
          for (int i = 0; i < 8; i++) {
            vec4 r = ripples[i];
            float age = time - r.z;
            if (age < 0.0 || age > 3.0 || r.w <= 0.0) continue;
            vec2 d = vRW.xz - r.xy; float dist = length(d) + 1e-4;
            float front = age * 0.9;
            float x = dist - front;
            float env = exp(-x * x * 18.0) * exp(-age * 1.3) * r.w / (1.0 + dist * 2.0);
            slope += d / dist * cos(x * 26.0) * env;
          }
          vec3 nW = normalize(vec3(-slope.x, 1.0, -slope.y));
          normal = normalize(normal + (viewMatrix * vec4(nW - vec3(0.0, 1.0, 0.0), 0.0)).xyz * 1.4);
        }`);
    };
    m.customProgramCacheKey = () => 'ripples';
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), m);
    water.rotation.x = -Math.PI / 2; water.receiveShadow = true; water.renderOrder = 1;
    water.userData.flow = [0.012, 0.007]; water.userData.noCollide = true; water.userData.water = true;
    return water;
  };
  // A lit candle drifting on the water.
  P.floatCandle = function (seed) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 10), G3D.woodMat(true)); g.add(disc);
    const c = P.candle(0.1 + (seed % 3) * 0.03); c.position.y = 0.01; g.add(c);
    g.userData.bob = { seed: seed * 1.37, amp: 0.015 };
    return g;
  };

  // The Drowned Wraith: a floating, tattered shape with a skull face and long bone hands.
  G3D.makeWraith = function () {
    const R = { root: new THREE.Group() };
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 1.0; R.body.add(R.hips);
    const tex = G3D.clothTex('wraith', { base: [120, 140, 150], tattered: true, stain: 0.7 });
    const robeMat = new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color('#b8d4dc'), roughness: 0.6, side: THREE.DoubleSide, alphaTest: 0.45,
      transparent: true, opacity: 0.82, emissive: new THREE.Color('#2a6a7a'), emissiveIntensity: 0.35, depthWrite: true });
    const prof = [[0.16, 0.85], [0.24, 0.6], [0.28, 0.3], [0.32, 0], [0.36, -0.5], [0.3, -1.0], [0.12, -1.35]].map(p => new THREE.Vector2(p[0], p[1]));
    const robe = mesh(new THREE.LatheGeometry(prof, 28), robeMat); robe.scale.set(1.1, 1, 0.85); R.hips.add(robe);
    robe.userData.sway = { base: robe.geometry.attributes.position.array.slice(), amp: 0.07, robe: true };
    R.torso = new THREE.Group(); R.hips.add(R.torso);
    R.neck = new THREE.Group(); R.neck.position.y = 0.92; R.torso.add(R.neck);
    R.head = new THREE.Group(); R.neck.add(R.head);
    const hood = mesh(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), robeMat); hood.scale.set(1, 1.3, 1.15); hood.rotation.x = -0.45; R.head.add(hood);
    const skull = P.skull(); skull.scale.setScalar(1.15); skull.position.set(0, -0.04, 0.05); R.head.add(skull);
    [-1, 1].forEach(s => { const e = mesh(new THREE.SphereGeometry(0.016, 8, 6), G3D.emissiveMat('weye', '#7ff6ff', 12), false); e.position.set(s * 0.045, -0.04, 0.16); R.head.add(e); });
    const eg = G3D.glow('#7ff6ff', 0.8, 0.9); eg.position.set(0, -0.03, 0.18); R.head.add(eg);
    ['L', 'R'].forEach((side, i) => {
      const s = i ? 1 : -1;
      const arm = new THREE.Group(); arm.position.set(s * 0.28, 0.78, 0); R.torso.add(arm);
      const sleeve = mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.62, 10, 1, true), robeMat); sleeve.position.y = -0.31; arm.add(sleeve);
      const fore = new THREE.Group(); fore.position.y = -0.6; arm.add(fore);
      const radius = mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.32, 6), bone()); radius.position.y = -0.16; fore.add(radius);
      for (let f = 0; f < 4; f++) { const fi = mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.16, 4), bone()); fi.position.set((f - 1.5) * 0.018, -0.38, 0.01); fi.rotation.x = 0.25; fore.add(fi); }
      const grip = new THREE.Group(); grip.position.y = -0.36; fore.add(grip);
      R['arm' + side] = arm; R['fore' + side] = fore; R['grip' + side] = grip;
    });
    const a = new THREE.Object3D(); a.position.set(0, 0.9, 0.3); R.torso.add(a); anchor(a, '#5ae0ff', 1.4, 6, { flicker: 0.6, priority: 5 });
    const mist = G3D.glow('#6ad8e8', 2.2, 0.35); mist.position.y = -1.1; R.hips.add(mist);
    R.root.scale.setScalar(1.12);
    R.kind = 'wraith';
    return R;
  };

  // Sister Aveline: the drowned saint's spirit, pale and luminous.
  G3D.makeSaint = function () {
    const R = { root: new THREE.Group() };
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 0.95; R.body.add(R.hips);
    const habit = new THREE.MeshStandardMaterial({ map: G3D.clothTex('saint', { base: [190, 204, 220], stain: 0.25 }), color: new THREE.Color('#b8cadc'), roughness: 0.7,
      side: THREE.DoubleSide, transparent: true, opacity: 0.55, emissive: new THREE.Color('#5a88b8'), emissiveIntensity: 0.3, depthWrite: false });
    const prof = [[0.16, 0.72], [0.22, 0.55], [0.25, 0.25], [0.3, 0], [0.38, -0.5], [0.42, -0.95]].map(p => new THREE.Vector2(p[0], p[1]));
    const robe = mesh(new THREE.LatheGeometry(prof, 28), habit); robe.scale.set(1.1, 1, 0.9); R.hips.add(robe);
    R.torso = new THREE.Group(); R.hips.add(R.torso);
    R.neck = new THREE.Group(); R.neck.position.y = 0.8; R.torso.add(R.neck);
    R.head = new THREE.Group(); R.neck.add(R.head);
    const face = mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: '#e8eef2', emissive: new THREE.Color('#8ab0d0'), emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.6 }));
    face.scale.set(0.92, 1.1, 1); face.position.y = 0.05; R.head.add(face);
    const veil = mesh(new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), habit); veil.scale.set(1, 1.2, 1.1); veil.rotation.x = -0.35; veil.position.y = 0.05; R.head.add(veil);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 40), G3D.emissiveMat('shalo', '#cfe8ff', 4)); halo.position.set(0, 0.24, -0.08); R.head.add(halo);
    const gl = G3D.glow('#bcd8ff', 1.6, 0.5); gl.position.y = 0.5; R.torso.add(gl);
    const a = new THREE.Object3D(); a.position.set(0, 0.6, 0.4); R.torso.add(a); anchor(a, '#a8ccff', 1.2, 6, { flicker: 0.2, priority: 3 });
    R.kind = 'npc';
    return R;
  };

  // ── v15: Saint Michael and the creatures of the fortress ──────────────────
  let featherTex = null;
  function feather() {
    if (featherTex) return featherTex;
    const S = 64, c = G3D.canvas(S), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.15, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.85)');
    x.fillStyle = g; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.2, S * 0.48, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(200,170,110,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(S / 2, 2); x.lineTo(S / 2, S - 2); x.stroke();
    featherTex = new THREE.CanvasTexture(c);
    return featherTex;
  }
  function wing(side) {
    const w = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: feather(), color: new THREE.Color('#f4e2c0').multiplyScalar(0.85), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(0.22, 1.0);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(geo, mat);
      const a = 0.2 + i * 0.16 + row * 0.05, len = (1.5 - row * 0.35) * (0.6 + i * 0.07);
      f.scale.set(1, len, 1);
      f.position.set(side * Math.cos(a) * (0.25 + i * 0.13 + row * 0.05), 0.2 + Math.sin(a) * 0.5 - row * 0.12, -row * 0.03);
      f.rotation.z = side * (-Math.PI / 2 + a) * 0.9; f.renderOrder = 6;
      w.add(f);
    }
    return w;
  }
  G3D.makeAngel = function () {
    const R = { root: new THREE.Group() };
    R.body = new THREE.Group(); R.root.add(R.body);
    const robe = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2e8d4'), emissive: new THREE.Color('#ffd890'), emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide });
    const gold = G3D.metalMat('gold', { extra: { emissive: new THREE.Color('#ffb040'), emissiveIntensity: 0.3 } });
    const prof = [[0.16, 0.8], [0.24, 0.6], [0.27, 0.3], [0.3, 0], [0.38, -0.6], [0.46, -1.0]].map(p => new THREE.Vector2(p[0], p[1]));
    const gown = mesh(new THREE.LatheGeometry(prof, 28), robe, false, false); gown.position.y = 1.0; R.body.add(gown);
    const cuirass = mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.42, 20), gold, false, false); cuirass.position.y = 1.55; R.body.add(cuirass);
    const head = mesh(new THREE.SphereGeometry(0.12, 18, 14), new THREE.MeshStandardMaterial({ color: '#f6e6d0', emissive: new THREE.Color('#ffe0b0'), emissiveIntensity: 0.6 }), false, false); head.position.y = 2.0; R.body.add(head);
    const hair = mesh(new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), G3D.emissiveMat('angelhair', '#ffd070', 1.6), false, false); hair.position.y = 2.02; R.body.add(hair);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.014, 8, 48), G3D.emissiveMat('angelhalo', '#ffe6a0', 6)); halo.position.set(0, 2.28, -0.08); halo.rotation.x = -0.3; R.body.add(halo);
    R.wingL = wing(-1); R.wingL.position.set(-0.08, 1.6, -0.18); R.body.add(R.wingL);
    R.wingR = wing(1); R.wingR.position.set(0.08, 1.6, -0.18); R.body.add(R.wingR);
    // Raised arm with a sword of flame
    R.arm = new THREE.Group(); R.arm.position.set(0.26, 1.7, 0); R.body.add(R.arm);
    const sleeve = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 10), robe, false, false); sleeve.position.y = 0.26; R.arm.add(sleeve);
    const sword = P.sword(gold, 1.3); sword.position.y = 0.55; R.arm.add(sword);
    const fl = G3D.flame('#ff9a30', 0.22, 1.5, 1.6); fl.position.y = 0.55 + 0.65; R.arm.add(fl);
    R.arm.rotation.z = -0.25;
    const gl = G3D.glow('#ffd890', 2.6, 0.3); gl.position.y = 1.5; R.body.add(gl);
    return R;
  };

  // A bat: body plus two flapping wings (game3d/life.js flies them).
  const batMat = () => G3D.flatMat('bat', '#120e10', 0.9);
  const batWingGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.22, 0.02, -0.05, 0.16, 0, 0.08, 0, 0, 0, 0.16, 0, 0.08, 0.05, 0, 0.09], 3)); g.computeVertexNormals(); g.userData.shared = true; return g; })();
  G3D.makeBat = function () {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#141012', roughness: 0.9, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), m); body.scale.set(1, 0.8, 1.6); g.add(body);
    const L = new THREE.Mesh(batWingGeo, m); L.scale.x = -1; g.add(L);
    const Rw = new THREE.Mesh(batWingGeo, m); g.add(Rw);
    g.userData.wings = [L, Rw];
    return g;
  };
  G3D.makeRat = function () {
    const g = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: '#3a3028', roughness: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), fur); body.scale.set(0.85, 0.7, 1.6); body.position.y = 0.05; g.add(body);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 8), fur); head.rotation.x = Math.PI / 2; head.position.set(0, 0.055, 0.12); g.add(head);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.2, 5), new THREE.MeshStandardMaterial({ color: '#8a6a60', roughness: 0.8 })); tail.rotation.x = Math.PI / 2 - 0.2; tail.position.set(0, 0.035, -0.17); g.add(tail);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), G3D.emissiveMat('rateye', '#ff4030', 2)); e.position.set(s * 0.022, 0.075, 0.13); g.add(e); });
    g.userData.tail = tail;
    return g;
  };
  G3D.makeRaven = function () {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m); body.scale.set(0.8, 0.85, 1.5); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m); head.position.set(0, 0.06, 0.1); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 6), G3D.flatMat('beak', '#1a1814', 0.4)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.055, 0.16); g.add(beak);
    const tailF = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), m); tailF.rotation.x = -Math.PI / 2 + 0.3; tailF.position.set(0, -0.01, -0.15); g.add(tailF);
    const wg = new THREE.PlaneGeometry(0.28, 0.1); wg.translate(0.14, 0, 0);
    const L = new THREE.Mesh(wg, m), Rw = new THREE.Mesh(wg, m); L.scale.x = -1; L.position.y = Rw.position.y = 0.03;
    L.rotation.x = Rw.rotation.x = -Math.PI / 2; g.add(L, Rw);
    g.userData.wings = [L, Rw];
    return g;
  };
})();
