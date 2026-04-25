export class AudioSystem {
  constructor() {
    this.ctx = null;
    this._ready = false;
  }

  init() {
    if (this._ready) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._ready = true;
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
}
