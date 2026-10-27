/* ================= AUDIO ================= */
let ac = null,
  muted = false;
function audio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
  } catch (e) {}
}
function sfx(f, d, type = "square", slide = 0, vol = 0.05) {
  if (muted || !ac) return;
  try {
    const o = ac.createOscillator(),
      gn = ac.createGain(),
      t = ac.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(ac.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  } catch (e) {}
}
function jingle(n, st = 0.09) {
  n.forEach((f, i) => setTimeout(() => sfx(f, 0.15, "square", 0, 0.045), i * st * 1000));
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  main: {
    bpm: 128,
    lead: [
      69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 67, 0, 69, 0, 0, 0, 69, 0, 72, 0, 76, 0, 79, 0, 77, 76, 74, 0, 76,
      0, 0, 0,
    ],
    bass: [
      45, 0, 57, 0, 45, 0, 57, 0, 41, 0, 53, 0, 41, 0, 53, 0, 43, 0, 55, 0, 43, 0, 55, 0, 40, 0, 52, 0, 40,
      0, 52, 0,
    ],
  },
  dark: {
    bpm: 100,
    lead: [
      69, 0, 0, 0, 72, 0, 71, 0, 0, 0, 68, 0, 0, 0, 0, 0, 69, 0, 0, 0, 76, 0, 74, 0, 0, 0, 72, 0, 71, 0, 0,
      0,
    ],
    bass: [
      45, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 41, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0, 40, 0, 0,
      0,
    ],
  },
  boss: {
    bpm: 158,
    lead: [
      64, 0, 64, 67, 0, 64, 70, 69, 64, 0, 64, 67, 0, 71, 70, 0, 64, 0, 64, 67, 0, 64, 70, 69, 72, 71, 70,
      69, 67, 0, 66, 0,
    ],
    bass: [
      40, 40, 52, 40, 40, 52, 40, 52, 40, 40, 52, 40, 43, 55, 42, 54, 40, 40, 52, 40, 40, 52, 40, 52, 36,
      36, 48, 36, 38, 50, 39, 51,
    ],
  },
  gate: {
    bpm: 116,
    lead: [
      72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0, 71, 0, 72, 0, 74, 0, 77, 0, 76, 0, 74, 0, 72,
      0, 71, 0,
    ],
    bass: [
      48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0, 41, 0, 48, 0, 41, 0, 48, 0, 43, 0, 50, 0, 43,
      0, 50, 0,
    ],
  },
};
let song = null,
  mStep = 0,
  mNext = 0;
function setSong(n) {
  if (song === n) return;
  song = n;
  mStep = 0;
  if (ac) mNext = ac.currentTime + 0.05;
}
let mGain = null,
  noiseBuf = null,
  intensity = 0,
  tempoMul = 1,
  duck = 1;
function mOut() {
  if (!mGain) {
    mGain = ac.createGain();
    mGain.gain.value = 1;
    mGain.connect(ac.destination);
  }
  return mGain;
}
function setDuck(v) {
  if (!ac || v === duck) return;
  duck = v;
  try {
    mOut().gain.setTargetAtTime(v, ac.currentTime, 0.08);
  } catch (e) {}
}
function note(m, t, d, type, vol) {
  const o = ac.createOscillator(),
    gn = ac.createGain();
  o.type = type;
  o.frequency.value = mtof(m);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn).connect(mOut());
  o.start(t);
  o.stop(t + d + 0.02);
}
function drum(type, t) {
  if (type === "k") {
    const o = ac.createOscillator(),
      gn = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gn.gain.setValueAtTime(0.18, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(gn).connect(mOut());
    o.start(t);
    o.stop(t + 0.18);
    return;
  }
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(),
    fl = ac.createBiquadFilter(),
    gn = ac.createGain(),
    d = type === "s" ? 0.12 : 0.03;
  s.buffer = noiseBuf;
  fl.type = type === "s" ? "bandpass" : "highpass";
  fl.frequency.value = type === "s" ? 1800 : 7000;
  gn.gain.setValueAtTime(type === "s" ? 0.1 : 0.035, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl).connect(gn).connect(mOut());
  s.start(t);
  s.stop(t + d + 0.01);
}
setInterval(() => {
  if (!ac || muted || !song || ac.state !== "running") return;
  const s = SONGS[song],
    dt = 60 / (s.bpm * tempoMul) / 4;
  if (mNext < ac.currentTime) mNext = ac.currentTime + 0.03;
  while (mNext < ac.currentTime + 0.15) {
    const i = mStep % 32,
      l = s.lead[i],
      b = s.bass[i],
      I = intensity;
    try {
      if (l) {
        note(l, mNext, dt * 1.6, "square", 0.018);
        if (I >= 2 && i % 2 === 0) note(l + 12, mNext, dt * 0.9, "square", 0.007);
      }
      if (b) note(b, mNext, dt * 1.8, "triangle", 0.055);
      if (I >= 1) {
        if (i % 8 === 0) drum("k", mNext);
        if (i % 8 === 4) drum("s", mNext);
        if (i % 2 === 0) drum("h", mNext);
      } else if (i % 4 === 2) drum("h", mNext);
      if (I >= 2) {
        if (i % 16 === 10 || i % 16 === 14) drum("k", mNext);
        if (i === 29 || i === 31) drum("s", mNext);
      }
    } catch (e) {}
    mStep++;
    mNext += dt;
  }
}, 40);
const sndBtn = document.getElementById("snd"),
  crtBtn = document.getElementById("crt");
let crtOn = true;
sndBtn.addEventListener("click", () => {
  muted = !muted;
  sndBtn.setAttribute("aria-pressed", String(!muted));
  audio();
});
crtBtn.addEventListener("click", () => {
  crtOn = !crtOn;
  crtBtn.setAttribute("aria-pressed", String(crtOn));
});
let calm = false;
try {
  const v = localStorage.getItem("shadowkeep-calm");
  calm = v === null ? matchMedia("(prefers-reduced-motion: reduce)").matches : v === "1";
} catch (e) {}
const fxBtn = document.getElementById("fx");
function syncFx() {
  fxBtn.textContent = "EFFECTS: " + (calm ? "REDUCED" : "FULL");
  fxBtn.setAttribute("aria-pressed", String(!calm));
}
syncFx();
fxBtn.addEventListener("click", () => {
  calm = !calm;
  syncFx();
  try {
    localStorage.setItem("shadowkeep-calm", calm ? "1" : "0");
  } catch (e) {}
});
