/* Knights Templar 3D — renderer, lighting, post-processing, camera, particles,
   character animation and the glue into the existing game.

   The game itself is untouched: this file wraps a handful of its global
   functions (renderScene, screenShake, damageFlash, showSpecialScene, …) and
   watches STATE to drive animation. If WebGL is unavailable or fails, the
   original SVG art keeps working exactly as before. */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE) return;
  const P = G3D.props;
  const E = G3D.engine = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const clamp = G3D.clamp;

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
  const Q = isMobile
    ? { pr: Math.min(window.devicePixelRatio || 1, 1.25), shadows: false, lights: 4, particles: 0.5, tex: 256, bloomRes: 0.5 }
    : { pr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: true, lights: 6, particles: 1, tex: 512, bloomRes: 0.5 };

  let renderer, scene, camera, composer, bloom, finalPass, pmrem;
  let panel, canvas, combatHost;
  let spot, dir, hemi, pool = [];
  let roomId = null, room = null, roomCache = {};
  let knight = null, enemy = null, npc = null, relicObj = null, scrollObj = null;
  let anchors = [];
  let time = 0, last = performance.now();
  let fps = { t: 0, n: 0, acc: 0 };
  let visible = true;
  const swayList = [], spinList = [], flickerLights = [];

  // Camera state
  const cam = { pos: V(0, 1.7, 4), look: V(0, 1.7, -4), fovH: 76, intro: 0, shake: 0, mx: 0, my: 0, combat: 0 };
  const post = { fade: 1, fadeTarget: 0, flash: 0, flashCol: new THREE.Color(), grade: null, deathGrade: 0 };

  // ── Boot ───────────────────────────────────────────────────────────────────
  function supportsWebGL() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
  }

  function pref() { try { return localStorage.getItem('kt3d'); } catch (_) { return null; } }
  function setPref(v) { try { localStorage.setItem('kt3d', v); } catch (_) {} }

  E.boot = function () {
    panel = document.getElementById('scenePanel');
    combatHost = document.getElementById('combatEnemyArt');
    if (!panel || typeof STATE === 'undefined' || typeof ROOMS === 'undefined') return false;
    addToggle();
    if (pref() === 'off' || !supportsWebGL()) return false;
    try { init(); } catch (e) { console.warn('[3D] init failed, using 2D art', e); teardown(); return false; }
    installHooks();
    E.setRoom(STATE.currentRoom, true);
    requestAnimationFrame(loop);
    return true;
  };

  function init() {
    G3D.setTextureSize(Q.tex);
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(Q.pr);
    renderer.outputEncoding = THREE.LinearEncoding;   // grading + gamma happen in the final pass
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    G3D.setAnisotropy(renderer.capabilities.getMaxAnisotropy());
    canvas = renderer.domElement;
    canvas.className = 'g3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    panel.insertBefore(canvas, panel.firstChild);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); console.warn('[3D] context lost'); teardown(); restore2D(); });

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 3, 0.05, 400);
    pmrem = new THREE.PMREMGenerator(renderer);

    hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.3); scene.add(hemi);
    spot = new THREE.SpotLight(0xffffff, 1, 30, 0.6, 0.8, 2);
    spot.castShadow = Q.shadows; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.03;
    spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 40;
    scene.add(spot); scene.add(spot.target);
    dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.castShadow = Q.shadows; dir.shadow.mapSize.set(1024, 1024); dir.shadow.bias = -0.0005; dir.shadow.normalBias = 0.03;
    scene.add(dir); scene.add(dir.target);
    for (let i = 0; i < Q.lights; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      // Point-light (cube) shadows would re-render the room six times a frame; the key light's shadow carries the scene.
      scene.add(l); pool.push({ light: l, anchor: null, base: 0, flicker: 0, seed: Math.random() * 100 });
    }

    // HDR render target where supported, so bloom and tone mapping work on real light values.
    const isGL2 = renderer.capabilities.isWebGL2;
    const hf = isGL2 || renderer.extensions.has('OES_texture_half_float') && renderer.extensions.has('EXT_color_buffer_half_float');
    const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: hf ? THREE.HalfFloatType : THREE.UnsignedByteType });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.6, 0.82);
    if (hf) [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach(t => { t.texture.type = THREE.HalfFloatType; });
    // Clamp very hot pixels before blurring: unclamped HDR spikes turn the bloom kernel into visible squares.
    bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min(texture2D( tDiffuse, vUv ), vec4(3.0));');
    bloom.materialHighPassFilter.needsUpdate = true;
    composer.addPass(bloom);
    finalPass = new THREE.ShaderPass(FINAL_SHADER);
    finalPass.renderToScreen = true;
    composer.addPass(finalPass);

    createParticles();
    panel.addEventListener('pointermove', e => {
      const r = panel.getBoundingClientRect();
      cam.mx = ((e.clientX - r.left) / r.width - 0.5) * 2; cam.my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    panel.addEventListener('pointerleave', () => { cam.mx = 0; cam.my = 0; });
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(panel);
    E.active = true;
  }

  function teardown() {
    E.active = false;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (panel) panel.classList.remove('g3d-active', 'g3d-ready');
    if (combatHost) combatHost.classList.remove('g3d-combat');
    try { renderer && renderer.dispose(); } catch (_) {}
  }
  function restore2D() {
    if (orig.renderScene && typeof STATE !== 'undefined') orig.renderScene(STATE.currentRoom);
    if (STATE && STATE.inCombat && STATE.currentEnemy && orig.renderEnemySVG) combatHost.innerHTML = orig.renderEnemySVG(STATE.currentEnemy.type);
  }

  // A small toggle in the top bar to switch between 3D and the classic art.
  function addToggle() {
    const bar = document.querySelector('.top-stats');
    if (!bar || document.getElementById('btn3d')) return;
    const b = document.createElement('button');
    b.id = 'btn3d'; b.className = 'btn-audio'; b.type = 'button';
    b.title = 'Toggle real-time 3D graphics';
    b.textContent = pref() === 'off' ? '◇ 2D' : '◆ 3D';
    b.addEventListener('click', () => { setPref(pref() === 'off' ? 'on' : 'off'); location.reload(); });
    const fs = bar.querySelector('.btn-fullscreen');
    bar.insertBefore(b, fs || null);
  }

  // ── Final pass: exposure, ACES, grade, aberration, vignette, grain, fades ──
  const FINAL_SHADER = {
    uniforms: {
      tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
      exposure: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1 }, contrast: { value: 1 },
      vignette: { value: 0.95 }, grain: { value: 0.03 }, aberration: { value: 0.0022 },
      fade: { value: 1 }, flashAmt: { value: 0 }, flashCol: { value: new THREE.Color() }, desat: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time, exposure, sat, contrast, vignette, grain, aberration, fade, flashAmt, desat;
      uniform vec3 tint, flashCol; uniform vec2 res; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec2 off = d * aberration * (0.3 + r2 * 3.0);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        c *= exposure * tint;
        c += flashCol * flashAmt;
        c = aces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat * (1.0 - desat));
        c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
        c *= mix(1.0, smoothstep(0.95, 0.18, sqrt(r2) * 1.25), vignette);
        c = pow(c, vec3(1.0 / 2.2));
        c += (hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5) * grain;
        c *= 1.0 - fade;
        gl_FragColor = vec4(c, 1.0);
      }`,
  };

  // ── Particles ──────────────────────────────────────────────────────────────
  // One additive system (dust, embers, wisps, sparks, bursts) + fog sprites.
  const PMAX = 1800;
  let pts, pPos, pCol, pSize, pAlpha, pData = [];
  let fogSprites = [];
  let fogTex = null;
  function createParticles() {
    const geo = new THREE.BufferGeometry();
    pPos = new Float32Array(PMAX * 3); pCol = new Float32Array(PMAX * 3); pSize = new Float32Array(PMAX); pAlpha = new Float32Array(PMAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; uniform float scale;
        varying vec3 vCol; varying float vA;
        void main(){ vCol = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * scale / -mv.z, 1.0, 64.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vCol; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) * vA;
          if (a < 0.003) discard; gl_FragColor = vec4(vCol * a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 6;
    scene.add(pts);
    for (let i = 0; i < PMAX; i++) pData.push({ life: 0, max: 0, vx: 0, vy: 0, vz: 0, type: '', on: false, seed: Math.random() * 100, emitter: null, size: 0, r: 0, g: 0, b: 0 });
    // Fog wisp texture
    const S = 128, c = G3D.canvas(S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5, dy = y / S - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = G3D.fbm(x / 32, y / 32, 4, 4, 9), a = clamp(1 - r, 0, 1) * clamp(n * 1.6 - 0.25, 0, 1);
      const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * a * 255;
    }
    ctx.putImageData(img, 0, 0);
    fogTex = new THREE.CanvasTexture(c);
  }

  let emitters = [];
  function setEmitters(list) {
    pData.forEach(p => { p.on = false; }); pAlpha.fill(0);
    fogSprites.forEach(s => scene.remove(s)); fogSprites = [];
    emitters = [];
    (list || []).forEach(e => {
      const n = Math.round(e.count * Q.particles * (reducedMotion ? 0.5 : 1));
      const col = new THREE.Color(e.color);
      if (e.type === 'fog') {
        for (let i = 0; i < Math.min(n, 40); i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, color: col, transparent: true, opacity: 0, depthWrite: false, fog: true }));
          const sz = (e.size || 3.5) * (0.7 + Math.random() * 0.8);
          s.scale.set(sz * 1.8, sz, 1);
          s.userData = { box: e.box, vx: (Math.random() - 0.3) * 0.12, phase: Math.random() * 10, op: (e.opacity || 0.1) * (0.6 + Math.random() * 0.8) };
          s.position.set(rand(e.box[0], e.box[1]), rand(e.box[2], e.box[3]) + sz * 0.25, rand(e.box[4], e.box[5]));
          s.renderOrder = 2; scene.add(s); fogSprites.push(s);
        }
        return;
      }
      const em = { type: e.type, box: e.box, col, n };
      emitters.push(em);
      for (let i = 0; i < n; i++) { const p = alloc(); if (!p) break; spawn(p, em, true); }
    });
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function alloc() { for (let i = 0; i < PMAX; i++) if (!pData[i].on) { pData[i].idx = i; return pData[i]; } return null; }
  function spawn(p, em, initial) {
    const b = em.box, t = em.type;
    p.on = true; p.emitter = em; p.type = t;
    const i = p.idx * 3;
    pPos[i] = rand(b[0], b[1]); pPos[i + 1] = rand(b[2], b[3]); pPos[i + 2] = rand(b[4], b[5]);
    let k = 1;
    if (t === 'dust') { p.vx = rand(-0.03, 0.03); p.vy = rand(-0.01, 0.02); p.vz = rand(-0.03, 0.03); p.max = rand(6, 14); p.size = rand(0.012, 0.03); k = 0.9; }
    else if (t === 'ember') { p.vx = rand(-0.15, 0.15); p.vy = rand(0.5, 1.4); p.vz = rand(-0.15, 0.15); p.max = rand(1.2, 3); p.size = rand(0.02, 0.045); k = 5; }
    else if (t === 'wisp') { p.vx = rand(-0.2, 0.2); p.vy = rand(0.05, 0.3); p.vz = rand(-0.2, 0.2); p.max = rand(3, 7); p.size = rand(0.04, 0.09); k = 3; }
    else if (t === 'spark') { p.vx = 0; p.vy = rand(0, 0.05); p.vz = 0; p.max = rand(0.6, 2.2); p.size = rand(0.02, 0.05); k = 6; }
    else if (t === 'ash') { p.vx = rand(-0.1, 0.25); p.vy = rand(-0.35, -0.12); p.vz = rand(-0.1, 0.1); p.max = rand(5, 10); p.size = rand(0.012, 0.025); k = 0.35; }
    else if (t === 'drip') { p.vx = 0; p.vy = 0; p.vz = 0; p.max = rand(1.5, 4); p.size = 0.02; k = 1.2; }
    p.life = initial ? Math.random() * p.max : 0;
    p.r = em.col.r * k; p.g = em.col.g * k; p.b = em.col.b * k;
    pSize[p.idx] = p.size;
  }
  // One-shot bursts (hit sparks, dust clouds, holy light)
  function burst(type, pos, n, color, speed) {
    const col = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const p = alloc(); if (!p) return;
      p.on = true; p.emitter = null; p.type = type; const i = p.idx * 3;
      pPos[i] = pos.x + rand(-0.15, 0.15); pPos[i + 1] = pos.y + rand(-0.2, 0.2); pPos[i + 2] = pos.z + rand(-0.15, 0.15);
      const a = Math.random() * 6.283, el = rand(-0.4, 1.2), s = (speed || 2) * rand(0.4, 1);
      p.vx = Math.cos(a) * Math.cos(el) * s; p.vy = Math.sin(el) * s; p.vz = Math.sin(a) * Math.cos(el) * s;
      p.life = 0; p.max = type === 'smoke' ? rand(1.2, 2.4) : rand(0.4, 1.0);
      p.size = type === 'smoke' ? rand(0.12, 0.25) : rand(0.025, 0.05);
      const kk = type === 'smoke' ? 0.25 : 6;
      p.r = col.r * kk; p.g = col.g * kk; p.b = col.b * kk;
      pSize[p.idx] = p.size;
    }
  }
  E.burst = burst;

  function updateParticles(dt) {
    for (let j = 0; j < PMAX; j++) {
      const p = pData[j]; if (!p.on) continue;
      const i = j * 3;
      p.life += dt;
      if (p.life >= p.max) { if (p.emitter) spawn(p, p.emitter, false); else { p.on = false; pAlpha[j] = 0; } continue; }
      const u = p.life / p.max;
      let a;
      switch (p.type) {
        case 'dust': p.vx += Math.sin(time * 0.3 + p.seed) * 0.002 * dt * 60 * 0.05; a = Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(time * 2 + p.seed)); break;
        case 'ember': p.vx += Math.sin(time * 3 + p.seed) * dt * 0.6; p.vz += Math.cos(time * 2.6 + p.seed) * dt * 0.6; a = (1 - u) * (0.6 + 0.4 * Math.sin(time * 20 + p.seed)); pSize[j] = p.size * (1 - u * 0.6); break;
        case 'wisp': p.vx += Math.sin(time * 1.3 + p.seed) * dt * 0.3; p.vz += Math.cos(time * 1.1 + p.seed) * dt * 0.3; a = Math.sin(u * Math.PI) * 0.8; break;
        case 'spark': a = Math.pow(Math.max(0, Math.sin(u * Math.PI)), 6) * (Math.sin(time * 30 + p.seed) > 0.2 ? 1 : 0.2); break;
        case 'ash': p.vx += Math.sin(time + p.seed) * dt * 0.2; a = Math.sin(u * Math.PI) * 0.8; break;
        case 'drip': if (u > 0.7) { p.vy -= 9.8 * dt; } a = u > 0.7 ? 0.8 : 0.3; break;
        case 'smoke': p.vx *= 0.96; p.vy = p.vy * 0.95 + 0.02; p.vz *= 0.96; pSize[j] = p.size * (1 + u * 2.5); a = (1 - u) * 0.6; break;
        default: p.vy -= 3.0 * dt; p.vx *= 0.97; p.vz *= 0.97; a = 1 - u; break; // sparks / holy bursts
      }
      pPos[i] += p.vx * dt; pPos[i + 1] += p.vy * dt; pPos[i + 2] += p.vz * dt;
      if (p.emitter && p.type === 'drip' && pPos[i + 1] < 0) { spawn(p, p.emitter, false); continue; }
      pAlpha[j] = a;
      pCol[i] = p.r; pCol[i + 1] = p.g; pCol[i + 2] = p.b;
    }
    const g = pts.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
    pts.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    fogSprites.forEach(s => {
      const u = s.userData, b = u.box;
      s.position.x += u.vx * dt;
      if (s.position.x > b[1] + 2) s.position.x = b[0] - 2;
      if (s.position.x < b[0] - 2) s.position.x = b[1] + 2;
      s.material.opacity = u.op * (0.6 + 0.4 * Math.sin(time * 0.3 + u.phase)) * clamp(time * 0.5, 0, 1);
      s.material.rotation = Math.sin(time * 0.05 + u.phase) * 0.3;
    });
  }

  // ── Characters ─────────────────────────────────────────────────────────────
  // Rest poses (rotations in radians) for each rig kind.
  const POSES = {
    knight: { armR: [-0.12, 0, 0.16], foreR: [-0.45, 0, 0], armL: [-0.55, 0.2, -0.05], foreL: [-1.2, 0, 0.35], legL: [0.1, 0, -0.04], legR: [-0.14, 0, 0.04], torso: [0, 0, 0], neck: [0.05, 0, 0] },
    risen: { armR: [-0.1, 0, 0.12], foreR: [-0.35, 0, 0], armL: [-0.5, 0.2, -0.05], foreL: [-1.0, 0, 0.3], legL: [0.12, 0, 0], legR: [-0.15, 0, 0], torso: [0.28, 0.1, 0], neck: [0.2, 0, 0.18] },
    peasant: { armR: [-1.15, 0, 0.1], foreR: [-0.3, 0, 0], armL: [-1.3, 0, -0.1], foreL: [-0.25, 0, 0], legL: [0.2, 0, 0], legR: [-0.15, 0, 0], torso: [0.45, 0, 0.08], neck: [0.15, 0, 0.35] },
    necromancer: { armR: [-0.25, 0, 0.2], foreR: [-0.2, 0, 0], armL: [-0.9, 0, -0.5], foreL: [-0.4, 0, 0], torso: [0, 0, 0], neck: [0.1, 0, 0] },
    npc: { torso: [0, 0, 0], neck: [0.1, 0, 0] },
  };

  class Actor {
    constructor(R) {
      this.R = R; this.kind = R.kind; this.pose = POSES[R.kind] || {};
      this.anim = null; this.alive = true; this.flash = 0; this.dissolve = 0;
      this.home = new THREE.Vector3(); this.facing = 0; this.rot = 0; this.offset = new THREE.Vector3();
      this.mats = [];
      // Own copies of materials so flashes / dissolves don't leak to other actors.
      R.root.traverse(o => {
        if (o.isMesh && o.material && !(o.material instanceof THREE.ShaderMaterial) && o.material.isMeshStandardMaterial) {
          const src = o.material; o.material = src.clone(); this.mats.push(o.material);
          if (src.userData.uvScale) G3D.withRepeat(o.material, [src.userData.uvScale.x, src.userData.uvScale.y]);
          o.material.userData.baseEmissive = o.material.emissive.clone();
          o.material.userData.baseEI = o.material.emissiveIntensity;
        }
        if (o.userData && o.userData.sway) swayList.push(o);
      });
    }
    place(pos, rot) { this.home.set(pos[0], pos[1], pos[2]); this.facing = rot; this.rot = rot; this.R.root.position.copy(this.home); this.R.root.rotation.y = rot; }
    play(name, dur, onHit) { this.anim = { name, t: 0, dur, onHit, fired: false }; }
    get busy() { return !!this.anim; }
    update(dt) {
      const R = this.R, P0 = this.pose;
      // Reset to rest pose
      ['armR', 'foreR', 'armL', 'foreL', 'legL', 'legR', 'torso', 'neck', 'shinL', 'shinR'].forEach(k => {
        if (!R[k]) return; const p = P0[k] || [0, 0, 0]; R[k].rotation.set(p[0], p[1], p[2]);
      });
      if (R.shield) { const sb = R.shield.userData.base || (R.shield.userData.base = { z: R.shield.position.z, ry: R.shield.rotation.y }); R.shield.position.z = sb.z; R.shield.rotation.y = sb.ry; }
      this.offset.set(0, 0, 0);
      let bodyY = 0;
      // Idle life
      const br = Math.sin(time * 1.8 + (this.kind === 'knight' ? 0 : 1.3));
      if (R.torso) R.torso.rotation.x += br * 0.015;
      if (R.armR) R.armR.rotation.z += br * 0.02;
      if (this.kind === 'peasant' && this.alive) { R.torso.rotation.z += Math.sin(time * 1.4) * 0.08; R.neck.rotation.z += Math.sin(time * 0.9) * 0.15; if (R.jaw) R.jaw.rotation.x = 0.35 + Math.abs(Math.sin(time * 3)) * 0.25; R.armL.rotation.x += Math.sin(time * 2.1) * 0.12; R.armR.rotation.x += Math.cos(time * 1.8) * 0.12; }
      if (this.kind === 'risen' && this.alive) { R.neck.rotation.z += Math.sin(time * 0.7) * 0.1; R.body.rotation.z = Math.sin(time * 1.1) * 0.03; }
      if (this.kind === 'necromancer') { bodyY = 0.35 + Math.sin(time * 1.3) * 0.12; R.armL.rotation.z += Math.sin(time * 2) * 0.1; R.torso.rotation.y = Math.sin(time * 0.6) * 0.1; }
      if (this.kind === 'npc') { R.neck.rotation.y = Math.sin(time * 0.4) * 0.25; }
      // Animations layered on top
      const A = this.anim;
      if (A) {
        A.t += dt; const u = clamp(A.t / A.dur, 0, 1);
        const fwd = V(Math.sin(this.rot), 0, Math.cos(this.rot));
        if (A.name === 'attack') {
          const wind = u < 0.4 ? ease(u / 0.4) : u < 0.58 ? 1 - easeOut((u - 0.4) / 0.18) : 0;
          const strike = u < 0.4 ? 0 : u < 0.58 ? easeOut((u - 0.4) / 0.18) : 1 - ease((u - 0.58) / 0.42);
          const lunge = u < 0.35 ? -0.1 * ease(u / 0.35) : u < 0.58 ? G3D.lerp(-0.1, 0.65, easeOut((u - 0.35) / 0.23)) : 0.65 * (1 - ease((u - 0.58) / 0.42));
          if (this.kind === 'necromancer') {
            R.armR.rotation.x -= wind * 1.6 + strike * 0.3; R.armL.rotation.x -= strike * 0.8;
          } else {
            R.armR.rotation.x += -wind * 2.4 + strike * 1.2; R.foreR.rotation.x += wind * 0.6 + strike * 0.5;
            R.torso.rotation.y += wind * 0.45 - strike * 0.5; R.torso.rotation.x += strike * 0.2;
            if (R.legR) { R.legR.rotation.x -= strike * 0.4; R.legL.rotation.x += strike * 0.3; }
          }
          this.offset.addScaledVector(fwd, lunge);
          if (!A.fired && u > 0.5) { A.fired = true; A.onHit && A.onHit(); }
        } else if (A.name === 'hit') {
          const k = Math.sin(u * Math.PI) * (1 - u * 0.4);
          if (R.torso) R.torso.rotation.x -= k * 0.35;
          if (R.neck) R.neck.rotation.x -= k * 0.3;
          this.offset.addScaledVector(fwd, -k * 0.22);
          this.flash = Math.max(this.flash, 1 - u);
        } else if (A.name === 'block') {
          const k = Math.sin(u * Math.PI);
          if (R.armL) { R.armL.rotation.x -= k * 0.5; R.foreL.rotation.x -= k * 0.3; }
          if (R.shield) { R.shield.position.z += k * 0.15; R.shield.rotation.y += k * 0.4; }
          this.offset.addScaledVector(fwd, -k * 0.08);
        } else if (A.name === 'die') {
          const k = easeOut(clamp(u / 0.45, 0, 1));
          const f = u > 0.45 ? ease((u - 0.45) / 0.55) : 0;
          const knee = this.kind === 'knight' ? k * (1 - f) : k;   // the knight straightens as he falls
          if (R.legL) { R.legL.rotation.x -= knee * 1.2; R.shinL.rotation.x += knee * 1.6; R.legR.rotation.x -= knee * 1.0; R.shinR.rotation.x += knee * 1.5; }
          if (R.torso) R.torso.rotation.x += k * 0.6 * (1 - f * 0.7);
          if (this.kind === 'necromancer') bodyY += k * 0.6;
          else if (this.kind === 'knight') { bodyY += G3D.lerp(-0.38 * k, 0.12, f); R.body.rotation.x = f * 1.45; }
          else bodyY -= k * 0.42;
          if (u > 0.45 && this.kind !== 'knight') {
            this.dissolve = f;
            if (Math.random() < 0.6) burst('smoke', this.R.root.position.clone().add(V(0, 0.4 + Math.random() * 1.2, 0)), 1, this.kind === 'necromancer' ? '#4dff5a' : '#8a8478', 0.6);
          }
          if (!A.fired && u > 0.45) { A.fired = true; A.onHit && A.onHit(); }
        } else if (A.name === 'divine') {
          bodyY += Math.sin(u * Math.PI) * 0.4;
          if (R.armR) R.armR.rotation.x -= Math.sin(u * Math.PI) * 2.6;
        }
        if (u >= 1) { this.anim = null; if (A.name === 'die') { this.alive = false; this.dead = true; } }
      }
      if (this.dead && this.kind === 'knight') { R.body.rotation.x = 1.45; bodyY = 0.12; }
      R.body.position.y = bodyY;
      this.rot += shortAngle(this.rot, this.facing) * Math.min(1, dt * 6);
      R.root.rotation.y = this.rot;
      R.root.position.copy(this.home).add(this.offset);
      // Hit flash + dissolve
      this.flash = Math.max(0, this.flash - dt * 3);
      this.mats.forEach(m => {
        if (this.flash > 0) { m.emissive.setRGB(1, 0.18, 0.08); m.emissiveIntensity = this.flash * this.flash * 0.55; }
        else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; }
        if (this.dissolve > 0) { m.transparent = true; m.opacity = 1 - this.dissolve; m.depthWrite = this.dissolve < 0.5; }
      });
      if (this.dissolve >= 1) this.R.root.visible = false;
    }
  }

  function buildKnight() {
    if (knight) { scene.remove(knight.R.root); removeSway(knight.R.root); }
    const golden = !!STATE.hasGoldenArmor;
    knight = new Actor(G3D.makeKnight({ golden }));
    knight.golden = golden;
    scene.add(knight.R.root);
  }
  function removeSway(root) {
    for (let i = swayList.length - 1; i >= 0; i--) { let o = swayList[i], inside = false; while (o) { if (o === root) { inside = true; break; } o = o.parent; } if (inside) swayList.splice(i, 1); }
  }

  function spawnEnemy(type) {
    despawnEnemy();
    const R = type === 'necromancer' ? G3D.makeNecromancer() : type === 'peasant' ? G3D.makePeasant() : G3D.makeRisen();
    enemy = new Actor(R); enemy.type = type;
    const sp = room.enemy;
    enemy.place(sp.pos, sp.rot);
    // Face the knight
    const k = knight.home;
    enemy.facing = enemy.rot = Math.atan2(k.x - sp.pos[0], k.z - sp.pos[2]);
    enemy.R.root.rotation.y = enemy.facing;
    scene.add(R.root);
    // Emerge: rise out of the floor in smoke
    enemy.R.root.position.y = -1.9; enemy.emerge = 0;
    burst('smoke', V(sp.pos[0], 0.3, sp.pos[2]), 40, type === 'necromancer' ? '#3aff5a' : '#7a8a90', 1.2);
    if (type === 'necromancer') burst('holy', V(sp.pos[0], 1.2, sp.pos[2]), 60, '#3aff5a', 3);
    assignLights();
  }
  function despawnEnemy() {
    if (!enemy) return;
    scene.remove(enemy.R.root); removeSway(enemy.R.root); enemy = null;
    assignLights();
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────
  // Keep the most recently used rooms resident; free GPU memory for older ones.
  const ROOM_CACHE_MAX = isMobile ? 4 : 7;
  const lru = [];
  function touchRoom(id) {
    const i = lru.indexOf(id); if (i >= 0) lru.splice(i, 1); lru.push(id);
    while (lru.length > ROOM_CACHE_MAX) {
      const old = lru.shift(), spec = roomCache[old];
      if (!spec || old === roomId) continue;
      delete roomCache[old];
      for (let k = swayList.length - 1; k >= 0; k--) if (swayList[k].userData._room === old) swayList.splice(k, 1);
      spec.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
      if (spec.env) spec.env.dispose();
    }
  }

  function buildRoom(id) {
    if (roomCache[id]) { touchRoom(id); return roomCache[id]; }
    const type = (ROOMS[id] && ROOMS[id].type) || 'chapel';
    const fn = G3D.rooms[G3D.roomTypeMap[type]] || G3D.rooms.chapel;
    const spec = fn();
    batchStatic(spec.group);
    spec.group.updateMatrixWorld(true);
    spec.anchors = []; spec.swing = [];
    spec.group.traverse(o => {
      if (o.userData.light) spec.anchors.push(o);
      if (o.userData.sway) { o.userData._room = id; swayList.push(o); }
      if (o.userData.swing) spec.swing.push(o);
    });
    spec.env = makeEnv(spec);
    roomCache[id] = spec;
    touchRoom(id);
    return spec;
  }

  // Merge every static mesh that shares a material into one draw call. Cloth that
  // sways, the swinging bell and spinning relics stay separate so they can animate.
  function batchStatic(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.children.length) return;
      const m = o.material, g = o.geometry;
      if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent) return;
      if (o.userData.sway || !g.attributes.uv || !g.attributes.normal || g.attributes.color) return;
      for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.swing || p.userData.spin || p.userData.bob) return;
      const key = m.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      if (!buckets.has(key)) buckets.set(key, { m, cast: o.castShadow, recv: o.receiveShadow, items: [] });
      buckets.get(key).items.push(o);
    });
    let merged = 0;
    buckets.forEach(b => {
      if (b.items.length < 2) return;
      const geo = G3D.merge(b.items.map(o => [o.geometry, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)]));
      const mesh = new THREE.Mesh(geo, b.m); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
      root.add(mesh);
      b.items.forEach(o => o.parent.remove(o));
      merged += b.items.length;
    });
    return merged;
  }

  // Small procedural environment map per room so metal and wet stone reflect its light.
  function makeEnv(spec) {
    const s = new THREE.Scene();
    const hemiC = spec.hemi || ['#444', '#111', 0.3];
    // Gradient dome via vertex colours (a custom shader here produced NaNs in the PMREM prefilter).
    const skyGeo = new THREE.SphereGeometry(10, 24, 12), top = new THREE.Color(hemiC[0]).multiplyScalar(0.22), bot = new THREE.Color(hemiC[1]).multiplyScalar(0.12);
    const cols = [], pa = skyGeo.attributes.position, c = new THREE.Color();
    for (let i = 0; i < pa.count; i++) { const t = G3D.smooth(clamp((pa.getY(i) / 10 + 0.3) / 0.9, 0, 1)); c.copy(bot).lerp(top, t); cols.push(c.r, c.g, c.b); }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    s.add(sky);
    const key = spec.key || {};
    const kc = new THREE.Color(key.color || '#ffffff').multiplyScalar(2.5);
    const blob = (c, x, y, z, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); s.add(m); };
    if (key.type === 'dir') { const d = V(...key.dir).normalize().multiplyScalar(8); blob(kc, d.x, d.y, d.z, 1.6); }
    else blob(kc, 0, 6, -6, 1.4);
    (spec.anchors || []).slice(0, 6).forEach((a, i) => blob(a.userData.light.color.clone().multiplyScalar(2), (i % 2 ? 1 : -1) * 6, 2.5, -2 - i * 2, 0.6));
    const rt = pmrem.fromScene(s, 0.04);
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return rt.texture;
  }

  function assignLights() {
    if (!room) return;
    const list = room.anchors.slice();
    [knight, enemy, npc].forEach(a => { if (a) a.R.root.traverse(o => { if (o.userData.light) list.push(o); }); });
    if (relicObj && relicObj.visible) relicObj.traverse(o => { if (o.userData.light) list.push(o); });
    const focus = V((room.knight.pos[0] + room.enemy.pos[0]) / 2, 1.5, (room.knight.pos[2] + room.enemy.pos[2]) / 2 - 1.5);
    const w = V();
    list.forEach(o => { o.getWorldPosition(w); o.userData._score = (o.userData.light.priority || 1) * 6 - w.distanceTo(focus); });
    list.sort((a, b) => b.userData._score - a.userData._score);
    pool.forEach((p, i) => {
      const a = list[i];
      p.anchor = a || null;
      if (!a) { p.light.intensity = 0; return; }
      const L = a.userData.light;
      p.light.color.copy(L.color); p.base = L.intensity; p.flicker = L.flicker; p.light.distance = L.distance;
    });
  }

  E.setRoom = function (id, immediate) {
    if (!E.active) return;
    const changing = id !== roomId;
    if (changing && !immediate && room) {
      // Fade out, swap, fade in.
      post.fadeTarget = 1;
      clearTimeout(E._swapT);
      E.pending = true;
      E._swapT = setTimeout(() => { E.pending = false; applyRoom(id); post.fadeTarget = 0; }, 260);
    } else {
      clearTimeout(E._swapT); E.pending = false;
      applyRoom(id);
      post.fadeTarget = 0;
    }
  };

  function applyRoom(id) {
    let spec;
    try { spec = buildRoom(id); } catch (e) { console.warn('[3D] room build failed', e); teardown(); restore2D(); return; }
    if (room && room.group.parent) scene.remove(room.group);
    const changed = roomId !== id;
    roomId = id; room = spec;
    scene.add(room.group);
    scene.background = new THREE.Color(spec.bg || '#000');
    scene.fog = new THREE.FogExp2(new THREE.Color(spec.fog[0]), spec.fog[1]);
    scene.environment = spec.env;
    // Lights
    hemi.color.set(spec.hemi[0]); hemi.groundColor.set(spec.hemi[1]); hemi.intensity = spec.hemi[2] * 0.45;
    const k = spec.key;
    spot.visible = k.type === 'spot'; dir.visible = k.type === 'dir';
    if (k.type === 'spot') {
      spot.position.set(...k.pos); spot.target.position.set(...k.target); spot.color.set(k.color);
      spot.intensity = k.intensity; spot.angle = k.angle; spot.penumbra = k.penumbra; spot.distance = k.distance;
      spot.userData.base = k.intensity;
    } else {
      const c = V(...(k.center || [0, 0, 0])), d = V(...k.dir).normalize();
      dir.position.copy(c).addScaledVector(d, 20); dir.target.position.copy(c);
      dir.color.set(k.color); dir.intensity = k.intensity; dir.userData.base = k.intensity;
      const a = k.area || 12, sc = dir.shadow.camera;
      sc.left = -a; sc.right = a; sc.top = a; sc.bottom = -a; sc.near = 1; sc.far = 60; sc.updateProjectionMatrix();
    }
    post.grade = spec.grade;
    // Cast
    const becameGolden = !!knight && !knight.golden && !!STATE.hasGoldenArmor;
    if (!knight || knight.golden !== !!STATE.hasGoldenArmor || knight.dead) buildKnight();
    knight.anim = null; knight.alive = true; knight.dead = false; knight.R.body.rotation.x = 0;
    knight.place(spec.knight.pos, spec.knight.rot);
    despawnEnemy();
    if (npc) { scene.remove(npc.R.root); npc = null; }
    const r = ROOMS[id];
    if (r && r.npc) {
      const tints = { edmund: [120, 30, 30], aldric: [90, 84, 70], matthias: [70, 56, 40], ezra: [40, 46, 80] };
      npc = new Actor(G3D.makeNPC(tints[r.npc] || [80, 64, 48]));
      npc.place(spec.npc.pos, spec.npc.rot); scene.add(npc.R.root);
    }
    if (relicObj) { scene.remove(relicObj); relicObj = null; }
    if (r && r.relic) { relicObj = P.relic(r.relic); relicObj.position.set(...spec.relic); relicObj.userData.relicName = r.relic; scene.add(relicObj); }
    if (scrollObj) { scene.remove(scrollObj); scrollObj = null; }
    if (hasScroll(id)) { scrollObj = P.scrollGlow(); scrollObj.position.set(...spec.scroll); scene.add(scrollObj); }
    setEmitters(spec.particles);
    assignLights();
    // Camera intro dolly
    cam.fovH = spec.cam.fovH || 76;
    if (changed) cam.intro = reducedMotion ? 1 : 0;
    lastHp = STATE.hp; lastEnemyHp = STATE.enemyHp; queue.length = 0; queueT = 0; cam.hold = 0;
    if (becameGolden) {
      knight.play('divine', 2.2);
      burst('holy', knight.R.root.position.clone().add(V(0, 1.5, 0)), 260, '#ffd36a', 5);
      post.flash = 2.0; post.flashCol.set('#ffe0a0');
    }
    // Combat that began during the room fade starts here, in the right room.
    if (STATE.inCombat && STATE.currentEnemy) {
      enemyRoom = STATE.currentEnemy.roomId;
      spawnEnemy(STATE.currentEnemy.type);
      knight.facing = Math.atan2(enemy.home.x - knight.home.x, enemy.home.z - knight.home.z);
      moveToCombatView(true); wasCombat = true;
    } else {
      if (canvas.parentElement !== panel) moveToCombatView(false);
      wasCombat = false;
    }
    // Pre-build neighbouring rooms when the browser is idle.
    const ex = (r && r.exits) ? Object.values(r.exits) : [];
    const idle = window.requestIdleCallback || (f => setTimeout(f, 400));
    ex.forEach((nid, i) => idle(() => { if (!roomCache[nid]) { try { buildRoom(nid); } catch (_) {} } }, { timeout: 3000 + i * 500 }));
  }

  function hasScroll(id) {
    try {
      const r = ROOMS[id];
      return !!(r && r.hasScroll && scrollPlacements && scrollPlacements[id] && !STATE.scrollsFound.includes(scrollPlacements[id].ref));
    } catch (_) { return false; }
  }

  // ── Combat choreography (driven by STATE changes) ──────────────────────────
  let lastHp = 0, lastEnemyHp = 0, wasCombat = false, enemyRoom = null;
  const queue = [];
  function enqueue(fn, dur) { queue.push({ fn, dur }); }
  let queueT = 0;
  function runQueue(dt) {
    if (queueT > 0) { queueT -= dt; return; }
    const q = queue.shift(); if (!q) return;
    q.fn(); queueT = q.dur;
  }
  function hitPoint(a) { return a.R.root.position.clone().add(V(0, 1.3, 0)); }

  function watchState() {
    if (E.pending) return;
    const inC = !!STATE.inCombat;
    if (inC && !wasCombat) {
      enemyRoom = STATE.currentEnemy && STATE.currentEnemy.roomId;
      spawnEnemy(STATE.currentEnemy.type);
      knight.facing = Math.atan2(enemy.home.x - knight.home.x, enemy.home.z - knight.home.z);
      moveToCombatView(true);
      lastEnemyHp = STATE.enemyHp;
    }
    // Player strikes
    if (enemy && STATE.enemyHp < lastEnemyHp) {
      const crit = lastEnemyHp - STATE.enemyHp >= 20;
      enqueue(() => knight.play('attack', 0.7, () => {
        if (!enemy) return;
        enemy.play('hit', 0.4); burst('spark', hitPoint(enemy), crit ? 60 : 30, crit ? '#ffd27a' : '#ffb060', crit ? 4 : 3);
        cam.shake = Math.max(cam.shake, crit ? 0.3 : 0.14);
        if (crit) { post.flash = 0.6; post.flashCol.set('#ffcc66'); }
      }), 0.75);
    }
    // Enemy strikes (or traps / events outside combat)
    if (STATE.hp < lastHp) {
      if (enemy && (inC || wasCombat)) {
        enqueue(() => enemy && enemy.play('attack', 0.75, () => {
          knight.play(STATE.defending ? 'block' : 'hit', 0.4);
          burst('spark', hitPoint(knight), 24, STATE.defending ? '#a0c8ff' : '#ff5030', 2.5);
          cam.shake = Math.max(cam.shake, 0.22); post.flash = 0.5; post.flashCol.set('#ff2010');
        }), 0.8);
      } else {
        knight.play('hit', 0.4); cam.shake = Math.max(cam.shake, 0.2);
      }
    }
    if (STATE.hp > lastHp && lastHp > 0) {
      burst('holy', knight.R.root.position.clone().add(V(0, 0.8, 0)), 50, '#6aff9a', 1.6);
      post.flash = 0.35; post.flashCol.set('#40ff80');
    }
    // Combat ended: victory (enemy defeated) or flight
    if (!inC && wasCombat) {
      const won = enemyRoom && STATE.enemiesDefeated && STATE.enemiesDefeated.has(enemyRoom);
      if (won && enemy) {
        const e = enemy;
        enqueue(() => {
          e.play('die', e.type === 'necromancer' ? 2.4 : 1.7, () => {
            burst('smoke', e.R.root.position.clone().add(V(0, 0.6, 0)), 60, e.type === 'necromancer' ? '#4dff5a' : '#9a9080', 1.4);
            if (e.type === 'necromancer') { burst('holy', e.R.root.position.clone().add(V(0, 1.4, 0)), 200, '#ffe6a0', 6); post.flash = 1.4; post.flashCol.set('#fff0c0'); cam.shake = 0.5; }
          });
          setTimeout(() => { if (enemy === e) despawnEnemy(); }, 2600);
        }, 0.2);
        cam.hold = e.type === 'necromancer' ? 3.4 : 2.6;
      } else if (enemy) despawnEnemy();
      moveToCombatView(false);
      setTimeout(() => { if (!STATE.inCombat && knight) knight.facing = room.knight.rot; }, (cam.hold || 0) * 1000);
    }
    wasCombat = inC; lastHp = STATE.hp; lastEnemyHp = STATE.enemyHp;
    // Golden armour granted
    if (!!STATE.hasGoldenArmor !== knight.golden && !knight.anim) {
      const gained = !!STATE.hasGoldenArmor;
      buildKnight(); knight.place(room.knight.pos, room.knight.rot); assignLights();
      if (gained) {
        knight.play('divine', 2.2);
        burst('holy', knight.R.root.position.clone().add(V(0, 1.5, 0)), 260, '#ffd36a', 5);
        post.flash = 2.0; post.flashCol.set('#ffe0a0');
      }
    }
    // Relic / scroll pickup
    if (relicObj && ROOMS[roomId] && !ROOMS[roomId].relic) {
      burst('holy', relicObj.position.clone().add(V(0, 1.4, 0)), 120, '#ffd27a', 3);
      scene.remove(relicObj); relicObj = null; assignLights();
    }
    if (scrollObj && !hasScroll(roomId)) { burst('holy', scrollObj.position.clone().add(V(0, 0.2, 0)), 60, '#ffe0a0', 2); scene.remove(scrollObj); scrollObj = null; }
  }

  // Move the canvas into the combat overlay so the fight plays out in 3D.
  function moveToCombatView(on) {
    if (!combatHost) return;
    if (on) {
      combatHost.innerHTML = ''; combatHost.classList.add('g3d-combat'); combatHost.appendChild(canvas);
    } else {
      combatHost.classList.remove('g3d-combat');
      panel.insertBefore(canvas, panel.firstChild);
    }
    cam.combatT = 0;
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  const tmpPos = V(), tmpLook = V();
  function updateCamera(dt) {
    const host = canvas.parentElement;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) resize(w, h);
    const aspect = w / h;
    cam.hold = Math.max(0, (cam.hold || 0) - dt);
    const inCombat = !!enemy && (STATE.inCombat || cam.hold > 0);
    cam.combat += ((inCombat ? 1 : 0) - cam.combat) * Math.min(1, dt * 3);
    cam.intro = Math.min(1, cam.intro + dt / 2.2);
    const ip = easeOut(cam.intro);
    // Exploration framing
    const c = room.cam;
    tmpPos.set(c.pos[0], c.pos[1], c.pos[2]).add(V(-0.6 * (1 - ip), 0.35 * (1 - ip), 2.2 * (1 - ip)));
    tmpLook.set(c.look[0], c.look[1], c.look[2]);
    // Combat framing: side-on two-shot of knight and foe
    if (cam.combat > 0.001) {
      const K = knight.home, N = room.enemy.pos;
      const mid = V((K.x + N[0]) / 2, 0, (K.z + N[2]) / 2);
      const axis = V(N[0] - K.x, 0, N[2] - K.z); const dist = axis.length(); axis.normalize();
      const side = V(-axis.z, 0, axis.x); if (side.z < 0) side.negate();
      // Tall foes (the Necromancer floats and towers) need a wider, higher two-shot.
      const big = enemy && enemy.kind === 'necromancer' ? 1 : 0;
      const cp = mid.clone().addScaledVector(side, 2.8 + dist * 0.6 + big * 1.8).add(V(0, 1.4 + big * 0.5, 0)).addScaledVector(axis, -0.4);
      const cl = mid.clone().add(V(0, 1.2 + big * 0.55, 0));
      const k = ease(cam.combat);
      tmpPos.lerp(cp, k); tmpLook.lerp(cl, k);
    }
    // On death, crane down over the fallen knight.
    if (post.deathGrade > 0.001) {
      const kd = ease(clamp(post.deathGrade, 0, 1)), kp = knight.home;
      const fwd = V(Math.sin(knight.rot), 0, Math.cos(knight.rot));
      const body = kp.clone().addScaledVector(fwd, 0.9).add(V(0, 0.25, 0));
      tmpLook.lerp(body, kd * 0.9);
      tmpPos.lerp(body.clone().add(V(2.6, 1.7, 2.5)), kd * 0.8);
    }
    // Drift + parallax
    if (!reducedMotion) {
      tmpPos.x += Math.sin(time * 0.13) * 0.18 + cam.mx * 0.25;
      tmpPos.y += Math.sin(time * 0.17) * 0.06 - cam.my * 0.1;
      tmpPos.z += Math.sin(time * 0.11) * 0.12;
      tmpLook.x += Math.sin(time * 0.09) * 0.15 + cam.mx * 0.3;
    }
    // Shake
    if (cam.shake > 0 && !reducedMotion) {
      const s = cam.shake;
      tmpPos.x += (Math.random() - 0.5) * s * 0.4; tmpPos.y += (Math.random() - 0.5) * s * 0.3;
      tmpLook.x += (Math.random() - 0.5) * s * 0.3;
    }
    cam.shake = Math.max(0, cam.shake - dt * 1.2);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    // Field of view from the desired horizontal angle, clamped for tall screens.
    const fovH = G3D.lerp(cam.fovH, 70, cam.combat);
    const vf = 2 * Math.atan(Math.tan(fovH * Math.PI / 360) / aspect) * 180 / Math.PI;
    camera.fov = clamp(vf, 26, 68); camera.aspect = aspect; camera.updateProjectionMatrix();
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    composer.setSize(Math.floor(w * pr), Math.floor(h * pr));
    bloom.resolution.set(w * pr * Q.bloomRes, h * pr * Q.bloomRes);
    finalPass.uniforms.res.value.set(w * pr, h * pr);
  }

  // ── Per-frame animation of the set ─────────────────────────────────────────
  const wp = V();
  function updateSet(dt) {
    // Lights: follow anchors + flicker
    pool.forEach(p => {
      if (!p.anchor) return;
      p.anchor.getWorldPosition(wp); p.light.position.copy(wp);
      const f = p.flicker;
      const n = Math.sin(time * 9.1 + p.seed) * 0.5 + Math.sin(time * 23.7 + p.seed * 2) * 0.3 + Math.sin(time * 4.3 + p.seed * 3) * 0.2;
      p.light.intensity = p.base * (1 + n * 0.16 * f);
    });
    if (spot.visible && room.key.flicker) spot.intensity = spot.userData.base * (1 + Math.sin(time * 7) * 0.08);
    // Lightning in the storm
    if (room.lightning && !reducedMotion) {
      E._ln = (E._ln || 6) - dt;
      if (E._ln <= 0) { E._ln = 6 + Math.random() * 9; E._lnT = 0; }
      if (E._lnT != null) {
        E._lnT += dt;
        const t = E._lnT, v = t < 0.08 ? 1 : t < 0.16 ? 0.2 : t < 0.26 ? 0.9 : Math.max(0, 1 - (t - 0.26) * 3);
        G3D.uniforms.lightning.value = v;
        dir.intensity = dir.userData.base * (1 + v * 5);
        if (t > 0.6) { E._lnT = null; G3D.uniforms.lightning.value = 0; dir.intensity = dir.userData.base; }
      }
    }
    // Cloth
    swayList.forEach(o => {
      if (o.userData._room && o.userData._room !== roomId) return;
      const s = o.userData.sway, p = o.geometry.attributes.position, b = s.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
        if (s.skirt || s.robe) {
          const k = clamp(-y, 0, 1);
          p.setX(i, x * (1 + Math.sin(time * 2 + y * 3 + x * 4) * s.amp * k)); p.setZ(i, z + Math.sin(time * 1.7 + x * 5) * s.amp * k);
        } else {
          const k = s.h ? clamp(-y / s.h, 0, 1) : 1;
          p.setZ(i, z + (Math.sin(time * 1.4 + y * 1.8 + x * 2.5) * 0.6 + Math.sin(time * 2.3 + x * 4) * 0.4) * s.amp * k * (s.cape ? 1.6 : 4));
        }
      }
      p.needsUpdate = true;
    });
    room.swing.forEach(o => { o.rotation.z = Math.sin(time * 1.1) * o.userData.swing; });
    if (relicObj) relicObj.traverse(o => { if (o.userData.spin) { o.rotation.y += dt * 0.8; o.position.y = 1.45 + Math.sin(time * 1.6) * 0.06; } });
    if (scrollObj) scrollObj.position.y = room.scroll[1] + 0.05 + Math.sin(time * 2) * 0.04;
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  function loop(now) {
    if (!E.active) return;
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden || !visible || !room || E.paused) return;
    try {
      frame(dt, true);
    } catch (e) {
      console.warn('[3D] frame failed, falling back to 2D art', e);
      teardown(); restore2D();
    }
  }

  function frame(dt, draw) {
    time += dt; G3D.uniforms.time.value = time;
    {
      watchState();
      runQueue(dt);
      if (enemy && enemy.emerge != null) { enemy.emerge = Math.min(1, enemy.emerge + dt / 1.2); enemy.home.y = -1.9 * (1 - easeOut(enemy.emerge)); if (enemy.emerge >= 1) { enemy.emerge = null; enemy.home.y = 0; } }
      knight.update(dt);
      if (enemy) enemy.update(dt);
      if (npc) npc.update(dt);
      updateSet(dt);
      updateParticles(dt);
      updateCamera(dt);
      // Post uniforms
      post.fade += (post.fadeTarget - post.fade) * Math.min(1, dt * 9);
      post.flash = Math.max(0, post.flash - dt * 2.2);
      const g = post.grade, u = finalPass.uniforms;
      u.time.value = time; u.exposure.value = g.exposure; u.tint.value.set(g.tint[0], g.tint[1], g.tint[2]);
      u.sat.value = g.sat; u.contrast.value = g.contrast; u.fade.value = post.fade;
      u.flashAmt.value = post.flash * 0.32; u.flashCol.value.copy(post.flashCol);
      post.deathGrade += ((knight.dead || (knight.anim && knight.anim.name === 'die') ? 1 : 0) - post.deathGrade) * Math.min(1, dt * 1.5);
      u.desat.value = post.deathGrade * 0.75;
      if (!draw) return;
      composer.render();
      if (!panel.classList.contains('g3d-active')) { panel.classList.add('g3d-active'); requestAnimationFrame(() => panel.classList.add('g3d-ready')); }
      adapt(dt);
    }
  }
  function shortAngle(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  // Dynamic resolution: keep it smooth on slower GPUs.
  function adapt(dt) {
    fps.acc += dt; fps.n++;
    if (fps.acc < 2.5) return;
    const avg = fps.acc / fps.n; fps.acc = 0; fps.n = 0;
    const pr = renderer.getPixelRatio();
    if (avg > 1 / 38 && pr > 0.6) { renderer.setPixelRatio(Math.max(0.6, pr - 0.15)); resize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight); }
    else if (avg < 1 / 58 && pr < Q.pr) { renderer.setPixelRatio(Math.min(Q.pr, pr + 0.1)); resize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight); }
  }

  // ── Hooks into the game ────────────────────────────────────────────────────
  const orig = {};
  function installHooks() {
    ['renderScene', 'screenShake', 'damageFlash', 'showSpecialScene', 'roomTransition', 'spawnParticles', 'renderEnemySVG', 'playerDeath'].forEach(n => { orig[n] = window[n]; });
    window.renderScene = function (id) { if (E.active) E.setRoom(id); else orig.renderScene(id); };
    window.screenShake = function (heavy) { if (E.active) cam.shake = Math.max(cam.shake, heavy ? 0.4 : 0.2); else orig.screenShake(heavy); };
    window.damageFlash = function (type) {
      if (!E.active) return orig.damageFlash(type);
      post.flash = Math.max(post.flash, type === 'healed' ? 0.35 : 0.5); post.flashCol.set(type === 'healed' ? '#40ff80' : '#ff2010');
    };
    window.roomTransition = function () { if (!E.active) orig.roomTransition(); };
    window.spawnParticles = function (t) { if (!E.active) orig.spawnParticles(t); };
    window.showSpecialScene = function (key) {
      if (E.active) {
        if (key === 'death') { queue.length = 0; knight.play('die', 2.2); cam.shake = 0.4; }
        if (key === 'victory') { post.flash = 1.6; post.flashCol.set('#fff0c0'); }
        return true;
      }
      return orig.showSpecialScene(key);
    };
    // While 3D owns the combat view, don't let the SVG enemy overwrite the canvas.
    window.renderEnemySVG = function (type) { return E.active ? '' : orig.renderEnemySVG(type); };
  }

  // Debug: advance the simulation n steps without drawing, then draw once.
  E.step = (n, dt) => { for (let i = 0; i < n; i++) frame(dt || 1 / 30, i === n - 1); };
  E.internals = () => ({ scene, renderer, camera, pool, spot, dir, hemi });
  E.debug = () => ({ fade: post.fade, fadeT: post.fadeTarget, calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    progs: renderer.info.programs.length, cam: camera.position.toArray().map(v => +v.toFixed(2)), fov: +camera.fov.toFixed(1),
    size: renderer.getSize(new THREE.Vector2()).toArray(), pr: renderer.getPixelRatio(), room: roomId, time: +time.toFixed(2), parent: canvas.parentElement.id,
    gl2: renderer.capabilities.isWebGL2, rtType: composer.renderTarget1.texture.type, pending: E.pending });
  // Boot after the game has initialised.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', E.boot); else E.boot();
})();
