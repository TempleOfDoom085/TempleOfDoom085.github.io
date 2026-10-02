/* Knights Templar 3D — procedural PBR texture generator.

   Runs in two places: on the page (core.js builds each texture set at a
   modest size the moment a room needs it) and as a Web Worker, which rebuilds
   every set in use at high resolution off the main thread so the Ultra tier can
   sharpen its stone, wood and metal without a single dropped frame.

   build(kind, arg, size) returns raw RGBA arrays:
     color  — albedo (sRGB)
     rough  — R: height (0..1, normalised; parallax occlusion reads it),
              G and B: roughness
     normal — tangent-space normal map from the height field
   Features are laid out in fractions of the tile, so a set looks the same at
   any size — only sharper. */
(function (root) {
  'use strict';

  // ── Deterministic RNG + tileable value noise ───────────────────────────────
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Lattice wraps every `period` cells.
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
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── Generators: each returns { base, strength, fn(u, v, px, o) } ───────────
  // px = pixels of this build per pixel of the base size (keeps edge widths and
  // normal strength identical at every resolution). o = [r, g, b, height, rough].
  const GEN = {};

  // Ashlar stone wall
  GEN.wall = (tint) => {
    const rows = 8, R = rng(11);
    const courses = [];
    for (let r = 0; r < rows; r++) {
      const edges = [0]; let x = 0;
      while (x < 1) { x += 0.18 + R() * 0.16; edges.push(Math.min(x, 1)); }
      if (1 - edges[edges.length - 2] < 0.08) edges.splice(edges.length - 2, 1);
      courses.push({ edges, off: R(), shade: [] });
      for (let b = 0; b < edges.length; b++) courses[r].shade.push(0.82 + R() * 0.3);
    }
    const base = tint === 'cold' ? [74, 80, 90] : tint === 'warm' ? [98, 86, 70] : tint === 'blood' ? [84, 62, 58] : [86, 82, 76];
    const B = 512;
    return { base: B, strength: 5, fn(u, v, px, o) {
      const row = Math.floor(v * rows), c = courses[row];
      let uu = (u + c.off) % 1, bi = 0;
      while (bi < c.edges.length - 1 && uu > c.edges[bi + 1]) bi++;
      const bx0 = c.edges[bi], bx1 = c.edges[bi + 1] || 1;
      const ev = (v * rows) % 1;
      const ex = Math.min(uu - bx0, bx1 - uu) * B, ey = Math.min(ev, 1 - ev) * B / rows;
      const edge = Math.min(ex, ey);
      const mortar = clamp(1 - edge / 3.2, 0, 1);
      const bevel = clamp(edge / 9, 0, 1);
      const n = fbm(u * 8, v * 8, 8, 5, 3);
      const n2 = fbm(u * 32, v * 32, 32, px > 1 ? 4 : 3, 9);
      const grime = fbm(u * 3, v * 3, 3, 4, 21);
      const sh = c.shade[bi] * (0.78 + n * 0.45) * (1 - grime * 0.35);
      const chip = n2 > 0.72 ? (n2 - 0.72) * 2 : 0;
      const k = sh * (1 - mortar * 0.6) * (1 - chip * 0.6);
      o[0] = clamp(base[0] * k + n2 * 10, 0, 255);
      o[1] = clamp(base[1] * k + n2 * 9, 0, 255);
      o[2] = clamp(base[2] * k + n2 * 8, 0, 255);
      // Damp moss streaks low on the wall
      const moss = clamp((v - 0.7) * 3, 0, 1) * clamp(grime * 1.6 - 0.5, 0, 1);
      o[0] *= 1 - moss * 0.35; o[2] *= 1 - moss * 0.45;
      o[3] = bevel * 0.7 + n * 0.25 + n2 * 0.08 - chip * 0.3 - mortar * 0.3;
      o[4] = 0.78 + n2 * 0.2 + mortar * 0.1 - moss * 0.3;
    } };
  };

  // Flagstone floor
  GEN.floor = (tint) => {
    const cells = 4, R = rng(77);
    const shades = []; for (let i = 0; i < cells * cells * 4; i++) shades.push(0.75 + R() * 0.35);
    const base = tint === 'cold' ? [62, 66, 74] : tint === 'warm' ? [92, 80, 64] : tint === 'blood' ? [72, 52, 48] : [76, 72, 66];
    const B = 512;
    return { base: B, strength: 4, fn(u, v, px, o) {
      // Irregular grid: jitter the cell lines with low-frequency noise.
      const ju = u * cells + (fbm(v * 4, u * 4, 4, 2, 5) - 0.5) * 0.35;
      const jv = v * cells + (fbm(u * 4, v * 4, 4, 2, 6) - 0.5) * 0.35;
      const cx = Math.floor(ju), cy = Math.floor(jv);
      const fx = ju - cx, fy = jv - cy;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * B / cells;
      const grout = clamp(1 - edge / 3.5, 0, 1);
      const n = fbm(u * 10, v * 10, 10, 5, 31), n2 = fbm(u * 40, v * 40, 40, px > 1 ? 3 : 2, 41);
      const crack = Math.abs(fbm(u * 6, v * 6, 6, 4, 51) - 0.5) < 0.012 ? 1 : 0;
      const wet = clamp(fbm(u * 2, v * 2, 2, 3, 61) * 2.2 - 1.1, 0, 1);
      const sh = shades[(((cx % cells) + cells) % cells) * cells + (((cy % cells) + cells) % cells)] * (0.75 + n * 0.45);
      const k = sh * (1 - grout * 0.65) * (1 - crack * 0.5) * (1 - wet * 0.25);
      o[0] = clamp(base[0] * k + n2 * 8, 0, 255); o[1] = clamp(base[1] * k + n2 * 7, 0, 255); o[2] = clamp(base[2] * k + n2 * 7, 0, 255);
      o[3] = clamp(edge / 10, 0, 1) * 0.6 + n * 0.3 - crack * 0.12;
      o[4] = 0.85 - wet * 0.6 + n2 * 0.1;
    } };
  };

  // Wood planks
  GEN.wood = (dark) => {
    const planks = 4, base = dark ? [52, 34, 22] : [92, 62, 38], B = 256;
    return { base: B, strength: 3, fn(u, v, px, o) {
      const p = Math.floor(u * planks), fu = (u * planks) % 1;
      const grain = fbm(u * 2 + p * 3.1, v * 24, 24, 4, 7 + p);
      const rings = Math.sin((grain * 18 + fu * 2) * Math.PI) * 0.5 + 0.5;
      const seam = clamp(1 - Math.min(fu, 1 - fu) * B / planks / 2, 0, 1);
      const k = (0.7 + rings * 0.25 + grain * 0.3) * (1 - seam * 0.6) * (0.85 + (p % 2) * 0.12);
      o[0] = clamp(base[0] * k, 0, 255); o[1] = clamp(base[1] * k, 0, 255); o[2] = clamp(base[2] * k, 0, 255);
      o[3] = rings * 0.3 - seam * 0.6; o[4] = 0.7 + grain * 0.2;
    } };
  };

  // Metal: steel, gold, rust, bronze
  GEN.metal = (kind) => ({ base: 256, strength: 2, fn(u, v, px, o) {
    const brushed = fbm(u * 2, v * 60, 60, 3, 13);
    const n = fbm(u * 8, v * 8, 8, 4, 17);
    const scratch = Math.abs(fbm(u * 12 + v * 3, v * 12, 12, 3, 23) - 0.5) < 0.01 / px ? 1 : 0;
    let col, rough;
    if (kind === 'rust') {
      const r = clamp(n * 1.8 - 0.4, 0, 1);
      col = [lerp(90, 120, r) * (0.6 + n * 0.5), lerp(88, 58, r) * (0.6 + n * 0.5), lerp(86, 34, r) * (0.6 + n * 0.5)];
      rough = 0.5 + r * 0.45;
    } else if (kind === 'gold') {
      col = [255 * (0.85 + brushed * 0.15), 196 * (0.85 + brushed * 0.15), 92 * (0.8 + brushed * 0.2)];
      rough = 0.22 + brushed * 0.15 + scratch * 0.2;
    } else if (kind === 'bronze') {
      const pat = clamp(n * 1.6 - 0.75, 0, 1);
      col = [lerp(176, 70, pat), lerp(120, 140, pat), lerp(70, 110, pat)];
      rough = 0.35 + pat * 0.4;
    } else {
      col = [190 * (0.8 + brushed * 0.2), 192 * (0.8 + brushed * 0.2), 198 * (0.8 + brushed * 0.2)];
      rough = 0.3 + brushed * 0.18 + n * 0.12 + scratch * 0.25;
    }
    o[0] = clamp(col[0] - scratch * 30, 0, 255); o[1] = clamp(col[1] - scratch * 30, 0, 255); o[2] = clamp(col[2] - scratch * 30, 0, 255);
    o[3] = n * 0.4 - scratch * 0.3; o[4] = rough;
  } });

  // Chainmail
  GEN.mail = (rusty) => {
    const rings = 16;
    return { base: 256, strength: 6, fn(u, v, px, o) {
      const uu = u * rings, vv = v * rings * 1.4;
      const row = Math.floor(vv), off = (row % 2) * 0.5;
      const fx = ((uu + off) % 1) - 0.5, fy = (vv % 1) - 0.5;
      const r = Math.hypot(fx, fy * 1.1);
      const ring = clamp(1 - Math.abs(r - 0.34) / 0.12, 0, 1);
      const n = fbm(u * 6, v * 6, 6, 3, 5);
      const rust = rusty ? clamp(n * 1.8 - 0.5, 0, 1) : 0;
      const k = ring * (0.75 + n * 0.3);
      o[0] = clamp(lerp(150, 110, rust) * k + 12, 0, 255);
      o[1] = clamp(lerp(152, 70, rust) * k + 12, 0, 255);
      o[2] = clamp(lerp(158, 40, rust) * k + 12, 0, 255);
      o[3] = ring; o[4] = 0.4 + (1 - ring) * 0.5 + rust * 0.3;
    } };
  };

  // ── Build ──────────────────────────────────────────────────────────────────
  function build(kind, arg, size) {
    const g = GEN[kind](arg), S = size || g.base, px = S / g.base;
    const n = S * S;
    const color = new Uint8ClampedArray(n * 4), rough = new Uint8ClampedArray(n * 4), normal = new Uint8ClampedArray(n * 4);
    const height = new Float32Array(n), rgh = new Float32Array(n);
    const o = [0, 0, 0, 0, 0];
    let hMin = Infinity, hMax = -Infinity;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        g.fn(x / S, y / S, px, o);
        const i = y * S + x, j = i * 4;
        color[j] = o[0]; color[j + 1] = o[1]; color[j + 2] = o[2]; color[j + 3] = 255;
        height[i] = o[3]; rgh[i] = clamp(o[4], 0, 1);
        if (o[3] < hMin) hMin = o[3]; if (o[3] > hMax) hMax = o[3];
      }
    }
    // Normals from the raw height field (same slopes as before); the stored
    // height is normalised to 0..1 for parallax.
    const k = g.strength * px, span = (hMax - hMin) || 1;
    for (let y = 0; y < S; y++) {
      const yu = ((y - 1 + S) % S) * S, yd = ((y + 1) % S) * S, yr = y * S;
      for (let x = 0; x < S; x++) {
        const xl = height[yr + ((x - 1 + S) % S)], xr = height[yr + ((x + 1) % S)];
        let nx = (xl - xr) * k, ny = (height[yu + x] - height[yd + x]) * k, nz = 1;
        const l = Math.sqrt(nx * nx + ny * ny + 1); nx /= l; ny /= l; nz /= l;
        const i = yr + x, j = i * 4;
        normal[j] = (nx * 0.5 + 0.5) * 255; normal[j + 1] = (ny * 0.5 + 0.5) * 255; normal[j + 2] = (nz * 0.5 + 0.5) * 255; normal[j + 3] = 255;
        const r = rgh[i] * 255;
        rough[j] = (height[i] - hMin) / span * 255; rough[j + 1] = r; rough[j + 2] = r; rough[j + 3] = 255;
      }
    }
    return { size: S, color, rough, normal };
  }

  root.KTTex = { rng, hash2, vnoise, fbm, clamp, lerp, build, kinds: Object.keys(GEN) };

  // Worker mode: build on request, hand the buffers back without copying.
  if (typeof window === 'undefined' && typeof importScripts === 'function') {
    root.onmessage = e => {
      const q = e.data;
      try {
        const r = build(q.kind, q.arg, q.size);
        root.postMessage({ id: q.id, size: r.size, color: r.color, rough: r.rough, normal: r.normal }, [r.color.buffer, r.rough.buffer, r.normal.buffer]);
      } catch (err) { root.postMessage({ id: q.id, error: String(err) }); }
    };
  }
})(typeof self !== 'undefined' ? self : this);
