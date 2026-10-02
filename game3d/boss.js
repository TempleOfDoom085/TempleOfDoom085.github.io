/* Knights Templar 3D — the Necromancer, staged.

   The game already runs the boss in three phases (game.html: initBossPhase).
   This file only stages them in the 3D arena:
   I   Shield of Bones — three bone shields rise from the rune circle and orbit
       him; each blow shatters one.
   II  Shadow Split    — he dissolves into three shadows; click the one you
       think is real (or use the buttons, as before).
   III Berserk         — the lair bleeds red: runes, braziers, light and fog.
   When he falls, the lair is cleansed to a soft gold.
   Rules and balance are untouched: everything here reads STATE and calls the
   game's own functions. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx) return;
  const E = G3D.engine, C = E.ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = G3D.clamp;
  const isBoss = () => STATE.inCombat && STATE.currentEnemy && STATE.currentEnemy.type === 'necromancer' && C.enemy && C.enemy.type === 'necromancer';

  const style = document.createElement('style');
  style.textContent = `
    .g3d-phase { position:absolute; left:50%; top:22%; transform:translate(-50%,-50%); z-index:7; pointer-events:none; text-align:center; white-space:nowrap;
      font-family:var(--heading, serif); color:#f2e6c8; text-shadow:0 0 24px rgba(0,0,0,0.9), 0 0 12px rgba(120,255,140,0.35); animation:g3dPhase 2.6s ease-out forwards; }
    .g3d-phase b { display:block; font-size:0.72rem; letter-spacing:0.5em; color:#9cf0a8; font-weight:normal; margin-bottom:6px; }
    .g3d-phase span { font-size:1.7rem; letter-spacing:0.18em; text-transform:uppercase; }
    .g3d-phase.red { text-shadow:0 0 24px rgba(0,0,0,0.9), 0 0 16px rgba(255,60,40,0.6); } .g3d-phase.red b { color:#ff8a70; }
    .g3d-phase.gold { text-shadow:0 0 24px rgba(0,0,0,0.9), 0 0 16px rgba(255,210,120,0.6); } .g3d-phase.gold b { color:#ffd890; }
    @keyframes g3dPhase { 0%{opacity:0;transform:translate(-50%,-40%) scale(1.08)} 15%{opacity:1;transform:translate(-50%,-50%) scale(1)} 75%{opacity:1} 100%{opacity:0;transform:translate(-50%,-55%)} }
    @media (max-width: 700px) { .g3d-phase span { font-size:1.1rem; } }
  `;
  document.head.appendChild(style);
  function card(num, title, tone) {
    const host = C.canvas.parentElement; if (!host) return;
    const el = document.createElement('div'); el.className = 'g3d-phase' + (tone ? ' ' + tone : '');
    el.innerHTML = '<b>' + num + '</b><span>' + title + '</span>';
    host.appendChild(el); setTimeout(() => el.remove(), 2700);
    C.post.barsHold = Math.max(C.post.barsHold || 0, 2.4);
  }

  const st = { phase: 0, shieldsSeen: 0, shields: [], clones: [], blood: 0, purify: 0, palette: null, grade: null, wasBoss: false };
  const boneMat = G3D.flatMat('bone', '#cbbf9f', 0.75, 0);

  // ── Phase I: orbiting shields of bone ─────────────────────────────────────
  function makeShield() {
    const g = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 5), boneMat);
      const a = i / 12 * Math.PI * 2; b.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0); b.rotation.z = a; g.add(b);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 24), boneMat); g.add(rim);
    const sk = G3D.props.skull(); sk.scale.setScalar(1.4); sk.position.z = 0.04; g.add(sk);
    const gl = G3D.glow('#4dff5a', 0.9, 0.3); g.add(gl);
    g.userData.rise = 0;
    return g;
  }
  function spawnShields(n) {
    clearShields();
    for (let i = 0; i < n; i++) { const s = makeShield(); s.userData.i = i; C.scene.add(s); st.shields.push(s); }
    const c = center(); E.burst('smoke', c.clone().setY(0.2), 50, '#3aff5a', 1.6);
  }
  function clearShields() { st.shields.forEach(s => C.scene.remove(s)); st.shields = []; }
  function shatter() {
    if (!st.shields.length) return;
    // The shield nearest the knight takes the blow.
    const k = C.knight.R.root.position;
    st.shields.sort((a, b) => a.position.distanceTo(k) - b.position.distanceTo(k));
    const s = st.shields.shift();
    E.burst('spark', s.position, 70, '#e8dcb8', 4); E.burst('smoke', s.position, 24, '#3aff5a', 1.2);
    C.scene.remove(s);
    C.post.flash = Math.max(C.post.flash, 0.4); C.post.flashCol.set('#c8ffb0');
  }
  function center() { return C.enemy ? C.enemy.R.root.position.clone() : V(...C.room.enemy.pos); }
  function updateShields(dt) {
    const c = center();
    st.shields.forEach((s, i) => {
      const u = s.userData; u.rise = Math.min(1, u.rise + dt / 1.2);
      const a = C.time * 0.9 + u.i * Math.PI * 2 / 3;
      s.position.set(c.x + Math.cos(a) * 1.25, 0.2 + (1.35 + Math.sin(C.time * 2 + u.i) * 0.08) * G3D.smooth(u.rise), c.z + Math.sin(a) * 1.25);
      s.lookAt(c.x, s.position.y, c.z); s.rotateY(Math.PI);
      s.scale.setScalar(0.3 + 0.7 * G3D.smooth(u.rise));
    });
  }

  // ── Phase II: three shadows ───────────────────────────────────────────────
  function shadowify(R) {
    R.root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const m = o.material.clone();
      if (m.color) m.color.multiplyScalar(0.35);
      m.transparent = true; m.opacity = 0.78; m.depthWrite = true;
      if (m.emissive && m.emissiveIntensity != null && !(m.emissive.r + m.emissive.g + m.emissive.b > 1)) { m.emissive = new THREE.Color('#1a0828'); m.emissiveIntensity = 0.6; }
      o.material = m;
    });
  }
  function buildClones() {
    clearClones();
    const c = center();
    const right = V(); C.camera.getWorldDirection(right); right.set(-right.z, 0, right.x).normalize();
    const pos = { Left: c.clone().addScaledVector(right, -1.9), Center: c.clone(), Right: c.clone().addScaledVector(right, 1.9) };
    STATE.bossShadows.forEach(s => {
      const R = G3D.makeNecromancer(); shadowify(R);
      R.root.position.copy(pos[s.label] || c); R.root.position.y = 0;
      C.scene.add(R.root);
      E.burst('smoke', R.root.position.clone().setY(1), 40, '#7a40ff', 1.4);
      st.clones.push({ label: s.label, R, fade: 0, dead: false, seed: Math.random() * 6 });
    });
    if (C.enemy) C.enemy.R.root.visible = false;
  }
  function clearClones() { st.clones.forEach(cl => C.scene.remove(cl.R.root)); st.clones = []; if (C.enemy) C.enemy.R.root.visible = true; }
  function updateClones(dt) {
    const live = new Set((STATE.bossShadows || []).map(s => s.label));
    const k = C.knight.R.root.position;
    st.clones.forEach(cl => {
      const r = cl.R.root;
      r.position.y = 0.35 + Math.sin(C.time * 1.3 + cl.seed) * 0.12;
      r.rotation.y = Math.atan2(k.x - r.position.x, k.z - r.position.z);
      if (!cl.dead && !live.has(cl.label)) { cl.dead = true; E.burst('smoke', r.position.clone().setY(1.2), 60, '#7a40ff', 1.8); }
      if (cl.dead) {
        cl.fade = Math.min(1, cl.fade + dt / 0.6);
        r.traverse(o => { if (o.isMesh && o.material && o.material.transparent) o.material.opacity = 0.78 * (1 - cl.fade); });
        if (cl.fade >= 1) r.visible = false;
      } else if (Math.random() < dt * 6) E.burst('smoke', r.position.clone().setY(0.4 + Math.random()), 1, '#5a20c0', 0.5);
    });
  }

  // ── Phase III and the cleansing: recolour the lair ────────────────────────
  // Rune circle, flames, glows and coals, and the lights that follow them.
  function collectPalette() {
    const list = [];
    C.room.group.traverse(o => {
      const m = o.material; if (!m) return;
      if (m.uniforms && m.uniforms.color && m.uniforms.color.value && m.uniforms.color.value.isColor) list.push({ c: m.uniforms.color.value, base: m.uniforms.color.value.clone() });
      else if (m.isSpriteMaterial && m.color) list.push({ c: m.color, base: m.color.clone() });
      else if (m.emissive && m.emissiveIntensity > 0.5 && m.emissive.g > m.emissive.r * 1.5) list.push({ c: m.emissive, base: m.emissive.clone() });
    });
    return list;
  }
  const RED = new THREE.Color('#ff2a14'), GOLD = new THREE.Color('#ffcf7a'), tmp = new THREE.Color();
  function updateLair(dt) {
    if (!C.room || C.roomId !== 'necromancerLair') return;
    if (!st.palette || st.palette.room !== C.room) { st.palette = collectPalette(); st.palette.room = C.room; st.grade = JSON.parse(JSON.stringify(C.room.grade)); }
    const berserk = isBoss() && STATE.bossPhase === 3;
    st.blood += ((berserk ? 1 : 0) - st.blood) * Math.min(1, dt * 1.6);
    st.purify += ((STATE.necromancerDead ? 1 : 0) - st.purify) * Math.min(1, dt * 0.5);
    const b = st.blood, p = st.purify * (1 - b);
    st.palette.forEach(e => {
      tmp.copy(e.base);
      if (b > 0.001) tmp.lerp(tmp.clone().setRGB(RED.r, RED.g, RED.b).multiplyScalar(Math.max(e.base.r, e.base.g, e.base.b) * 1.2), b);
      if (p > 0.001) tmp.lerp(GOLD.clone().multiplyScalar(Math.max(e.base.r, e.base.g, e.base.b) * 0.7), p);
      e.c.copy(tmp);
    });
    const I = E.internals();
    I.pool.forEach(pl => {
      if (!pl.anchor) return;
      pl.light.color.copy(pl.anchor.userData.light.color);
      if (b > 0.001) pl.light.color.lerp(RED, b);
      if (p > 0.001) pl.light.color.lerp(GOLD, p);
    });
    if (I.spot.visible) { I.spot.color.set(C.room.key.color); if (b > 0.001) I.spot.color.lerp(RED, b); if (p > 0.001) I.spot.color.lerp(GOLD, p); }
    const g0 = st.grade, g = C.room.grade;
    g.tint = [G3D.lerp(G3D.lerp(g0.tint[0], 1.4, b), 1.08, p), G3D.lerp(G3D.lerp(g0.tint[1], 0.72, b), 1.0, p), G3D.lerp(G3D.lerp(g0.tint[2], 0.66, b), 0.86, p)];
    g.sat = G3D.lerp(g0.sat, 1.2, b); g.exposure = G3D.lerp(g0.exposure, 1.15, Math.max(b, p)); g.contrast = G3D.lerp(g0.contrast || 1, 1.25, b);
    E.tune = b > 0.02 ? { light: 0.32 + b * 0.9, density: 0.03 + b * 0.025 } : null;
    if (b > 0.3 && Math.random() < dt * 30) E.burst('ember', center().add(V((Math.random() - 0.5) * 6, 0.1, (Math.random() - 0.5) * 6)), 1, '#ff3a18', 1.5);
  }

  // ── Watching the game ─────────────────────────────────────────────────────
  E.onWatch = function () {
    const boss = isBoss();
    if (!boss) {
      if (st.wasBoss) { clearShields(); clearClones(); st.phase = 0; }
      st.wasBoss = false;
      return;
    }
    st.wasBoss = true;
    const ph = STATE.bossPhase || 0;
    if (ph !== st.phase) {
      if (ph === 1) { spawnShields(STATE.bossShields || 3); st.shieldsSeen = STATE.bossShields || 3; card('Phase I', 'Shield of Bones'); }
      if (ph === 2) { clearShields(); card('Phase II', 'Shadow Split'); }
      if (ph === 3) { clearShields(); clearClones(); card('Phase III', 'Berserk', 'red'); window.screenShake && window.screenShake(true); C.post.flash = 1.2; C.post.flashCol.set('#ff2a14'); }
      st.phase = ph;
    }
    // A blow against the shields: swing, and one shatters.
    if (ph === 1 && STATE.bossShields < st.shieldsSeen) {
      const n = st.shieldsSeen - STATE.bossShields; st.shieldsSeen = STATE.bossShields;
      for (let i = 0; i < n; i++) E.enqueue(() => C.knight.play('attack', 0.7, shatter), 0.75);
    }
    // Shadows appear when the phase sets them up, and vanish when he's found.
    if (ph === 2 && STATE.bossShadows.length && !st.clones.length) buildClones();
    if (ph === 2 && !STATE.bossShadows.length && st.clones.length) { st.clones.forEach(cl => E.burst('smoke', cl.R.root.position.clone().setY(1.2), 50, '#7a40ff', 1.6)); clearClones(); }
  };
  let wasDead = !!STATE.necromancerDead;
  function frame(dt) {
    if (isBoss()) { updateShields(dt); updateClones(dt); }
    updateLair(dt);
    if (STATE.necromancerDead && !wasDead) setTimeout(() => card('The lair is cleansed', 'The Necromancer is no more', 'gold'), 2600);
    wasDead = !!STATE.necromancerDead;
  }
  const prevFrame = E.onFrame, prevRoom = E.onRoom;
  E.onFrame = function (dt) { if (prevFrame) prevFrame(dt); frame(dt); };
  E.onRoom = function (id, spec) { if (prevRoom) prevRoom(id, spec); clearShields(); clearClones(); st.phase = 0; st.blood = 0; E.tune = null; };

  // Clickable shadows for game3d/world.js
  G3D.boss = {
    get clones() { return st.clones.filter(c => !c.dead); },
    choose(label) { const i = (STATE.bossShadows || []).findIndex(s => s.label === label); if (i >= 0 && typeof bossPhase2Choose === 'function') bossPhase2Choose(i); },
    state: st,
  };
  }
})();
