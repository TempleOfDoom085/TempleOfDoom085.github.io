/* Knights Templar — the score (v19).

   Generative music written in the Web Audio API, no recordings: a male choir
   (sawtooth voices through vowel formants) holding slow chords, a Gregorian
   chant line wandering the mode above it, a drone beneath, and bronze church
   bells tolling now and then — all in a long cathedral reverb (a generated
   impulse response). The mood follows the room: the fortress halls (D Dorian),
   the crypts (Phrygian, low and sparse), the flooded wing (high and glassy),
   the Ember Vaults (Aeolian, with slow war drums), and after the victory the
   bells ring in D major. In a fight the choir draws back under the drums
   (game3d/world.js); thunder and other effects share the reverb.

   KTMusic.start() / stop() are driven by the ♪ Music button (game.html); the
   first click or key press starts the sound unless the player switched it off. */
(function () {
  'use strict';
  const M = { on: false, ready: false, mood: null, chordAt: 0, chord: 0, phraseAt: 0, bellAt: 0, drumAt: 0, voices: [], timer: null };
  const ctx = () => window.getAudioCtx();
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ── Moods: mode (semitones from the root), chord roots as scale degrees, timbre ──
  const DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10], AEOL = [0, 2, 3, 5, 7, 8, 10], IONIAN = [0, 2, 4, 5, 7, 9, 11];
  const MOODS = {
    castle:  { root: 50, mode: DORIAN, prog: [0, 6, 0, 4, 3, 6, 0, 2], chordLen: 9,  pad: 0.05, chant: 0.55, bells: [28, 55], vowels: ['a', 'o'], drone: 0.04 },
    crypt:   { root: 45, mode: PHRYG,  prog: [0, 1, 0, 6, 5, 1],         chordLen: 12, pad: 0.045, chant: 0.25, bells: [45, 80], vowels: ['u', 'o'], drone: 0.06 },
    water:   { root: 55, mode: DORIAN, prog: [0, 3, 6, 4, 0, 5],         chordLen: 11, pad: 0.035, chant: 0.35, bells: [35, 70], vowels: ['u', 'e'], drone: 0.03, high: true },
    ember:   { root: 45, mode: AEOL,   prog: [0, 5, 6, 0, 3, 6, 4, 0],   chordLen: 8,  pad: 0.05, chant: 0.3,  bells: [60, 99], vowels: ['o', 'a'], drone: 0.07, drums: true },
    victory: { root: 50, mode: IONIAN, prog: [0, 3, 4, 0, 5, 3, 4, 0],   chordLen: 7,  pad: 0.05, chant: 0.6,  bells: [10, 22], vowels: ['a', 'e'], drone: 0.03 },
  };
  const ROOM_MOOD = { crypt: 'crypt', catacombs: 'crypt', lair: 'crypt', throne: 'crypt', dungeon: 'crypt',
    flooded: 'water', ossuary: 'water', sanctum: 'water', emberstair: 'ember', forge: 'ember', vault: 'ember' };
  function moodNow() {
    if (typeof STATE === 'undefined') return 'castle';
    if (STATE.necromancerDead) return 'victory';
    const r = ROOMS[STATE.currentRoom];
    return (r && ROOM_MOOD[r.type]) || 'castle';
  }
  // Note on scale degree d (may run past the octave) of the mood's mode.
  const deg = (m, d) => m.root + m.mode[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

  // ── The cathedral: a generated stereo impulse response ───────────────────────
  function impulse(c, seconds, decay) {
    const sr = c.sampleRate, len = Math.floor(sr * seconds), buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // Darkening tail: the stone soaks up the highs first.
        const k = Math.min(0.97, 0.25 + t * 0.35);
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        const early = t < 0.08 && Math.random() < 0.012 ? (Math.random() * 2 - 1) * 0.6 : 0;
        d[i] = (lp * 2.2 + early) * Math.exp(-t * decay) * (t < 0.018 ? t / 0.018 : 1);
      }
    }
    return buf;
  }

  function setup() {
    if (M.ready) return true;
    let c; try { c = ctx(); } catch (_) { return false; }
    M.out = c.createGain(); M.out.gain.value = 0;                 // fades on start / stop
    M.vol = c.createGain(); M.vol.gain.value = volume();
    M.comp = c.createDynamicsCompressor(); M.comp.threshold.value = -18; M.comp.ratio.value = 3; M.comp.attack.value = 0.02; M.comp.release.value = 0.4;
    M.out.connect(M.comp).connect(M.vol).connect(c.destination);
    M.verb = c.createConvolver(); M.verb.buffer = impulse(c, 5.5, 1.25);
    M.wet = c.createGain(); M.wet.gain.value = 0.85; M.verb.connect(M.wet).connect(M.out);
    M.dry = c.createGain(); M.dry.gain.value = 0.32; M.dry.connect(M.out);
    M.duck = c.createGain(); M.duck.gain.value = 1;                 // the choir draws back in a fight
    M.duck.connect(M.dry); M.duck.connect(M.verb);
    // Drone: two detuned saws on the root and a fifth, breathing through a low filter.
    M.droneF = c.createBiquadFilter(); M.droneF.type = 'lowpass'; M.droneF.frequency.value = 260; M.droneF.Q.value = 0.8;
    M.droneG = c.createGain(); M.droneG.gain.value = 0;
    M.droneF.connect(M.droneG).connect(M.duck);
    M.drones = [0, 0.07, 7, 7.05, -12].map(semi => { const o = c.createOscillator(); o.type = semi === -12 ? 'sine' : 'sawtooth'; o.connect(M.droneF); o.start(); return { o, semi }; });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg).connect(M.droneF.frequency); lfo.start();
    M.ready = true;
    return true;
  }
  function volume() {
    const s = window.G3D && G3D.settings ? G3D.settings.get('music') : null;
    return s == null ? 0.8 : s;
  }

  // ── A choir voice: two detuned saws through three vowel formants ────────────
  const FORMANTS = { a: [[730, 1], [1090, 0.5], [2440, 0.22]], o: [[570, 1], [840, 0.45], [2410, 0.15]], u: [[300, 1], [870, 0.3], [2240, 0.08]], e: [[530, 1], [1840, 0.4], [2480, 0.2]] };
  function voice(c, midi, vowel, t0, dur, peak, attack, release, dest) {
    const f = mtof(midi), out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    out.gain.setValueAtTime(peak, t0 + Math.max(attack, dur - release));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(dest || M.duck);
    const src = c.createGain(); src.gain.value = 0.5;
    const oscs = [-7, 6].map(cents => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents + (Math.random() - 0.5) * 6; o.connect(src); return o; });
    // Vibrato that blooms after the attack
    const vib = c.createOscillator(); vib.frequency.value = 4.6 + Math.random() * 0.8;
    const vg = c.createGain(); vg.gain.setValueAtTime(0, t0); vg.gain.linearRampToValueAtTime(f * 0.004, t0 + Math.min(1.2, dur * 0.5));
    vib.connect(vg); oscs.forEach(o => vg.connect(o.frequency));
    FORMANTS[vowel].forEach(([fq, g]) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = fq < 1000 ? 6 : 9;
      const fg = c.createGain(); fg.gain.value = g * 2.2;
      src.connect(bp).connect(fg).connect(out);
    });
    const end = t0 + dur + 0.05;
    oscs.forEach(o => { o.start(t0); o.stop(end); }); vib.start(t0); vib.stop(end);
  }

  // ── A bronze bell: inharmonic partials, each with its own decay ─────────────
  const PARTIALS = [[0.5, 0.6, 9], [1, 1, 6], [1.183, 0.5, 4.5], [1.506, 0.35, 4], [2.0, 0.45, 3.5], [2.514, 0.22, 2.6], [2.662, 0.18, 2.2], [3.011, 0.15, 1.8], [4.166, 0.08, 1.2]];
  function bell(c, midi, t0, amp) {
    const f = mtof(midi);
    PARTIALS.forEach(([r, a, d]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a * amp, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(M.verb); g.connect(M.dry); o.start(t0); o.stop(t0 + d + 0.1);
    });
    // The clapper's strike
    const n = c.createOscillator(); n.type = 'square'; n.frequency.value = f * 5.3;
    const ng = c.createGain(); ng.gain.setValueAtTime(amp * 0.06, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    n.connect(ng).connect(M.verb); n.start(t0); n.stop(t0 + 0.08);
  }
  // A slow war drum for the Ember Vaults
  function drum(c, t0, amp) {
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(92, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.35);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(amp, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g); g.connect(M.duck); o.start(t0); o.stop(t0 + 1.2);
  }

  // ── The conductor: schedules chords, chant phrases, bells and drums ahead ───
  function tick() {
    if (!M.on) return;
    const c = ctx(), t = c.currentTime;
    const mk = moodNow();
    if (mk !== M.mood) {
      M.mood = mk; M.chord = 0; M.chordAt = Math.max(M.chordAt, t + 0.3);
      const m = MOODS[mk];
      M.drones.forEach(d => d.o.frequency.setTargetAtTime(mtof(m.root - 12 + d.semi), t, 2.5));
      M.droneG.gain.setTargetAtTime(m.drone, t, 3);
    }
    const m = MOODS[M.mood];
    const fight = typeof STATE !== 'undefined' && STATE.inCombat;
    M.duck.gain.setTargetAtTime(fight ? 0.35 : 1, t, fight ? 0.6 : 2.5);
    // Chords: a four-voice choir, overlapping so the harmony never breaks.
    while (M.chordAt < t + 0.6) {
      const d = m.prog[M.chord % m.prog.length], len = m.chordLen;
      const lift = m.high ? 12 : 0;
      [[d - 7, 'u', 0.9], [d, m.vowels[0], 1], [d + 2, m.vowels[0], 0.8], [d + 4, m.vowels[1], 0.7]].forEach(([dd, v, a], i) => {
        voice(c, deg(m, dd) + lift, v, M.chordAt + i * 0.12, len + 2.6, m.pad * a, 2.4, 2.6);
      });
      M.chordAt += len; M.chord++;
    }
    // Chant: a phrase of plainsong on the reciting tone and its neighbours, then silence.
    if (!fight && t > M.phraseAt) {
      if (Math.random() < m.chant) {
        let d = 4 + (Math.random() < 0.5 ? 0 : 2), at = t + 0.2;
        const n = 5 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) {
          const dur = (i === n - 1 ? 2.4 : 0.6 + Math.random() * 0.8);
          voice(c, deg(m, d) + (m.high ? 12 : 0), m.vowels[i % 2 ? 1 : 0], at, dur + 0.25, 0.07, 0.12, 0.3);
          at += dur;
          // Stepwise, drifting home to the final on the last note
          d += i >= n - 2 ? Math.sign(0 - d) * Math.min(2, Math.abs(d)) : [-1, -1, 1, 1, 0, 2, -2][Math.floor(Math.random() * 7)];
          d = Math.max(-2, Math.min(9, d));
        }
        M.phraseAt = at + 4 + Math.random() * 6;
      } else M.phraseAt = t + 6 + Math.random() * 6;
    }
    // Bells toll, now and then (often after the victory).
    if (t > M.bellAt) {
      if (M.bellAt > 0) {
        const n = M.mood === 'victory' ? 3 : 1 + (Math.random() < 0.3 ? 1 : 0);
        for (let i = 0; i < n; i++) bell(c, deg(m, [0, 4, 2][i % 3]), t + 0.1 + i * 2.2, M.mood === 'crypt' ? 0.05 : 0.07);
      }
      M.bellAt = t + m.bells[0] + Math.random() * (m.bells[1] - m.bells[0]);
    }
    // War drums under the forge
    if (m.drums && !fight && t > M.drumAt) {
      drum(c, t + 0.1, 0.32); drum(c, t + 0.75, 0.2);
      M.drumAt = t + 4.5 + Math.random() * 2;
    }
  }

  function start() {
    if (!setup()) return;
    const c = ctx(), t = c.currentTime;
    if (c.state === 'suspended' && c.resume) c.resume();
    M.on = true; M.mood = null;
    M.chordAt = t + 0.2; M.phraseAt = t + 3; M.bellAt = t + 2.5; M.drumAt = t + 1;
    M.out.gain.cancelScheduledValues(t); M.out.gain.setTargetAtTime(1, t, 0.8);
    clearInterval(M.timer); M.timer = setInterval(tick, 250); tick();
  }
  function stop() {
    if (!M.ready) { M.on = false; return; }
    const c = ctx(), t = c.currentTime;
    M.on = false; clearInterval(M.timer);
    M.out.gain.cancelScheduledValues(t); M.out.gain.setTargetAtTime(0, t, 0.4);
    M.droneG.gain.setTargetAtTime(0, t, 0.4);
  }

  // Sound comes on with the first click or key press, unless the player turned it off.
  function pref() { try { return localStorage.getItem('kt_sound'); } catch (_) { return null; } }
  function firstGesture(ev) {
    ['pointerdown', 'keydown', 'touchstart'].forEach(k => window.removeEventListener(k, firstGesture, true));
    if (ev && ev.target && ev.target.closest && ev.target.closest('#btnAudio')) return;   // the button handles itself
    if (pref() === 'off' || typeof STATE === 'undefined' || STATE.audioPlaying || typeof toggleAudio !== 'function') return;
    toggleAudio(true);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(k => window.addEventListener(k, firstGesture, true));

  window.KTMusic = {
    start, stop,
    get on() { return M.on; },
    setVolume(v) { if (M.ready) M.vol.gain.setTargetAtTime(v, ctx().currentTime, 0.1); },
    // Shared with game3d/world.js so thunder rolls round the same stone.
    reverb() { return setup() ? M.verb : null; },
    state: M,
  };
})();
