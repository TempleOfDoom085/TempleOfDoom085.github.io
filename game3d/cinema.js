/* Knights Templar 3D — cinematics.

   • Opening: a storm-lit flyover of the fortress (the '@exterior' set) that
     dives through the chapel doors into the game. Plays once; 🎬 replays it.
   • Ending: dawn over the cleansed fortress ('@exteriorDawn') before the
     victory screen.
   • Saint Michael: when the golden armour is earned, the archangel descends
     in a pillar of light and the armour forms in a flash (engine E.onGolden).
   Any key or click skips. Reduced motion skips them entirely. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx) return;
  const E = G3D.engine, C = E.ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = G3D.clamp, ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (C.reducedMotion) return;

  const style = document.createElement('style');
  style.textContent = `
    .g3d-cinema { position:fixed; inset:0; z-index:10000; background:#000; display:none; cursor:pointer; }
    .g3d-cinema.on { display:block; }
    .g3d-cinema .g3d-canvas { position:absolute; inset:0; width:100% !important; height:100% !important; opacity:1; }
    .g3d-cine-text { position:absolute; left:50%; transform:translateX(-50%); text-align:center; pointer-events:none; white-space:nowrap;
      color:#f2e6c8; text-shadow:0 0 30px rgba(0,0,0,0.95); opacity:0; transition:opacity 1.4s ease; font-family:var(--heading, serif); }
    .g3d-cine-text.show { opacity:1; }
    .g3d-cine-title { top:38%; } .g3d-cine-title b { display:block; font-size:clamp(2rem, 6vw, 4.6rem); letter-spacing:0.16em; color:#e8c06a; font-weight:normal; }
    .g3d-cine-title span { display:block; margin-top:10px; font-size:clamp(0.9rem, 2vw, 1.4rem); letter-spacing:0.3em; text-transform:uppercase; }
    .g3d-cine-sub { bottom:16%; font-size:clamp(0.85rem, 1.8vw, 1.2rem); letter-spacing:0.22em; font-style:italic; }
    .g3d-cine-skip { position:absolute; right:22px; bottom:18px; font-family:var(--ui, monospace); font-size:0.7rem; letter-spacing:0.14em;
      text-transform:uppercase; color:rgba(240,230,210,0.55); pointer-events:none; }
    #btnIntro[aria-pressed="true"] { color:#f0d58a; }
  `;
  document.head.appendChild(style);
  const overlay = document.createElement('div'); overlay.className = 'g3d-cinema'; overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="g3d-cine-text g3d-cine-title"></div><div class="g3d-cine-text g3d-cine-sub"></div><div class="g3d-cine-skip">Click or press any key to skip</div>';
  document.body.appendChild(overlay);
  const titleEl = overlay.querySelector('.g3d-cine-title'), subEl = overlay.querySelector('.g3d-cine-sub');

  // ── A cinematic: a set, a camera path, timed captions ─────────────────────
  let shot = null;
  function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(p => V(...p)), false, 'centripetal'); }
  function play(o) {
    if (shot || STATE.inCombat) return false;
    shot = Object.assign({ t: 0, ending: false, fired: {} }, o);
    shot.pos = curve(o.path.map(p => p.pos)); shot.look = curve(o.path.map(p => p.look));
    E.cinema = true;
    overlay.classList.add('on');
    titleEl.classList.remove('show'); subEl.classList.remove('show');
    overlay.insertBefore(C.canvas, overlay.firstChild);
    C.post.fade = 1;
    E.setRoom(o.set, true);
    C.post.fade = 1; C.post.fadeTarget = 0;
    if (C.knight) C.knight.R.root.visible = !!o.showKnight;
    if (o.showKnight && o.knightAt) { C.knight.place(o.knightAt.pos, o.knightAt.rot); }
    E.camOverride = (pos, look) => {
      const u = ease(clamp(shot.t / shot.dur, 0, 1));
      pos.copy(shot.pos.getPoint(u)); look.copy(shot.look.getPoint(u));
    };
    E.dofOverride = null;
    return true;
  }
  function finish() {
    if (!shot || shot.ending) return;
    shot.ending = true; C.post.fadeTarget = 1;
    titleEl.classList.remove('show'); subEl.classList.remove('show');
    setTimeout(() => {
      const done = shot.onEnd; shot = null;
      E.camOverride = null; E.cinema = false;
      overlay.classList.remove('on');
      if (C.knight) C.knight.R.root.visible = true;
      E.setRoom(STATE.currentRoom, true);   // back to the game; the engine re-homes the canvas
      C.post.fade = 1; C.post.fadeTarget = 0;
      done && done();
    }, 650);
  }
  function caption(el, html) { el.innerHTML = html; el.classList.add('show'); }
  function tick(dt) {
    if (!shot || shot.ending) return;
    shot.t += dt;
    (shot.cues || []).forEach((c, i) => { if (!shot.fired[i] && shot.t >= c.at) { shot.fired[i] = true; c.run(); } });
    if (shot.t >= shot.dur) finish();
  }
  overlay.addEventListener('click', () => finish());
  window.addEventListener('keydown', ev => {
    if (!E.cinema) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (shot) finish(); else if (michael) michael.skip();
  }, true);

  // ── Opening: storm flyover into the chapel ────────────────────────────────
  function opening() {
    return play({
      set: '@exterior', dur: 12.5,
      path: [
        { pos: [-38, 7, 62], look: [0, 6, 0] },
        { pos: [-17, 12, 41], look: [0, 6, 0] },
        { pos: [1, 21, 21], look: [-3, 2, 0] },
        { pos: [10, 12, 15], look: [5, 4, 3] },
        { pos: [5.6, 3.4, 12], look: [5, 2.6, 4] },
        { pos: [5, 1.9, 5.6], look: [5, 1.8, -2] },
      ],
      cues: [
        { at: 1.2, run: () => caption(subEl, 'France · Anno Domini 1307') },
        { at: 3.0, run: () => { E._ln = 0.01; subEl.classList.remove('show'); } },
        { at: 4.2, run: () => caption(titleEl, '<b>KNIGHTS TEMPLAR</b><span>The Siege of the Undead</span>') },
        { at: 8.6, run: () => titleEl.classList.remove('show') },
        { at: 9.2, run: () => { E._ln = 0.01; } },
      ],
    });
  }
  // ── Ending: dawn over the fortress ────────────────────────────────────────
  function ending(onEnd) {
    return play({
      set: '@exteriorDawn', dur: 14, showKnight: true, knightAt: { pos: [1.5, 0, 9], rot: 2.3 },
      path: [
        { pos: [-4.5, 1.7, 13.5], look: [6, 3.5, -8] },
        { pos: [-9, 5, 18], look: [8, 5, -14] },
        { pos: [-17, 12, 28], look: [9, 5, -22] },
        { pos: [-32, 26, 58], look: [10, 4, -30] },
      ],
      cues: [
        { at: 1.0, run: () => C.knight && C.knight.play('divine', 2.4) },
        { at: 2.2, run: () => caption(subEl, 'Dawn breaks over the fortress.') },
        { at: 6.0, run: () => { subEl.classList.remove('show'); caption(titleEl, '<b>DEUS VULT</b><span>The Order endures</span>'); } },
      ],
      onEnd,
    });
  }

  // Opening plays once per browser; the 🎬 button replays it.
  const introBtn = document.createElement('button');
  introBtn.type = 'button'; introBtn.className = 'btn-audio'; introBtn.id = 'btnIntro'; introBtn.textContent = '🎬';
  introBtn.title = 'Watch the opening'; introBtn.setAttribute('aria-label', 'Watch the opening');
  introBtn.addEventListener('click', () => { if (!E.cinema) opening(); });
  const anchorBtn = document.getElementById('btnPhoto') || document.getElementById('btn3d');
  if (anchorBtn && anchorBtn.parentElement) anchorBtn.parentElement.insertBefore(introBtn, anchorBtn.nextSibling);
  let seen = false;
  try { seen = !!localStorage.getItem('kt_intro_seen'); } catch (_) {}
  if (!seen && STATE.currentRoom === 'chapel' && !STATE.inCombat) {
    try { localStorage.setItem('kt_intro_seen', '1'); } catch (_) {}
    setTimeout(() => opening(), 400);
  }

  // The ending takes the stage before the victory screen.
  const win = document.getElementById('winScreen');
  let endingShown = false;
  if (win) new MutationObserver(() => {
    if (!win.classList.contains('active') || endingShown || !E.active || !STATE.necromancerDead) return;
    endingShown = true;
    win.classList.remove('active');
    if (!ending(() => win.classList.add('active'))) win.classList.add('active');
  }).observe(win, { attributes: true, attributeFilter: ['class'] });

  // ── Saint Michael descends ────────────────────────────────────────────────
  let michael = null;
  E.onGolden = function (transform) {
    const k = C.knight; if (!k || michael) { transform(); return; }
    E.cinema = true;
    const fwd = V(); C.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const kp = k.home.clone();
    const target = kp.clone().addScaledVector(fwd, 1.9);
    const A = G3D.makeAngel(); A.root.position.set(target.x, 9, target.z);
    A.root.rotation.y = Math.atan2(kp.x - target.x, kp.z - target.z);
    C.scene.add(A.root);
    const shaft = G3D.props.lightShaft(1.0, 2.2, 13, '#ffe6a0', 0.001); shaft.position.set(target.x, 13, target.z); shaft.lookAt(target.x, 0, target.z); shaft.rotateX(-Math.PI / 2); C.scene.add(shaft);
    const center = kp.clone().lerp(target, 0.5); center.y = 1.7;
    const off = C.camera.position.clone().sub(center), r = Math.max(4, Math.hypot(off.x, off.z)), yaw0 = Math.atan2(off.x, off.z), y0 = C.camera.position.y;
    const m = { t: 0, done: false, transformed: false };
    C.post.barsHold = 8.5;
    E.camOverride = (pos, look) => {
      const u = ease(clamp(m.t / 7.2, 0, 1));
      const yaw = yaw0 + u * 0.75;
      pos.set(center.x + Math.sin(yaw) * r, G3D.lerp(y0, y0 + 1.2, u), center.z + Math.cos(yaw) * r);
      look.copy(center).y += G3D.lerp(1.2, 0.2, clamp(m.t / 4, 0, 1));
    };
    const fadeAngel = a => A.root.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = a; } });
    function doTransform() {
      if (m.transformed) return; m.transformed = true;
      transform();
      E.slowT = 0.6; E.punch && E.punch(1.2); E.shake && E.shake(0.4);
      if (G3D.juice) G3D.juice.shockwave(kp.clone().setY(0.05), '#ffd890', 4.5);
    }
    function end() {
      if (m.done) return; m.done = true;
      doTransform();
      C.scene.remove(A.root); C.scene.remove(shaft);
      E.camOverride = null; E.cinema = false; michael = null;
      E.gradeMul.exposure = 1;
    }
    michael = {
      skip: () => end(),
      tick(dt) {
        m.t += dt; const t = m.t;
        // Descend, wings beating slowly; the world dims as the light grows.
        const d = ease(clamp(t / 3.2, 0, 1));
        A.root.position.y = G3D.lerp(9, 0.9, d) + (t > 3.2 ? Math.sin(t * 1.6) * 0.08 : 0);
        const flap = Math.sin(t * 2.4) * 0.25;
        A.wingL.rotation.y = 0.35 + flap; A.wingR.rotation.y = -0.35 - flap;
        A.arm.rotation.z = -0.25 - ease(clamp((t - 3.2) / 1.0, 0, 1)) * 2.4;
        shaft.material.uniforms.strength.value = 0.45 * clamp(t / 1.2, 0, 1) * (t > 5 ? clamp(1 - (t - 5) / 2, 0, 1) : 1);
        E.gradeMul.exposure = t < 4.4 ? G3D.lerp(1, 0.72, clamp(t / 2, 0, 1)) : G3D.lerp(0.72, 1, clamp((t - 4.4) / 1.5, 0, 1));
        if (Math.random() < dt * 25) E.burst('holy', V(target.x + (Math.random() - 0.5) * 3, 5 + Math.random() * 3, target.z + (Math.random() - 0.5) * 3), 2, '#ffd890', 0.6);
        if (t >= 4.4) doTransform();
        if (t > 5.0) { A.root.position.y += dt * 2.2 * (t - 5); fadeAngel(clamp(1 - (t - 5) / 1.6, 0, 1)); }
        if (t >= 7.4) end();
      },
    };
  };
  C.canvas.addEventListener('click', () => { if (michael) michael.skip(); });

  const prevFrame = E.onFrame;
  E.onFrame = function (dt) { if (prevFrame) prevFrame(dt); tick(dt); if (michael) michael.tick(dt); };
  G3D.cinema = { opening, ending, get playing() { return !!shot || !!michael; } };
  }
})();
