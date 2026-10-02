/* Knights Templar 3D — the living world.
   Builds on game3d/engine.js:
   • exit sigils you can click, and the knight striding out through them
   • click the world: relics, scrolls, NPCs, and enemies in combat
   • timed strikes: hit the gold ring for a guaranteed critical
   • a procedural ambient soundscape (only while the player has sound on)
   Everything calls the game's own functions (go, grabRelic, readScroll,
   talkNPC, combatAction), so the rules and balance are unchanged. */
(function () {
  'use strict';
  // The engine boots on DOMContentLoaded; registering after it means it has run.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx) return;
  const E = G3D.engine, C = E.ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = G3D.clamp;
  const DIRS = ['north', 'east', 'south', 'west'];
  const ARROW = { north: '↑', east: '→', south: '↓', west: '←' };

  // ── DOM: hover label + strike UI ──────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .g3d-label { position:absolute; z-index:6; pointer-events:none; transform:translate(-50%,-130%); white-space:nowrap;
      font-family:var(--ui, monospace); font-size:0.78rem; letter-spacing:0.12em; text-transform:uppercase; color:#f0d58a;
      background:rgba(8,8,10,0.82); border:1px solid rgba(201,168,76,0.45); padding:5px 10px; border-radius:2px;
      box-shadow:0 0 18px rgba(201,168,76,0.25); opacity:0; transition:opacity 0.15s ease; }
    .g3d-label.on { opacity:1; }
    .g3d-label small { display:block; font-size:0.62rem; letter-spacing:0.08em; color:rgba(240,230,210,0.6); text-transform:none; margin-top:2px; }
    .g3d-strike { position:absolute; inset:0; z-index:6; pointer-events:none; }
    .g3d-strike svg { position:absolute; overflow:visible; transform-origin:0 0; }
    .g3d-strike .hint { position:absolute; left:50%; bottom:10px; transform:translateX(-50%); font-family:var(--ui, monospace);
      font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:rgba(240,213,138,0.85); text-shadow:0 0 8px #000; white-space:nowrap; }
    .g3d-strike .verdict { position:absolute; transform:translate(-50%,-50%); font-family:var(--heading, serif); font-size:1.6rem;
      letter-spacing:0.12em; color:#ffd36a; text-shadow:0 0 18px rgba(255,200,80,0.8); animation:g3dPop 0.7s ease-out forwards; }
    .scene-panel.g3d-photo .scene-overlay { opacity:0; transition:opacity 0.3s ease; }
    .scene-panel.g3d-photo .g3d-canvas { cursor:grab; touch-action:none; }
    .scene-panel.g3d-photo .g3d-canvas:active { cursor:grabbing; }
    .g3d-photo-hint { position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:6; pointer-events:none; white-space:nowrap;
      font-family:var(--ui, monospace); font-size:0.68rem; letter-spacing:0.1em; color:rgba(240,230,210,0.85);
      background:rgba(8,8,10,0.7); border:1px solid rgba(201,168,76,0.35); padding:5px 12px; border-radius:2px; }
    .g3d-photo-hint b { color:#f0d58a; font-weight:normal; text-transform:uppercase; margin-right:6px; }
    .g3d-photo-hint kbd { font-family:inherit; border:1px solid rgba(240,230,210,0.35); padding:0 4px; border-radius:2px; }
    #btnPhoto[aria-pressed="true"] { color:#f0d58a; border-color:rgba(201,168,76,0.7); }
    @media (max-width: 700px) { .g3d-photo-hint { font-size:0.58rem; white-space:normal; width:90%; text-align:center; } }
    @keyframes g3dPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.6)} 25%{opacity:1;transform:translate(-50%,-50%) scale(1.15)} 100%{opacity:0;transform:translate(-50%,-70%) scale(1)} }
  `;
  document.head.appendChild(style);
  const label = document.createElement('div');
  label.className = 'g3d-label';

  // ── Exit sigils ───────────────────────────────────────────────────────────
  const sigilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf6a').multiplyScalar(1.5), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
  const sigilCore = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0c0').multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const exitGroup = new THREE.Group(); C.scene.add(exitGroup);
  const proxies = new THREE.Group(); C.scene.add(proxies);
  let exits = [];

  function makeSigil(dir) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 8, 40), sigilMat); g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 32), sigilMat); ring2.rotation.y = Math.PI / 2; g.add(ring2);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), sigilCore); g.add(core);
    const glow = G3D.glow('#ffc860', 0.75, 0.5); g.add(glow);
    const beam = G3D.props.lightShaft(0.02, 0.18, 1.6, '#ffd890', 0.25); beam.rotation.x = Math.PI; beam.position.y = -1.7; g.add(beam);
    g.userData = { dir, ring, ring2, core, glow, hover: 0, base: 1 };
    return g;
  }

  // Place sigils in screen space (from the room's resting camera) so they're
  // always visible: north far ahead, east right, west left, south near the lens.
  const SCREEN = { north: [0.12, -0.02, 10], east: [0.8, -0.05, 6.5], west: [-0.8, 0.22, 7.5], south: [0.42, -0.62, 3.6] };
  function restCamera(spec) {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
    const el = C.canvas.parentElement, aspect = (el.clientWidth || 3) / (el.clientHeight || 1);
    const fovH = spec.cam.fovH || 76;
    cam.fov = clamp(2 * Math.atan(Math.tan(fovH * Math.PI / 360) / aspect) * 180 / Math.PI, 26, 68);
    cam.aspect = aspect; cam.position.set(...spec.cam.pos); cam.lookAt(V(...spec.cam.look)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    return cam;
  }
  function buildExits(id, spec) {
    exitGroup.clear(); exits = [];
    const room = ROOMS[id]; if (!room || !room.exits) return;
    const cam = restCamera(spec), origin = cam.position.clone();
    DIRS.forEach(dir => {
      const to = room.exits[dir]; if (!to) return;
      const [nx, ny, d] = SCREEN[dir];
      const p = V(nx, ny, 0.5).unproject(cam).sub(origin).normalize().multiplyScalar(d).add(origin);
      p.y = clamp(p.y, 0.7, 2.4);
      const s = makeSigil(dir); s.position.copy(p); exitGroup.add(s);
      // Near sigils would fill the frame; keep them a similar size on screen.
      s.userData.base = clamp(p.distanceTo(origin) / 7, 0.5, 1.2);
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), proxyMat); proxy.position.copy(p);
      proxy.userData.hit = { kind: 'exit', dir, to, obj: s };
      exits.push({ dir, to, sigil: s, proxy });
    });
  }

  // ── Interactive targets (rebuilt each frame from engine state) ────────────
  const proxyFor = {};
  function proxy(key, w, h, d) {
    if (!proxyFor[key]) { proxyFor[key] = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat); proxies.add(proxyFor[key]); }
    return proxyFor[key];
  }
  function canAct() { return !photo.on && !STATE.inCombat && !walking && !C.pending && !(C.knight && (C.knight.dead || C.knight.walk)); }
  function targets() {
    const list = [];
    const room = ROOMS[C.roomId];
    if (STATE.inCombat && C.enemy && C.enemy.alive !== false && !C.enemy.dissolve) {
      const p = proxy('enemy', 1.3, 2.6, 1.3); p.position.copy(C.enemy.home).add(V(0, 1.3, 0));
      p.userData.hit = { kind: 'enemy' }; list.push(p);
    }
    if (canAct()) {
      exits.forEach(e => list.push(e.proxy));
      if (C.relicObj && room && room.relic) { const p = proxy('relic', 1.1, 2.4, 1.1); p.position.copy(C.relicObj.position).add(V(0, 1.2, 0)); p.userData.hit = { kind: 'relic', name: room.relic }; list.push(p); }
      if (C.scrollObj && C.hasScroll(C.roomId)) { const p = proxy('scroll', 0.9, 0.9, 0.9); p.position.copy(C.scrollObj.position).add(V(0, 0.3, 0)); p.userData.hit = { kind: 'scroll' }; list.push(p); }
      if (C.npc && room && room.npc) { const p = proxy('npc', 1.0, 2.1, 1.0); p.position.copy(C.npc.home).add(V(0, 1.05, 0)); p.userData.hit = { kind: 'npc', name: (NPCS[room.npc] || {}).name }; list.push(p); }
    }
    return list;
  }

  function describe(hit) {
    if (hit.kind === 'exit') return ARROW[hit.dir] + ' ' + hit.dir + '<small>' + ((ROOMS[hit.to] && (STATE.visited && STATE.visited.has(hit.to) ? ROOMS[hit.to].name : 'Unexplored'))) + '</small>';
    if (hit.kind === 'relic') return '⚜ Take relic<small>' + hit.name + '</small>';
    if (hit.kind === 'scroll') return '📜 Read scroll<small>A sacred text lies here</small>';
    if (hit.kind === 'npc') return '💬 Speak<small>' + (hit.name || '') + '</small>';
    if (hit.kind === 'enemy') return strike ? '⚔ Strike!' : '⚔ Attack';
    return '';
  }

  function act(hit) {
    if (hit.kind === 'exit') window.go(hit.dir);
    else if (hit.kind === 'relic') window.grabRelic();
    else if (hit.kind === 'scroll') window.readScroll();
    else if (hit.kind === 'npc') window.talkNPC();
    else if (hit.kind === 'enemy') window.combatAction('attack');
  }

  // ── Pointer handling on the canvas (it moves between scene and combat view) ─
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null, pointer = null;
  function pick(ev) {
    const r = C.canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, C.camera);
    const list = targets(); list.forEach(o => o.updateMatrixWorld());
    const hits = ray.intersectObjects(list, false);
    return hits.length ? hits[0].object.userData.hit : null;
  }
  C.canvas.addEventListener('pointermove', ev => { pointer = { x: ev.clientX, y: ev.clientY }; hovered = pick(ev); });
  C.canvas.addEventListener('pointerleave', () => { pointer = null; hovered = null; });
  C.canvas.addEventListener('click', ev => {
    if (photo.on) return;
    if (strike) { resolveStrike(); return; }
    const hit = pick(ev);
    if (hit) act(hit);
  });

  function updateHover() {
    const host = C.canvas.parentElement;
    if (label.parentElement !== host) host.appendChild(label);
    C.canvas.style.cursor = hovered ? 'pointer' : '';
    if (hovered && pointer) {
      const r = host.getBoundingClientRect();
      const html = describe(hovered);
      if (label.innerHTML !== html) label.innerHTML = html;
      label.style.left = (pointer.x - r.left) + 'px'; label.style.top = (pointer.y - r.top) + 'px';
      if (!label.classList.contains('on')) label.classList.add('on');
    } else if (label.classList.contains('on')) label.classList.remove('on');
  }

  function updateSigils(dt) {
    const show = canAct();
    exitGroup.visible = show;
    exits.forEach((e, i) => {
      const s = e.sigil, u = s.userData, t = C.time + i * 0.7;
      const target = hovered && hovered.kind === 'exit' && hovered.dir === e.dir ? 1 : 0;
      u.hover += (target - u.hover) * Math.min(1, dt * 10);
      u.ring.rotation.y = t * 0.9; u.ring2.rotation.x = t * 1.3; u.core.rotation.y = t * 2;
      s.position.y += Math.sin(t * 1.6) * 0.0015;
      const k = 1 + u.hover * 0.45;
      s.scale.setScalar(u.base * k);
      u.glow.material.opacity = (0.16 + u.hover * 0.3) * (0.8 + 0.2 * Math.sin(t * 3));
    });
  }

  // ── Walking out of a room ─────────────────────────────────────────────────
  let walking = false;
  const origGo = window.go;
  window.go = function (dir) {
    if (walking || photo.on) return;
    const room = ROOMS[STATE.currentRoom];
    if (!E.active || STATE.inCombat || C.pending || !room || !room.exits[dir] || C.reducedMotion || !C.knight || C.knight.dead) return origGo(dir);
    walking = true; hovered = null;
    const k = C.knight; k.anim = null;
    k.walkTo(k.home.clone().addScaledVector(C.DIRV[dir], 3.0), 1.0, null);
    setTimeout(() => { walking = false; E.travelDir = dir; origGo(dir); }, 640);
  };

  // ── Timed strikes ─────────────────────────────────────────────────────────
  // Attack starts a closing ring around the foe; strike again (button, A, Space
  // or a click) as it meets the gold ring for a guaranteed critical hit. Doing
  // nothing resolves as a normal attack, so the old rhythm still works.
  const origCombat = window.combatAction;
  let strike = null, strikeLockUntil = 0;
  const R0 = 118, RT = 34, WINDOW = 9, DUR = 0.85;
  const ui = document.createElement('div'); ui.className = 'g3d-strike';
  ui.innerHTML = '<svg width="1" height="1"><circle class="t" r="' + RT + '" fill="none" stroke="#ffd36a" stroke-width="3" opacity="0.9"/>' +
    '<circle class="w" r="' + RT + '" fill="none" stroke="#ffd36a" stroke-width="' + (WINDOW * 2) + '" opacity="0.12"/>' +
    '<circle class="c" fill="none" stroke="#f5f2ec" stroke-width="2.5"/></svg><div class="hint">Strike again on the gold ring</div>';
  const svg = ui.querySelector('svg'), cc = ui.querySelector('.c');

  function strikeCenter() {
    const host = C.canvas.parentElement, r = host.getBoundingClientRect(), cr = C.canvas.getBoundingClientRect();
    const p = C.enemy ? C.enemy.home.clone().add(V(0, 1.35, 0)).project(C.camera) : V(0.3, 0.1, 0);
    return { x: (p.x * 0.5 + 0.5) * cr.width + (cr.left - r.left), y: (-p.y * 0.5 + 0.5) * cr.height + (cr.top - r.top) };
  }
  function beginStrike() {
    strike = { t: 0, start: performance.now() };
    const host = C.canvas.parentElement; if (ui.parentElement !== host) host.appendChild(ui);
    ui.style.display = '';
  }
  function resolveStrike() {
    if (!strike) return;
    const u = clamp((performance.now() - strike.start) / 1000 / DUR, 0, 1), r = R0 * (1 - u);
    const perfect = Math.abs(r - RT) <= WINDOW;
    const pos = strikeCenter();
    strike = null; strikeLockUntil = performance.now() + 250;
    ui.style.display = 'none';
    if (perfect && STATE.inCombat) {
      STATE.questFlags._guaranteedCrit = true;
      verdict('PERFECT', pos);
      if (C.enemy) C.burst('holy', C.enemy.home.clone().add(V(0, 1.4, 0)), 50, '#ffd36a', 3);
    }
    origCombat('attack');
  }
  function verdict(text, pos) {
    const host = C.canvas.parentElement, v = document.createElement('div');
    v.className = 'verdict'; v.textContent = text; v.style.left = pos.x + 'px'; v.style.top = (pos.y - 60) + 'px';
    const wrap = document.createElement('div'); wrap.className = 'g3d-strike'; wrap.appendChild(v); host.appendChild(wrap);
    setTimeout(() => wrap.remove(), 800);
  }
  window.combatAction = function (action) {
    if (!E.active || action !== 'attack' || !STATE.inCombat || C.reducedMotion || (C.knight && C.knight.dead) ||
        (STATE.bossPhase === 2 && STATE.bossShadows && STATE.bossShadows.length)) return origCombat(action);
    if (strike) { resolveStrike(); return; }
    if (performance.now() < strikeLockUntil) return;
    beginStrike();
  };
  document.addEventListener('keydown', e => {
    if (strike && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); resolveStrike(); }
  });
  function updateStrike() {
    if (!strike) { ui.style.display = 'none'; return; }
    if (!STATE.inCombat || !E.active) { strike = null; ui.style.display = 'none'; return; }
    const u = (performance.now() - strike.start) / 1000 / DUR;
    if (u >= 1) { resolveStrike(); return; }
    const pos = strikeCenter(), r = R0 * (1 - u), near = Math.abs(r - RT) <= WINDOW;
    svg.style.left = pos.x + 'px'; svg.style.top = pos.y + 'px';
    svg.style.transform = 'scale(' + clamp(C.canvas.clientHeight / 340, 0.6, 1).toFixed(3) + ')';
    svg.querySelectorAll('circle').forEach(c => { c.setAttribute('cx', 0); c.setAttribute('cy', 0); });
    cc.setAttribute('r', Math.max(0, r)); cc.setAttribute('stroke', near ? '#ffd36a' : '#f5f2ec');
    cc.setAttribute('stroke-width', near ? 4 : 2.5);
  }

  // ── Ambient soundscape ────────────────────────────────────────────────────
  // Plays only while the player has sound switched on (the ♪ Music button).
  const amb = { ctx: null, master: null, noise: null, wind: null, windGain: null, windFilter: null, rumbleGain: null, profile: null, nextCrackle: 0, nextDrip: 0, on: false };
  const WINDY = { courtyard: 0.7, watchtower: 0.9, tower: 0.45, cloister: 0.35 };
  const DRIPS = { catacombs: 1, crypt: 0.7, dungeon: 0.9, lair: 0.4 };
  const RUMBLE = { lair: 0.9, throne: 0.6, catacombs: 0.35, crypt: 0.3 };
  const RAIN = { courtyard: 1, watchtower: 0.85 };
  function profileFor(id) {
    const type = (ROOMS[id] && ROOMS[id].type) || '';
    const fires = (C.room && C.room.anchors) ? C.room.anchors.length : 0;
    return { wind: WINDY[type] || 0, drip: DRIPS[type] || 0, rumble: RUMBLE[type] || 0, rain: RAIN[type] || 0, crackle: Math.min(1, fires / 6) };
  }
  function ensureAudio() {
    if (amb.ctx) return true;
    try { amb.ctx = window.getAudioCtx(); } catch (_) { return false; }
    const ctx = amb.ctx, sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    amb.noise = buf;
    amb.master = ctx.createGain(); amb.master.gain.value = 0; amb.master.connect(ctx.destination);
    // Wind: band-passed noise with a slow, wandering filter
    const w = ctx.createBufferSource(); w.buffer = buf; w.loop = true;
    amb.windFilter = ctx.createBiquadFilter(); amb.windFilter.type = 'bandpass'; amb.windFilter.frequency.value = 420; amb.windFilter.Q.value = 0.7;
    amb.windGain = ctx.createGain(); amb.windGain.gain.value = 0;
    w.connect(amb.windFilter).connect(amb.windGain).connect(amb.master); w.start();
    // Rumble: deep low-passed noise
    const rb = ctx.createBufferSource(); rb.buffer = buf; rb.loop = true; rb.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90;
    amb.rumbleGain = ctx.createGain(); amb.rumbleGain.gain.value = 0;
    rb.connect(lp).connect(amb.rumbleGain).connect(amb.master); rb.start();
    // Rain: a steady hiss of high-passed noise
    const rn = ctx.createBufferSource(); rn.buffer = buf; rn.loop = true; rn.playbackRate.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 7500;
    amb.rainGain = ctx.createGain(); amb.rainGain.gain.value = 0;
    rn.connect(hp).connect(lp2).connect(amb.rainGain).connect(amb.master); rn.start();
    return true;
  }
  function blip(type) {
    const ctx = amb.ctx, t = ctx.currentTime;
    if (type === 'crackle') {
      const s = ctx.createBufferSource(); s.buffer = amb.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 2500;
      const g = ctx.createGain(); const len = 0.015 + Math.random() * 0.04;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.08, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(hp).connect(g).connect(amb.master); s.start(t, Math.random() * 1.5, len + 0.02);
    } else if (type === 'drip') {
      const o = ctx.createOscillator(); o.type = 'sine';
      const f = 900 + Math.random() * 700;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.09);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(amb.master); o.start(t); o.stop(t + 0.3);
    } else if (type === 'thunder') {
      const s = ctx.createBufferSource(); s.buffer = amb.noise; s.playbackRate.value = 0.3;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(420, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      s.connect(lp).connect(g).connect(amb.master); s.start(t, Math.random(), 3.4);
    } else if (type === 'step') {
      const s = ctx.createBufferSource(); s.buffer = amb.noise;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380 + Math.random() * 120;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      s.connect(lp).connect(g).connect(amb.master); s.start(t, Math.random() * 1.5, 0.15);
    }
  }
  function updateAudio(dt) {
    const want = !!STATE.audioPlaying && !document.hidden;
    if (!want && !amb.on) return;
    if (want && !ensureAudio()) return;
    const ctx = amb.ctx, t = ctx.currentTime;
    if (want !== amb.on) { amb.on = want; amb.master.gain.cancelScheduledValues(t); amb.master.gain.setTargetAtTime(want ? 0.9 : 0, t, 0.6); }
    if (!amb.on) return;
    const p = amb.profile || (amb.profile = profileFor(C.roomId));
    amb.windGain.gain.setTargetAtTime(p.wind * (0.07 + 0.04 * Math.sin(C.time * 0.23)), t, 0.8);
    amb.windFilter.frequency.setTargetAtTime(320 + 260 * (0.5 + 0.5 * Math.sin(C.time * 0.17)) , t, 1.0);
    amb.rumbleGain.gain.setTargetAtTime(p.rumble * 0.12, t, 1.2);
    amb.rainGain.gain.setTargetAtTime(p.rain * 0.16, t, 0.8);
    // Thunder follows the lightning flash after a beat.
    const ln = G3D.uniforms.lightning ? G3D.uniforms.lightning.value : 0;
    if (ln > 0.8 && !amb.lnPrev) { const at = t + 0.5 + Math.random() * 1.2; setTimeout(() => { if (amb.on) blip('thunder'); }, (at - t) * 1000); }
    amb.lnPrev = ln > 0.8;
    if (p.crackle > 0 && C.time > amb.nextCrackle) { blip('crackle'); amb.nextCrackle = C.time + (0.04 + Math.random() * 0.22) / p.crackle; }
    if (p.drip > 0 && C.time > amb.nextDrip) { blip('drip'); amb.nextDrip = C.time + (1.2 + Math.random() * 3.5) / p.drip; }
  }
  E.onStep = () => { if (amb.on) blip('step'); };

  // ── Photo mode ────────────────────────────────────────────────────────────
  // P (or the 📷 button) frees the camera: drag to orbit the knight, scroll to
  // zoom, [ and ] to change the depth-of-field blur, P or Esc to return.
  const photo = { on: false, yaw: 0, pitch: 0.2, dist: 4.5, target: V(0, 1, 0), ap: 0.45, drag: null };
  const photoHint = document.createElement('div'); photoHint.className = 'g3d-photo-hint';
  photoHint.innerHTML = '<b>Photo mode</b> drag to orbit · scroll to zoom · [ ] focus blur · <kbd>P</kbd> / <kbd>Esc</kbd> exit';
  const photoBtn = document.createElement('button');
  photoBtn.type = 'button'; photoBtn.className = 'btn-audio'; photoBtn.id = 'btnPhoto';
  photoBtn.title = 'Photo mode (P): orbit the camera freely'; photoBtn.setAttribute('aria-pressed', 'false');
  photoBtn.textContent = '📷'; photoBtn.setAttribute('aria-label', 'Photo mode');
  const b3 = document.getElementById('btn3d');
  if (b3 && b3.parentElement) b3.parentElement.insertBefore(photoBtn, b3.nextSibling);
  photoBtn.addEventListener('click', () => setPhoto(!photo.on));
  function photoAllowed() { return E.active && !STATE.inCombat && !C.pending && !walking && C.knight && !C.knight.dead && !C.knight.walk && !strike; }
  function setPhoto(on) {
    if (on && !photoAllowed()) return;
    photo.on = on; hovered = null;
    C.panel.classList.toggle('g3d-photo', on);
    photoBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      // Start exactly where the camera is, so the switch is seamless.
      photo.target.copy(C.knight.home); photo.target.y += 1.1;
      const off = C.camera.position.clone().sub(photo.target), d = off.length();
      photo.dist = clamp(d, 1.6, 10); photo.yaw = Math.atan2(off.x, off.z); photo.pitch = clamp(Math.asin(off.y / d), -0.12, 1.3);
      if (photoHint.parentElement !== C.panel) C.panel.appendChild(photoHint);
      E.camOverride = (pos, look) => {
        const cp = Math.cos(photo.pitch);
        pos.set(photo.target.x + Math.sin(photo.yaw) * cp * photo.dist, Math.max(0.25, photo.target.y + Math.sin(photo.pitch) * photo.dist), photo.target.z + Math.cos(photo.yaw) * cp * photo.dist);
        look.copy(photo.target);
      };
      E.dofOverride = { target: photo.target, aperture: photo.ap };
    } else {
      photoHint.remove(); E.camOverride = null; E.dofOverride = null; photo.drag = null;
    }
  }
  C.canvas.addEventListener('pointerdown', ev => {
    if (!photo.on) return;
    photo.drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    try { C.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
  });
  C.canvas.addEventListener('pointermove', ev => {
    if (!photo.on || !photo.drag || photo.drag.id !== ev.pointerId) return;
    photo.yaw -= (ev.clientX - photo.drag.x) * 0.008;
    photo.pitch = clamp(photo.pitch + (ev.clientY - photo.drag.y) * 0.006, -0.12, 1.3);
    photo.drag.x = ev.clientX; photo.drag.y = ev.clientY;
  });
  const endDrag = () => { photo.drag = null; };
  C.canvas.addEventListener('pointerup', endDrag); C.canvas.addEventListener('pointercancel', endDrag);
  C.canvas.addEventListener('wheel', ev => {
    if (!photo.on) return;
    ev.preventDefault();
    photo.dist = clamp(photo.dist * Math.exp(ev.deltaY * 0.0012), 1.6, 10);
  }, { passive: false });
  // Capture phase, so photo mode can keep the game's own shortcuts from firing.
  window.addEventListener('keydown', ev => {
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = ev.key;
    if (!photo.on) { if ((k === 'p' || k === 'P') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) setPhoto(true); return; }
    ev.stopImmediatePropagation();
    if (k === 'p' || k === 'P' || k === 'Escape') { setPhoto(false); return; }
    if (k === '[' || k === ']') { photo.ap = clamp(photo.ap + (k === ']' ? 0.1 : -0.1), 0, 1.2); E.dofOverride.aperture = photo.ap; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { ev.preventDefault(); photo.yaw += k === 'ArrowLeft' ? 0.08 : -0.08; }
    if (k === 'ArrowUp' || k === 'ArrowDown') { ev.preventDefault(); photo.pitch = clamp(photo.pitch + (k === 'ArrowUp' ? 0.05 : -0.05), -0.12, 1.3); }
    if (k === '+' || k === '=' || k === '-') photo.dist = clamp(photo.dist * (k === '-' ? 1.1 : 0.9), 1.6, 10);
  }, true);
  function updatePhoto() { if (photo.on && !photoAllowed()) setPhoto(false); }

  // ── Wire into the engine ──────────────────────────────────────────────────
  E.onRoom = function (id, spec) { if (photo.on) setPhoto(false); buildExits(id, spec); amb.profile = null; hovered = null; };
  E.onFrame = function (dt) { updatePhoto(); updateSigils(dt); updateHover(); updateStrike(); updateAudio(dt); };
  if (C.room && C.roomId) buildExits(C.roomId, C.room);
  G3D.world = { group: exitGroup, exits: () => exits.map(e => ({ dir: e.dir, to: e.to, pos: e.sigil.position.toArray() })), get strike() { return strike; }, get walking() { return walking; }, get hovered() { return hovered; }, amb, photo, setPhoto };
  }
})();
