/* Knights Templar 3D — core utilities and procedural textures.
   Everything is generated at runtime on canvases (no image downloads):
   colour maps plus matching normal and roughness maps derived from a height
   field, so stone, wood and metal pick up real lighting. */
(function () {
  'use strict';
  const G3D = window.G3D = window.G3D || {};

  // ── Deterministic RNG + value noise (shared with the texture worker) ───────
  const T = window.KTTex;
  const rng = T.rng, fbm = T.fbm;
  G3D.rng = rng;
  G3D.fbm = fbm;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G3D.clamp = clamp;
  G3D.lerp = (a, b, t) => a + (b - a) * t;
  G3D.smooth = t => t * t * (3 - 2 * t);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  G3D.canvas = canvas;

  let maxAniso = 4;
  G3D.setAnisotropy = n => { maxAniso = Math.min(8, n || 4); };

  function toTex(c, srgb, repeat) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  G3D.toTex = toTex;

  // Raw RGBA arrays (see texgen.js) -> canvases.
  function paint(c, size, data) {
    if (c.width !== size) { c.width = c.height = size; }
    const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
    img.data.set(data); ctx.putImageData(img, 0, 0);
    return c;
  }
  function fromRaw(r) {
    return { size: r.size, color: paint(canvas(r.size), r.size, r.color), rough: paint(canvas(r.size), r.size, r.rough), normal: paint(canvas(r.size), r.size, r.normal) };
  }
  // A PBR set (colour, roughness + height, normal), built now at the current
  // texture size and remembered so the worker can rebuild it sharper later.
  function genSet(kind, arg, size) {
    const set = fromRaw(T.build(kind, arg, size));
    set.kind = kind; set.arg = arg;
    sets.push(set);
    set.target = set.size * (hi || 1);
    if (hi) upgrade(set);
    return set;
  }

  const cache = {};
  function cached(key, make) { return cache[key] || (cache[key] = make()); }

  // One GPU texture set per canvas set, shared by every material that uses it.
  // (r128 uploads each Texture object separately, so per-repeat clones would
  // duplicate megabytes of VRAM.) Tiling is applied per material in the shader.
  const setTex = new Map();
  function texSet(set) {
    if (!setTex.has(set)) setTex.set(set, { map: toTex(set.color, true), normalMap: toTex(set.normal, false), roughnessMap: toTex(set.rough, false) });
    return setTex.get(set);
  }

  // ── High-resolution upgrade (Ultra): a Web Worker rebuilds every set in use
  // at hi× size off the main thread; each arrives and swaps into its textures.
  const sets = [];
  let hi = 0, worker = null, nextId = 1;
  const pending = new Map();
  function upgrade(set) {
    if (!worker || set.upgrading || set.size >= set.target) return;
    const id = nextId++; set.upgrading = true;
    pending.set(id, set);
    worker.postMessage({ id, kind: set.kind, arg: set.arg, size: set.target });
  }
  function received(e) {
    const r = e.data, set = pending.get(r.id);
    pending.delete(r.id);
    if (!set) return;
    set.upgrading = false;
    if (r.error) { console.warn('[3D] texture worker', r.error); return; }
    paint(set.color, r.size, r.color); paint(set.rough, r.size, r.rough); paint(set.normal, r.size, r.normal);
    set.size = r.size;
    const t = setTex.get(set);
    if (t) [t.map, t.normalMap, t.roughnessMap].forEach(x => { x.needsUpdate = true; });
    G3D.texUpgrades = (G3D.texUpgrades || 0) + 1;
  }
  // factor: 2 → 512 stone becomes 1024, 256 metal becomes 512.
  G3D.hiResTextures = function (factor) {
    if (hi || !factor || typeof Worker === 'undefined') return false;
    try { worker = new Worker('/game3d/texgen.js'); } catch (_) { return false; }
    worker.onmessage = received;
    worker.onerror = ev => { console.warn('[3D] texture worker unavailable'); worker = null; ev.preventDefault && ev.preventDefault(); };
    hi = factor;
    sets.forEach(s => { s.target = s.size * hi; upgrade(s); });
    return true;
  };
  G3D.textureSets = () => sets.map(s => ({ kind: s.kind, arg: s.arg, size: s.size }));
  // Per-material shader patches: UV scale (shares one program across all
  // scales) and, on the Ultra tier, parallax occlusion (G3D.pomOn, fx.js).
  function patchStd(m) {
    const ud = m.userData;
    if (!ud.uvScale && !ud.pom) return m;
    m.onBeforeCompile = sh => {
      if (ud.uvScale) {
        sh.uniforms.uvScale = { value: ud.uvScale };
        sh.vertexShader = 'uniform vec2 uvScale;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#ifdef USE_UV\n\tvUv = ( uvTransform * vec3( uv * uvScale, 1 ) ).xy;\n#endif');
      }
      if (ud.pom && G3D.pomOn && m.roughnessMap && G3D.fx) G3D.fx.patchPOM(sh, ud.pom);
    };
    m.customProgramCacheKey = () => (ud.uvScale ? 'uvScale' : '') + (ud.pom && G3D.pomOn ? 'pom' : '');
    return m;
  }
  function withRepeat(m, repeat) {
    const rx = repeat ? repeat[0] : 1, ry = repeat ? repeat[1] : 1;
    if (rx === 1 && ry === 1) return m;
    m.userData.uvScale = new THREE.Vector2(rx, ry);
    return patchStd(m);
  }
  // Parallax depth in metres (mortar joints, flagstone seams).
  function withPOM(m, depth) { m.userData.pom = depth; return patchStd(m); }
  // A cloned material loses its onBeforeCompile; restore the patches from the source.
  G3D.repatch = (m, src) => {
    const su = src.userData;
    if (su.uvScale) m.userData.uvScale = new THREE.Vector2(su.uvScale.x, su.uvScale.y);
    if (su.pom) m.userData.pom = su.pom;
    return patchStd(m);
  };
  G3D.withRepeat = withRepeat;

  let TEX = 512;
  G3D.setTextureSize = n => { TEX = n; };

  // ── Stone, flagstones, wood, metal, chainmail (generators in texgen.js) ────
  G3D.stoneWallSet = (tint) => cached('wall' + (tint || ''), () => genSet('wall', tint || '', TEX));
  G3D.floorSet = (tint) => cached('floor' + (tint || ''), () => genSet('floor', tint || '', TEX));
  G3D.woodSet = (dark) => cached('wood' + (dark ? 'd' : ''), () => genSet('wood', !!dark, TEX / 2));
  G3D.metalSet = (kind) => cached('metal' + kind, () => genSet('metal', kind, 256));
  G3D.mailSet = (rusty) => cached('mail' + (rusty ? 'r' : ''), () => genSet('mail', !!rusty, 256));

  // ── Cloth: plain or with a Templar cross ───────────────────────────────────
  // opts: { base:[r,g,b], cross:[r,g,b]|null, trim:[r,g,b]|null, tattered:bool, stain:0..1 }
  G3D.clothTex = (key, opts) => cached('cloth' + key, () => {
    const S = 512, c = canvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S), d = img.data;
    const b = opts.base;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const weave = ((x % 4 < 2) ^ (y % 4 < 2)) ? 0.96 : 1.04;
      const n = fbm(u * 6, v * 6, 6, 4, 3), stain = (opts.stain || 0) * clamp(fbm(u * 3, v * 3, 3, 4, 8) * 2 - 0.6, 0, 1);
      const k = weave * (0.82 + n * 0.3) * (1 - stain * 0.55);
      const i = (y * S + x) * 4;
      d[i] = clamp(b[0] * k + stain * 30, 0, 255); d[i + 1] = clamp(b[1] * k, 0, 255); d[i + 2] = clamp(b[2] * k, 0, 255); d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (opts.cross) {
      // Cross pattée: arms flare toward the ends.
      ctx.fillStyle = `rgb(${opts.cross.join(',')})`;
      const cx = S / 2, cy = S * (opts.crossY || 0.42), L = S * (opts.crossSize || 0.3), nw = L * 0.16, fw = L * 0.5;
      ctx.beginPath();
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const P = (r, t) => [cx + ca * r - sa * t, cy + sa * r + ca * t];
        const p1 = P(nw * 0.6, -nw / 2), p2 = P(L, -fw / 2), p3 = P(L * 0.92, 0), p4 = P(L, fw / 2), p5 = P(nw * 0.6, nw / 2);
        if (a === 0) ctx.moveTo(p1[0], p1[1]); else ctx.lineTo(p1[0], p1[1]);
        ctx.quadraticCurveTo(...P(L * 0.55, -nw * 0.7), p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]);
        ctx.quadraticCurveTo(...P(L * 0.55, nw * 0.7), p5[0], p5[1]);
      }
      ctx.closePath(); ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    }
    if (opts.trim) {
      ctx.fillStyle = `rgb(${opts.trim.join(',')})`;
      ctx.fillRect(0, S - 26, S, 14); ctx.fillRect(0, 10, S, 8);
      ctx.globalAlpha = 0.6;
      for (let x = 0; x < S; x += 24) ctx.fillRect(x, S - 36, 10, 6);
      ctx.globalAlpha = 1;
    }
    if (opts.tattered) {
      // Ragged bottom edge — alpha-tested by the material.
      ctx.globalCompositeOperation = 'destination-out';
      const R = rng(5);
      ctx.beginPath(); ctx.moveTo(0, S);
      for (let x = 0; x <= S; x += 12) ctx.lineTo(x, S - 10 - R() * 70);
      ctx.lineTo(S, S); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(R() * S, S * 0.4 + R() * S * 0.5, 6 + R() * 18, 4 + R() * 12, R() * 3, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    return toTex(c, true);
  });

  // ── Stained glass (rose window) ────────────────────────────────────────────
  G3D.stainedGlassTex = () => cached('glass', () => {
    const S = 512, c = canvas(S), ctx = c.getContext('2d'), R = rng(99);
    const cols = ['#b8141e', '#1d3fb5', '#d9a21a', '#1f7a3a', '#6b1d8f', '#c2410c', '#0e7490'];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    // Radial panes in rings
    const ringsR = [0, 40, 95, 160, 230, 256];
    for (let r = 0; r < ringsR.length - 1; r++) {
      const n = r === 0 ? 1 : 6 * r + 6;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringsR[r + 1] - 3, a0, a1);
        if (r === 0) ctx.lineTo(cx, cy); else ctx.arc(cx, cy, ringsR[r] + 3, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = r === 0 ? '#e8c060' : cols[Math.floor(R() * cols.length)];
        ctx.fill();
      }
    }
    // Lead came
    ctx.strokeStyle = '#050403'; ctx.lineWidth = 7;
    ringsR.forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); });
    // Central cross pattée in red on gold
    ctx.fillStyle = '#9a0f14';
    ctx.fillRect(cx - 9, cy - 32, 18, 64); ctx.fillRect(cx - 32, cy - 9, 64, 18);
    // Glass grain
    const img = ctx.getImageData(0, 0, S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, n = 0.7 + fbm(x / 40, y / 40, 13, 3, 4) * 0.6;
      d[i] *= n; d[i + 1] *= n; d[i + 2] *= n;
    }
    ctx.putImageData(img, 0, 0);
    const t = toTex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  // Tall lancet window panes
  G3D.lancetGlassTex = () => cached('lancet', () => {
    const W = 256, H = 1024, c = canvas(W, H), ctx = c.getContext('2d'), R = rng(7);
    const cols = ['#9b1218', '#1c3a9e', '#c99418', '#1c6b34', '#5a1a7a', '#14286e', '#7a0e14'];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // Irregular quarries in diamond lattice, as real lancets are glazed
    for (let y = -40; y < H + 40; y += 28) for (let x = -40; x < W + 40; x += 28) {
      const ox = (Math.floor(y / 28) % 2) * 14;
      ctx.fillStyle = cols[Math.floor(R() * cols.length)];
      ctx.beginPath(); ctx.moveTo(x + ox, y - 13); ctx.lineTo(x + ox + 13, y); ctx.lineTo(x + ox, y + 13); ctx.lineTo(x + ox - 13, y); ctx.closePath(); ctx.fill();
    }
    // A haloed saint holding a cross
    ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(W / 2, 330, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0dcc0'; ctx.beginPath(); ctx.arc(W / 2, 336, 28, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(W / 2 - 50, 700); ctx.lineTo(W / 2 - 34, 380); ctx.lineTo(W / 2 + 34, 380); ctx.lineTo(W / 2 + 50, 700); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a01018'; ctx.fillRect(W / 2 - 7, 420, 14, 120); ctx.fillRect(W / 2 - 34, 450, 68, 14);
    ctx.fillStyle = '#c9a030'; ctx.fillRect(W / 2 + 46, 360, 8, 360); ctx.fillRect(W / 2 + 30, 400, 40, 8);
    // Lead lines
    ctx.strokeStyle = '#050403'; ctx.lineWidth = 3;
    for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 28); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W, y); ctx.lineTo(0, y + 28); ctx.stroke(); }
    ctx.lineWidth = 10; ctx.strokeRect(0, 0, W, H);
    const t = toTex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  // ── Parchment and painted portraits ────────────────────────────────────────
  G3D.parchmentTex = () => cached('parch', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fbm(x / S * 5, y / S * 5, 5, 5, 2), e = Math.min(x, y, S - x, S - y) / S;
      const k = (0.75 + n * 0.35) * (0.6 + clamp(e * 6, 0, 1) * 0.4), i = (y * S + x) * 4;
      d[i] = 222 * k; d[i + 1] = 196 * k; d[i + 2] = 150 * k; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(40,22,10,0.55)';
    for (let l = 0; l < 14; l++) ctx.fillRect(28, 30 + l * 14, 120 + ((l * 37) % 80), 3);
    ctx.fillStyle = 'rgba(150,20,20,0.8)'; ctx.fillRect(28, 26, 18, 18);
    return toTex(c, true);
  });

  G3D.portraitTex = (i) => cached('portrait' + i, () => {
    const W = 192, H = 256, c = canvas(W, H), ctx = c.getContext('2d'), R = rng(300 + i);
    const bgs = [['#2a1a10', '#4a2c18'], ['#101820', '#2a3a4a'], ['#1a1010', '#4a2020'], ['#141a10', '#36402a']][i % 4];
    const g = ctx.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, bgs[1]); g.addColorStop(1, bgs[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Shoulders / surcoat
    ctx.fillStyle = i % 2 ? '#d8d0bc' : '#5a4a3a';
    ctx.beginPath(); ctx.moveTo(10, H); ctx.quadraticCurveTo(W / 2, H * 0.5, W - 10, H); ctx.fill();
    if (i % 2) { ctx.fillStyle = '#8a1010'; ctx.fillRect(W / 2 - 8, H * 0.72, 16, 60); ctx.fillRect(W / 2 - 26, H * 0.8, 52, 14); }
    // Head (helm or face)
    if (R() > 0.5) {
      ctx.fillStyle = '#8a8a90'; ctx.fillRect(W / 2 - 30, H * 0.22, 60, 76);
      ctx.fillStyle = '#111'; ctx.fillRect(W / 2 - 24, H * 0.36, 48, 6); ctx.fillRect(W / 2 - 3, H * 0.36, 6, 34);
    } else {
      ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.38, 28, 36, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.48, 26, 18, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#1a1008'; ctx.fillRect(W / 2 - 14, H * 0.35, 7, 4); ctx.fillRect(W / 2 + 7, H * 0.35, 7, 4);
    }
    // Varnish + craquelure
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 0.75 + fbm(x / 30, y / 30, 9, 3, i) * 0.4, j = (y * W + x) * 4;
      d[j] *= k * 1.05; d[j + 1] *= k * 0.95; d[j + 2] *= k * 0.75;
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, true);
  });

  // ── Soft radial sprite (glows, particles) ──────────────────────────────────
  G3D.glowTex = () => cached('glow', () => {
    const S = 128, c = canvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return toTex(c, false);
  });

  // Runic circle for the necromancer's lair (alpha mask, tinted in shader).
  G3D.runeTex = () => cached('runes', () => {
    const S = 1024, c = canvas(S), ctx = c.getContext('2d'), R = rng(666);
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
    const cx = S / 2, cy = S / 2;
    [480, 455, 330, 310, 150].forEach((r, i) => { ctx.lineWidth = i % 2 ? 4 : 9; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); });
    // Pentagram
    ctx.lineWidth = 7; ctx.beginPath();
    for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * 4 * Math.PI / 5; const x = cx + Math.cos(a) * 310, y = cy + Math.sin(a) * 310; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // Runes around the band
    ctx.font = 'bold 34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let k = 0; k < 40; k++) {
      const a = k / 40 * Math.PI * 2; ctx.save(); ctx.translate(cx + Math.cos(a) * 392, cy + Math.sin(a) * 392); ctx.rotate(a + Math.PI / 2);
      ctx.fillText(glyphs[Math.floor(R() * glyphs.length)], 0, 0); ctx.restore();
    }
    const t = toTex(c, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  // ── Material factory (shared, cached) ──────────────────────────────────────
  const mats = {};
  G3D.mat = function (key, make) { return mats[key] || (mats[key] = make()); };

  G3D.stoneMat = (tint, repeat, key) => G3D.mat('stone' + tint + (key || repeat.join('x')), () => {
    const s = texSet(G3D.stoneWallSet(tint));
    const m = withRepeat(new THREE.MeshStandardMaterial({ ...s, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1, metalness: 0 }), repeat);
    return key === 'statue' ? m : withPOM(m, 0.03);
  });
  G3D.floorMat = (tint, repeat) => G3D.mat('floor' + tint + repeat.join('x'), () => {
    const s = texSet(G3D.floorSet(tint));
    return withPOM(withRepeat(new THREE.MeshStandardMaterial({ ...s, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0 }), repeat), 0.018);
  });
  G3D.woodMat = (dark, repeat) => G3D.mat('wood' + dark + (repeat || [1, 1]).join('x'), () => {
    const s = texSet(G3D.woodSet(dark));
    return withRepeat(new THREE.MeshStandardMaterial({ ...s, roughness: 1, metalness: 0 }), repeat);
  });
  G3D.metalMat = (kind, opts) => G3D.mat('metal' + kind + JSON.stringify(opts || {}), () => {
    const s = texSet(G3D.metalSet(kind));
    return withRepeat(new THREE.MeshStandardMaterial(Object.assign({
      ...s, metalness: kind === 'rust' ? 0.55 : 1, roughness: 1,
      envMapIntensity: kind === 'rust' ? 1.2 : 2.6,
    }, opts && opts.extra)), opts && opts.repeat);
  });
  G3D.mailMat = (rusty) => G3D.mat('mail' + rusty, () => {
    const s = texSet(G3D.mailSet(rusty));
    return withRepeat(new THREE.MeshStandardMaterial({ ...s, metalness: rusty ? 0.6 : 0.95, roughness: 1, normalScale: new THREE.Vector2(1.5, 1.5), envMapIntensity: rusty ? 1 : 2.2 }), [4, 4]);
  });
  G3D.flatMat = (key, color, rough, metal, extra) => G3D.mat('flat' + key, () =>
    new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(color), roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }, extra)));
  G3D.emissiveMat = (key, color, intensity) => G3D.mat('emis' + key, () =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity || 1), toneMapped: false }));

  // ── Geometry helpers ───────────────────────────────────────────────────────
  // Merge several (geometry, matrix) pairs into one non-indexed BufferGeometry.
  G3D.merge = function (parts) {
    const pos = [], nor = [], uv = [];
    parts.forEach(([g, m]) => {
      const geo = (g.index ? g.toNonIndexed() : g.clone());
      if (m) geo.applyMatrix4(m);
      const p = geo.attributes.position.array, n = geo.attributes.normal.array;
      const t = geo.attributes.uv ? geo.attributes.uv.array : new Float32Array(p.length / 3 * 2);
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      for (let i = 0; i < t.length; i++) uv.push(t[i]);
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  };
  G3D.mtx = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x || 0, y || 0, z || 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
    return m;
  };

  // Mesh helper with shadow flags.
  G3D.mesh = function (geo, mat, cast, receive) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast !== false; m.receiveShadow = receive !== false;
    return m;
  };
})();
