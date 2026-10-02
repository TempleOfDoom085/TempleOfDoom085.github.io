/* Knights Templar 3D — a living fortress.

   Rats that scatter from your feet, bats bursting from the bell tower and the
   catacombs, ravens on the battlements that take wing at lightning, ghostly
   monks drifting through walls, chains that swing as you brush past — and a
   world that changes as you win: the storm eases with every relic, cleared
   rooms warm, and after the Necromancer falls the open sky turns to dawn. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx || !G3D.makeRat) return;
  const E = G3D.engine, C = E.ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = G3D.clamp, calm = C.reducedMotion;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const RATS = { dungeon: 3, catacombs: 3, barracks: 2, armory: 2, crypt: 2, throne: 3, treasury: 1, ossuary: 2, infirmary: 1, flooded: 0 };
  const BATS = { tower: 22, catacombs: 14, crypt: 12, watchtower: 10 };
  const GHOSTS = { chapel: 1, cloister: 1, scriptorium: 1, hall: 1, gallery: 1, infirmary: 1, sanctum: 1 };
  const PERCH = {
    courtyard: [[6.8, 3.7, -13.1], [8.3, 4.3, -12.6], [7.6, 5.0, -13.5], [-4.2, 2.55, -8]],
    watchtower: [[5.7, 1.92, -3.8], [-5.7, 1.92, -3.8], [2.2, 1.92, -7.6], [-3.4, 1.92, -6.9]],
  };
  const life = { rats: [], bats: [], ravens: [], ghosts: [], nextBats: 0, nextGhost: 0, type: null };
  const kpos = () => C.knight ? C.knight.R.root.position : V();
  const grid = () => (G3D.world && G3D.world.navGrid) ? G3D.world.navGrid() : null;

  // Remove a creature and free its per-instance geometry (shared pieces are left alone).
  function drop(obj) {
    C.scene.remove(obj);
    obj.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }
  function clear() {
    ['rats', 'bats', 'ravens', 'ghosts'].forEach(k => { life[k].forEach(o => drop(o.obj)); life[k] = []; });
  }
  function spawnFor(id) {
    clear();
    const r = ROOMS[id]; life.type = r ? r.type : null;
    if (!r || calm) return;
    const t = r.type;
    life.nextBats = C.time + (t === 'tower' ? 1.2 : rnd(8, 20));
    life.nextGhost = C.time + rnd(6, 14);
    if (RATS[t]) setTimeout(() => { if (life.type === t) for (let i = 0; i < RATS[t]; i++) spawnRat(); }, 400);
    (PERCH[t] || []).forEach(p => {
      if (STATE.necromancerDead && Math.random() < 0.5) return;
      const obj = G3D.makeRaven(); obj.scale.setScalar(1.8); obj.position.set(...p); obj.rotation.y = rnd(-0.6, 0.6) + Math.PI * 0.1;
      obj.userData.wings.forEach(w => { w.rotation.y = 0; w.scale.y = 0.4; });
      C.scene.add(obj); life.ravens.push({ obj, fly: null, peck: rnd(0, 3) });
    });
  }

  // ── Rats ──────────────────────────────────────────────────────────────────
  function randomCell(g, far) {
    const k = kpos();
    for (let i = 0; i < 40; i++) {
      const p = g.nearest(k.x + rnd(-7, 7), k.z + rnd(-9, 3), 2);
      if (p && (!far || p.distanceTo(V(k.x, 0, k.z)) > far)) return p;
    }
    return null;
  }
  function spawnRat() {
    const g = grid(); if (!g) return;
    const p = randomCell(g, 3); if (!p) return;
    const obj = G3D.makeRat(); obj.position.set(p.x, g.floorY(p.x, p.z), p.z); C.scene.add(obj);
    life.rats.push({ obj, target: null, pause: rnd(0, 2), flee: 0, gone: false });
  }
  function updateRats(dt) {
    const g = grid(), k = kpos();
    life.rats.forEach(r => {
      const o = r.obj;
      const dk = Math.hypot(o.position.x - k.x, o.position.z - k.z);
      if (dk < 2.2 && r.flee <= 0) {   // scatter!
        r.flee = 1.4;
        const away = V(o.position.x - k.x, 0, o.position.z - k.z).normalize().multiplyScalar(4);
        r.target = g && g.nearest(o.position.x + away.x, o.position.z + away.z, 2);
        r.pause = 0;
      }
      r.flee -= dt;
      if (r.pause > 0) { r.pause -= dt; o.userData.tail.rotation.z = Math.sin(C.time * 3) * 0.3; return; }
      if (!r.target && g) r.target = randomCell(g, 0);
      if (!r.target) return;
      const dx = r.target.x - o.position.x, dz = r.target.z - o.position.z, d = Math.hypot(dx, dz);
      const speed = r.flee > 0 ? 3.4 : 0.55;
      if (d < 0.08) { r.target = null; r.pause = rnd(0.6, 3); return; }
      const step = Math.min(d, speed * dt), nx = o.position.x + dx / d * step, nz = o.position.z + dz / d * step;
      if (g && !g.walkable(nx, nz)) { r.target = null; r.pause = 0.3; return; }
      o.position.set(nx, (g ? g.floorY(nx, nz) : 0) + Math.abs(Math.sin(C.time * 30)) * 0.008 * (speed > 1 ? 1 : 0.3), nz);
      o.rotation.y = Math.atan2(dx, dz);
      o.userData.tail.rotation.z = Math.sin(C.time * 18) * 0.4;
    });
  }

  // ── Bats ──────────────────────────────────────────────────────────────────
  function spawnBats(n) {
    const cam = C.camera.position, fwd = V(); C.camera.getWorldDirection(fwd);
    const src = cam.clone().addScaledVector(fwd, 9); src.y = Math.max(src.y + 2, 3.2);
    for (let i = 0; i < n; i++) {
      const obj = G3D.makeBat(); obj.scale.setScalar(2.4); obj.position.copy(src).add(V(rnd(-1.5, 1.5), rnd(-0.6, 0.6), rnd(-1.5, 1.5)));
      const aim = cam.clone().add(V(rnd(-4, 4), rnd(0.5, 2.5), rnd(-2, 1)));
      const vel = aim.sub(obj.position).normalize().multiplyScalar(rnd(4.5, 7));
      C.scene.add(obj); life.bats.push({ obj, vel, t: 0, delay: i * 0.06, seed: rnd(0, 9) });
    }
  }
  function updateBats(dt) {
    for (let i = life.bats.length - 1; i >= 0; i--) {
      const b = life.bats[i];
      if (b.delay > 0) { b.delay -= dt; b.obj.visible = false; continue; }
      b.obj.visible = true; b.t += dt;
      b.vel.x += Math.sin(C.time * 7 + b.seed) * dt * 6; b.vel.y += Math.cos(C.time * 5 + b.seed) * dt * 4;
      b.obj.position.addScaledVector(b.vel, dt);
      b.obj.lookAt(b.obj.position.clone().add(b.vel));
      const f = Math.sin(C.time * 38 + b.seed) * 0.9;
      b.obj.userData.wings[0].rotation.z = f; b.obj.userData.wings[1].rotation.z = -f;
      if (b.t > 3.5) { drop(b.obj); life.bats.splice(i, 1); }
    }
  }

  // ── Ravens ────────────────────────────────────────────────────────────────
  function updateRavens(dt) {
    const k = kpos(), flash = G3D.uniforms.lightning ? G3D.uniforms.lightning.value : 0;
    life.ravens.forEach(r => {
      const o = r.obj, w = o.userData.wings;
      if (!r.fly) {
        r.peck -= dt;
        if (r.peck < 0) { r.peck = rnd(1.5, 4); o.rotation.y += rnd(-0.8, 0.8); }
        if (Math.hypot(o.position.x - k.x, o.position.z - k.z) < 3.5 || flash > 0.6 || STATE.inCombat) {
          r.fly = { t: 0, vel: V(rnd(-2, 2), rnd(2.5, 4), rnd(-4, -2)) };
          w.forEach(x => { x.scale.y = 1; });
        }
        return;
      }
      r.fly.t += dt; r.fly.vel.y -= dt * 0.6;
      o.position.addScaledVector(r.fly.vel, dt);
      o.lookAt(o.position.clone().add(r.fly.vel));
      const f = Math.sin(C.time * 20) * 0.9;
      w[0].rotation.y = f; w[1].rotation.y = -f;
      if (r.fly.t > 4) o.visible = false;
    });
  }

  // ── Ghostly monks ─────────────────────────────────────────────────────────
  function ghostify(R) {
    R.root.traverse(o => {
      if (o.isSprite) { o.visible = false; return; }
      if (!o.isMesh || !o.material) return;
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9ab8d8'), emissive: new THREE.Color('#5a7a9a'), emissiveIntensity: 0.6,
        transparent: true, opacity: 0, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide });
    });
    R.root.traverse(o => { if (o.userData && o.userData.light) o.userData.light = null; });
  }
  function spawnGhost() {
    const g = grid(); if (!g) return;
    const k = kpos(), z = k.z + rnd(-7, -3);
    // Walkable span across the room at that depth: the monk starts and ends inside the walls.
    let minX = Infinity, maxX = -Infinity;
    for (let x = k.x - 12; x <= k.x + 12; x += 0.2) if (g.walkable(x, z)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (!(maxX - minX > 2.5)) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const from = V(dir > 0 ? minX - 1.4 : maxX + 1.4, 0, z), to = V(dir > 0 ? maxX + 1.4 : minX - 1.4, 0, z);
    const R = G3D.makeNPC([70, 80, 100]); ghostify(R);
    R.root.position.copy(from); R.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    C.scene.add(R.root);
    life.ghosts.push({ obj: R.root, from, to, t: 0, dur: from.distanceTo(to) / 0.7 });
  }
  function updateGhosts(dt) {
    for (let i = life.ghosts.length - 1; i >= 0; i--) {
      const gh = life.ghosts[i]; gh.t += dt;
      const u = clamp(gh.t / gh.dur, 0, 1), span = gh.from.distanceTo(gh.to);
      gh.obj.position.lerpVectors(gh.from, gh.to, u); gh.obj.position.y = 0.12 + Math.sin(C.time * 1.4) * 0.05;
      const edge = Math.min(u * span, (1 - u) * span), a = clamp((edge - 0.6) / 1.6, 0, 1) * 0.38;
      gh.obj.traverse(o => { if (o.isMesh && o.material) o.material.opacity = a; });
      if (u >= 1) { drop(gh.obj); gh.obj.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); life.ghosts.splice(i, 1); }
    }
  }

  // ── Chains that swing as you pass ─────────────────────────────────────────
  const wp = V();
  function updateChains(dt) {
    if (!C.room || !C.room.swing) return;
    const k = kpos();
    C.room.swing.forEach(o => {
      const ch = o.userData.chain; if (!ch) return;
      o.getWorldPosition(wp);
      const bottom = wp.y - ch.len;
      const near = Math.hypot(wp.x - k.x, wp.z - k.z) < 0.75 && bottom < 2.2;
      if (near && o.userData.swing < 0.2) { o.userData.swing = 0.42; if (G3D.world && G3D.world.amb && G3D.world.amb.on) {/* the clink rides the footstep */} }
      o.userData.swing += (0.025 - o.userData.swing) * Math.min(1, dt * 0.9);
    });
  }

  // ── The world turns ───────────────────────────────────────────────────────
  const goal = { exposure: 1, sat: 1, tint: [1, 1, 1] };
  function updateWorld(dt) {
    const relics = Math.min(6, STATE.inventory ? STATE.inventory.length : 0);
    E.storm = STATE.necromancerDead ? 0 : clamp(1 - relics / 6 * 0.75, 0.25, 1);
    if (C.room) C.room.group.children.forEach(o => {
      const rain = o.userData && o.userData.rain; if (!rain) return;
      o.visible = E.storm > 0.05;
      rain.mats[0].uniforms.opacity.value = rain.base * E.storm;
      if (o.children[1]) o.children[1].visible = E.storm > 0.3;
    });
    if (E.cinema) return;   // cinematics drive the grade themselves
    const id = STATE.currentRoom, cleared = STATE.enemiesDefeated && STATE.enemiesDefeated.has(id);
    if (STATE.necromancerDead) { goal.exposure = 1.1; goal.sat = 1.08; goal.tint = [1.07, 1.0, 0.92]; }
    else if (cleared) { goal.exposure = 1.05; goal.sat = 1.05; goal.tint = [1.03, 1.0, 0.97]; }
    else { goal.exposure = 1; goal.sat = 1; goal.tint = [1, 1, 1]; }
    const gm = E.gradeMul, k = Math.min(1, dt * 1.5);
    gm.exposure += (goal.exposure - gm.exposure) * k; gm.sat += (goal.sat - gm.sat) * k;
    for (let i = 0; i < 3; i++) gm.tint[i] += (goal.tint[i] - gm.tint[i]) * k;
  }
  // After the victory, the open sky over the fortress turns to dawn.
  function dawn(spec) {
    if (!spec || !spec.outdoor || !spec.group) return;
    const on = !!STATE.necromancerDead;
    spec.group.traverse(o => {
      const u = o.material && o.material.uniforms;
      if (!u || !u.horizon || !u.moonDir) return;
      if (!o.userData.night) o.userData.night = { top: u.top.value.clone(), horizon: u.horizon.value.clone(), moon: u.moonDir.value.clone() };
      const n = o.userData.night;
      u.top.value.copy(on ? new THREE.Color('#2a4a7a') : n.top);
      u.horizon.value.copy(on ? new THREE.Color('#ffae6a') : n.horizon);
      u.moonDir.value.copy(on ? V(0.55, 0.14, -0.82).normalize() : n.moon);
    });
    if (!on) return;
    const I = E.internals();
    if (I.dir.visible) { I.dir.color.set('#ffc080'); I.dir.intensity *= 1.8; I.dir.userData.base = I.dir.intensity; }
    I.hemi.color.set('#ffc8a0'); I.hemi.groundColor.set('#3a2a28'); I.hemi.intensity *= 1.6;
    if (C.scene.fog) C.scene.fog.color.set('#3a2c30');
  }

  const prevRoom = E.onRoom, prevFrame = E.onFrame;
  E.onRoom = function (id, spec) { if (prevRoom) prevRoom(id, spec); spawnFor(id); dawn(spec); };
  E.onFrame = function (dt) {
    if (prevFrame) prevFrame(dt);
    updateWorld(dt);
    if (calm || E.cinema) return;
    const T = life.type;
    if (BATS[T] && C.time > life.nextBats && !STATE.inCombat) { spawnBats(BATS[T]); life.nextBats = C.time + rnd(22, 40); }
    if (GHOSTS[T] && C.time > life.nextGhost && !STATE.inCombat && !life.ghosts.length) { spawnGhost(); life.nextGhost = C.time + rnd(20, 38); }
    updateRats(dt); updateBats(dt); updateRavens(dt); updateGhosts(dt); updateChains(dt);
  };
  if (C.roomId) { spawnFor(C.roomId); dawn(C.room); }
  G3D.life = { state: life, spawnBats, spawnGhost };
  }
})();
