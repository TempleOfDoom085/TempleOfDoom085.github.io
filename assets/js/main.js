/* ---- portfolio: tabs, patch notes, fade-in, nav, easter eggs, terminal, hero ---- */
// Tab switching
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

// Patch notes accordion
function togglePatch(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.patch-toggle');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  toggle.textContent = isOpen ? '▶' : '▼';
}

// Launch game - points to game.html in same directory
function launchGame() {
  document.getElementById('gameLauncher').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';
  document.getElementById('gameFrame').src = 'game.html';
}

// Scroll-triggered fade-in animations
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

// Close hamburger when a nav link is clicked on mobile
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.remove('open');
    document.getElementById('navHamburger').classList.remove('open');
  });
});

// Active nav link tracking
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('section[id]');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => link.classList.remove('active'));
      const activeLink = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (activeLink) activeLink.classList.add('active');
    }
  });
}, { threshold: 0.3 });
sections.forEach(s => navObserver.observe(s));

// Back to top button
const backBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
  if (window.scrollY > 600) backBtn.classList.add('show');
  else backBtn.classList.remove('show');
});

// ── v9.0: NAV MORPH ON SCROLL ──
const navEl = document.querySelector('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 80) navEl.classList.add('scrolled');
  else navEl.classList.remove('scrolled');
}, { passive: true });

// ── v12.0: PARTICLE NETWORK — mouse-interactive, click pulse ──
(function() {
  const canvas = document.getElementById('heroBgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const COUNT    = 95;
  const MAX_DIST = 155;
  const ATTRACT  = 160;  // attraction outer radius
  const REPEL    = 75;   // repulsion inner radius
  let W, H, particles = [];
  let mx = -999, my = -999;
  const pulses = [];  // click shockwaves on canvas

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function Particle() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.r  = 1.1 + Math.random() * 1.9;
    this.phase = Math.random() * Math.PI * 2;  // pulse phase for glow
  }

  function init() { resize(); particles = Array.from({ length: COUNT }, () => new Particle()); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() * 0.001;

    // --- Pulses (click shockwaves) ---
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pu = pulses[i];
      pu.r  += 5;
      pu.op -= 0.022;
      if (pu.op <= 0) { pulses.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2);
      const blend = pu.x / W;
      const rr = Math.round(blend * 184);
      const gg = Math.round(blend * 147 + (1-blend) * 212);
      const bb = Math.round((1-blend) * 255 + blend * 58);
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${pu.op * 0.8})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    particles.forEach(p => {
      const ddx = p.x - mx, ddy = p.y - my;
      const dd  = Math.sqrt(ddx*ddx + ddy*ddy);

      if (dd < REPEL && dd > 0) {
        // Hard repulsion close to cursor
        const force = (REPEL - dd) / REPEL * 1.1;
        p.vx += (ddx / dd) * force;
        p.vy += (ddy / dd) * force;
      } else if (dd < ATTRACT && dd > 0) {
        // Gentle attraction in outer ring
        const force = ((dd - REPEL) / (ATTRACT - REPEL)) * 0.04;
        p.vx -= (ddx / dd) * force;
        p.vy -= (ddy / dd) * force;
      }

      // Pulse shockwave forces
      pulses.forEach(pu => {
        const pdx = p.x - pu.x, pdy = p.y - pu.y;
        const pd  = Math.sqrt(pdx*pdx + pdy*pdy);
        const waveFront = pu.r;
        if (Math.abs(pd - waveFront) < 30 && pd > 0) {
          const wf = (1 - Math.abs(pd - waveFront) / 30) * pu.op * 1.4;
          p.vx += (pdx / pd) * wf;
          p.vy += (pdy / pd) * wf;
        }
      });

      p.vx *= 0.975; p.vy *= 0.975;
      const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
      if (spd > 2.2) { p.vx = (p.vx/spd)*2.2; p.vy = (p.vy/spd)*2.2; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    });

    // --- Connection lines ---
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < MAX_DIST) {
          const alpha = 0.28 * (1 - d / MAX_DIST);
          const midX  = (particles[i].x + particles[j].x) / 2;
          const blend = midX / W;
          const r = Math.round(blend * 184);
          const g = Math.round(blend * 147 + (1-blend) * 212);
          const b = Math.round((1-blend) * 255 + blend * 58);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // --- Dots with mouse-proximity glow ---
    particles.forEach(p => {
      const blend    = p.x / W;
      const r = Math.round(blend * 212);
      const g = Math.round(blend * 168 + (1-blend) * 220);
      const b = Math.round((1-blend) * 255 + blend * 76);
      const ddx  = p.x - mx, ddy = p.y - my;
      const dd   = Math.sqrt(ddx*ddx + ddy*ddy);
      const glow = dd < 90 ? 1 - dd / 90 : 0;
      const radius  = p.r + glow * 2.5;
      const opacity = 0.65 + glow * 0.35;
      // Glow halo for nearby particles
      if (glow > 0.1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${glow * 0.12})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  const hero = canvas.parentElement;
  hero.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  }, { passive: true });
  hero.addEventListener('mouseleave', () => { mx = -999; my = -999; }, { passive: true });
  hero.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    pulses.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 10, op: 0.9 });
  });

  window.addEventListener('resize', resize, { passive: true });
  init();
  draw();
})();

// ── v12.0: 3D CARD TILT + SPECULAR ──
(function() {
  const MAX_TILT = 14;
  document.querySelectorAll('.skill-card, .project-item, .cert-card-full').forEach(card => {
    // Ensure position:relative for shine overlay
    const cs = getComputedStyle(card);
    if (cs.position === 'static') card.style.position = 'relative';

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width  / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotX = -dy * MAX_TILT;
      const rotY =  dx * MAX_TILT;

      card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px) scale(1.01)`;
      card.style.boxShadow = `0 ${16 + Math.abs(rotX)}px ${40 + Math.abs(rotY) * 2}px rgba(0,0,0,0.45), 0 0 0 1px rgba(184,147,58,0.12)`;
      card.style.transition = 'box-shadow 0.1s';

      // Specular highlight follows surface normal
      const shine = card.querySelector('.card-shine');
      if (shine) {
        const sx = ((dx + 1) / 2) * 100;
        const sy = ((dy + 1) / 2) * 100;
        shine.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,0.16) 0%, transparent 58%)`;
      }
      // Holographic foil shifts with mouse angle
      const foil = card.querySelector('.holo-foil');
      if (foil) {
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top)  / rect.height;
        const angle = Math.atan2(py - 0.5, px - 0.5) * (180 / Math.PI) + 105;
        card.style.setProperty('--holo-x', `${px * 100}%`);
        card.style.setProperty('--holo-y', `${py * 100}%`);
        card.style.setProperty('--holo-angle', `${angle}deg`);
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1), box-shadow 0.5s ease';
      const shine = card.querySelector('.card-shine');
      if (shine) shine.style.background = '';
    });
  });
})();

// ── v9.0: STAGGER OBSERVER ──
const staggerObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.stagger-children').forEach(el => staggerObserver.observe(el));

// ── v12.0: CINEMATIC ENGINE ──
(function() {
  'use strict';
  const cursor = document.getElementById('cursor');
  const ring   = document.getElementById('cursor-ring');
  const clickCv = document.getElementById('clickCanvas');
  if (!cursor || !ring) return;

  // --- State ---
  let mx = -200, my = -200;      // true mouse position
  let rx = -200, ry = -200;      // ring lerp position
  let trailT = 0;
  let isHover = false;
  let magTarget = null;           // magnetic button target
  const ripples = [];             // active click ripples

  // --- Click canvas setup ---
  const cctx = clickCv ? clickCv.getContext('2d') : null;
  function resizeCC() {
    if (!clickCv) return;
    clickCv.width  = window.innerWidth;
    clickCv.height = window.innerHeight;
  }
  resizeCC();
  window.addEventListener('resize', resizeCC, { passive: true });

  // --- Lerp ring loop ---
  function loop() {
    // Magnetic pull: if near a button, snap cursor toward it
    let tx = mx, ty = my;
    if (magTarget) {
      const r = magTarget.getBoundingClientRect();
      const bcx = r.left + r.width / 2;
      const bcy = r.top  + r.height / 2;
      const dx = bcx - mx, dy = bcy - my;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 72 && dist > 0) {
        const pull = 0.28 * (1 - dist / 72);
        tx = mx + dx * pull;
        ty = my + dy * pull;
      }
    }

    // Dot follows exact mouse (no lerp on dot for precision feel)
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';

    // Ring lerps behind — elastic drag
    rx += (tx - rx) * 0.10;
    ry += (ty - ry) * 0.10;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';

    // --- Draw ripples on click canvas ---
    if (cctx && ripples.length) {
      cctx.clearRect(0, 0, clickCv.width, clickCv.height);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r  += 6;
        rp.op -= 0.028;
        if (rp.op <= 0) { ripples.splice(i, 1); continue; }
        // Outer ring
        cctx.beginPath();
        cctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        cctx.strokeStyle = `rgba(${rp.c},${rp.op * 0.7})`;
        cctx.lineWidth = 1.5;
        cctx.stroke();
        // Inner ring (smaller, faster)
        cctx.beginPath();
        cctx.arc(rp.x, rp.y, rp.r * 0.55, 0, Math.PI * 2);
        cctx.strokeStyle = `rgba(255,255,255,${rp.op * 0.25})`;
        cctx.lineWidth = 0.8;
        cctx.stroke();
      }
    } else if (cctx && !ripples.length) {
      cctx.clearRect(0, 0, clickCv.width, clickCv.height);
    }

    requestAnimationFrame(loop);
  }
  loop();

  // --- Mouse move ---
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;

    // Trail sparks (throttled)
    const now = Date.now();
    if (now - trailT > 38) {
      trailT = now;
      const p = document.createElement('div');
      p.className = 'cursor-trail';
      // Color gradient based on x position (left=cyan, right=gold)
      const blend = mx / window.innerWidth;
      const r = Math.round(blend * 184 + (1 - blend) * 0);
      const g = Math.round(blend * 147 + (1 - blend) * 212);
      const b = Math.round(blend * 58  + (1 - blend) * 255);
      p.style.cssText = `left:${mx}px;top:${my}px;background:rgb(${r},${g},${b})`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 520);
    }
  }, { passive: true });

  // --- Click burst ---
  document.addEventListener('click', e => {
    // Brief dot shrink
    document.body.classList.add('cursor-click');
    setTimeout(() => document.body.classList.remove('cursor-click'), 120);

    // Ripple on canvas
    const isGold = (e.clientX / window.innerWidth) > 0.5;
    ripples.push({
      x: e.clientX, y: e.clientY,
      r: 4, op: 1,
      c: isGold ? '184,147,58' : '0,212,255'
    });
    // Second ripple (offset timing)
    setTimeout(() => {
      ripples.push({ x: e.clientX, y: e.clientY, r: 2, op: 0.6, c: '245,242,236' });
    }, 80);

    // DOM particle burst (6 sparks)
    for (let i = 0; i < 6; i++) {
      const spark = document.createElement('div');
      const angle = (i / 6) * Math.PI * 2;
      const dist  = 22 + Math.random() * 18;
      const ex = e.clientX + Math.cos(angle) * dist;
      const ey = e.clientY + Math.sin(angle) * dist;
      spark.style.cssText = `position:fixed;pointer-events:none;z-index:99997;
        width:3px;height:3px;border-radius:50%;
        background:${i % 2 === 0 ? 'rgba(184,147,58,0.9)' : 'rgba(0,212,255,0.9)'};
        left:${e.clientX}px;top:${e.clientY}px;
        transition:left 0.35s cubic-bezier(0,0.8,0.4,1),top 0.35s cubic-bezier(0,0.8,0.4,1),opacity 0.35s ease`;
      document.body.appendChild(spark);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        spark.style.left    = ex + 'px';
        spark.style.top     = ey + 'px';
        spark.style.opacity = '0';
      }));
      setTimeout(() => spark.remove(), 380);
    }
  });

  // --- Hover state + magnetic ---
  document.querySelectorAll('a, button, [role="button"]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-hover');
      magTarget = el;
      isHover = true;
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover');
      magTarget = null;
      isHover = false;
    });
  });

  // --- Cursor visibility ---
  document.addEventListener('mouseleave',  () => { cursor.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter',  () => { cursor.style.opacity = '1'; ring.style.opacity = '1'; });
})();

// ── v12.0: CARD SPECULAR + HOLOGRAPHIC FOIL INJECTION ──
(function() {
  document.querySelectorAll('.skill-card, .project-item, .cert-card-full').forEach(card => {
    const cs = getComputedStyle(card);
    if (cs.position === 'static') card.style.position = 'relative';
    // Specular
    const shine = document.createElement('div');
    shine.className = 'card-shine';
    card.appendChild(shine);
    // Holographic foil
    const foil = document.createElement('div');
    foil.className = 'holo-foil';
    card.appendChild(foil);
  });
})();

// ── v12.0: SECTION SCAN REVEAL ──
(function() {
  const scanObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.classList.contains('scanned')) {
        e.target.classList.add('scanned');
        scanObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('.section-heading').forEach(h => {
    h.classList.add('scan-heading');
    const inner = h.innerHTML;
    h.innerHTML = `<span class="scan-mask"><span>${inner}</span></span>`;
    scanObs.observe(h);
  });
})();

// ── v12.0: AURORA BACKGROUND CANVAS ──
(function() {
  const canvas = document.getElementById('auroraCanvas');
  if (!canvas) return;
  // Skip on reduced-motion or mobile for perf
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }, { passive: true });

  // Each orb: position, velocity, size, color
  const orbs = [
    { px: 0.15, py: 0.25, vx: 0.00030, vy: 0.00022, r: 0.55, c: '0,212,255',  a: 0.038 },
    { px: 0.82, py: 0.62, vx:-0.00025, vy: 0.00028, r: 0.50, c: '184,147,58', a: 0.032 },
    { px: 0.48, py: 0.78, vx: 0.00028, vy:-0.00020, r: 0.42, c: '0,255,136',  a: 0.025 },
    { px: 0.72, py: 0.18, vx:-0.00032, vy: 0.00030, r: 0.38, c: '80,40,220',  a: 0.020 },
    { px: 0.22, py: 0.68, vx: 0.00020, vy:-0.00034, r: 0.44, c: '255,50,100', a: 0.018 },
    { px: 0.60, py: 0.40, vx:-0.00018, vy:-0.00022, r: 0.35, c: '0,200,255',  a: 0.022 },
  ];

  function draw() {
    ctx.clearRect(0, 0, W, H);
    orbs.forEach(o => {
      o.px += o.vx; o.py += o.vy;
      if (o.px < -0.1 || o.px > 1.1) o.vx *= -1;
      if (o.py < -0.1 || o.py > 1.1) o.vy *= -1;
      const gx = o.px * W, gy = o.py * H, gr = o.r * Math.min(W, H);
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0,   `rgba(${o.c},${o.a})`);
      grad.addColorStop(0.45,`rgba(${o.c},${o.a * 0.35})`);
      grad.addColorStop(1,   `rgba(${o.c},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── v12.0: HERO PLASMA RIBBONS ──
// Upgrades the existing heroBgCanvas: paints sine-wave light ribbons first, then particles draw on top
// We hook into the existing draw function by patching it — actually we just add a pre-pass layer
// The existing canvas draw() starts each frame with clearRect, so we intercept by overwriting
// the draw loop. Since the existing IIFE already runs, we use a second overlay canvas layered under.
(function() {
  const heroEl = document.querySelector('.hero');
  if (!heroEl) return;
  // Create a second canvas layered between background and the particle canvas
  const plasma = document.createElement('canvas');
  plasma.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  heroEl.insertBefore(plasma, heroEl.firstChild);
  const ctx = plasma.getContext('2d');
  let W, H;
  function resize() {
    W = plasma.width  = heroEl.offsetWidth;
    H = plasma.height = heroEl.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const ribbons = [
    { freq: 0.0055, amp: 0.18, phase: 0.0, speed: 0.28, c: '0,212,255',  a: 0.10, w: 140 },
    { freq: 0.0038, amp: 0.15, phase: 1.8, speed: 0.20, c: '184,147,58', a: 0.08, w: 120 },
    { freq: 0.0048, amp: 0.16, phase: 5.1, speed: 0.24, c: '0,180,255',  a: 0.07, w: 100 },
  ];

  function waveY(r, x, t) {
    return Math.sin(x * r.freq + t * r.speed) * H * r.amp * 0.55
         + Math.sin(x * r.freq * 1.8 + t * r.speed * 1.4) * H * r.amp * 0.28
         + Math.sin(x * r.freq * 0.5 + t * r.speed * 0.7 + r.phase) * H * r.amp * 0.18;
  }

  function draw(ts) {
    const t = ts * 0.001;
    ctx.clearRect(0, 0, W, H);
    ribbons.forEach((r, i) => {
      const yBase = H * (0.25 + i * 0.25) + Math.sin(t * r.speed * 0.5 + r.phase) * H * 0.06;
      // Build top edge (wave + halfWidth), then bottom edge reversed (wave - halfWidth)
      const pts = [];
      for (let x = 0; x <= W; x += 4) pts.push([x, yBase + waveY(r, x, t)]);
      ctx.beginPath();
      // Top edge: wave + w/2
      pts.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y - r.w / 2); else ctx.lineTo(x, y - r.w / 2);
      });
      // Bottom edge: wave - w/2 reversed
      for (let j = pts.length - 1; j >= 0; j--) {
        ctx.lineTo(pts[j][0], pts[j][1] + r.w / 2);
      }
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, yBase - r.w, 0, yBase + r.w);
      grad.addColorStop(0,   `rgba(${r.c},0)`);
      grad.addColorStop(0.5, `rgba(${r.c},${r.a})`);
      grad.addColorStop(1,   `rgba(${r.c},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// YOU DIED overlay — triggered only from game code, not on exit-intent

function closeYouDied() {
  const overlay = document.getElementById('you-died-overlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 1800);
}

// ── v9.1: KONAMI CODE ──
(function() {
  const SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  document.addEventListener('keydown', e => {
    if (e.key === SEQ[pos]) {
      pos++;
      if (pos === SEQ.length) {
        pos = 0;
        document.getElementById('konami-overlay').classList.add('show');
      }
    } else {
      pos = e.key === SEQ[0] ? 1 : 0;
    }
  });
})();

function closeKonami() {
  document.getElementById('konami-overlay').classList.remove('show');
}

// ── v9.1: SCROLL STAT COUNTERS ──
(function() {
  const counters = document.querySelectorAll('.stat-num[data-count]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const dur    = 1400;
      const start  = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = Math.round(eased * target) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      el.textContent = '0' + suffix;
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach(el => observer.observe(el));
})();

// ── v9.1: HERO PARALLAX ──
(function() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const leftText  = hero.querySelector('.hero-left  .hero-name');
  const leftDesc  = hero.querySelector('.hero-left  .hero-desc');
  const rightText = hero.querySelector('.hero-right .hero-name');
  const rightDesc = hero.querySelector('.hero-right .hero-desc');

  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left)  / rect.width  - 0.5;
    const y = (e.clientY - rect.top)   / rect.height - 0.5;
    if (leftText)  leftText.style.transform  = `translate(${x * 14}px, ${y * 10}px)`;
    if (leftDesc)  leftDesc.style.transform  = `translate(${x *  7}px, ${y *  5}px)`;
    if (rightText) rightText.style.transform = `translate(${x * -10}px, ${y * 8}px)`;
    if (rightDesc) rightDesc.style.transform = `translate(${x * -5}px, ${y * 4}px)`;
  });
  hero.addEventListener('mouseleave', () => {
    [leftText, leftDesc, rightText, rightDesc].forEach(el => { if (el) el.style.transform = ''; });
  });
})();

// ── v10.0: TERMINAL ──
(function() {
  const CMDS = {
    help: `AVAILABLE COMMANDS\n─────────────────────────────────────────────\n  whoami              — who is this guy\n  ls                  — list sections\n  cat about.txt       — about Brian\n  cat skills.txt      — full skill set\n  cat experience.txt  — work history\n  cat certs.txt       — certifications\n  cat contact.txt     — get in touch\n  ./play              — launch the game\n  clear               — clear terminal\n  exit                — close terminal`,
    whoami: `brian@fortress — AI Security Advisor @ Cranium AI\n─────────────────────────────────────────────\n  Location  : Towaco, NJ\n  Status    : Securing enterprise AI\n  Clearance : 18+ Certifications\n  XP        : 10+ years sales, 3+ years tech\n  Current   : SNHU Cyber Security Program\n  Build     : v12.0`,
    ls: `about/         experience/    skills/        projects/\ncerts/         education/     kitchen.html   contact/\ngame.exe`,
    'ls -la': `drwxr-xr-x  brian  fortress  about/\ndrwxr-xr-x  brian  fortress  skills/\n-rwxr-xr-x  brian  fortress  game.exe\n-rw-r--r--  brian  fortress  contact.txt\n-rw-r--r--  brian  fortress  README.md`,
    'ls -al': `drwxr-xr-x  brian  fortress  about/\ndrwxr-xr-x  brian  fortress  skills/\n-rwxr-xr-x  brian  fortress  game.exe\n-rw-r--r--  brian  fortress  contact.txt\n-rw-r--r--  brian  fortress  README.md`,
    'cat about.txt': `I'm Brian Temple — an AI Security Advisor at Cranium AI,\nbased in Towaco, NJ. I work with CISOs, Chief AI Officers and\nthird-party risk leaders at regulated enterprises on AI\nvisibility, governance and runtime security.\n\nBefore the risk side I built and deployed production AI agent\nsystems — voice agents, automation pipelines, cloud infra.\nI know where these systems break because I've shipped them.\n\nBefore tech, I spent a decade in high-performance sales.\nThat background shapes how I think: systems need to work\nfor people, not just on paper.`,
    'cat skills.txt': `AI SECURITY & GOVERNANCE\n  → AI Discovery & Inventory   → Automated Red Teaming\n  → Third-Party AI Risk        → Runtime Policy Enforcement\n  → EU AI Act / NIST AI RMF / ISO 42001 / SR 11-7 / HIPAA\n\nAI & AUTOMATION\n  → AI Agent Development       → Workflow Automation (n8n)\n  → Voice AI & IVR Design      → Bland AI Integration\n  → Conversational UX\n\nCYBERSECURITY\n  → Threat Analysis & IR       → Network Security\n  → DFIR & Threat Hunting      → Linux Security\n  → Vulnerability Assessment\n\nTECHNICAL STACK\n  → Cloud Deployment           → Python (Security Focus)\n  → CRM Integration            → API & Webhook Pipelines\n\nSALES & COMMUNICATION\n  → Consultative Sales         → Technical Client Comms\n  → Lead Generation            → Sales Automation`,
    'cat experience.txt': `[CURRENT]  Cranium AI              — AI Security Advisor\n[PREV]     Unblinded               — AI Automation Builder\n[PREV]     Evolve                 — SDR / Sales Automation\n[PREV]     Globus                  — Account Executive\n[PREV]     Axium Academy           — Enrollment Advisor\n[PREV]     Verizon                 — Business Solutions Consultant\n[PREV]     Complete Doc. Sol.      — Account Executive`,
    'cat certs.txt': `✓  Cranium AI: AI Security Certificate (Sep 2026)\n✓  Cranium AI: AI Red Team Certificate (Sep 2026)\n✓  Anthropic: AI Fluency: Framework &amp; Foundations (Apr 2026)\n✓  Anthropic: Claude Code in Action (Apr 2026)\n✓  Anthropic: Introduction to Claude Cowork (Apr 2026)\n✓  Anthropic: Claude 101 (Apr 2026)\n✓  Anthropic: Introduction to Subagents (Mar 2026)\n✓  Google Cybersecurity Professional Certificate\n✓  Cisco Introduction to Cybersecurity\n✓  SNHU IT-140 Python Fundamentals\n✓  Additional certs — scroll to the /certs section`,
    'cat contact.txt': `GitHub   : github.com/TempleOfDoom085\nEmail    : Scroll to the Contact section\nLinkedIn : Scroll to the Contact section`,
    './play': '__LAUNCH__',
    play: '__LAUNCH__',
    nmap: `Starting Nmap 7.94 -- nmap.org\nScan report for fortress.local (127.0.0.1)\n17 rooms discovered, all OPEN\nService: undead-patrol on ports 1-16\nService: necromancer-boss on port 666\nWarning: Route through catacombs required`,
    'git log': `commit a1b2c3d  Add 2D open world canvas map (UPCOMING)\ncommit 4e5f6a7  Phase 2 — terminal, achievements, skill tree\ncommit 8b9c0d1  Phase 1 — cursor, Easter eggs, parallax\ncommit f696116  Bump version to v9.1\ncommit 41cf37d  Security review: A+ rating`,
    hack: `Initializing...\n[████████████████] 100%\n\nAccess granted.\n\nJust kidding. That's literally what the cybersecurity cert is for.`,
    vim: `\n~\n~\n~\n~\n~  "portfolio.txt" [readonly] 847 lines\n\nPress :wq to save and quit.\nPress :q! to abandon changes.\nGood luck. You'll need it.`,
    'sudo rm -rf /': `Permission denied.\nYou are not root in this fortress.`,
    pwd: `/home/brian/fortress`,
    clear: '__CLEAR__',
    exit: '__EXIT__',
    q: '__EXIT__',
  };

  const overlay = document.getElementById('terminal-overlay');
  const output  = document.getElementById('terminal-output');
  const input   = document.getElementById('terminal-input');
  let cmdHistory = [], histIdx = -1, opened = false;

  function openTerminal() {
    overlay.classList.add('open');
    if (!opened) {
      opened = true;
      addSystem('╔════════════════════════════════════════════╗');
      addSystem('║   brian@fortress  —  Interactive Portfolio  ║');
      addSystem('║   Type "help" for available commands        ║');
      addSystem('╚════════════════════════════════════════════╝');
      addBlank();
    }
    setTimeout(() => input.focus(), 60);
    window._unlockAchievement && window._unlockAchievement('analyst');
  }

  function closeTerminal() { overlay.classList.remove('open'); }

  function addSystem(txt) { const d = document.createElement('div'); d.className = 't-line t-system'; d.textContent = txt; output.appendChild(d); scroll(); }
  function addBlank()     { const d = document.createElement('div'); d.className = 't-blank'; output.appendChild(d); scroll(); }
  function addOutput(txt) { const d = document.createElement('div'); d.className = 't-line t-output'; d.textContent = txt; output.appendChild(d); scroll(); }
  function addError(txt)  { const d = document.createElement('div'); d.className = 't-line t-err'; d.textContent = txt; output.appendChild(d); scroll(); }
  function scroll() { output.scrollTop = output.scrollHeight; }

  function addPromptLine(raw) {
    const d = document.createElement('div'); d.className = 't-line';
    const ps = document.createElement('span'); ps.className = 't-prompt'; ps.textContent = 'brian@fortress:~$ ';
    const cs = document.createElement('span'); cs.className = 't-cmd'; cs.textContent = raw;
    d.appendChild(ps); d.appendChild(cs); output.appendChild(d); scroll();
  }

  function runCmd(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    cmdHistory.unshift(raw); histIdx = -1;
    addPromptLine(raw);
    const key = cmd.toLowerCase();
    const resp = CMDS[key];
    if (resp === '__CLEAR__')  { output.innerHTML = ''; return; }
    if (resp === '__EXIT__')   { closeTerminal(); return; }
    if (resp === '__LAUNCH__') {
      addSystem('Launching Knights Templar: The Siege of the Undead v10.0...');
      setTimeout(() => { closeTerminal(); document.getElementById('game-section').scrollIntoView({ behavior: 'smooth' }); }, 900);
      return;
    }
    if (resp !== undefined)    { addOutput(resp); }
    else if (key.startsWith('cd ')) { addError(`cd: ${cmd.slice(3)}: This is a portfolio, not a real filesystem.`); }
    else if (key.startsWith('sudo ')) { addError('Permission denied. You are not root here.'); }
    else { addError(`Command not found: ${cmd}  —  type "help" for available commands`); }
    addBlank();
    if (cmdHistory.length >= 3) window._unlockAchievement && window._unlockAchievement('analyst');
  }

  document.addEventListener('keydown', e => {
    if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      overlay.classList.contains('open') ? closeTerminal() : openTerminal();
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; runCmd(v); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); if (histIdx < cmdHistory.length - 1) { histIdx++; input.value = cmdHistory[histIdx]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) { histIdx--; input.value = cmdHistory[histIdx]; } else { histIdx = -1; input.value = ''; } }
  });

  window._closeTerminal = closeTerminal;
})();
function closeTerminal() { window._closeTerminal && window._closeTerminal(); }

// ── v10.0: ACHIEVEMENT SYSTEM ──
(function() {
  const DEFS = {
    explorer:  { icon: '🗺', name: 'Explorer',   desc: 'Scroll through every section' },
    player:    { icon: '⚔',  name: 'Player',     desc: 'Launch the game' },
    analyst:   { icon: '💻', name: 'Analyst',    desc: 'Use the terminal' },
    devoted:   { icon: '⏳', name: 'Devoted',    desc: 'Spend 2+ minutes reading' },
    recruiter: { icon: '📧', name: 'Recruiter',  desc: 'Click the contact link' },
    gamer:     { icon: '🎮', name: 'Gamer',      desc: 'Enter the Konami code' },
    mortality: { icon: '☠',  name: 'Mortality',  desc: 'Try to leave the page' },
    connected: { icon: '🌐', name: 'Connected',  desc: 'Visit GitHub or LinkedIn' },
  };
  const KEY = 'bt_ach_v1';
  const unlocked = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));

  function unlock(id) {
    if (unlocked.has(id) || !DEFS[id]) return;
    unlocked.add(id);
    localStorage.setItem(KEY, JSON.stringify([...unlocked]));
    showToast(DEFS[id]);
  }

  function showToast(def) {
    const c = document.getElementById('achievement-container');
    const t = document.createElement('div');
    t.className = 'achievement-toast';
    t.innerHTML = `<span class="toast-icon">${def.icon}</span><div><div class="toast-label">Achievement Unlocked</div><div class="toast-name">${def.name}</div></div>`;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 350); }, 4200);
  }

  // Explorer — visit 6 key sections
  const needed = ['about','experience','skills','projects','certs','contact'];
  const seen   = new Set();
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { seen.add(e.target.id); if (needed.every(s => seen.has(s))) unlock('explorer'); } });
  }, { threshold: 0.3 });
  needed.forEach(id => { const el = document.getElementById(id); if (el) secObs.observe(el); });

  // Devoted — 2 min on page
  setTimeout(() => unlock('devoted'), 2 * 60 * 1000);

  // Recruiter — contact links
  document.querySelectorAll('#contact a').forEach(a => a.addEventListener('click', () => unlock('recruiter')));

  // Connected — GitHub / LinkedIn
  document.querySelectorAll('a[href*="github"], a[href*="linkedin"]').forEach(a => a.addEventListener('click', () => unlock('connected')));

  // Player — game launch button
  const glb = document.querySelector('.game-launch-btn');
  if (glb) glb.addEventListener('click', () => unlock('player'));

  // Mortality — You Died overlay shows
  new MutationObserver(ms => { ms.forEach(m => { if (m.target.classList.contains('active')) unlock('mortality'); }); })
    .observe(document.getElementById('you-died-overlay'), { attributes: true, attributeFilter: ['class'] });

  // Gamer — Konami overlay shows
  new MutationObserver(ms => { ms.forEach(m => { if (m.target.classList.contains('show')) unlock('gamer'); }); })
    .observe(document.getElementById('konami-overlay'), { attributes: true, attributeFilter: ['class'] });

  window._unlockAchievement = unlock;
})();

// ── SCROLL PROGRESS BAR ──
(function() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? (window.scrollY / total) * 100 : 0) + '%';
  }, { passive: true });
})();

// ── COMMAND PALETTE (Ctrl+K) ──
(function() {
  const overlay = document.getElementById('cmd-palette-overlay');
  const input   = document.getElementById('cmd-input');
  const results = document.getElementById('cmd-results');
  const ITEMS = [
    { icon: '👤', name: 'About',           desc: 'Who is Brian Temple?',                tag: 'section', href: '#about' },
    { icon: '💼', name: 'Experience',      desc: 'Work history and roles',              tag: 'section', href: '#experience' },
    { icon: '⚡', name: 'Skills',          desc: 'Technical skills overview',           tag: 'section', href: '#skills' },
    { icon: '🚀', name: 'Projects',        desc: "What I've built",                     tag: 'section', href: '#projects' },
    { icon: '⚔',  name: 'Game',            desc: 'Knights Templar: Siege of the Undead',tag: 'section', href: '#game-section' },
    { icon: '🛡', name: 'Certifications',  desc: 'Security certs and credentials',      tag: 'section', href: '#certs' },
    { icon: '🎓', name: 'Education',       desc: 'SNHU, CU Boulder',                    tag: 'section', href: '#education' },
    { icon: '🍳', name: 'Kitchen',         desc: 'Recipes and cooking',                 tag: 'page', href: 'kitchen.html' },
    { icon: '🤝', name: 'Volunteering',    desc: 'Community involvement',               tag: 'section', href: '#volunteering' },
    { icon: '📬', name: 'Contact',         desc: 'Get in touch',                        tag: 'section', href: '#contact' },
    { icon: '#',  name: 'Hash Analyzer',   desc: 'Identify and analyze hashes',         tag: 'tool', href: 'tools/hash.html' },
    { icon: '🌐', name: 'Network Recon',   desc: 'DNS, geolocation, ports',             tag: 'tool', href: 'tools/recon.html' },
    { icon: '🔍', name: 'OSINT Dashboard', desc: 'Subdomains, DNS, threat score',       tag: 'tool', href: 'tools/osint.html' },
    { icon: '🔑', name: 'Password Strength',desc: 'Entropy & crack time estimator',     tag: 'tool', href: 'tools/password.html' },
    { icon: '🔗', name: 'URL / IP Scanner',desc: 'Threat intelligence lookup',          tag: 'tool', href: 'tools/scanner.html' },
    { icon: '🪙', name: 'JWT Decoder',     desc: 'Decode and inspect JWTs',             tag: 'tool', href: 'tools/jwt.html' },
    { icon: '🔄', name: 'Encode / Decode', desc: 'Base64, Hex, URL, ROT13...',          tag: 'tool', href: 'tools/encode.html' },
    { icon: '📧', name: 'Email OSINT',     desc: 'Email analysis and breach check',     tag: 'tool', href: 'tools/email.html' },
    { icon: '🧩', name: 'Regex Tester',    desc: 'Live pattern matching & groups',      tag: 'tool', href: 'tools/regex.html' },
    { icon: '🖥', name: 'CIDR Calculator', desc: 'Subnet ranges and IP math',           tag: 'tool', href: 'tools/cidr.html' },
    { icon: '⏱', name: 'Cron Parser',     desc: 'Decode cron expressions plainly',     tag: 'tool', href: 'tools/cron.html' },
    { icon: '🔒', name: 'HTTP Headers',    desc: 'Security header grade analyzer',      tag: 'tool', href: 'tools/headers.html' },
    { icon: '🎲', name: 'Password Generator', desc: 'Cryptographically secure passwords', tag: 'tool', href: 'tools/pwgen.html' },
    { icon: '🛡', name: 'SSL Checker',     desc: 'TLS grade, certs, and vuln scan',     tag: 'tool', href: 'tools/ssl.html' },
    { icon: '⚡', name: 'Payload Library', desc: 'XSS, SQLi, CMDi — 76 payloads',      tag: 'tool', href: 'tools/payloads.html' },
    { icon: '🔎', name: 'CVE Search',      desc: 'NVD vulnerability database lookup',   tag: 'tool', href: 'tools/cve.html' },
    { icon: '🌍', name: 'WHOIS Lookup',    desc: 'Domain registrar and expiry info',    tag: 'tool', href: 'tools/whois.html' },
    { icon: '📋', name: 'Pentest Checklist', desc: 'Interactive pentest phase tracker', tag: 'tool', href: 'tools/pentest.html' },
    { icon: '📡', name: 'DNS Propagation', desc: 'Global DNS record checker',           tag: 'tool', href: 'tools/dns.html' },
    { icon: '🔧', name: 'HTTP Builder',    desc: 'Craft and fire HTTP requests',        tag: 'tool', href: 'tools/http-builder.html' },
    { icon: '🏁', name: 'Password Cracker Race', desc: 'Brute force vs dictionary vs rainbow table', tag: 'tool', href: 'tools/cracker.html' },
    { icon: '📡', name: 'Live Hacker Feed',desc: 'Real-time GitHub activity console',    tag: 'live',  href: 'hacker-feed.html' },
    { icon: '⚔',  name: 'Attack Visualizer',desc: 'SQL injection, XSS, buffer overflow', tag: 'edu',  href: 'attack-viz.html' },
    { icon: '🎯', name: 'Pentest Simulator', desc: 'Watch a full pentest unfold — recon, exploit, root shell, report.', tag: 'interactive', href: 'pentest-sim.html' },
    { icon: '💻', name: 'Open Terminal',   desc: 'Interactive portfolio shell',          tag: 'action', action: 'terminal' },
  ];
  let selected = 0, filtered = [...ITEMS];

  function open() {
    overlay.classList.add('open');
    input.value = '';
    render(ITEMS);
    setTimeout(() => input.focus(), 40);
  }
  function close() { overlay.classList.remove('open'); }
  window.openCmdPalette = open;

  function render(items) {
    filtered = items; selected = 0;
    results.innerHTML = items.map((item, i) =>
      `<div class="cmd-result-item${i===0?' selected':''}" data-idx="${i}" onclick="_cmdGo(${i})">
        <span class="cmd-result-icon">${item.icon}</span>
        <div><div class="cmd-result-name">${item.name}</div><div class="cmd-result-desc">${item.desc}</div></div>
        <span class="cmd-result-tag">${item.tag}</span>
      </div>`
    ).join('');
  }

  window._cmdGo = function(idx) {
    const item = filtered[idx]; if (!item) return;
    close();
    if (item.action === 'terminal') { openTerminal(); return; }
    if (item.href && item.href.startsWith('#')) {
      document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    render(q ? ITEMS.filter(i => (i.name+i.desc+i.tag).toLowerCase().includes(q)) : ITEMS);
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); overlay.classList.contains('open') ? close() : open(); }
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected+1, filtered.length-1); updateSel(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); selected = Math.max(selected-1, 0); updateSel(); }
    if (e.key === 'Enter')     { e.preventDefault(); _cmdGo(selected); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  function updateSel() {
    results.querySelectorAll('.cmd-result-item').forEach((el, i) => {
      el.classList.toggle('selected', i === selected);
      if (i === selected) el.scrollIntoView({ block: 'nearest' });
    });
  }
})();

// ── HERO TYPEWRITER CYCLING ──
(function() {
  const leftPhrases  = ['intelligent', 'automated', 'resilient', 'scalable', 'secure'];
  const rightPhrases = ['technical', 'strategic', 'decisive', 'relentless', 'adaptive'];

  function cycle(elId, phrases, offset) {
    const el = document.getElementById(elId);
    if (!el) return;
    let idx = 0;

    function typeOut(text, cb) {
      let i = 0; el.textContent = '';
      const t = setInterval(() => {
        el.textContent += text[i++];
        if (i >= text.length) { clearInterval(t); cb && cb(); }
      }, 80);
    }
    function eraseOut(cb) {
      const t = setInterval(() => {
        el.textContent = el.textContent.slice(0, -1);
        if (!el.textContent.length) { clearInterval(t); cb && cb(); }
      }, 48);
    }
    function next() {
      idx = (idx + 1) % phrases.length;
      setTimeout(() => typeOut(phrases[idx], () => setTimeout(() => eraseOut(next), 2600)), 320);
    }

    setTimeout(() => eraseOut(next), 2800 + offset);
  }

  cycle('hero-cycle-left',  leftPhrases,  0);
  cycle('hero-cycle-right', rightPhrases, 500);
})();

// ── v10.0: GITHUB STATS ──
(function() {
  fetch('https://api.github.com/users/TempleOfDoom085')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(u => {
      const re = document.getElementById('gh-repos');
      const fo = document.getElementById('gh-followers');
      if (re) re.textContent = u.public_repos ?? '—';
      if (fo) fo.textContent = u.followers ?? '—';
      return fetch('https://api.github.com/users/TempleOfDoom085/repos?per_page=100');
    })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(repos => {
      if (!Array.isArray(repos)) return;
      const stars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
      const el = document.getElementById('gh-stars');
      if (el) el.textContent = stars;
    })
    .catch(() => {});
})();

/* ---- service worker registration ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW failed:', err));
  });
}

/* ---- mobile hint + gold click burst ---- */
// Show mobile game hint
if (window.innerWidth <= 768) {
  const hint = document.getElementById('mobile-game-hint');
  if (hint) hint.style.display = 'inline';
}

/* ── GOLD PARTICLE BURST ON CLICK ─────────────────────────────────────── */
(function(){
  var COLORS = ['rgba(184,147,58,0.95)','rgba(212,180,88,0.9)','rgba(255,215,80,0.85)','rgba(201,168,76,0.8)'];
  document.addEventListener('click', function(e){
    var N = 20;
    for(var i = 0; i < N; i++){
      (function(i){
        var s = document.createElement('div');
        var angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        var speed = 50 + Math.random() * 80;
        var size  = 2 + Math.random() * 4;
        var color = COLORS[Math.floor(Math.random() * COLORS.length)];
        s.style.cssText = 'position:fixed;pointer-events:none;z-index:99997;border-radius:50%;'
          + 'width:' + size + 'px;height:' + size + 'px;'
          + 'background:' + color + ';'
          + 'left:' + e.clientX + 'px;top:' + e.clientY + 'px;'
          + 'transform:translate(-50%,-50%);transition:none;';
        document.body.appendChild(s);
        var vx = Math.cos(angle) * speed;
        var vy = Math.sin(angle) * speed;
        var dur = 500 + Math.random() * 300;
        var start = null;
        function step(ts){
          if(!start) start = ts;
          var p = (ts - start) / dur;
          if(p >= 1){ s.remove(); return; }
          s.style.left = (e.clientX + vx * p) + 'px';
          s.style.top  = (e.clientY + vy * p + 120 * p * p) + 'px';
          s.style.opacity = 1 - p;
          s.style.width  = (size * (1 - p * 0.5)) + 'px';
          s.style.height = (size * (1 - p * 0.5)) + 'px';
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })(i);
    }
  });
})();
