/* Knights Templar — settings and accessibility (⚙ in the top bar, or F10).

   Graphics: quality tier, render resolution, and each Ultra effect.
   Audio: master volume (every sound, via a bus on the audio destination) and
   ambience & combat music. Comfort: camera shake, hit-stop and slow motion,
   reduced motion, simple attacks instead of the timed strike, text size and
   touch controls. Choices persist in localStorage ('kt_settings'). Works in the
   2D mode too (audio and text size). */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const KEY = 'kt_settings';
  const DEFAULTS = {
    resScale: 1, vol: true, ssr: true, ao: true, dof: true, lens: true, grain: true, taa: true, pom: true, pcss: true, hires: true,
    master: 1, music: 0.8, ambience: 1,
    shake: true, impact: true, motion: 'system', strikes: 'timed', text: 'normal', touch: 'auto',
  };
  const load = () => { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return Object.assign({}, DEFAULTS); } };
  const S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  const pref = () => { try { return localStorage.getItem('kt3d'); } catch (_) { return null; } };
  const G3D = window.G3D || {};
  const E = G3D.engine && G3D.engine.active ? G3D.engine : null;

  // ── Audio: one master bus in front of the speakers ────────────────────────
  let bus = null;
  function installBus(ctx) {
    if (ctx.__ktBus) return;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Object.getPrototypeOf(ctx)), 'destination') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'destination');
    const real = desc && desc.get ? desc.get.call(ctx) : ctx.destination;
    bus = ctx.createGain(); bus.gain.value = S.master; bus.connect(real);
    try { Object.defineProperty(ctx, 'destination', { get: () => bus, configurable: true }); ctx.__ktBus = bus; } catch (_) { bus = null; }
  }
  if (typeof window.getAudioCtx === 'function') {
    const orig = window.getAudioCtx;
    window.getAudioCtx = function () { const ctx = orig.apply(this, arguments); try { installBus(ctx); } catch (_) {} return ctx; };
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  function apply() {
    document.documentElement.style.fontSize = S.text === 'xl' ? '125%' : S.text === 'large' ? '112.5%' : '';
    if (bus) bus.gain.value = S.master;
    const amb = G3D.world && G3D.world.amb;
    if (amb && amb.bus) amb.bus.gain.value = S.ambience;
    if (window.KTMusic) KTMusic.setVolume(S.music);
    if (E) {
      Object.assign(E.fx, { vol: S.vol, ssr: S.ssr, ao: S.ao, dof: S.dof, taa: S.taa });
      E.shakeOn = S.shake; E.impactOn = S.impact; E.simpleStrikes = S.strikes === 'simple';
      E.grain = S.grain ? 0.03 : 0;
      if (E.setLens) E.setLens(S.lens);
      if (E.setResScale) E.setResScale(S.resScale);
    }
    if (G3D.world && G3D.world.setTouch) G3D.world.setTouch(S.touch);
  }

  // ── The menu ──────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .kt-settings { position:fixed; inset:0; z-index:9000; display:none; align-items:center; justify-content:center; background:rgba(4,4,6,0.72); }
    .kt-settings.on { display:flex; }
    .kt-panel { width:min(560px, calc(100vw - 32px)); max-height:calc(100vh - 48px); overflow:auto; background:#0e0d0b; border:1px solid rgba(201,168,76,0.45);
      box-shadow:0 20px 60px rgba(0,0,0,0.6); padding:20px 22px; color:#e8dfc8; font-family:var(--ui, Georgia, serif); }
    .kt-panel h2 { margin:0 0 4px; font-family:var(--heading, serif); font-weight:normal; letter-spacing:0.18em; text-transform:uppercase; font-size:1.1rem; color:#e8c06a; }
    .kt-panel h3 { margin:18px 0 8px; font-size:0.72rem; letter-spacing:0.22em; text-transform:uppercase; color:#b8933a; border-bottom:1px solid rgba(201,168,76,0.2); padding-bottom:4px; }
    .kt-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:6px 0; font-size:0.9rem; }
    .kt-row small { display:block; color:rgba(232,223,200,0.55); font-size:0.75rem; }
    .kt-row select, .kt-row input[type=range] { accent-color:#c9a84c; background:#1a1814; color:#e8dfc8; border:1px solid rgba(201,168,76,0.35); padding:4px 6px; font:inherit; font-size:0.85rem; }
    .kt-row input[type=range] { width:150px; padding:0; }
    .kt-row input[type=checkbox] { accent-color:#c9a84c; width:18px; height:18px; }
    .kt-row.dim { opacity:0.45; }
    .kt-keys { display:grid; grid-template-columns:auto 1fr; gap:4px 14px; font-size:0.82rem; color:rgba(232,223,200,0.85); }
    .kt-keys kbd { font-family:monospace; border:1px solid rgba(201,168,76,0.4); padding:0 5px; border-radius:2px; color:#f0d58a; white-space:nowrap; }
    .kt-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
    .kt-actions button { font:inherit; font-size:0.85rem; letter-spacing:0.08em; padding:7px 14px; background:#1a1814; color:#e8dfc8; border:1px solid rgba(201,168,76,0.45); cursor:pointer; }
    .kt-actions button.primary { background:#3a2c10; color:#f0d58a; }
    .kt-note { font-size:0.75rem; color:#e0a060; margin-top:8px; min-height:1em; }
  `;
  document.head.appendChild(style);
  const wrap = document.createElement('div'); wrap.className = 'kt-settings'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Settings');
  const tier = pref() === 'off' ? 'off' : pref() === 'std' ? 'std' : 'ultra';
  const ultra = !!(E && E.ultra);
  const row = (label, hint, control, dim) => `<div class="kt-row${dim ? ' dim' : ''}"><label>${label}${hint ? `<small>${hint}</small>` : ''}</label>${control}</div>`;
  const check = (k) => `<input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}>`;
  const range = (k, min, max, step) => `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}">`;
  const select = (k, opts) => `<select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${S[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  wrap.innerHTML = `<div class="kt-panel">
    <h2>⚙ Settings</h2>
    <h3>Graphics</h3>
    ${row('Quality', 'Ultra: volumetric light, reflections, occlusion, depth of field', `<select data-k="tier"><option value="ultra" ${tier === 'ultra' ? 'selected' : ''}>Ultra</option><option value="std" ${tier === 'std' ? 'selected' : ''}>Standard 3D</option><option value="off" ${tier === 'off' ? 'selected' : ''}>Classic 2D</option></select>`)}
    ${row('Resolution', 'Lower is faster on older machines', range('resScale', 0.5, 1, 0.05), !E)}
    ${row('Volumetric fog & light shafts', '', check('vol'), !ultra)}
    ${row('Reflections', '', check('ssr'), !ultra)}
    ${row('Ambient occlusion', '', check('ao'), !ultra)}
    ${row('Depth of field', '', check('dof'), !ultra)}
    ${row('Temporal anti-aliasing', 'Steadier edges and smoother fog', check('taa'), !ultra)}
    ${row('Parallax stone', 'Mortar and flagstones with real depth', check('pom'), !ultra)}
    ${row('Soft shadows', 'Sharp at the foot, soft far away', check('pcss'), !ultra)}
    ${row('High-resolution textures', 'Rebuilt in the background after loading', check('hires'), !ultra)}
    ${row('Lens flares, streaks, dirt & heat shimmer', '', check('lens'), !E)}
    ${row('Film grain', '', check('grain'), !E)}
    <h3>Audio</h3>
    ${row('Master volume', 'All sound', range('master', 0, 1, 0.05))}
    ${row('Music', 'Choir, chant and bells', range('music', 0, 1, 0.05))}
    ${row('Ambience & combat music', 'Wind, rain, thunder, fire, war drums', range('ambience', 0, 1, 0.05))}
    <h3>Comfort &amp; accessibility</h3>
    ${row('Camera shake', '', check('shake'), !E)}
    ${row('Hit-stop & slow motion', 'The freeze-frame on impacts', check('impact'), !E)}
    ${row('Motion', 'Reduced turns off cinematics, walking and drifting', select('motion', [['system', 'Follow system setting'], ['reduce', 'Reduced'], ['full', 'Full']]))}
    ${row('Attacks', 'Simple: no timing ring, every attack lands at once', select('strikes', [['timed', 'Timed strikes'], ['simple', 'Simple']]), !E)}
    ${row('Text size', '', select('text', [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']]))}
    ${row('Touch controls', 'On-screen joystick and buttons', select('touch', [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Off']]), !E)}
    <h3>Controls</h3>
    <div class="kt-keys">
      <kbd>W A S D / ←↑→↓</kbd><span>Walk (hold Shift to run) · tap the floor to walk there</span>
      <kbd>E</kbd><span>Use what's in reach: relics, scrolls, people</span>
      <kbd>A · D · F</kbd><span>In combat: attack · defend · flee (1 · 2 · 3). Defending can parry a blow and riposte</span>
      <kbd>Space</kbd><span>Land a timed strike on the gold ring</span>
      <kbd>G · R · T · X</kbd><span>Take relic · read scroll · talk · examine portrait</span>
      <kbd>P</kbd><span>Photo mode</span>
      <kbd>F5 · F9</kbd><span>Quick save · quick load</span>
      <kbd>C</kbd><span>Codex: skills, bestiary and achievements</span>
      <kbd>F10</kbd><span>Settings</span>
      <kbd>Gamepad</kbd><span>Stick moves · A acts / attacks · X defends · B flees</span>
    </div>
    <div class="kt-note" aria-live="polite"></div>
    <div class="kt-actions"><button type="button" data-a="reset">Reset</button><button type="button" class="primary" data-a="close">Done</button></div>
  </div>`;
  document.body.appendChild(wrap);
  const note = wrap.querySelector('.kt-note');
  let needsReload = false;
  wrap.addEventListener('input', ev => {
    const el = ev.target, k = el.dataset.k; if (!k) return;
    if (k === 'tier') { try { localStorage.setItem('kt3d', el.value === 'ultra' ? 'on' : el.value); } catch (_) {} needsReload = el.value !== tier; }
    else {
      S[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
      if (k === 'motion' || k === 'pom' || k === 'pcss' || k === 'hires') needsReload = true;
      save(); apply();
    }
    note.textContent = needsReload ? 'Some changes apply when the page reloads — it will reload when you press Done.' : '';
  });
  wrap.addEventListener('click', ev => {
    const a = ev.target.dataset && ev.target.dataset.a;
    if (ev.target === wrap || a === 'close') close();
    if (a === 'reset') { Object.assign(S, DEFAULTS); save(); try { localStorage.removeItem('kt3d'); } catch (_) {} needsReload = true; close(); }
  });
  let lastFocus = null;
  function open() { lastFocus = document.activeElement; wrap.classList.add('on'); wrap.querySelector('select, input').focus(); }
  function close() { wrap.classList.remove('on'); if (needsReload) location.reload(); else if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  window.addEventListener('keydown', ev => {
    if (ev.key === 'F10') { ev.preventDefault(); ev.stopImmediatePropagation(); wrap.classList.contains('on') ? close() : open(); return; }
    if (!wrap.classList.contains('on')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    ev.stopImmediatePropagation();   // the game doesn't move while the menu is open
  }, true);

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-audio'; btn.id = 'btnSettings'; btn.textContent = '⚙';
  btn.title = 'Settings (F10)'; btn.setAttribute('aria-label', 'Settings');
  btn.addEventListener('click', open);
  const bar = document.querySelector('.top-stats');
  if (bar) bar.insertBefore(btn, bar.querySelector('.btn-fullscreen') || null);

  apply();
  G3D.settings = { get: k => S[k], open, close, values: S };
  window.G3D = G3D;
  }
})();
