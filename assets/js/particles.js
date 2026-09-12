/* ── PARTICLE TEXT EXPLOSION ──────────────────────────────────────────── */
(function () {
  'use strict';

  var canvas = document.getElementById('particleTextCanvas');
  var ctx    = canvas.getContext('2d');
  var hero   = document.querySelector('.hero');
  var label  = document.getElementById('detonateLabel');

  var COLORS = [
    'rgba(0,212,255,0.9)',
    'rgba(184,147,58,0.9)',
    'rgba(255,255,255,0.85)'
  ];

  var TARGET_COUNT = 2000;
  var DAMPING      = 0.85;
  var SPRING       = 0.12;

  var particles = [];
  var exploded  = false;
  var settled   = false;
  var settleTimer = null;

  /* ── size canvas to hero ── */
  function resize() {
    var r = hero.getBoundingClientRect();
    canvas.width  = r.width;
    canvas.height = r.height;
    buildParticles();
  }

  /* ── sample text into pixel positions ── */
  function sampleText() {
    /* hero can briefly have no layout box (hidden tab, pane still opening) — getImageData throws on a 0×0 canvas */
    if (!canvas.width || !canvas.height) return [];
    var isMobile = window.innerWidth < 768;
    var offscreen = document.createElement('canvas');
    offscreen.width  = canvas.width;
    offscreen.height = canvas.height;
    var oc = offscreen.getContext('2d');

    var fontSize = isMobile ? 60 : 120;
    var font = 'bold ' + fontSize + 'px "Cormorant Garamond", serif';
    oc.font = font;
    oc.fillStyle = '#ffffff';
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';

    if (isMobile) {
      var lineH = fontSize * 1.15;
      var cy = offscreen.height / 2;
      oc.fillText('BRIAN',  offscreen.width / 2, cy - lineH / 2);
      oc.fillText('TEMPLE', offscreen.width / 2, cy + lineH / 2);
    } else {
      oc.fillText('BRIAN TEMPLE', offscreen.width / 2, offscreen.height / 2);
    }

    var data = oc.getImageData(0, 0, offscreen.width, offscreen.height).data;
    var pts  = [];
    var step = Math.max(1, Math.floor(Math.sqrt((offscreen.width * offscreen.height) / (TARGET_COUNT * 4))));

    for (var y = 0; y < offscreen.height; y += step) {
      for (var x = 0; x < offscreen.width; x += step) {
        var idx = (y * offscreen.width + x) * 4;
        if (data[idx + 3] > 128) {
          pts.push({ x: x, y: y });
        }
      }
    }

    /* shuffle and trim */
    for (var i = pts.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pts[i]; pts[i] = pts[j]; pts[j] = tmp;
    }
    if (pts.length > TARGET_COUNT) pts.length = TARGET_COUNT;
    return pts;
  }

  /* ── build / rebuild particle array ── */
  function buildParticles() {
    settled = false;
    label.classList.remove('visible');
    if (settleTimer) clearTimeout(settleTimer);

    var targets = sampleText();
    particles = [];

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      particles.push({
        targetX: t.x,
        targetY: t.y,
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size:  1.5 + Math.random() * 1.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
    // particles form in text positions invisibly — no auto-reveal
  }

  function scheduleSettle() {
    settleTimer = setTimeout(function () {
      settled = true;
      // fade canvas back out after explosion settles
      canvas.classList.remove('ptc-active');
    }, 2400);
  }

  /* ── explode on hero click ── */
  function handleHeroClick() {
    exploded = true;
    settled  = false;
    canvas.classList.add('ptc-active'); // flash visible for explosion
    if (settleTimer) clearTimeout(settleTimer);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.vx = (8 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1);
      p.vy = (8 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1);
    }

    scheduleSettle();
  }

  /* ── animation loop ── */
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      /* spring toward target */
      var ax = (p.targetX - p.x) * SPRING;
      var ay = (p.targetY - p.y) * SPRING;

      p.vx = (p.vx + ax) * DAMPING;
      p.vy = (p.vy + ay) * DAMPING;

      p.x += p.vx;
      p.y += p.vy;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  /* ── hero click listener (pointer-events:none on canvas, so attach to hero) ── */
  hero.addEventListener('click', handleHeroClick);

  /* ── init ── */
  window.addEventListener('resize', resize);
  resize();
  tick();
})();

/* ── CYBERPUNK AMBIENT SOUND ENGINE ── */
(function () {
  'use strict';

  var ctx = null;
  var masterGain = null;
  var compressor = null;
  var isPlaying = false;

  /* ── Oscillator handles for cleanup ── */
  var nodes = [];

  /* ── Pad frequency sets: Am7 and Dm7 ── */
  var PAD_AM7 = [110, 130.81, 164.81, 196.00];
  var PAD_DM7 = [146.83, 174.61, 220.00, 261.63];
  var padOscillators = [];
  var currentPadFreqs = PAD_AM7.slice();
  var targetPadFreqs  = PAD_AM7.slice();
  var padTransitioning = false;

  /* ── Arpeggio notes (Am pentatonic) ── */
  var ARP_NOTES = [220, 246.94, 261.63, 293.66, 329.63];
  var arpIndex  = 0;
  var arpOrder  = [0, 1, 2, 3, 4];

  /* ── Rhythm scheduling ── */
  var BEAT       = 1.2;           /* seconds per beat */
  var HAT_TIMES  = [0, 0.18, 0.42, 0.60, 0.78, 1.02]; /* within beat */
  var schedAhead = 0.12;          /* lookahead window */
  var schedInt   = 80;            /* ms scheduler interval */
  var nextBeat   = 0;
  var schedTimer = null;

  /* ── Widget DOM ── */
  var widget = document.getElementById('audioWidget');
  var label  = document.getElementById('audioWidgetLabel');

  /* ────────────────────────────────────────────────
     REVERB: procedurally generated impulse response
  ──────────────────────────────────────────────── */
  function makeReverb(audioCtx) {
    var sampleRate = audioCtx.sampleRate;
    var length     = sampleRate * 2.4;   /* 2.4 s tail */
    var decay      = 2.0;
    var ir         = audioCtx.createBuffer(2, length, sampleRate);

    for (var ch = 0; ch < 2; ch++) {
      var data = ir.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) *
                  Math.pow(1 - i / length, decay);
      }
    }

    var conv = audioCtx.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  /* ────────────────────────────────────────────────
     BASS DRONE — two detuned sines + LFO
  ──────────────────────────────────────────────── */
  function startBassDrone() {
    var baseFreq = 55;
    var bassGain = ctx.createGain();
    bassGain.gain.value = 0.55;
    bassGain.connect(compressor);

    [0, 0.7].forEach(function (detune) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq + detune;

      /* LFO on frequency ±2 Hz at 0.15 Hz */
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value  = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(bassGain);
      osc.start();
      nodes.push(osc, lfo, lfoGain, bassGain);
    });
  }

  /* ────────────────────────────────────────────────
     PAD CHORD — Am7 sawtooth + LP filter + reverb
  ──────────────────────────────────────────────── */
  function startPadChord(reverb) {
    var padMix = ctx.createGain();
    padMix.gain.value = 0.18;

    var filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value         = 0.8;

    padMix.connect(filter);
    filter.connect(reverb);
    reverb.connect(compressor);

    padOscillators = [];
    currentPadFreqs.forEach(function (freq) {
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(padMix);
      osc.start();
      padOscillators.push(osc);
      nodes.push(osc);
    });

    nodes.push(padMix, filter);
  }

  /* ────────────────────────────────────────────────
     PAD CHORD TRANSITION (scroll-based)
  ──────────────────────────────────────────────── */
  function transitionPad(newFreqs) {
    if (padTransitioning) return;
    padTransitioning = true;
    var rampTime = 2.5;
    padOscillators.forEach(function (osc, i) {
      osc.frequency.linearRampToValueAtTime(
        newFreqs[i], ctx.currentTime + rampTime
      );
    });
    currentPadFreqs = newFreqs.slice();
    setTimeout(function () { padTransitioning = false; }, rampTime * 1000 + 100);
  }

  /* ────────────────────────────────────────────────
     HI-HAT — filtered noise burst
  ──────────────────────────────────────────────── */
  function scheduleHat(time) {
    var bufSize = ctx.sampleRate * 0.05;
    var buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data    = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    var src    = ctx.createBufferSource();
    src.buffer = buf;

    var hp = ctx.createBiquadFilter();
    hp.type            = 'highpass';
    hp.frequency.value = 7000;

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.28, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    src.connect(hp);
    hp.connect(env);
    env.connect(compressor);
    src.start(time);
    src.stop(time + 0.06);
  }

  /* ────────────────────────────────────────────────
     KICK — sine sweep 80 → 20 Hz over 0.15 s
  ──────────────────────────────────────────────── */
  function scheduleKick(time) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, time);
    osc.frequency.exponentialRampToValueAtTime(20, time + 0.15);

    var env = ctx.createGain();
    env.gain.setValueAtTime(1.2, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

    osc.connect(env);
    env.connect(compressor);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  /* ────────────────────────────────────────────────
     ARPEGGIO — triangle, Am pentatonic, random order
  ──────────────────────────────────────────────── */
  function scheduleArp(time) {
    /* advance order index; reshuffle each octave */
    if (arpIndex >= arpOrder.length) {
      arpIndex = 0;
      /* Fisher-Yates shuffle */
      for (var i = arpOrder.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arpOrder[i]; arpOrder[i] = arpOrder[j]; arpOrder[j] = tmp;
      }
    }
    var noteFreq = ARP_NOTES[arpOrder[arpIndex]];
    arpIndex++;

    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = noteFreq;

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.22, time + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);

    osc.connect(env);
    env.connect(compressor);
    osc.start(time);
    osc.stop(time + 0.42);
  }

  /* ────────────────────────────────────────────────
     SCHEDULER — look-ahead loop
  ──────────────────────────────────────────────── */
  function scheduler() {
    var lookAhead = ctx.currentTime + schedAhead;
    while (nextBeat < lookAhead) {
      /* kick on every beat */
      scheduleKick(nextBeat);

      /* hi-hats */
      HAT_TIMES.forEach(function (offset) {
        scheduleHat(nextBeat + offset);
      });

      /* arpeggio — one note per beat */
      scheduleArp(nextBeat);

      nextBeat += BEAT;
    }
  }

  /* ────────────────────────────────────────────────
     AUDIO ENGINE — start / stop
  ──────────────────────────────────────────────── */
  function startEngine() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value      = 8;
    compressor.ratio.value     = 4;
    compressor.attack.value    = 0.003;
    compressor.release.value   = 0.25;

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    var reverb = makeReverb(ctx);

    startBassDrone();
    startPadChord(reverb);

    nextBeat = ctx.currentTime + 0.05;
    scheduler();
    schedTimer = setInterval(scheduler, schedInt);

    /* ── apply scroll state immediately if needed ── */
    checkScroll();
  }

  function stopEngine() {
    clearInterval(schedTimer);
    schedTimer = null;
    nodes.forEach(function (n) {
      try { n.stop && n.stop(); } catch (e) { /* already stopped */ }
      try { n.disconnect(); }      catch (e) { /* already disconnected */ }
    });
    nodes = [];
    padOscillators = [];
    if (ctx) { ctx.close(); ctx = null; }
    currentPadFreqs = PAD_AM7.slice();
    targetPadFreqs  = PAD_AM7.slice();
    padTransitioning = false;
    arpIndex = 0;
    arpOrder = [0, 1, 2, 3, 4];
  }

  /* ────────────────────────────────────────────────
     WIDGET — toggle
  ──────────────────────────────────────────────── */
  function updateWidget(playing) {
    if (playing) {
      widget.classList.add('playing');
      label.textContent = '◼ AUDIO ON';
    } else {
      widget.classList.remove('playing');
      label.textContent = '♫ AUDIO OFF';
    }
  }

  widget.addEventListener('click', function () {
    isPlaying = !isPlaying;
    if (isPlaying) {
      startEngine();
    } else {
      stopEngine();
    }
    updateWidget(isPlaying);
  });

  /* ────────────────────────────────────────────────
     SCROLL — transition Am7 ↔ Dm7 past 50% page
  ──────────────────────────────────────────────── */
  var lastChord = 'am7';

  function checkScroll() {
    if (!isPlaying || !padOscillators.length) return;
    var scrollPct = window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight || 1);
    var chord = scrollPct > 0.5 ? 'dm7' : 'am7';
    if (chord !== lastChord) {
      lastChord = chord;
      transitionPad(chord === 'dm7' ? PAD_DM7 : PAD_AM7);
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });

})();

// ── CODE RAIN OVERLAY (press R) ──
(function () {
  var canvas = document.getElementById('rain-canvas');
  var indicator = document.getElementById('rain-indicator');
  var ctx = canvas.getContext('2d');
  var active = false;
  var fadeTimer = null;

  var SYMBOLS = [
    '0x', '//', '&&', '>>', '{}', '||',
    'ssh', 'fn', '0', '1', '!', '@', '#', '$', '%', '^', '&',
    '(', ')', '[', ']', '\\', ';', ':', "'", '"', '<', '>', '?', '/',
    'sudo', 'rm', 'ls', 'cd', 'ps'
  ];

  var COL_W = 16;
  var cols = [];
  var lastFrame = 0;
  var rafId = null;
  var running = false;

  function randomSym() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  function initCols() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var count = Math.ceil(canvas.width / COL_W);
    cols = [];
    for (var i = 0; i < count; i++) {
      cols.push({
        x: i * COL_W,
        y: Math.random() * canvas.height,
        speed: 2 + Math.random() * 4,
        trail: 12 + Math.floor(Math.random() * 9), // 12-20
        chars: []
      });
    }
  }

  function lerpColor(t) {
    // t=0 => cyan #00d4ff, t=1 => gold #b8933a
    var r = Math.round(0   + t * (0xb8 - 0));
    var g = Math.round(0xd4 + t * (0x93 - 0xd4));
    var b = Math.round(0xff + t * (0x3a - 0xff));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawFrame() {
    var W = canvas.width, H = canvas.height;
    ctx.fillStyle = 'rgba(14,14,14,0.18)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = '14px "Share Tech Mono","DM Mono",monospace';
    ctx.textBaseline = 'top';

    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      var t = W > 1 ? col.x / (W - 1) : 0; // 0..1 for color lerp
      var baseColor = lerpColor(t);

      // push new char at head
      col.chars.unshift(randomSym());
      if (col.chars.length > col.trail) col.chars.length = col.trail;

      for (var j = 0; j < col.chars.length; j++) {
        var alpha = j === 0 ? 1.0 : Math.max(0.05, 1.0 - (j / col.trail) * 0.95);
        var yPos = col.y - j * COL_W;
        if (yPos < -COL_W || yPos > H + COL_W) continue;

        if (j === 0) {
          ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
        } else {
          // parse baseColor channels for rgba
          ctx.fillStyle = baseColor.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')');
        }
        ctx.fillText(col.chars[j], col.x, yPos);
      }

      col.y += col.speed;
      if (col.y - col.trail * COL_W > H) {
        col.y = -COL_W;
        col.chars = [];
        col.speed = 2 + Math.random() * 4;
      }
    }
  }

  function loop(ts) {
    if (!running) return;
    if (ts - lastFrame >= 33) {
      lastFrame = ts;
      drawFrame();
    }
    rafId = requestAnimationFrame(loop);
  }

  function startRain() {
    initCols();
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stopRainLoop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  window.toggleRain = function () {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }

    if (!active) {
      active = true;
      canvas.style.display = 'block';
      indicator.style.display = 'block';
      startRain();
      // force reflow then fade in
      requestAnimationFrame(function () {
        canvas.style.opacity = '1';
      });
    } else {
      active = false;
      canvas.style.opacity = '0';
      indicator.style.display = 'none';
      fadeTimer = setTimeout(function () {
        canvas.style.display = 'none';
        stopRainLoop();
        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fadeTimer = null;
      }, 400);
    }
  };

  window.addEventListener('resize', function () {
    if (active) { initCols(); }
  });

  document.addEventListener('keydown', function (e) {
    // Don't fire if typing in input/textarea
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') {
      window.toggleRain();
    }
  });
})();

// ── STEALTH MODE (Alt+S) ──
(function () {
  var ORIGINAL_TITLE = 'Brian Temple \u2014 AI & Cybersecurity';
  var STEALTH_TITLE  = 'LinkedIn - Professional Portfolio';
  var stealth = false;
  var flashEl = document.getElementById('stealth-flash');
  var flashTimer = null;

  function showFlash(msg) {
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    flashEl.textContent = msg;
    flashEl.style.display = 'block';
    // force reflow
    void flashEl.offsetWidth;
    flashEl.style.opacity = '1';
    flashTimer = setTimeout(function () {
      flashEl.style.opacity = '0';
      setTimeout(function () {
        flashEl.style.display = 'none';
        flashTimer = null;
      }, 200);
    }, 500);
  }

  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      stealth = !stealth;
      if (stealth) {
        document.documentElement.classList.add('stealth-mode');
        document.title = STEALTH_TITLE;
        showFlash('STEALTH MODE');
      } else {
        document.documentElement.classList.remove('stealth-mode');
        document.title = ORIGINAL_TITLE;
        showFlash('STEALTH OFF');
      }
    }
  });
})();
