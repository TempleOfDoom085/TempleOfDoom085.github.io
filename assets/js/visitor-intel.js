(function () {
  'use strict';

  var loaded = false;

  /* ── helpers ── */
  function parseUA(ua) {
    var browser = 'Unknown', version = '';
    var bMap = [
      [/Edg\/([\d.]+)/, 'Edge'],
      [/OPR\/([\d.]+)/, 'Opera'],
      [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Firefox\/([\d.]+)/, 'Firefox'],
      [/Safari\/([\d.]+)/, 'Safari'],
      [/Trident.*rv:([\d.]+)/, 'IE']
    ];
    for (var i = 0; i < bMap.length; i++) {
      var m = ua.match(bMap[i][0]);
      if (m) { browser = bMap[i][1]; version = m[1].split('.')[0]; break; }
    }
    return browser + (version ? ' ' + version : '');
  }

  function parseOS(ua) {
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Win/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function canvasHash() {
    try {
      var c = document.createElement('canvas');
      c.width = 200; c.height = 40;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, 200, 40);
      ctx.fillStyle = '#00d4ff';
      ctx.font = '14px sans-serif';
      ctx.fillText('TempleRecon\u2620', 4, 26);
      ctx.strokeStyle = '#b8933a';
      ctx.beginPath();
      ctx.arc(170, 20, 14, 0, Math.PI * 2);
      ctx.stroke();
      var raw = c.toDataURL();
      var hash = 0;
      for (var j = 0; j < raw.length; j++) {
        hash = ((hash << 5) - hash + raw.charCodeAt(j)) | 0;
      }
      return (hash >>> 0).toString(16).slice(0, 8).padStart(8, '0');
    } catch (e) { return 'n/a'; }
  }

  /* ── collect local data immediately ── */
  var ua = navigator.userAgent;
  var localData = {
    browser: parseUA(ua) + ' / ' + parseOS(ua),
    screen: screen.width + '\u00D7' + screen.height + ' @ ' + (window.devicePixelRatio || 1) + 'x DPR',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvasHash(),
    lang: navigator.language || 'Unknown',
    net: (navigator.connection && navigator.connection.effectiveType)
      ? navigator.connection.effectiveType.toUpperCase()
      : 'UNKNOWN',
    plugins: (navigator.plugins ? navigator.plugins.length : 0) + ' detected'
  };

  /* ── DOM refs ── */
  var panel    = document.getElementById('visitorRecon');
  var rowsEl   = document.getElementById('vrRows');
  var footerEl = document.getElementById('vrFooter');

  function makeBoot(text) {
    var d = document.createElement('div');
    d.className = 'vr-boot';
    d.textContent = '> ' + text;
    return d;
  }

  function makeRow(label, val, cyan) {
    var wrap = document.createElement('div');
    wrap.className = 'vr-row';
    var l = document.createElement('span');
    l.className = 'vr-row-label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'vr-row-val' + (cyan ? ' vr-cyan' : '');
    v.textContent = val;
    wrap.appendChild(l);
    wrap.appendChild(v);
    return { el: wrap, valEl: v };
  }

  /* boot lines */
  var boot1 = makeBoot('INITIALIZING VISITOR ANALYSIS...');
  var boot2 = makeBoot('SCANNING BROWSER ENVIRONMENT...');
  rowsEl.appendChild(boot1);
  rowsEl.appendChild(boot2);

  /* data rows — IP/location filled after fetch */
  var rowIP    = makeRow('IP',       '\u2014', true);
  var rowLoc   = makeRow('LOCATION', '\u2014', false);
  var rowBrows = makeRow('BROWSER',  localData.browser,  false);
  var rowScr   = makeRow('SCREEN',   localData.screen,   false);
  var rowTZ    = makeRow('TZ',       localData.tz,       false);
  var rowCvs   = makeRow('CANVAS',   localData.canvas,   false);
  var rowNet   = makeRow('NETWORK',  localData.net,      false);
  var rowLang  = makeRow('LANG',     localData.lang,     false);
  var rowPlug  = makeRow('PLUGINS',  localData.plugins,  false);

  var dataRows = [rowIP, rowLoc, rowBrows, rowScr, rowTZ, rowCvs, rowNet, rowLang, rowPlug];
  dataRows.forEach(function (r) { rowsEl.appendChild(r.el); });

  /* ── stagger reveal ── */
  function revealItem(el, delay) {
    setTimeout(function () { el.classList.add('vr-show'); }, delay);
  }

  function runSequence() {
    var t = 0;
    revealItem(boot1, t);  t += 400;
    revealItem(boot2, t);  t += 400;
    dataRows.forEach(function (r) { revealItem(r.el, t); t += 120; });
    setTimeout(function () { footerEl.classList.add('vr-show'); }, t);
  }

  /* ── close button ── */
  document.getElementById('vrClose').addEventListener('click', function () {
    panel.classList.remove('vr-visible');
    panel.addEventListener('transitionend', function handler() {
      panel.removeEventListener('transitionend', handler);
      panel.classList.add('vr-hidden');
    });
    document.getElementById('vrToggle').classList.remove('vr-toggle-hidden');
  });

  /* ── toggle button ── */
  document.getElementById('vrToggle').addEventListener('click', function () {
    this.classList.add('vr-toggle-hidden');
    panel.classList.remove('vr-hidden');
    // Small delay so display:none clears before transition
    setTimeout(function () { panel.classList.add('vr-visible'); }, 20);
    if (!loaded) {
      loaded = true;
      fetch('https://ipapi.co/json/')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          rowIP.valEl.textContent  = d.ip || 'Unknown';
          var city    = d.city || '';
          var country = d.country_name || '';
          var loc = [city, country].filter(Boolean).join(', ');
          if (d.org) loc += ' \u00B7 ' + d.org.replace(/^AS\d+\s*/, '');
          rowLoc.valEl.textContent = loc || 'Unknown';
        })
        .catch(function () {
          rowIP.valEl.textContent  = 'Unavailable';
          rowLoc.valEl.textContent = 'Unavailable';
        })
        .finally(function () { runSequence(); });
    } else {
      runSequence();
    }
  });

})();

// ── v13.1: WEBGL2 GPU FLUID SIMULATION ──
(function() {
  'use strict';
  if (window.matchMedia('(max-width:768px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  const hero = document.querySelector('.hero');
  if (!hero) return;

  // ── Canvas setup ──
  const canvas = document.createElement('canvas');
  canvas.id = 'fluidCanvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:screen;';
  const ptc = hero.querySelector('#particleTextCanvas');
  if (ptc) hero.insertBefore(canvas, ptc); else hero.appendChild(canvas);

  const SIM_RES = 256;
  canvas.width = SIM_RES;
  canvas.height = SIM_RES;

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }

  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) { canvas.remove(); return; }

  // ── Shader sources ──
  const VERT_SRC = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const ADVECT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDT;
uniform float uDissipation;
out vec4 fragColor;
void main() {
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 prevUv = vUv - vel * uDT;
  prevUv = clamp(prevUv, 0.0, 1.0);
  fragColor = uDissipation * texture(uSource, prevUv);
}`;

  const DIVERGENCE_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

  const PRESSURE_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + T + B - div) * 0.25, 0.0, 0.0, 1.0);
}`;

  const GRADSUBTRACT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  vec2 vel = texture(uVelocity, vUv).xy;
  vel -= 0.5 * vec2(R - L, T - B);
  fragColor = vec4(vel, 0.0, 1.0);
}`;

  const SPLAT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
uniform float uIsVelocity;
out vec4 fragColor;
void main() {
  vec2 d = vUv - uPoint;
  float splat = exp(-dot(d, d) / uRadius);
  vec4 base = texture(uTarget, vUv);
  if (uIsVelocity > 0.5) {
    fragColor = base + vec4(uColor.xy * splat, 0.0, 0.0);
  } else {
    fragColor = base + vec4(uColor * splat, splat);
  }
}`;

  const RENDER_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDensity;
out vec4 fragColor;
void main() {
  vec4 c = texture(uDensity, vUv);
  fragColor = vec4(c.rgb, c.a * 0.9);
}`;

  // ── Shader compilation helpers ──
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(vertSrc, fragSrc) {
    const vert = compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }

  // ── Compile all programs ──
  const progAdvect      = createProgram(VERT_SRC, ADVECT_SRC);
  const progDivergence  = createProgram(VERT_SRC, DIVERGENCE_SRC);
  const progPressure    = createProgram(VERT_SRC, PRESSURE_SRC);
  const progGradSub     = createProgram(VERT_SRC, GRADSUBTRACT_SRC);
  const progSplat       = createProgram(VERT_SRC, SPLAT_SRC);
  const progRender      = createProgram(VERT_SRC, RENDER_SRC);

  if (!progAdvect || !progDivergence || !progPressure || !progGradSub || !progSplat || !progRender) {
    canvas.remove(); return;
  }

  // ── Fullscreen quad ──
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  function bindQuad(prog) {
    const loc = gl.getAttribLocation(prog, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  // ── FBO helpers ──
  function createFBO(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { tex, fbo, w, h };
  }

  function createDoubleFBO(w, h) {
    return { read: createFBO(w, h), write: createFBO(w, h),
      swap() { const t = this.read; this.read = this.write; this.write = t; } };
  }

  function deleteFBO(fbo) {
    gl.deleteTexture(fbo.tex);
    gl.deleteFramebuffer(fbo.fbo);
  }

  function deleteDoubleFBO(d) { deleteFBO(d.read); deleteFBO(d.write); }

  const RES = SIM_RES;
  let velFBO  = createDoubleFBO(RES, RES);
  let dyeFBO  = createDoubleFBO(RES, RES);
  let presFBO = createDoubleFBO(RES, RES);
  let divFBO  = createFBO(RES, RES);

  const texelSize = [1.0 / RES, 1.0 / RES];

  // ── Blit: draw fullscreen quad into target FBO (null = screen) ──
  function blit(targetFbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo ? targetFbo.fbo : null);
    gl.viewport(0, 0, targetFbo ? targetFbo.w : canvas.width, targetFbo ? targetFbo.h : canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ── Texture binding helper ──
  function bindTex(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  // ── Simulation steps ──
  function stepAdvect(velDouble, srcDouble, dt, dissipation) {
    gl.useProgram(progAdvect);
    bindQuad(progAdvect);
    bindTex(0, velDouble.read.tex);
    bindTex(1, srcDouble.read.tex);
    gl.uniform1i(gl.getUniformLocation(progAdvect, 'uVelocity'), 0);
    gl.uniform1i(gl.getUniformLocation(progAdvect, 'uSource'), 1);
    gl.uniform1f(gl.getUniformLocation(progAdvect, 'uDT'), dt);
    gl.uniform1f(gl.getUniformLocation(progAdvect, 'uDissipation'), dissipation);
    blit(srcDouble.write);
    srcDouble.swap();
  }

  function stepDivergence() {
    gl.useProgram(progDivergence);
    bindQuad(progDivergence);
    bindTex(0, velFBO.read.tex);
    gl.uniform1i(gl.getUniformLocation(progDivergence, 'uVelocity'), 0);
    gl.uniform2fv(gl.getUniformLocation(progDivergence, 'uTexelSize'), texelSize);
    blit(divFBO);
  }

  function stepPressure() {
    // Clear pressure
    gl.bindFramebuffer(gl.FRAMEBUFFER, presFBO.read.fbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, presFBO.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(progPressure);
    bindQuad(progPressure);
    gl.uniform1i(gl.getUniformLocation(progPressure, 'uDivergence'), 1);
    gl.uniform2fv(gl.getUniformLocation(progPressure, 'uTexelSize'), texelSize);
    bindTex(1, divFBO.tex);
    for (let i = 0; i < 20; i++) {
      bindTex(0, presFBO.read.tex);
      gl.uniform1i(gl.getUniformLocation(progPressure, 'uPressure'), 0);
      blit(presFBO.write);
      presFBO.swap();
    }
  }

  function stepGradSubtract() {
    gl.useProgram(progGradSub);
    bindQuad(progGradSub);
    bindTex(0, presFBO.read.tex);
    bindTex(1, velFBO.read.tex);
    gl.uniform1i(gl.getUniformLocation(progGradSub, 'uPressure'), 0);
    gl.uniform1i(gl.getUniformLocation(progGradSub, 'uVelocity'), 1);
    gl.uniform2fv(gl.getUniformLocation(progGradSub, 'uTexelSize'), texelSize);
    blit(velFBO.write);
    velFBO.swap();
  }

  // ── Splat: inject dye + velocity ──
  function splat(x, y, dx, dy, r, g, b) {
    const RADIUS = 0.0012;
    // velocity splat
    gl.useProgram(progSplat);
    bindQuad(progSplat);
    bindTex(0, velFBO.read.tex);
    gl.uniform1i(gl.getUniformLocation(progSplat, 'uTarget'), 0);
    gl.uniform2f(gl.getUniformLocation(progSplat, 'uPoint'), x, y);
    gl.uniform3f(gl.getUniformLocation(progSplat, 'uColor'), dx, dy, 0.0);
    gl.uniform1f(gl.getUniformLocation(progSplat, 'uRadius'), RADIUS);
    gl.uniform1f(gl.getUniformLocation(progSplat, 'uIsVelocity'), 1.0);
    blit(velFBO.write);
    velFBO.swap();
    // dye splat
    bindTex(0, dyeFBO.read.tex);
    gl.uniform1i(gl.getUniformLocation(progSplat, 'uTarget'), 0);
    gl.uniform2f(gl.getUniformLocation(progSplat, 'uPoint'), x, y);
    gl.uniform3f(gl.getUniformLocation(progSplat, 'uColor'), r, g, b);
    gl.uniform1f(gl.getUniformLocation(progSplat, 'uRadius'), RADIUS);
    gl.uniform1f(gl.getUniformLocation(progSplat, 'uIsVelocity'), 0.0);
    blit(dyeFBO.write);
    dyeFBO.swap();
  }

  // ── Render dye to screen ──
  function render() {
    gl.useProgram(progRender);
    bindQuad(progRender);
    bindTex(0, dyeFBO.read.tex);
    gl.uniform1i(gl.getUniformLocation(progRender, 'uDensity'), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  // ── Main simulation step ──
  const DT = 0.016;
  const VEL_DISSIPATION = 0.995;
  const DYE_DISSIPATION = 0.985;

  function simStep() {
    // Advect velocity
    stepAdvect(velFBO, velFBO, DT, VEL_DISSIPATION);
    // Divergence
    stepDivergence();
    // Pressure solve (Jacobi)
    stepPressure();
    // Gradient subtract → make divergence-free
    stepGradSubtract();
    // Advect dye
    stepAdvect(velFBO, dyeFBO, DT, DYE_DISSIPATION);
  }

  // ── Mouse / interaction ──
  const heroRect = { x: 0, y: 0, w: 1, h: 1 };
  function updateRect() {
    const r = hero.getBoundingClientRect();
    heroRect.x = r.left; heroRect.y = r.top;
    heroRect.w = r.width; heroRect.h = r.height;
  }
  updateRect();
  window.addEventListener('resize', updateRect, { passive: true });

  // Color by horizontal position: cyan left, gold right
  function splatColor(normX) {
    const t = Math.max(0, Math.min(1, normX));
    // left=cyan [0,0.83,1], right=gold [0.72,0.58,0.23]
    return [
      t * 0.72,
      (1 - t) * 0.83 + t * 0.58,
      (1 - t) * 1.0  + t * 0.23
    ];
  }

  let prevMX = -1, prevMY = -1;

  hero.addEventListener('mousemove', e => {
    updateRect();
    const nx = (e.clientX - heroRect.x) / heroRect.w;
    const ny = (e.clientY - heroRect.y) / heroRect.h;
    // WebGL UV: y=0 at bottom, flip
    const ux = nx;
    const uy = 1.0 - ny;
    if (prevMX >= 0) {
      const dvx = (nx - prevMX) * 18.0;
      const dvy = -(ny - prevMY) * 18.0; // flip y for UV space
      const [r, g, b] = splatColor(nx);
      splat(ux, uy, dvx, dvy, r * 0.6, g * 0.6, b * 0.6);
    }
    prevMX = nx; prevMY = ny;
  }, { passive: true });

  hero.addEventListener('click', e => {
    updateRect();
    const nx = (e.clientX - heroRect.x) / heroRect.w;
    const ny = (e.clientY - heroRect.y) / heroRect.h;
    const ux = nx;
    const uy = 1.0 - ny;
    const [r, g, b] = splatColor(nx);
    // Radial burst: 8 directions
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const spd = 0.06 + Math.random() * 0.08;
      splat(ux, uy, Math.cos(ang) * spd, Math.sin(ang) * spd, r, g, b);
    }
  });

  // ── Auto-splat when idle ──
  let lastSplatTime = 0;
  let lastMouseTime = 0;
  hero.addEventListener('mousemove', () => { lastMouseTime = performance.now(); }, { passive: true });

  function autoSplat(now) {
    if (now - lastMouseTime < 2000) return; // skip if mouse recently moved
    if (now - lastSplatTime < 2000) return;
    lastSplatTime = now;
    const ux = 0.1 + Math.random() * 0.8;
    const uy = 0.1 + Math.random() * 0.8;
    const [r, g, b] = splatColor(ux);
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.04 + Math.random() * 0.05;
    splat(ux, uy, Math.cos(ang) * spd, Math.sin(ang) * spd, r * 0.7, g * 0.7, b * 0.7);
  }

  // ── Primer splats on load ──
  setTimeout(() => {
    splat(0.28, 0.5,  0.05, -0.03, 0.0, 0.83, 1.0);
    splat(0.72, 0.5, -0.05,  0.03, 0.72, 0.58, 0.23);
    splat(0.5,  0.7,  0.0,  -0.04, 0.36, 0.7,  0.6);
  }, 400);

  // ── Animation loop ──
  function loop(ts) {
    autoSplat(ts);
    simStep();
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
