/* Knights Templar 3D — walkable-floor maps for free roaming.

   Each room is rasterised once into a 20 cm grid straight from its geometry:
   upward-facing triangles near the ground are floor; anything between knee
   and head height (walls, pillars, tables, pews) blocks. A flood fill from
   the knight's starting spot keeps him inside the room, and the cells nearest
   the camera are left out so he can't walk behind the lens. */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE) return;
  const CELL = 0.2, HALF = 15;          // a 30 m square around the start point
  const LOW = 0.32, HIGH = 1.7;         // the knight's body band
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  function build(root, start, opts) {
    opts = opts || {};
    const t0 = performance.now();
    const n = Math.ceil(HALF * 2 / CELL), x0 = start[0] - HALF, z0 = start[2] - HALF;
    const floor = new Uint8Array(n * n), block = new Uint8Array(n * n), height = new Float32Array(n * n);
    const ci = x => Math.floor((x - x0) / CELL), cj = z => Math.floor((z - z0) / CELL);
    const cellX = i => x0 + (i + 0.5) * CELL, cellZ = j => z0 + (j + 0.5) * CELL;
    const mark = (arr, i, j) => { if (i >= 0 && j >= 0 && i < n && j < n) arr[j * n + i] = 1; };

    function tri(A, B, C) {
      const minY = Math.min(A.y, B.y, C.y), maxY = Math.max(A.y, B.y, C.y);
      if (maxY < -0.8 || minY > HIGH) return;
      let i0 = ci(Math.min(A.x, B.x, C.x)), i1 = ci(Math.max(A.x, B.x, C.x));
      let j0 = cj(Math.min(A.z, B.z, C.z)), j1 = cj(Math.max(A.z, B.z, C.z));
      if (i1 < 0 || j1 < 0 || i0 >= n || j0 >= n) return;
      i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(n - 1, i1); j1 = Math.min(n - 1, j1);
      const ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z, vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const isFloor = Math.abs(ny) / nl > 0.75 && maxY < LOW && minY > -0.8;
      if (!isFloor && (maxY < LOW || minY > HIGH)) return;
      const area = ux * vz - uz * vx;           // signed 2× xz area
      if (Math.abs(area) < CELL * CELL * 0.25) {
        if (isFloor) return;
        // Near-vertical: rasterise its footprint as a line between the two farthest points.
        let P = A, Q = B, best = (A.x - B.x) ** 2 + (A.z - B.z) ** 2;
        const d2 = (A.x - C.x) ** 2 + (A.z - C.z) ** 2, d3 = (B.x - C.x) ** 2 + (B.z - C.z) ** 2;
        if (d2 > best) { P = A; Q = C; best = d2; }
        if (d3 > best) { P = B; Q = C; best = d3; }
        const steps = Math.max(1, Math.ceil(Math.sqrt(best) / (CELL * 0.5)));
        for (let s = 0; s <= steps; s++) { const t = s / steps; mark(block, ci(P.x + (Q.x - P.x) * t), cj(P.z + (Q.z - P.z) * t)); }
        return;
      }
      if (i0 === i1 && j0 === j1) {
        if (isFloor) { const k = j0 * n + i0; if (!floor[k] || maxY > height[k]) height[k] = maxY; floor[k] = 1; }
        else block[j0 * n + i0] = 1;
        return;
      }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = cellX(i), pz = cellZ(j);
        // Barycentric coordinates in the xz plane
        const wx = px - A.x, wz = pz - A.z;
        const s = (wx * vz - wz * vx) / area, t = (ux * wz - uz * wx) / area;
        if (s < -0.02 || t < -0.02 || s + t > 1.02) continue;
        const y = A.y + uy * s + vy * t, k = j * n + i;
        if (isFloor) { if (!floor[k] || y > height[k]) height[k] = y; floor[k] = 1; }
        else if (y >= LOW && y <= HIGH) block[k] = 1;
      }
    }

    root.updateMatrixWorld(true);
    const mtx = new THREE.Matrix4(), im = new THREE.Matrix4();
    root.traverse(o => {
      if (!o.isMesh || o.userData.noCollide) return;
      for (let p = o; p; p = p.parent) if (p.visible === false) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.isShaderMaterial || m.blending === THREE.AdditiveBlending || m.visible === false) return;
      const g = o.geometry, pos = g && g.attributes.position;
      if (!pos) return;
      const idx = g.index, triCount = (idx ? idx.count : pos.count) / 3;
      const copies = o.isInstancedMesh ? o.count : 1;
      for (let k = 0; k < copies; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, im); mtx.multiplyMatrices(o.matrixWorld, im); } else mtx.copy(o.matrixWorld);
        for (let t = 0; t < triCount; t++) {
          const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(mtx);
          b.fromBufferAttribute(pos, i1).applyMatrix4(mtx);
          c.fromBufferAttribute(pos, i2).applyMatrix4(mtx);
          tri(a, b, c);
        }
      }
    });

    // Open floor, minus anything too close to (or behind) the camera.
    const open = new Uint8Array(n * n), maxZ = opts.maxZ != null ? opts.maxZ : Infinity;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      open[k] = floor[k] && !block[k] && cellZ(j) <= maxZ ? 1 : 0;
    }
    // Keep a body-width margin from walls and props.
    const clear = new Uint8Array(n * n);
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      clear[k] = open[k] & open[k - 1] & open[k + 1] & open[k - n] & open[k + n] & open[k - n - 1] & open[k - n + 1] & open[k + n - 1] & open[k + n + 1];
    }
    // Flood fill from the knight's spot so he can't wander off the set.
    const ok = new Uint8Array(n * n);
    let si = ci(start[0]), sj = cj(start[2]);
    if (!clear[sj * n + si]) {
      const near = nearestIn(clear, n, si, sj, 15);
      if (near) { si = near[0]; sj = near[1]; }
    }
    if (clear[sj * n + si]) {
      const stack = [sj * n + si]; ok[sj * n + si] = 1;
      while (stack.length) {
        const k = stack.pop(), i = k % n, j = (k - i) / n;
        const nb = [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, j > 0 ? k - n : -1, j < n - 1 ? k + n : -1];
        for (const q of nb) if (q >= 0 && clear[q] && !ok[q]) { ok[q] = 1; stack.push(q); }
      }
    }
    let cells = 0; for (let k = 0; k < n * n; k++) cells += ok[k];

    const grid = {
      n, x0, z0, cell: CELL, ok, height, cells, ms: Math.round(performance.now() - t0),
      walkable(x, z) { const i = ci(x), j = cj(z); return i >= 0 && j >= 0 && i < n && j < n && ok[j * n + i] === 1; },
      floorY(x, z) { const i = ci(x), j = cj(z); if (i < 0 || j < 0 || i >= n || j >= n) return 0; const k = j * n + i; return ok[k] ? Math.max(0, height[k]) : 0; },
      // Nearest walkable point to (x, z), searching up to `r` metres away.
      nearest(x, z, r) {
        const hit = nearestIn(ok, n, ci(x), cj(z), Math.ceil((r || 3) / CELL));
        return hit ? new THREE.Vector3(cellX(hit[0]), 0, cellZ(hit[1])) : null;
      },
    };
    return grid;
  }

  function nearestIn(arr, n, i, j, maxR) {
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n || !arr[jj * n + ii]) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = [ii, jj]; }
      }
      if (best) return best;
    }
    return null;
  }

  G3D.nav = { build, CELL };
})();
