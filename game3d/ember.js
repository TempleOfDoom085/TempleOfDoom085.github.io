/* Knights Templar 3D — the Ember Vaults (v18).

   The Order's forge beneath the treasury: a stair down into the heat, the
   Cinder Forge with its river of molten iron, and the Warden's Vault over a
   lake of fire. Also: lava and lava-falls (a flowing, crusted, HDR shader
   that lights the fog through anchored lights), anvils, the great furnace,
   the Cinder Knight, the Ashen Warden in molten plate with a greatsword of
   flame, and Godfrey the Smith. */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE || !G3D.roomKit || !G3D.charKit) return;
  const P = G3D.props, { mesh, mtx } = G3D;
  const { shell, wallTorch, spec, place } = G3D.roomKit;
  const K = G3D.charKit;

  // ── Lava ─────────────────────────────────────────────────────────────────
  // Domain-warped flowing noise: dark cooling crust plates over glowing cracks,
  // hotter where it moves fastest. HDR, so it blooms.
  const LAVA_VS = `
    varying vec2 vUv; varying vec3 vW;
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const LAVA_FS = `
    uniform float time, heat, fall; uniform vec2 flow, scale;
    varying vec2 vUv; varying vec3 vW;
    #include <fog_pars_fragment>
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p = p * 2.03 + 3.1; a *= 0.5; } return s; }
    // Cellular distance to the nearest crack between crust plates.
    float cells(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h(i + g), h(i + g + 17.3)); o = 0.5 + 0.45 * sin(time * 0.25 + 6.2831 * o);
        float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return d2 - d1; }
    void main(){
      vec2 p = vUv * scale;
      vec2 t = flow * time;
      vec2 q = vec2(fbm(p * 0.8 + t * 0.6), fbm(p * 0.8 + vec2(5.2, 1.3) - t * 0.3));
      vec2 w = p + q * 1.6 + t;
      float crack = 1.0 - smoothstep(0.0, 0.16, cells(w * 1.3));
      float hot = fbm(w * 1.7 + q * 2.0);
      float glow = clamp(crack * 1.2 + smoothstep(0.55, 0.9, hot) * 0.9, 0.0, 1.0);
      glow = max(glow, fall);                                 // a lava-fall is all molten
      float pulse = 0.85 + 0.15 * sin(time * 1.3 + hot * 9.0);
      vec3 crust = mix(vec3(0.035, 0.018, 0.012), vec3(0.09, 0.04, 0.025), hot);
      vec3 molten = mix(vec3(0.9, 0.12, 0.01), vec3(1.0, 0.55, 0.1), glow * glow) * (0.6 + glow * 1.4);
      vec3 col = mix(crust, molten * heat * pulse, glow);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`;
  function lavaMat(sx, sy, flow, fall) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: { value: 0 }, heat: { value: 1 }, fall: { value: fall || 0 }, flow: { value: new THREE.Vector2(...(flow || [0.05, 0.02])) }, scale: { value: new THREE.Vector2(sx, sy) },
      }]),
      vertexShader: LAVA_VS, fragmentShader: LAVA_FS, fog: true,
    });
  }
  const lavaMats = [];
  // A pool or river of lava (w × d, lying flat). Lights are anchored along it so it lights the fog.
  P.lava = function (w, d, flow, lights, heat) {
    const m = lavaMat(w / 3, d / 3, flow);
    m.uniforms.heat.value = heat == null ? 1 : heat;
    m.uniforms.time = G3D.uniforms.time;   // share the engine's clock
    lavaMats.push(m);
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    lava.rotation.x = -Math.PI / 2; lava.userData.noCollide = true;
    const g = new THREE.Group(); g.add(lava);
    const n = lights == null ? Math.max(1, Math.round(Math.max(w, d) / 6)) : lights;
    for (let i = 0; i < n; i++) {
      const a = new THREE.Object3D(), t = n === 1 ? 0.5 : i / (n - 1);
      a.position.set(w >= d ? (t - 0.5) * w * 0.8 : 0, 0.6, w >= d ? 0 : (t - 0.5) * d * 0.8);
      g.add(a); G3D.anchor(a, '#ff5a14', 1.4, 8, { flicker: 0.35, priority: 3 });
    }
    return g;
  };
  // A sheet of lava pouring down a wall.
  P.lavaFall = function (w, h) {
    const m = lavaMat(w / 2, h / 2, [0, 0.35], 0.35); m.uniforms.time = G3D.uniforms.time; m.uniforms.heat.value = 0.7;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 8), m);
    // Bulge it forward at the foot as it spills.
    const p = f.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h + 0.5; p.setZ(i, Math.pow(1 - y, 3) * 0.6); }
    f.geometry.computeVertexNormals(); f.userData.noCollide = true;
    const g = new THREE.Group(); g.add(f);
    const a = new THREE.Object3D(); a.position.set(0, -h * 0.3, 0.8); g.add(a); G3D.anchor(a, '#ff6a20', 2.0, 10, { flicker: 0.25, priority: 4 });
    const gl = G3D.glow('#ff5a14', w * 1.6, 0.25); gl.position.set(0, -h * 0.35, 0.5); g.add(gl);
    return g;
  };

  // ── Forge props ──────────────────────────────────────────────────────────
  const iron = () => G3D.flatMat('iron', '#2a2826', 0.55, 0.85);
  P.anvil = function () {
    const parts = [
      [new THREE.BoxGeometry(0.34, 0.1, 0.26), mtx(0, 0.05, 0)],
      [new THREE.BoxGeometry(0.2, 0.3, 0.16), mtx(0, 0.25, 0)],
      [new THREE.BoxGeometry(0.5, 0.12, 0.2), mtx(0.03, 0.46, 0)],
      [new THREE.ConeGeometry(0.1, 0.28, 10), mtx(-0.34, 0.46, 0, 0, 0, Math.PI / 2, 1, 1, 0.7)],
    ];
    const g = new THREE.Group();
    const a = mesh(G3D.merge(parts), G3D.metalMat('steel', { extra: { roughness: 0.55 } })); a.scale.setScalar(1.6); g.add(a);
    const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 12), G3D.woodMat(true)); base.position.y = -0.0; base.scale.y = 0.8; g.add(base);
    a.position.y = 0.2;
    return g;
  };
  // A glowing half-forged blade lying across an anvil or in the coals.
  P.hotBlade = function (len) {
    const s = P.sword(G3D.flatMat('hotblade', '#3a1a10', 0.5, 0.6, { emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 2.2 }), len || 0.9);
    return s;
  };
  // The great furnace: a stone mass with an arched mouth full of fire.
  P.furnace = function () {
    const g = new THREE.Group(), sm = G3D.stoneMat('warm', [2, 2], 'furnace');
    const body = mesh(new THREE.BoxGeometry(4.4, 4.2, 2.2), sm); body.position.set(0, 2.1, 0); g.add(body);
    const hood = mesh(new THREE.CylinderGeometry(0.7, 2.2, 2.6, 4, 1), sm); hood.rotation.y = Math.PI / 4; hood.position.set(0, 5.5, 0); g.add(hood);
    const flue = mesh(new THREE.BoxGeometry(1.0, 6, 1.0), sm); flue.position.set(0, 9.6, 0); g.add(flue);
    const arch = P.gothicArch(2.2, 1.8, 0.4, sm); arch.position.set(0, 0.6, 1.12); g.add(arch);
    const mouth = mesh(new THREE.PlaneGeometry(2.0, 1.9), G3D.emissiveMat('furnaceMouth', '#ff4a10', 3.2), false); mouth.position.set(0, 1.5, 1.11); g.add(mouth);
    const coals = mesh(new THREE.BoxGeometry(2.0, 0.3, 0.6), G3D.flatMat('coals', '#1a0806', 0.9, 0, { emissive: new THREE.Color('#ff3a0a'), emissiveIntensity: 1.6 })); coals.position.set(0, 0.75, 1.0); g.add(coals);
    for (let i = 0; i < 4; i++) { const f = G3D.flame(i % 2 ? '#ff8a20' : '#ff5a10', 0.8 + (i % 3) * 0.2, 1.3 + (i % 2) * 0.4, 1.6); f.position.set(-0.75 + i * 0.5, 0.85, 1.05); g.add(f); }
    const gl = G3D.glow('#ff6a20', 4.5, 0.35); gl.position.set(0, 1.6, 1.6); g.add(gl);
    const a = new THREE.Object3D(); a.position.set(0, 1.6, 2.0); g.add(a); G3D.anchor(a, '#ff7a28', 2.6, 14, { flicker: 1.2, priority: 6 });
    return g;
  };
  // Bellows on a frame.
  P.bellows = function () {
    const g = new THREE.Group(), lm = G3D.flatMat('leather2', '#3a2014', 0.85);
    const bag = mesh(new THREE.CylinderGeometry(0.05, 0.55, 1.4, 12, 1), lm); bag.rotation.z = Math.PI / 2; bag.scale.set(1, 1, 0.45); bag.position.y = 0.7; g.add(bag);
    const boards = mesh(new THREE.BoxGeometry(1.3, 0.05, 1.0), G3D.woodMat(true)); boards.position.y = 0.95; g.add(boards);
    const nozzle = mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 8), iron()); nozzle.rotation.z = Math.PI / 2; nozzle.position.set(-0.9, 0.7, 0); g.add(nozzle);
    return g;
  };
  // A quench trough of water (steams in the heat).
  P.quench = function () {
    const g = new THREE.Group(), wm = G3D.woodMat(true);
    const box = mesh(new THREE.BoxGeometry(1.8, 0.6, 0.8), wm); box.position.y = 0.3; g.add(box);
    const water = mesh(new THREE.PlaneGeometry(1.6, 0.6), G3D.flatMat('quenchW', '#0a1214', 0.05, 0.2)); water.rotation.x = -Math.PI / 2; water.position.y = 0.58; g.add(water);
    return g;
  };

  // A crack network that glows: the molten plate's emissive map.
  let moltenTex = null;
  function moltenMap() {
    if (moltenTex) return moltenTex;
    const S = 256, c = G3D.canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), R = G3D.rng(5);
    const pts = []; for (let i = 0; i < 26; i++) pts.push([R() * S, R() * S]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const p of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const dx = x - p[0] - ox * S, dy = y - p[1] - oy * S, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      const v = Math.max(0, 1 - e / 3.2) + G3D.fbm(x / 32, y / 32, 8, 3, 3) * 0.12;
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, v * 255); img.data[i + 1] = Math.min(255, v * v * 170); img.data[i + 2] = Math.min(255, v * v * v * 60); img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    moltenTex = G3D.toTex(c, true); moltenTex.repeat.set(2, 2);
    return moltenTex;
  }

  // ── The Cinder Knight ────────────────────────────────────────────────────
  // A forge-watch knight still burning inside blackened plate.
  G3D.makeCinder = function () {
    const char = G3D.mat('charplate', () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2420'), roughness: 0.55, metalness: 0.8,
      emissive: new THREE.Color('#ff5a14'), emissiveMap: moltenMap(), emissiveIntensity: 0.9, envMapIntensity: 0.8 }));
    const mail = G3D.mailMat(true), hand = G3D.flatMat('charhand', '#1e1612', 0.7);
    const R = K.rig({ leg: mail, boot: char, greave: char, torso: mail, arm: mail, fore: char, hand, pauldron: char, joint: char, sabaton: true, gauntlet: true });
    const sc = mesh(K.lathe([[0.19, 0.02], [0.2, 0.1], [0.215, 0.24], [0.236, 0.38], [0.238, 0.46], [0.222, 0.54], [0.18, 0.585]], 28, Math.PI),
      new THREE.MeshStandardMaterial({ map: G3D.clothTex('cindersur', { base: [42, 30, 24], cross: [120, 30, 10], crossSize: 0.12, crossY: 0.3, stain: 0.9, tattered: true }), roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 }));
    sc.scale.set(1.22, 1, 0.78); R.torso.add(sc);
    K.skirt(R, G3D.clothTex('cindersk', { base: [36, 26, 20], stain: 0.9, tattered: true }), 0.58, 0.36, true);
    const helm = K.makeGreatHelm(char, '#ffb040'); helm.position.y = 0.06; R.head.add(helm);
    const eg = G3D.glow('#ff8a30', 0.55, 0.9); eg.position.set(0, 0.1, 0.16); R.head.add(eg);
    // A burning sword
    const sword = P.sword(G3D.flatMat('cinderblade', '#3a1a10', 0.45, 0.7, { emissive: new THREE.Color('#ff4a10'), emissiveIntensity: 2.6 }), 1.05);
    sword.rotation.x = 2.3; R.gripR.add(sword); R.weapon = sword;
    for (let i = 0; i < 3; i++) { const f = G3D.flame('#ff6a18', 0.12, 0.3, 1.2); f.position.set(0, 0.25 + i * 0.28, 0); sword.add(f); }
    // Fire leaking from the joints, and a light that walks with him.
    [[R.torso, 0, 0.62, 0.05], [R.torso, 0.18, 0.3, 0.12], [R.hips, -0.12, -0.1, 0.1]].forEach(([p, x, y, z]) => { const f = G3D.flame('#ff6a1a', 0.18, 0.32, 1.1); f.position.set(x, y, z); p.add(f); });
    const a = new THREE.Object3D(); a.position.set(0, 1.3, 0.3); R.root.add(a); G3D.anchor(a, '#ff6a20', 1.6, 6, { flicker: 1, priority: 5 });
    R.kind = 'cinder';
    R.smoke = '#ff7a30';
    return R;
  };

  // ── The Ashen Warden ─────────────────────────────────────────────────────
  // A giant in molten plate: horned great helm, crown of spikes, a flame
  // greatsword held two-handed, embers pouring from every seam.
  G3D.makeWarden = function () {
    const plate = G3D.mat('wardenplate', () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a302a'), roughness: 0.42, metalness: 0.92,
      emissive: new THREE.Color('#ff6a18'), emissiveMap: moltenMap(), emissiveIntensity: 1.3, envMapIntensity: 1.1 }));
    const dark = G3D.mat('wardendark', () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1614'), roughness: 0.5, metalness: 0.85 }));
    const R = K.rig({ leg: dark, boot: plate, greave: plate, torso: dark, arm: dark, fore: plate, hand: plate, pauldron: plate, joint: plate, sabaton: true, gauntlet: true });
    // Breastplate and fauld over the dark under-armour
    const bp = mesh(K.lathe([[0.2, 0.06], [0.215, 0.16], [0.24, 0.3], [0.258, 0.42], [0.25, 0.52], [0.22, 0.58], [0.15, 0.62]], 28), plate); bp.scale.set(1.25, 1, 0.82); R.torso.add(bp);
    const faulds = [];
    for (let i = 0; i < 4; i++) faulds.push([new THREE.CylinderGeometry(0.27 + i * 0.02, 0.29 + i * 0.022, 0.09, 24, 1, true), mtx(0, -0.02 - i * 0.075, 0, 0, 0, 0, 1.2, 1, 0.85)]);
    R.hips.add(K.merged(faulds, plate));
    // Great helm with horns and a crown of spikes
    const helm = K.makeGreatHelm(plate, '#ffd060'); helm.position.y = 0.06; helm.scale.setScalar(1.08); R.head.add(helm);
    [-1, 1].forEach(s => {
      const horn = new THREE.Group(); horn.position.set(s * 0.13, 0.17, -0.02); horn.rotation.z = -s * 0.9; R.head.add(horn);
      const h1 = mesh(new THREE.ConeGeometry(0.035, 0.32, 8), dark); h1.position.y = 0.16; horn.add(h1);
    });
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4; const sp = mesh(new THREE.ConeGeometry(0.015, 0.11, 5), plate); sp.position.set(Math.sin(a) * 0.13, 0.25, Math.cos(a) * 0.13); sp.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); R.head.add(sp); }
    const eg = G3D.glow('#ffc060', 0.7, 1); eg.position.set(0, 0.1, 0.18); R.head.add(eg);
    // Ragged ash-grey cloak
    R.cape = K.cape(R, G3D.clothTex('wardencape', { base: [52, 46, 44], tattered: true, stain: 0.7 }), 0.75, 1.3);
    // The greatsword of flame, held in both hands
    const gs = new THREE.Group();
    const blade = P.sword(G3D.flatMat('wardenblade', '#4a1c0c', 0.35, 0.6, { emissive: new THREE.Color('#ff7a20'), emissiveIntensity: 1.8 }), 1.6);
    blade.scale.set(1.5, 1, 1.5); gs.add(blade);
    for (let i = 0; i < 5; i++) { const f = G3D.flame(i % 2 ? '#ffb040' : '#ff5a10', 0.16, 0.38, 0.9); f.position.set(0, 0.3 + i * 0.28, 0); gs.add(f); }
    const bg = G3D.glow('#ff6a20', 1.2, 0.3); bg.position.y = 0.9; gs.add(bg);
    gs.rotation.x = 2.0; R.gripR.add(gs); R.weapon = gs;
    // Embers leak from the seams; a strong light rides on him.
    [[R.torso, -0.22, 0.4, 0.1], [R.torso, 0.22, 0.42, 0.1]].forEach(([p, x, y, z]) => { const f = G3D.flame('#ff7a20', 0.14, 0.28, 0.8); f.position.set(x, y, z); p.add(f); });
    const a = new THREE.Object3D(); a.position.set(0, 1.3, 0.4); R.root.add(a); G3D.anchor(a, '#ff7a28', 1.6, 8, { flicker: 1, priority: 7 });
    R.root.scale.setScalar(1.42);
    R.kind = 'warden';
    R.smoke = '#ff6a20';
    R.plate = plate;
    return R;
  };

  // ── Godfrey the Smith ────────────────────────────────────────────────────
  G3D.makeSmith = function () {
    const R = G3D.makeNPC([96, 58, 34]);
    // Swap the candle for a hammer, and give him a leather apron and a glow of the forge.
    R.torso.traverse(o => { if (o.userData && o.userData.candle) o.visible = false; });
    const apron = mesh(new THREE.PlaneGeometry(0.42, 0.9), G3D.flatMat('apron', '#2a1a10', 0.9, 0, { side: THREE.DoubleSide })); apron.position.set(0, -0.12, 0.29); apron.rotation.x = -0.12; R.torso.add(apron);
    const hammer = new THREE.Group();
    hammer.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.5, 8), G3D.woodMat(true)));
    const head = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.07), G3D.metalMat('steel')); head.position.y = 0.26; hammer.add(head);
    hammer.position.set(0.3, 0.32, 0.2); hammer.rotation.z = -0.4; R.torso.add(hammer);
    // Ghost-light: he is not quite here.
    R.root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.82; o.material.emissive = new THREE.Color('#ff7a30'); o.material.emissiveIntensity = 0.18; } });
    const gl = G3D.glow('#ffa060', 1.6, 0.4); gl.position.set(0, 1.2, 0); R.root.add(gl);
    return R;
  };

  G3D.enemyBuilders = Object.assign(G3D.enemyBuilders || {}, { cinder: G3D.makeCinder, warden: G3D.makeWarden });
  G3D.npcBuilders = Object.assign(G3D.npcBuilders || {}, { godfrey: G3D.makeSmith });

  // ── Rooms ────────────────────────────────────────────────────────────────
  const R = G3D.rooms;

  // Ember Stair: a landing in the bedrock, and a stair going down into red light.
  R.emberstair = () => {
    const s = shell({ w: 8, d: 15, h: 6, tint: 'warm', vault: 'barrel', ribSpacing: 3.2, noFloor: true });
    const g = s.g;
    const landing = mesh(new THREE.PlaneGeometry(8, 8.5), G3D.floorMat('warm', [2.3, 2.4]), false, true); landing.rotation.x = -Math.PI / 2; landing.position.set(0, 0, s.zF - 4.25); g.add(landing);
    // The stair down: each step a little lower, into the glow
    const sm = G3D.stoneMat('warm', [1, 1], 'emstep');
    for (let i = 0; i < 12; i++) {
      const top = -0.22 * (i + 1), z = s.zF - 8.5 - i * 0.55;
      const st = mesh(new THREE.BoxGeometry(4.6, 0.6, 0.56), sm); st.position.set(0, top - 0.3, z - 0.28); g.add(st);
    }
    // Side walls of the stairwell (the rest of the floor drops away)
    [-1, 1].forEach(sd => { const w = mesh(new THREE.BoxGeometry((8 - 4.6) / 2, 1.2, 6.6), sm); w.position.set(sd * (2.3 + (8 - 4.6) / 4), -0.6, s.zF - 8.5 - 3.3); g.add(w); });
    const glowDown = G3D.glow('#ff4a10', 6, 0.3); glowDown.position.set(0, -1.6, s.zB + 1.2); g.add(glowDown);
    const deep = new THREE.Object3D(); deep.position.set(0, -1.2, s.zB + 1.5); g.add(deep); G3D.anchor(deep, '#ff4a14', 2.4, 12, { flicker: 0.6, priority: 5 });
    const lava = P.lava(4.6, 2.2, [0.02, 0.06], 0); lava.position.set(0, -2.8, s.zB + 1.1); g.add(lava);
    // West arch to the forge
    const sideArch = P.gothicArch(2.4, 3.0, 0.5, G3D.stoneMat('warm', [1, 1], 'emside')); sideArch.rotation.y = Math.PI / 2; sideArch.position.set(-s.w / 2 + 0.05, 0, s.zF - 4.5); g.add(sideArch);
    const sideDark = mesh(new THREE.PlaneGeometry(2.2, 3.0), G3D.emissiveMat('emsideglow', '#3a0c02', 1)); sideDark.rotation.y = Math.PI / 2; sideDark.position.set(-s.w / 2 + 0.02, 1.5, s.zF - 4.5); g.add(sideDark);
    place(g, P.brazier('#ff7a28', 1.0), 2.8, 0, s.zF - 2.0);
    place(g, P.brazier('#ff7a28', 1.0), -2.8, 0, s.zF - 7.5);
    wallTorch(g, 'R', s.w / 2 - 0.25, 2.6, s.zF - 6, 0.9);
    place(g, P.anvil(), 2.6, 0, s.zF - 6.4, -0.4);
    place(g, P.barrel(), -3.1, 0, s.zF - 1.8);
    return spec({
      group: g, fog: ['#140604', 0.035], bg: '#060201', vol: { light: 0.4, density: 0.03, ambient: 0.12, wet: 0.2, puddles: 0, dof: 0.2 },
      hemi: ['#5a2a14', '#0a0302', 0.32],
      key: { type: 'spot', pos: [0, -1.5, s.zB + 0.5], target: [0, 1.5, s.zF - 2], color: '#ff6a24', intensity: 1.4, angle: 0.8, penumbra: 0.9, distance: 26 },
      grade: { exposure: 0.8, tint: [1.06, 0.97, 0.9], sat: 1.05, contrast: 1.12 },
      particles: [{ type: 'ember', count: 90, box: [-2.2, 2.2, -2.5, 4.5, s.zB, s.zB + 6], color: '#ff8a30' }, { type: 'dust', count: 90, box: [-3.5, 3.5, 0.3, 5, s.zB + 6, 4], color: '#ffb080' }],
      knight: { pos: [-1.0, 0, 1.8], rot: 0.35 }, npc: { pos: [1.7, 0, -0.6], rot: -0.7 },
      cam: { pos: [0.5, 2.0, 5.9], look: [-0.1, 0.6, -6], fovH: 78 },
    });
  };

  // Cinder Forge: anvils, the great furnace, and a river of molten iron.
  R.forge = () => {
    const s = shell({ w: 16, d: 20, h: 9, tint: 'warm', vault: 'pointed', rise: 6, zFront: 7, noFloor: true, pillars: { spacing: 5, r: 0.45, inset: 1.1 } });
    const g = s.g;
    const chZ = -6.2, chW = 2.2;   // the channel of molten iron, across the room
    const front = mesh(new THREE.PlaneGeometry(s.w, s.zF - (chZ + chW / 2)), G3D.floorMat('warm', [4.5, 3.5]), false, true); front.rotation.x = -Math.PI / 2; front.position.set(0, 0, (s.zF + chZ + chW / 2) / 2); g.add(front);
    const back = mesh(new THREE.PlaneGeometry(s.w, (chZ - chW / 2) - s.zB), G3D.floorMat('warm', [4.5, 1.5]), false, true); back.rotation.x = -Math.PI / 2; back.position.set(0, 0, (chZ - chW / 2 + s.zB) / 2); g.add(back);
    const lava = P.lava(s.w, chW, [0.08, 0.0], 3); lava.position.set(0, -0.9, chZ); g.add(lava);
    const curbM = G3D.stoneMat('warm', [5, 0.4], 'curb');
    [-1, 1].forEach(sd => { const c = mesh(new THREE.BoxGeometry(s.w, 1.0, 0.35), curbM); c.position.set(0, -0.42, chZ + sd * (chW / 2 + 0.17)); g.add(c); });
    // A stone bridge over the channel
    const br = mesh(new THREE.BoxGeometry(2.6, 0.5, chW + 0.8), G3D.stoneMat('warm', [1, 1], 'fbridge')); br.position.set(3.5, -0.25, chZ); g.add(br);
    const furnace = P.furnace(); furnace.position.set(0, 0, s.zB + 1.15); g.add(furnace);
    place(g, P.bellows(), -3.4, 0, s.zB + 1.6, 0.2);
    // Anvils with glowing blades, a quench trough, racks and chains
    [[-3.2, -1.2, 0.4], [-0.6, -3.4, -0.3], [3.8, -1.8, -0.6]].forEach(([x, z, r]) => {
      const a = P.anvil(); a.position.set(x, 0, z); a.rotation.y = r; g.add(a);
      const b = P.hotBlade(0.8); b.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + r); b.position.set(x, 0.92, z); g.add(b);
    });
    place(g, P.quench(), 5.6, 0, 0.6, -0.3);
    place(g, P.weaponRack(17), -6.6, 0, -2.5, Math.PI / 2);
    place(g, P.weaponRack(23), 6.6, 0, -3.5, -Math.PI / 2);
    [[-2.5, -3.5], [2.2, -9.0], [-5.0, -10.5]].forEach(([x, z], i) => { const c = P.chain(4.2, i + 7); c.position.set(x, 9, z); g.add(c); });
    s.pillarZ.forEach(z => { wallTorch(g, 'L', -s.w / 2 + 0.25, 3.0, z - 2); wallTorch(g, 'R', s.w / 2 - 0.25, 3.0, z - 2); });
    for (let i = 0; i < 2; i++) { const b = P.banner(1.3, 4.0, 'red'); b.position.set(-5 + i * 10, 7.4, s.zB + 0.1); g.add(b); }
    return spec({
      group: g, fog: ['#180804', 0.03], bg: '#060201', vol: { light: 0.35, density: 0.028, ambient: 0.12, key: 0.25, wet: 0.15, puddles: 0 },
      hemi: ['#6a3018', '#0a0302', 0.3],
      key: { type: 'spot', pos: [0, 2.2, s.zB + 3.5], target: [0, 0.5, 2], color: '#ff7a30', intensity: 1.6, angle: 0.95, penumbra: 1, distance: 30 },
      grade: { exposure: 0.78, tint: [1.06, 0.97, 0.9], sat: 1.05, contrast: 1.14 },
      particles: [{ type: 'ember', count: 160, box: [-7, 7, -0.6, 4, chZ - 1.2, chZ + 1.2], color: '#ff8a30' }, { type: 'ember', count: 60, box: [-1.4, 1.4, 0.8, 4, s.zB + 1.2, s.zB + 2.6], color: '#ffb050' },
        { type: 'fog', count: 20, box: [-7, 7, -0.6, 0.6, chZ - 1, chZ + 1], color: '#a03a10', opacity: 0.08 }, { type: 'dust', count: 120, box: [-7, 7, 0.3, 7, s.zB, 5], color: '#ffb080' }],
      knight: { pos: [-1.6, 0, 2.6], rot: 0.55 }, enemy: { pos: [1.0, 0, 0.6], rot: -2.3 },
      cam: { pos: [0.6, 2.1, 7.2], look: [-0.1, 1.4, -4], fovH: 80 },
    });
  };

  // Warden's Vault: a dais over a lake of fire, reached by a stone bridge.
  R.vault = () => {
    const s = shell({ w: 18, d: 22, h: 12, tint: 'blood', vault: 'pointed', rise: 8, zFront: 8, noFloor: true, pillars: { spacing: 5.5, r: 0.55, inset: 1.2 } });
    const g = s.g;
    const lava = P.lava(s.w, s.d, [0.03, 0.02], 0, 0.6); lava.position.set(0, -1.1, s.zF - s.d / 2); g.add(lava);
    [[-6, -1], [6, -2], [-5, -10], [5, -11], [0, -12.5]].forEach(([x, z]) => { const a = new THREE.Object3D(); a.position.set(x, -0.4, z); g.add(a); G3D.anchor(a, '#ff4a10', 1.4, 9, { flicker: 0.3, priority: 3 }); });
    const fm = G3D.floorMat('blood', [2, 2]), bm = G3D.stoneMat('blood', [2, 1], 'vbridge');
    const landing = mesh(new THREE.PlaneGeometry(6, 3.2), fm, false, true); landing.rotation.x = -Math.PI / 2; landing.position.set(0, 0, s.zF - 1.6); g.add(landing);
    const landBase = mesh(new THREE.BoxGeometry(6, 1.2, 3.2), bm); landBase.position.set(0, -0.61, s.zF - 1.6); g.add(landBase);
    const bridge = mesh(new THREE.BoxGeometry(2.8, 1.2, 4.0), bm); bridge.position.set(0, -0.61, s.zF - 3.2 - 2.0); g.add(bridge);
    const bridgeTop = mesh(new THREE.PlaneGeometry(2.8, 4.0), fm, false, true); bridgeTop.rotation.x = -Math.PI / 2; bridgeTop.position.set(0, 0.005, s.zF - 5.2); g.add(bridgeTop);
    const dz = -2.6, dr = 4.6;
    const dais = mesh(new THREE.CylinderGeometry(dr, dr + 0.4, 1.2, 48), bm); dais.position.set(0, -0.61, dz); g.add(dais);
    const top = mesh(new THREE.CircleGeometry(dr, 48), fm, false, true); top.rotation.x = -Math.PI / 2; top.position.set(0, 0.005, dz); g.add(top);
    const ring = P.runeCircle(3.4, '#ff6a20'); ring.position.set(0, 0.02, dz); g.add(ring);
    // The Warden's seat and the war-blades of the Order behind it
    const throne = mesh(new THREE.BoxGeometry(1.6, 2.6, 0.5), G3D.stoneMat('blood', [1, 1], 'wthrone')); throne.position.set(0, 1.3, dz - 3.9); g.add(throne);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 1.6, sw = P.sword(G3D.metalMat('steel', { extra: { roughness: 0.4 } }), 1.3);
      sw.position.set(Math.sin(a) * 3.6, 0.3, dz - Math.cos(a) * 3.6); sw.rotation.set(Math.PI, 0, (Math.random() - 0.5) * 0.15); g.add(sw);
    }
    [-1, 1].forEach(sd => place(g, P.brazier('#ff7a28', 1.1), sd * 3.9, 0, dz - 2.4));
    // Lava-falls pour from the back wall
    [-5.5, 5.5].forEach(x => { const f = P.lavaFall(2.4, 9.5); f.position.set(x, 3.6, s.zB + 0.35); g.add(f); });
    const gl = G3D.glow('#ff4a10', 14, 0.12); gl.position.set(0, -0.6, -4); g.add(gl);
    for (let i = 0; i < 3; i++) { const b = P.banner(1.6, 5.4, 'black'); b.position.set(-4.2 + i * 4.2, 10.4, s.zB + 0.12); g.add(b); }
    return spec({
      group: g, fog: ['#1a0604', 0.026], bg: '#080201', vol: { light: 0.3, density: 0.026, ambient: 0.12, key: 0.25, wet: 0.1, puddles: 0, dof: 0.18 },
      hemi: ['#7a3018', '#0a0202', 0.3],
      key: { type: 'spot', pos: [0, 11, dz + 2], target: [0, 0, dz], color: '#ff8a40', intensity: 1.8, angle: 0.55, penumbra: 0.8, distance: 34 },
      grade: { exposure: 0.78, tint: [1.08, 0.96, 0.88], sat: 1.06, contrast: 1.16 },
      particles: [{ type: 'ember', count: 220, box: [-8.5, 8.5, -1, 6, s.zB, 6], color: '#ff8a30' }, { type: 'ember', count: 50, box: [-1.2, 1.2, 0.6, 3, dz - 1, dz + 1], color: '#ffc060' },
        { type: 'fog', count: 26, box: [-8, 8, -1, 0.2, s.zB, 6], color: '#b0400f', opacity: 0.09 }],
      knight: { pos: [-1.7, 0, -0.6], rot: 1.2 }, enemy: { pos: [1.7, 0, -2.4], rot: -1.9 },
      relic: [0, 0, dz - 2], scroll: [-2.6, 0, dz],
      cam: { pos: [0.4, 2.7, 7.6], look: [0, 1.3, -4], fovH: 80 },
    });
  };

  Object.assign(G3D.roomTypeMap, { emberstair: 'emberstair', forge: 'forge', vault: 'vault' });

  // ── Living fire: the Warden's plate breathes with the fight ──────────────
  const E = G3D.engine;
  if (!E) return;
  function boot() {
    if (!E.active) return;
    const prev = E.onFrame;
    E.onFrame = function (dt) {
      if (prev) prev(dt);
      const c = E.ctx, en = c && c.enemy;
      if (!en || (en.kind !== 'warden' && en.kind !== 'cinder')) return;
      const t = G3D.uniforms.time.value;
      // Molten plate glows hot until a parry cracks it; then it gutters and flares.
      const cracked = typeof STATE !== 'undefined' && STATE.questFlags && STATE.questFlags._wardenPlateCracked;
      const phase = typeof STATE !== 'undefined' ? STATE.wardenPhase || 0 : 0;
      const base = en.kind === 'cinder' ? 0.9 : cracked ? 0.7 + Math.max(0, Math.sin(t * 9)) * 0.8 : 1.3 + Math.sin(t * 2.2) * 0.25;
      const boost = en.kind === 'warden' && phase >= 2 ? 1.3 : 1;
      en.mats.forEach(m => { if (m.emissiveMap) m.userData.baseEI = base * boost; });
      // Embers rising off him
      if (Math.random() < dt * (en.kind === 'warden' ? 14 : 6)) {
        const p = en.R.root.position.clone(); p.x += (Math.random() - 0.5) * 0.6; p.y += 0.6 + Math.random() * 1.6; p.z += (Math.random() - 0.5) * 0.6;
        E.burst && E.burst('ember', p, 1, '#ff8a30', 0.6);
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
