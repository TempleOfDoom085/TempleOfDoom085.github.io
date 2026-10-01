/* Knights Templar 3D — core utilities and procedural textures.
   Everything is generated at runtime on canvases (no image downloads):
   colour maps plus matching normal and roughness maps derived from a height
   field, so stone, wood and metal pick up real lighting. */
(function () {
  'use strict';
  const G3D = window.G3D = window.G3D || {};

  // ── Deterministic RNG + value noise ────────────────────────────────────────
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  G3D.rng = rng;

  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Tileable value noise: lattice wraps every `period` cells.
  function vnoise(x, y, period, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const p = period;
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
    const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, period, oct, seed) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += vnoise(x * f, y * f, period * f, seed + i * 17) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
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

  // Height field (Float32Array, 0..1) -> tangent-space normal map canvas.
  function normalFromHeight(h, w, hgt, strength) {
    const c = canvas(w, hgt), ctx = c.getContext('2d');
    const img = ctx.createImageData(w, hgt), d = img.data;
    for (let y = 0; y < hgt; y++) {
      for (let x = 0; x < w; x++) {
        const xl = h[y * w + ((x - 1 + w) % w)], xr = h[y * w + ((x + 1) % w)];
        const yu = h[((y - 1 + hgt) % hgt) * w + x], yd = h[((y + 1) % hgt) * w + x];
        let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * w + x) * 4;
        d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255;
        d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Build a PBR texture set from a per-pixel function returning
  // [r,g,b (0..255), height 0..1, roughness 0..1].
  function buildSet(size, fn, normalStrength) {
    const cc = canvas(size), rc = canvas(size);
    const cctx = cc.getContext('2d'), rctx = rc.getContext('2d');
    const ci = cctx.createImageData(size, size), ri = rctx.createImageData(size, size);
    const height = new Float32Array(size * size);
    const out = [0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        fn(x, y, out);
        const i = (y * size + x), j = i * 4;
        ci.data[j] = out[0]; ci.data[j + 1] = out[1]; ci.data[j + 2] = out[2]; ci.data[j + 3] = 255;
        const r = clamp(out[4], 0, 1) * 255;
        ri.data[j] = r; ri.data[j + 1] = r; ri.data[j + 2] = r; ri.data[j + 3] = 255;
        height[i] = out[3];
      }
    }
    cctx.putImageData(ci, 0, 0); rctx.putImageData(ri, 0, 0);
    return { color: cc, rough: rc, normal: normalFromHeight(height, size, size, normalStrength) };
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
  // Per-material UV scale (shares one shader program across all scales).
  function withRepeat(m, repeat) {
    const rx = repeat ? repeat[0] : 1, ry = repeat ? repeat[1] : 1;
    if (rx === 1 && ry === 1) return m;
    const scale = new THREE.Vector2(rx, ry);
    m.userData.uvScale = scale;
    m.onBeforeCompile = sh => {
      sh.uniforms.uvScale = { value: scale };
      sh.vertexShader = 'uniform vec2 uvScale;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#ifdef USE_UV\n\tvUv = ( uvTransform * vec3( uv * uvScale, 1 ) ).xy;\n#endif');
    };
    m.customProgramCacheKey = () => 'uvScale';
    return m;
  }
  G3D.withRepeat = withRepeat;

  let TEX = 512;
  G3D.setTextureSize = n => { TEX = n; };

  // ── Ashlar stone wall ──────────────────────────────────────────────────────
  G3D.stoneWallSet = (tint) => cached('wall' + (tint || ''), () => {
    const S = TEX, rows = 8, R = rng(11);
    // Pre-compute course offsets and block widths so blocks tile horizontally.
    const courses = [];
    for (let r = 0; r < rows; r++) {
      const edges = [0]; let x = 0;
      while (x < 1) { x += 0.18 + R() * 0.16; edges.push(Math.min(x, 1)); }
      if (1 - edges[edges.length - 2] < 0.08) edges.splice(edges.length - 2, 1);
      courses.push({ edges, off: R(), shade: [] });
      for (let b = 0; b < edges.length; b++) courses[r].shade.push(0.82 + R() * 0.3);
    }
    const base = tint === 'cold' ? [74, 80, 90] : tint === 'warm' ? [98, 86, 70] : tint === 'blood' ? [84, 62, 58] : [86, 82, 76];
    return buildSet(S, (px, py, o) => {
      const u = px / S, v = py / S;
      const row = Math.floor(v * rows), c = courses[row];
      let uu = (u + c.off) % 1, bi = 0;
      while (bi < c.edges.length - 1 && uu > c.edges[bi + 1]) bi++;
      const bx0 = c.edges[bi], bx1 = c.edges[bi + 1] || 1;
      const ev = (v * rows) % 1;
      const ex = Math.min(uu - bx0, bx1 - uu) * S / 1.0, ey = Math.min(ev, 1 - ev) * S / rows;
      const edge = Math.min(ex, ey);
      const mortar = clamp(1 - edge / 3.2, 0, 1);
      const bevel = clamp(edge / 9, 0, 1);
      const n = fbm(u * 8, v * 8, 8, 5, 3);
      const n2 = fbm(u * 32, v * 32, 32, 3, 9);
      const grime = fbm(u * 3, v * 3, 3, 4, 21);
      const sh = c.shade[bi] * (0.78 + n * 0.45) * (1 - grime * 0.35);
      const chip = n2 > 0.72 ? (n2 - 0.72) * 2 : 0;
      let k = sh * (1 - mortar * 0.6) * (1 - chip * 0.6);
      o[0] = clamp(base[0] * k + n2 * 10, 0, 255);
      o[1] = clamp(base[1] * k + n2 * 9, 0, 255);
      o[2] = clamp(base[2] * k + n2 * 8, 0, 255);
      // Damp moss streaks low on the wall
      const moss = clamp((v - 0.7) * 3, 0, 1) * clamp(grime * 1.6 - 0.5, 0, 1);
      o[0] *= 1 - moss * 0.35; o[2] *= 1 - moss * 0.45;
      o[3] = bevel * 0.7 + n * 0.25 + n2 * 0.08 - chip * 0.3 - mortar * 0.3;
      o[4] = 0.78 + n2 * 0.2 + mortar * 0.1 - moss * 0.3;
    }, 5);
  });

  // ── Flagstone floor ────────────────────────────────────────────────────────
  G3D.floorSet = (tint) => cached('floor' + (tint || ''), () => {
    const S = TEX, cells = 4, R = rng(77);
    const shades = []; for (let i = 0; i < cells * cells * 4; i++) shades.push(0.75 + R() * 0.35);
    const base = tint === 'cold' ? [62, 66, 74] : tint === 'warm' ? [92, 80, 64] : tint === 'blood' ? [72, 52, 48] : [76, 72, 66];
    return buildSet(S, (px, py, o) => {
      const u = px / S, v = py / S;
      // Irregular grid: jitter the cell lines with low-frequency noise.
      const ju = u * cells + (fbm(v * 4, u * 4, 4, 2, 5) - 0.5) * 0.35;
      const jv = v * cells + (fbm(u * 4, v * 4, 4, 2, 6) - 0.5) * 0.35;
      const cx = Math.floor(ju), cy = Math.floor(jv);
      const fx = ju - cx, fy = jv - cy;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * S / cells;
      const grout = clamp(1 - edge / 3.5, 0, 1);
      const n = fbm(u * 10, v * 10, 10, 5, 31), n2 = fbm(u * 40, v * 40, 40, 2, 41);
      const crack = Math.abs(fbm(u * 6, v * 6, 6, 4, 51) - 0.5) < 0.012 ? 1 : 0;
      const wet = clamp(fbm(u * 2, v * 2, 2, 3, 61) * 2.2 - 1.1, 0, 1);
      const sh = shades[(((cx % cells) + cells) % cells) * cells + (((cy % cells) + cells) % cells)] * (0.75 + n * 0.45);
      const k = sh * (1 - grout * 0.65) * (1 - crack * 0.5) * (1 - wet * 0.25);
      o[0] = clamp(base[0] * k + n2 * 8, 0, 255); o[1] = clamp(base[1] * k + n2 * 7, 0, 255); o[2] = clamp(base[2] * k + n2 * 7, 0, 255);
      o[3] = clamp(edge / 10, 0, 1) * 0.6 + n * 0.3 - crack * 0.4;
      o[4] = 0.85 - wet * 0.6 + n2 * 0.1;
    }, 4);
  });

  // ── Wood planks ────────────────────────────────────────────────────────────
  G3D.woodSet = (dark) => cached('wood' + (dark ? 'd' : ''), () => {
    const S = TEX / 2, planks = 4;
    const base = dark ? [52, 34, 22] : [92, 62, 38];
    return buildSet(S, (px, py, o) => {
      const u = px / S, v = py / S;
      const p = Math.floor(u * planks), fu = (u * planks) % 1;
      const grain = fbm(u * 2 + p * 3.1, v * 24, 24, 4, 7 + p);
      const rings = Math.sin((grain * 18 + fu * 2) * Math.PI) * 0.5 + 0.5;
      const seam = clamp(1 - Math.min(fu, 1 - fu) * S / planks / 2, 0, 1);
      const k = (0.7 + rings * 0.25 + grain * 0.3) * (1 - seam * 0.6) * (0.85 + (p % 2) * 0.12);
      o[0] = clamp(base[0] * k, 0, 255); o[1] = clamp(base[1] * k, 0, 255); o[2] = clamp(base[2] * k, 0, 255);
      o[3] = rings * 0.3 - seam * 0.6; o[4] = 0.7 + grain * 0.2;
    }, 3);
  });

  // ── Metal (steel, gold, rust, bronze) ──────────────────────────────────────
  G3D.metalSet = (kind) => cached('metal' + kind, () => {
    const S = 256;
    return buildSet(S, (px, py, o) => {
      const u = px / S, v = py / S;
      const brushed = fbm(u * 2, v * 60, 60, 3, 13);
      const n = fbm(u * 8, v * 8, 8, 4, 17);
      const scratch = Math.abs(fbm(u * 12 + v * 3, v * 12, 12, 3, 23) - 0.5) < 0.01 ? 1 : 0;
      let col, rough;
      if (kind === 'rust') {
        const r = clamp(n * 1.8 - 0.4, 0, 1);
        col = [G3D.lerp(90, 120, r) * (0.6 + n * 0.5), G3D.lerp(88, 58, r) * (0.6 + n * 0.5), G3D.lerp(86, 34, r) * (0.6 + n * 0.5)];
        rough = 0.5 + r * 0.45;
      } else if (kind === 'gold') {
        col = [255 * (0.85 + brushed * 0.15), 196 * (0.85 + brushed * 0.15), 92 * (0.8 + brushed * 0.2)];
        rough = 0.22 + brushed * 0.15 + scratch * 0.2;
      } else if (kind === 'bronze') {
        const pat = clamp(n * 1.6 - 0.75, 0, 1);
        col = [G3D.lerp(176, 70, pat), G3D.lerp(120, 140, pat), G3D.lerp(70, 110, pat)];
        rough = 0.35 + pat * 0.4;
      } else {
        col = [190 * (0.8 + brushed * 0.2), 192 * (0.8 + brushed * 0.2), 198 * (0.8 + brushed * 0.2)];
        rough = 0.3 + brushed * 0.18 + n * 0.12 + scratch * 0.25;
      }
      o[0] = clamp(col[0] - scratch * 30, 0, 255); o[1] = clamp(col[1] - scratch * 30, 0, 255); o[2] = clamp(col[2] - scratch * 30, 0, 255);
      o[3] = n * 0.4 - scratch * 0.3; o[4] = rough;
    }, 2);
  });

  // ── Chainmail ──────────────────────────────────────────────────────────────
  G3D.mailSet = (rusty) => cached('mail' + (rusty ? 'r' : ''), () => {
    const S = 256, rings = 16;
    return buildSet(S, (px, py, o) => {
      const u = px / S * rings, v = py / S * rings * 1.4;
      const row = Math.floor(v), off = (row % 2) * 0.5;
      const fx = ((u + off) % 1) - 0.5, fy = (v % 1) - 0.5;
      const r = Math.hypot(fx, fy * 1.1);
      const ring = clamp(1 - Math.abs(r - 0.34) / 0.12, 0, 1);
      const n = fbm(px / S * 6, py / S * 6, 6, 3, 5);
      const rust = rusty ? clamp(n * 1.8 - 0.5, 0, 1) : 0;
      const k = ring * (0.75 + n * 0.3);
      o[0] = clamp(G3D.lerp(150, 110, rust) * k + 12, 0, 255);
      o[1] = clamp(G3D.lerp(152, 70, rust) * k + 12, 0, 255);
      o[2] = clamp(G3D.lerp(158, 40, rust) * k + 12, 0, 255);
      o[3] = ring; o[4] = 0.4 + (1 - ring) * 0.5 + rust * 0.3;
    }, 6);
  });

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
    return withRepeat(new THREE.MeshStandardMaterial({ ...s, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1, metalness: 0 }), repeat);
  });
  G3D.floorMat = (tint, repeat) => G3D.mat('floor' + tint + repeat.join('x'), () => {
    const s = texSet(G3D.floorSet(tint));
    return withRepeat(new THREE.MeshStandardMaterial({ ...s, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0 }), repeat);
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
