/* Knights Templar — the Codex (📖 in the top bar, or C).

   Three pages over the game's own progression data (game.html):
   • Skills — the Sword, Shield and Faith trees; spend points earned by levelling
   • Bestiary — every foe met, how many were slain, their lore and a tactic
   • Achievements — all of them, locked and unlocked
   Works in the 2D mode as well as the 3D one. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  if (typeof STATE === 'undefined' || typeof SKILLS === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    .kt-codex { position:fixed; inset:0; z-index:9000; display:none; align-items:center; justify-content:center; background:rgba(4,4,6,0.72); }
    .kt-codex.on { display:flex; }
    .kt-codex .cx { width:min(760px, calc(100vw - 24px)); max-height:calc(100vh - 40px); display:flex; flex-direction:column; background:#0e0d0b;
      border:1px solid rgba(201,168,76,0.45); box-shadow:0 20px 60px rgba(0,0,0,0.6); color:#e8dfc8; font-family:var(--ui, Georgia, serif); }
    .kt-codex header { display:flex; align-items:center; gap:14px; padding:14px 18px 0; flex-wrap:wrap; }
    .kt-codex h2 { margin:0; font-weight:normal; letter-spacing:0.18em; text-transform:uppercase; font-size:1.05rem; color:#e8c06a; flex:1; }
    .kt-codex .tabs { display:flex; gap:4px; padding:12px 18px 0; border-bottom:1px solid rgba(201,168,76,0.25); }
    .kt-codex .tabs button { font:inherit; font-size:0.8rem; letter-spacing:0.12em; text-transform:uppercase; padding:8px 14px; background:none; color:rgba(232,223,200,0.6);
      border:1px solid transparent; border-bottom:none; cursor:pointer; }
    .kt-codex .tabs button[aria-selected=true] { color:#f0d58a; border-color:rgba(201,168,76,0.35); background:#16140f; }
    .kt-codex .body { overflow:auto; padding:16px 18px 18px; }
    .kt-codex .pts { font-size:0.85rem; color:#ffd76a; }
    .kt-codex .close { font:inherit; font-size:0.8rem; padding:6px 12px; background:#1a1814; color:#e8dfc8; border:1px solid rgba(201,168,76,0.45); cursor:pointer; }
    .kt-codex .trees { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
    .kt-codex .tree h3 { margin:0 0 8px; font-size:0.72rem; letter-spacing:0.22em; text-transform:uppercase; color:#b8933a; text-align:center; }
    .kt-codex .sk { position:relative; display:block; width:100%; text-align:left; font:inherit; padding:10px 10px 10px 44px; margin-bottom:22px; background:#15130f;
      color:#e8dfc8; border:1px solid rgba(201,168,76,0.22); cursor:default; min-height:64px; }
    .kt-codex .sk:not(:last-child)::after { content:''; position:absolute; left:50%; bottom:-22px; height:22px; border-left:2px solid rgba(201,168,76,0.2); }
    .kt-codex .sk.have { border-color:#c9a84c; background:#2a2110; box-shadow:0 0 14px rgba(201,168,76,0.18) inset; }
    .kt-codex .sk.have:not(:last-child)::after { border-color:#c9a84c; }
    .kt-codex .sk.can { cursor:pointer; border-color:rgba(255,215,106,0.7); animation:cxPulse 1.6s ease-in-out infinite; }
    .kt-codex .sk.can:hover, .kt-codex .sk.can:focus-visible { background:#221c10; outline:none; }
    .kt-codex .sk.locked { opacity:0.45; }
    .kt-codex .sk .ic { position:absolute; left:10px; top:10px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:1.05rem; }
    .kt-codex .sk b { display:block; font-weight:normal; color:#f0d58a; letter-spacing:0.04em; }
    .kt-codex .sk small { display:block; color:rgba(232,223,200,0.65); font-size:0.75rem; line-height:1.35; margin-top:2px; }
    @keyframes cxPulse { 50% { box-shadow:0 0 14px rgba(255,215,106,0.35); } }
    .kt-codex .beasts { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
    .kt-codex .beast { border:1px solid rgba(201,168,76,0.22); background:#15130f; padding:10px 12px; }
    .kt-codex .beast.unknown { opacity:0.5; }
    .kt-codex .beast h4 { margin:0 0 4px; font-weight:normal; color:#f0d58a; display:flex; gap:8px; align-items:baseline; }
    .kt-codex .beast h4 span:last-child { margin-left:auto; font-size:0.72rem; color:rgba(232,223,200,0.55); letter-spacing:0.08em; }
    .kt-codex .beast .st { font-size:0.72rem; color:#c9a84c; letter-spacing:0.06em; margin-bottom:6px; }
    .kt-codex .beast p { margin:0 0 6px; font-size:0.8rem; line-height:1.45; color:rgba(232,223,200,0.82); }
    .kt-codex .beast em { font-size:0.75rem; color:#9fd8ff; font-style:normal; }
    .kt-codex .ach { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:8px; }
    .kt-codex .a { display:flex; gap:10px; align-items:center; border:1px solid rgba(201,168,76,0.18); background:#15130f; padding:8px 10px; font-size:0.82rem; }
    .kt-codex .a.got { border-color:#c9a84c; background:#221b0e; }
    .kt-codex .a:not(.got) { opacity:0.45; filter:grayscale(1); }
    .kt-codex .a i { font-style:normal; font-size:1.2rem; width:24px; text-align:center; }
    .kt-codex .summary { font-size:0.78rem; color:rgba(232,223,200,0.6); margin-bottom:12px; }
    @media (max-width: 620px) { .kt-codex .trees { grid-template-columns:1fr; } .kt-codex .sk { margin-bottom:12px; } .kt-codex .sk::after { display:none; } }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'kt-codex'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Codex');
  wrap.innerHTML = `<div class="cx">
    <header><h2>📖 Codex</h2><span class="pts" aria-live="polite"></span><button type="button" class="close" data-a="close">Close</button></header>
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="skills">Skills</button>
      <button type="button" role="tab" data-tab="bestiary">Bestiary</button>
      <button type="button" role="tab" data-tab="achievements">Achievements</button>
    </div>
    <div class="body" role="tabpanel"></div>
  </div>`;
  document.body.appendChild(wrap);
  const body = wrap.querySelector('.body'), pts = wrap.querySelector('.pts');
  let tab = 'skills', lastFocus = null;
  try { tab = localStorage.getItem('kt_codex_tab') || 'skills'; } catch (_) {}

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function renderSkills() {
    const trees = {};
    Object.entries(SKILLS).forEach(([id, sk]) => { (trees[sk.tree] = trees[sk.tree] || []).push([id, sk]); });
    return `<div class="summary">Earn a skill point every level, and one more from a certain warden. Each tree unlocks from the top down.</div>
      <div class="trees">${Object.entries(trees).map(([name, list]) => `<div class="tree"><h3>${esc(name)}</h3>${
        list.sort((a, b) => a[1].tier - b[1].tier).map(([id, sk]) => {
          const have = hasSkill(id), can = canLearn(id), locked = !have && sk.req && !hasSkill(sk.req);
          return `<button type="button" class="sk ${have ? 'have' : can ? 'can' : locked ? 'locked' : ''}" data-skill="${id}" ${can ? '' : 'aria-disabled="true"'}
            title="${have ? 'Learned' : can ? 'Click to learn' : locked ? 'Learn ' + esc(SKILLS[sk.req].name) + ' first' : 'Needs a skill point'}">
            <span class="ic">${sk.icon}</span><b>${esc(sk.name)}${have ? ' ✓' : ''}</b><small>${esc(sk.desc)}</small></button>`;
        }).join('')}</div>`).join('')}</div>`;
  }
  function renderBestiary() {
    const order = ['peasant', 'risen', 'wraith', 'cinder', 'warden', 'necromancer'].filter(t => ENEMIES[t]);
    const met = order.filter(t => STATE.bestiary[t]).length;
    return `<div class="summary">${met} of ${order.length} foes recorded.</div><div class="beasts">${order.map(t => {
      const e = ENEMIES[t], b = BESTIARY[t] || {}, rec = STATE.bestiary[t];
      if (!rec) return `<div class="beast unknown"><h4><span>❔</span><span>Unknown foe</span></h4><p>Not yet encountered.</p></div>`;
      return `<div class="beast"><h4><span>${b.icon || '☠'}</span><span>${esc(e.name)}</span><span>slain ${rec.slain}</span></h4>
        <div class="st">HP ${e.hp} · strikes ${e.dmgMin}–${e.dmgMax} · ${e.xp} XP</div><p>${esc(b.lore || '')}</p>${b.tip ? `<em>Tactic: ${esc(b.tip)}</em>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function renderAchievements() {
    const ids = Object.keys(ACHIEVEMENTS), got = ids.filter(id => STATE.achievements.has(id)).length;
    const f = STATE.feats || {};
    return `<div class="summary">${got} of ${ids.length} unlocked · best combo ${STATE.bestCombo || 0} · parries ${f.parries || 0} · flawless victories ${f.flawless || 0}</div>
      <div class="ach">${ids.map(id => { const a = ACHIEVEMENTS[id], has = STATE.achievements.has(id);
        return `<div class="a ${has ? 'got' : ''}"><i>${a.icon}</i><span>${esc(a.name)}</span></div>`; }).join('')}</div>`;
  }
  function render() {
    wrap.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    pts.textContent = STATE.skillPoints > 0 ? `✦ ${STATE.skillPoints} skill point${STATE.skillPoints > 1 ? 's' : ''} to spend` : '';
    body.innerHTML = tab === 'bestiary' ? renderBestiary() : tab === 'achievements' ? renderAchievements() : renderSkills();
    badge();
  }
  function open(t) { if (t) tab = t; lastFocus = document.activeElement; wrap.classList.add('on'); render(); (wrap.querySelector('.sk.can') || wrap.querySelector('.tabs button[aria-selected=true]')).focus(); }
  function close() { wrap.classList.remove('on'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function toggle() { wrap.classList.contains('on') ? close() : open(); }

  wrap.addEventListener('click', ev => {
    const t = ev.target.closest('[data-tab],[data-skill],[data-a]') || ev.target;
    if (ev.target === wrap || t.dataset.a === 'close') return close();
    if (t.dataset.tab) { tab = t.dataset.tab; try { localStorage.setItem('kt_codex_tab', tab); } catch (_) {} render(); }
    if (t.dataset.skill && canLearn(t.dataset.skill)) { learnSkill(t.dataset.skill); render(); const n = wrap.querySelector('.sk.can') || wrap.querySelector(`[data-skill="${t.dataset.skill}"]`); n && n.focus(); }
  });
  window.addEventListener('keydown', ev => {
    if (!wrap.classList.contains('on')) return;
    if (ev.key === 'Escape' || ev.key === 'c' || ev.key === 'C') { ev.preventDefault(); close(); }
    ev.stopImmediatePropagation();   // the game doesn't move while the Codex is open
  }, true);

  // Top-bar button, with a dot when there are points to spend.
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-audio'; btn.id = 'btnCodex'; btn.textContent = '📖';
  btn.title = 'Codex: skills, bestiary, achievements (C)'; btn.setAttribute('aria-label', 'Codex');
  btn.style.position = 'relative';
  btn.addEventListener('click', () => open());
  const bar = document.querySelector('.top-stats');
  if (bar) bar.insertBefore(btn, document.getElementById('btnSettings') || bar.querySelector('.btn-fullscreen') || null);
  function badge() {
    btn.style.boxShadow = STATE.skillPoints > 0 ? '0 0 0 1px #ffd76a, 0 0 10px rgba(255,215,106,0.5)' : '';
    btn.title = STATE.skillPoints > 0 ? `Codex — ${STATE.skillPoints} skill point${STATE.skillPoints > 1 ? 's' : ''} to spend (C)` : 'Codex: skills, bestiary, achievements (C)';
  }
  // The stat strip's ✦ chip opens the skills page.
  document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('.stat-sp')) open('skills'); });
  setInterval(badge, 1000);
  badge();

  window.KTCodex = { open, close, toggle, render };
  }
})();
