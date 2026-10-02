/* Knights Templar 3D — cloth.

   Capes and banners are simulated instead of swayed: a grid of Verlet
   particles in world space, held together by stretch, shear and bend
   constraints, pinned along the top edge to whatever carries them (the
   knight's shoulders, a banner rod). Wind pushes on each particle along the
   cloth's own normal, relative to the particle's velocity, so a flag on the
   battlements streams and snaps while a tapestry indoors barely breathes, and
   a cape billows when the knight runs and settles when he stops. Capes collide
   with ellipsoids on the body so they drape over the back and legs instead of
   through them. The engine calls step() for every cloth in view
   (engine.js, "Cloth"). */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE) return;

  const H = 1 / 60, MAX_SUB = 3, ITER = 6, GRAVITY = -9.8;
  const inv = new THREE.Matrix4(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function setup(o) {
    const g = o.geometry, prm = g.parameters || {};
    const cols = (prm.widthSegments || 1) + 1, rows = (prm.heightSegments || 1) + 1;
    const p = g.attributes.position, n = p.count;
    if (n !== cols * rows) return null;
    o.updateWorldMatrix(true, false);
    const rest = o.userData.sway.base || p.array.slice();
    const x = new Float32Array(n * 3), prev = new Float32Array(n * 3), w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      tmp.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).applyMatrix4(o.matrixWorld);
      x[i * 3] = prev[i * 3] = tmp.x; x[i * 3 + 1] = prev[i * 3 + 1] = tmp.y; x[i * 3 + 2] = prev[i * 3 + 2] = tmp.z;
      w[i] = i < cols ? 0 : 1;   // the top row is pinned
    }
    const con = [];
    const link = (a, b) => {
      const dx = x[a * 3] - x[b * 3], dy = x[a * 3 + 1] - x[b * 3 + 1], dz = x[a * 3 + 2] - x[b * 3 + 2];
      con.push(a, b, Math.sqrt(dx * dx + dy * dy + dz * dz));
    };
    const id = (c, r) => r * cols + c;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) link(id(c, r), id(c + 1, r));
      if (r + 1 < rows) link(id(c, r), id(c, r + 1));
      if (c + 1 < cols && r + 1 < rows) { link(id(c, r), id(c + 1, r + 1)); link(id(c + 1, r), id(c, r + 1)); }
      if (c + 2 < cols) link(id(c, r), id(c + 2, r));
      if (r + 2 < rows) link(id(c, r), id(c, r + 2));
    }
    const ci = new Int32Array(con.length / 3 * 2), cr = new Float32Array(con.length / 3);
    for (let k = 0; k < cr.length; k++) { ci[k * 2] = con[k * 3]; ci[k * 2 + 1] = con[k * 3 + 1]; cr[k] = con[k * 3 + 2]; }
    o.frustumCulled = false;
    return { cols, rows, n, rest, x, prev, w, ci, cr, nrm: new Float32Array(n * 3), acc: 0,
      pin0: new Float32Array(cols * 3), pin1: new Float32Array(cols * 3), seed: Math.random() * 100 };
  }

  // Ellipsoid colliders: { obj, c: [x, y, z], r: [rx, ry, rz] } in obj's space.
  function collide(S, cols) {
    for (const k of cols) {
      k.obj.updateWorldMatrix(true, false);
      const M = k.obj.matrixWorld;
      inv.copy(M).invert();
      for (let i = 0; i < S.n; i++) {
        if (!S.w[i]) continue;
        tmp.set(S.x[i * 3], S.x[i * 3 + 1], S.x[i * 3 + 2]).applyMatrix4(inv);
        const qx = (tmp.x - k.c[0]) / k.r[0], qy = (tmp.y - k.c[1]) / k.r[1], qz = (tmp.z - k.c[2]) / k.r[2];
        const d2 = qx * qx + qy * qy + qz * qz;
        if (d2 >= 1 || d2 < 1e-8) continue;
        const s = 1 / Math.sqrt(d2);
        tmp.set(k.c[0] + qx * s * k.r[0], k.c[1] + qy * s * k.r[1], k.c[2] + qz * s * k.r[2]).applyMatrix4(M);
        S.x[i * 3] = tmp.x; S.x[i * 3 + 1] = tmp.y; S.x[i * 3 + 2] = tmp.z;
      }
    }
  }

  // Per-particle normals from the grid (for wind).
  function normals(S) {
    const { cols, rows, x, nrm } = S;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const l = r * cols + Math.max(0, c - 1), rt = r * cols + Math.min(cols - 1, c + 1);
      const u = Math.max(0, r - 1) * cols + c, d = Math.min(rows - 1, r + 1) * cols + c;
      const ax = x[rt * 3] - x[l * 3], ay = x[rt * 3 + 1] - x[l * 3 + 1], az = x[rt * 3 + 2] - x[l * 3 + 2];
      const bx = x[d * 3] - x[u * 3], by = x[d * 3 + 1] - x[u * 3 + 1], bz = x[d * 3 + 2] - x[u * 3 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nrm[i * 3] = nx / len; nrm[i * 3 + 1] = ny / len; nrm[i * 3 + 2] = nz / len;
    }
  }

  function sub(S, a, wind, t, drag, skin) {
    const { x, prev, w, n, cols, ci, cr, nrm } = S;
    // Pins glide from last frame's carrier pose to this frame's.
    for (let c = 0; c < cols; c++) for (let k = 0; k < 3; k++) x[c * 3 + k] = S.pin0[c * 3 + k] + (S.pin1[c * 3 + k] - S.pin0[c * 3 + k]) * a;
    normals(S);
    const g = GRAVITY * H * H, h2 = H * H;
    for (let i = 0; i < n; i++) {
      if (!w[i]) { prev[i * 3] = x[i * 3]; prev[i * 3 + 1] = x[i * 3 + 1]; prev[i * 3 + 2] = x[i * 3 + 2]; continue; }
      const px = x[i * 3], py = x[i * 3 + 1], pz = x[i * 3 + 2];
      const vx = (px - prev[i * 3]) * 0.985, vy = (py - prev[i * 3 + 1]) * 0.985, vz = (pz - prev[i * 3 + 2]) * 0.985;
      // Gusting wind, varying across the cloth; force along the normal of the relative air flow.
      const gust = 0.65 + 0.35 * Math.sin(t * 1.7 + px * 0.9 + S.seed) * Math.sin(t * 2.9 + pz * 1.3 + py * 0.7);
      const rx = wind.x * gust - vx / H, ry = wind.y * gust - vy / H, rz = wind.z * gust - vz / H;
      const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
      // Pressure on the face, plus skin friction along the flow (what makes a flag stream).
      const f = (rx * nx + ry * ny + rz * nz) * drag * h2, k = skin * h2;
      prev[i * 3] = px; prev[i * 3 + 1] = py; prev[i * 3 + 2] = pz;
      x[i * 3] = px + vx + nx * f + rx * k; x[i * 3 + 1] = py + vy + g + ny * f + ry * k; x[i * 3 + 2] = pz + vz + nz * f + rz * k;
    }
    for (let it = 0; it < ITER; it++) {
      for (let k = 0; k < cr.length; k++) {
        const i = ci[k * 2], j = ci[k * 2 + 1], wi = w[i], wj = w[j], ws = wi + wj;
        if (!ws) continue;
        const dx = x[j * 3] - x[i * 3], dy = x[j * 3 + 1] - x[i * 3 + 1], dz = x[j * 3 + 2] - x[i * 3 + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const corr = (len - cr[k]) / (len * ws);
        x[i * 3] += dx * corr * wi; x[i * 3 + 1] += dy * corr * wi; x[i * 3 + 2] += dz * corr * wi;
        x[j * 3] -= dx * corr * wj; x[j * 3 + 1] -= dy * corr * wj; x[j * 3 + 2] -= dz * corr * wj;
      }
    }
  }

  // o: a mesh whose userData.sway has { cape | banner, colliders? }.
  // env: { wind: THREE.Vector3 (m/s, world), time }.
  function step(o, dt, env) {
    const s = o.userData.sway;
    let S = s._sim;
    if (S === undefined) S = s._sim = setup(o);
    if (!S) return false;
    o.updateWorldMatrix(true, false);
    const M = o.matrixWorld;
    // Where the pinned edge is now.
    let jump = 0;
    for (let c = 0; c < S.cols; c++) {
      tmp.set(S.rest[c * 3], S.rest[c * 3 + 1], S.rest[c * 3 + 2]).applyMatrix4(M);
      S.pin0[c * 3] = S.x[c * 3]; S.pin0[c * 3 + 1] = S.x[c * 3 + 1]; S.pin0[c * 3 + 2] = S.x[c * 3 + 2];
      S.pin1[c * 3] = tmp.x; S.pin1[c * 3 + 1] = tmp.y; S.pin1[c * 3 + 2] = tmp.z;
      jump = Math.max(jump, tmp2.set(S.x[c * 3], S.x[c * 3 + 1], S.x[c * 3 + 2]).distanceToSquared(tmp));
    }
    // Teleported (new room, a cut): start again from the rest pose.
    if (jump > 0.8 * 0.8) {
      for (let i = 0; i < S.n; i++) {
        tmp.set(S.rest[i * 3], S.rest[i * 3 + 1], S.rest[i * 3 + 2]).applyMatrix4(M);
        S.x[i * 3] = S.prev[i * 3] = tmp.x; S.x[i * 3 + 1] = S.prev[i * 3 + 1] = tmp.y; S.x[i * 3 + 2] = S.prev[i * 3 + 2] = tmp.z;
      }
      S.pin0.set(S.pin1); S.acc = H * 30;   // let it settle for half a second
    }
    S.acc = Math.min(S.acc + dt, H * 30);
    let steps = Math.min(Math.floor(S.acc / H), S.acc >= H * 30 ? 30 : MAX_SUB);
    if (!steps) { steps = 0; }
    const wind = env.wind, drag = s.drag || (s.cape ? 1.3 : 3.2), skin = s.skin != null ? s.skin : (s.cape ? 0.3 : 1.1);
    for (let k = 0; k < steps; k++) {
      sub(S, (k + 1) / steps, wind, env.time - (steps - 1 - k) * H, drag, skin);
      if (s.colliders) collide(S, s.colliders);
    }
    S.acc -= steps * H;
    if (!steps) return true;
    // Back into the mesh's own space.
    inv.copy(M).invert();
    const p = o.geometry.attributes.position;
    for (let i = 0; i < S.n; i++) {
      tmp.set(S.x[i * 3], S.x[i * 3 + 1], S.x[i * 3 + 2]).applyMatrix4(inv);
      p.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    p.needsUpdate = true;
    o.geometry.computeVertexNormals();
    return true;
  }

  G3D.cloth = { step };
})();
