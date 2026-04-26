export class AudioSystem {
  constructor() {
    this.ctx = null;
    this._ready = false;
    this._amb = null;
  }

  init() {
    if (this._ready) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._ready = true;
    this._initAmbients();
  }

  _play(freq, type = 'sine', dur = 0.15, gain = 0.15, detune = 0) {
    if (!this._ready) return;
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.connect(g); g.connect(this.ctx.destination);
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  _initAmbients() {
    const ctx = this.ctx;
    this._amb = {};

    const mkLayer = (freqs, oscType, filterType, filterHz, filterQ) => {
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterHz;
      filter.Q.value = filterQ;
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);
      freqs.forEach(({ f, d = 0 }) => {
        const osc = ctx.createOscillator();
        osc.type = oscType;
        osc.frequency.value = f;
        osc.detune.value = d;
        osc.connect(filter);
        osc.start();
      });
      return masterGain;
    };

    // Wind: detuned sawtooths through heavy lowpass
    this._amb.wind = mkLayer(
      [80,110,140,170,200].map((f, i) => ({ f, d: (i - 2) * 90 })),
      'sawtooth', 'lowpass', 260, 0.7
    );

    // Waves: sawtooths through bandpass with slow LFO on filter freq
    const waveGain = ctx.createGain(); waveGain.gain.value = 0;
    const waveFilt = ctx.createBiquadFilter();
    waveFilt.type = 'bandpass'; waveFilt.frequency.value = 175; waveFilt.Q.value = 0.9;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.22; lfoG.gain.value = 75;
    lfo.connect(lfoG); lfoG.connect(waveFilt.frequency); lfo.start();
    [120,165,205,245].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f; o.detune.value = (Math.random()-0.5)*180;
      o.connect(waveFilt); o.start();
    });
    waveFilt.connect(waveGain); waveGain.connect(ctx.destination);
    this._amb.waves = waveGain;

    // City hum: square wave harmonics through tight lowpass
    this._amb.city = mkLayer(
      [60,120,180].map(f => ({ f })),
      'square', 'lowpass', 170, 1.8
    );
  }

  // Smoothly cross-fade ambient mix based on player zone
  setZone(zone) {
    if (!this._ready || !this._amb) return;
    const t = this.ctx.currentTime, ramp = 2.8;
    const MIXES = {
      city:   { wind: 0.005, waves: 0,     city: 0.020 },
      beach:  { wind: 0.008, waves: 0.028, city: 0     },
      forest: { wind: 0.016, waves: 0,     city: 0     },
      plain:  { wind: 0.007, waves: 0,     city: 0.008 },
    };
    const mix = MIXES[zone] || MIXES.plain;
    Object.entries(mix).forEach(([key, val]) => {
      const g = this._amb[key]; if (!g) return;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(val, t + ramp);
    });
  }

  footstep()  { if (Math.random() < 0.18) this._play(55 + Math.random()*20, 'triangle', 0.04, 0.05); }
  jump()      { this._play(300, 'sine', 0.18, 0.2); }
  land()      { this._play(80, 'triangle', 0.1, 0.18); }
  punch()     { this._play(120, 'square', 0.07, 0.25); setTimeout(() => this._play(80, 'square', 0.06, 0.18), 45); }
  shoot()     { this._play(900, 'sawtooth', 0.04, 0.3); this._play(200, 'square', 0.03, 0.2); }
  pickup()    { [500,700,900].forEach((f,i) => setTimeout(() => this._play(f,'sine',0.1,0.2), i*55)); }
  quest()     { [440,550,660].forEach((f,i) => setTimeout(() => this._play(f,'sine',0.18,0.22), i*80)); }
  fail()      { [440,330,220].forEach((f,i) => setTimeout(() => this._play(f,'sawtooth',0.2,0.2), i*100)); }
  coin()      { this._play(660, 'sine', 0.12, 0.2); setTimeout(() => this._play(880,'sine',0.1,0.18), 60); }
  engine(spd) { if (Math.random() > 0.06) return; this._play(60 + spd * 1.8, 'sawtooth', 0.03, 0.04); }
  splash()    { this._play(180, 'triangle', 0.25, 0.12); }
  skate()     { if (Math.random() < 0.08) this._play(200 + Math.random()*80, 'sawtooth', 0.03, 0.04); }
  notif()     { this._play(520, 'sine', 0.22, 0.18); }
  levelUp()   { [440,550,660,880].forEach((f,i)=>setTimeout(()=>this._play(f,'sine',0.22,0.28),i*70)); }
}
