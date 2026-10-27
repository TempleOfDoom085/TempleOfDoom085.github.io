// Headless test suite for Shadow Keep.  Usage: node tests/run.mjs
// Builds nothing itself: run `node build.mjs claude` first (npm test does both).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "dist/claude/shadow-keep.html"), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- minimal browser stubs ----
function makeEnv() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return (s) => ({ width: String(s).length * 8 });
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop: noop });
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return k in t ? t[k] : noop;
    },
    set: (t, k, v) => ((t[k] = v), true),
  });
  const el = () => {
    const e = {
      getContext: (type) => (type === "webgl" ? null : ctx), addEventListener: noop, setAttribute: noop,
      classList: { add: noop, remove: noop, contains: () => false }, style: {}, appendChild: noop,
      scrollIntoView: noop, focus: noop, blur: noop, replaceWith: noop, toBlob: noop,
      closest: () => ({ hidden: false }), querySelector: () => el(), width: 0, height: 0, value: "", checked: false,
      textContent: "", hidden: false, getBoundingClientRect: () => ({ left: 0, top: 0, width: 256, height: 192 }),
    };
    return e;
  };
  const timers = [];
  const store = new Map();
  const g = {
    document: { getElementById: el, createElement: el, querySelector: el, querySelectorAll: () => [], body: el(), fonts: null, hidden: false, activeElement: null },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    matchMedia: () => ({ matches: false }),
    addEventListener: noop, performance: { now: () => 0 }, requestAnimationFrame: noop,
    setInterval: noop, setTimeout: (f) => timers.push(f), navigator: {}, console,
    Promise, Math, JSON, Set, Map, Date, Array, Object, String, Number, Uint8ClampedArray, Float32Array,
  };
  g.window = g; g.globalThis = g;
  return { g, timers, store };
}

function boot() {
  const { g, timers, store } = makeEnv();
  let api;
  g.__SK_TEST__ = (a) => (api = a);
  vm.runInNewContext(code, g);
  const flush = () => timers.splice(0).forEach((f) => f());
  const step = (n = 1) => { for (let i = 0; i < n; i++) { api.update(); api.draw(); if (i % 20 === 0) flush(); } };
  return { api, step, flush, store };
}

// ---- tiny test framework ----
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

// helpers
function startGame(t) {
  const { api, step } = t;
  api.PLAYER.tag = "TESTER"; api.PLAYER.co = "QA";
  api.newGame("intro", false);
  for (let i = 0; i < 6 && api.S.mode === "intro"; i++) { step(25); api.press("a"); step(2); }
  for (let i = 0; i < 3 && api.S.mode === "controls"; i++) { step(25); api.press("a"); step(2); }
}
function clearMessages(t) { for (let i = 0; i < 12 && t.api.S.msg; i++) { t.api.press("a"); t.step(16); } }
function talkTo(t, x, y) {
  const { api, step } = t;
  api.S.p.x = x; api.S.p.y = y; api.press("a"); step(2);
  for (let i = 0; i < 60 && api.S.mode === "dialog"; i++) { api.press("a"); step(4); }
}
function teleport(t, key) { const [x, y] = key.split(",").map(Number); t.api.S.rx = x; t.api.S.ry = y; t.api.S.mode = "play"; }

console.log("Shadow Keep tests");

test("boots to the title screen", () => {
  const t = boot();
  expect(t.api.S.mode === "title", "mode was " + t.api.S.mode);
  t.step(10);
});

test("start goes through name entry, intro, controls card, then play", () => {
  const t = boot();
  t.api.press("a"); t.step(2);
  expect(t.api.S.mode === "entry", "expected entry, got " + t.api.S.mode);
  startGame(t);
  expect(t.api.S.mode === "play", "expected play, got " + t.api.S.mode);
});

test("first room fact waits for A, then clears", () => {
  const t = boot(); startGame(t);
  expect(t.api.S.msg && t.api.S.msg.pause, "no paused fact on arrival");
  t.step(200);
  expect(t.api.S.msg, "fact disappeared without A");
  t.api.press("a"); t.step(20);
  expect(!t.api.S.msg, "fact did not clear after A");
});

test("room fact and enemy tip never overlap; each fact appears once", () => {
  const t = boot(); startGame(t); clearMessages(t);
  const seen = [];
  const go = (dx) => {
    const p = t.api.S.p; p.y = 80; p.x = dx < 0 ? 2 : 16 * 16 - 12;
    for (let i = 0; i < 40 && !t.api.S.trans; i++) { t.api.keys.left = dx < 0; t.api.keys.right = dx > 0; t.step(1); }
    t.api.keys.left = t.api.keys.right = false; t.step(30);
  };
  go(-1); // into catacombs
  expect(t.api.S.msg && t.api.S.msg.kind === "room", "expected room fact first");
  seen.push(t.api.S.msg.body);
  expect(t.api.S.queue.length >= 1, "enemy tip should be queued behind the fact");
  t.api.press("a"); t.step(20);
  expect(t.api.S.msg && t.api.S.msg.kind === "tip", "enemy tip should follow the fact");
  t.api.press("a"); t.step(20);
  expect(!t.api.S.msg, "tip did not clear");
  go(1); clearMessages(t); go(-1);
  expect(!t.api.S.msg || !t.api.S.msg.body, "revisit should not repeat the fact");
});

test("enemies freeze while a paused message is up", () => {
  const t = boot(); startGame(t); clearMessages(t); teleport(t, "0,1");
  const e = t.api.room().enemies[0]; const x = e.x, y = e.y;
  t.api.S.p.x = 40; t.api.S.p.y = 40;
  t.api.S.queue.push({ kind: "tip", title: "TEST", body: "x", pause: true });
  t.step(60);
  expect(e.x === x && e.y === y, "enemy moved during pause");
});

test("dialogue pages never exceed three lines", () => {
  const t = boot(); startGame(t); clearMessages(t);
  const S = t.api.S;
  S.p.x = 112; S.p.y = 60; t.api.press("a"); t.step(2);
  expect(S.mode === "dialog", "talking to the CISO should open dialogue");
  for (const page of S.dialog.lines) {
    const n = t.api.wrap(page.t, 230).length;
    expect(n <= 3, `page has ${n} lines: "${page.t}"`);
  }
  for (let i = 0; i < 60 && S.mode === "dialog"; i++) { t.api.press("a"); t.step(4); }
  expect(S.gear.lantern, "CISO should give Detect AI");
});

test("B spin kills a goblin in one hit and has a cooldown", () => {
  const t = boot(); startGame(t); clearMessages(t); teleport(t, "0,1"); t.api.S.msg = null; t.api.S.queue.length = 0;
  const e = t.api.room().enemies[0]; t.api.S.p.x = e.x + 4; t.api.S.p.y = e.y + 16; t.api.S.p.inv = 999;
  t.api.press("b"); t.step(20);
  expect(!e.alive, "goblin survived");
  t.api.press("b"); t.step(1);
  expect(t.api.S.p.spin === 0, "spin should be on cooldown");
});

test("vendor gate: correct calls earn the seal", () => {
  const t = boot(); startGame(t); clearMessages(t);
  t.api.S.gear.lantern = true; teleport(t, "1,2"); t.api.S.msg = null; t.api.S.queue.length = 0;
  talkTo(t, 131, 88);
  expect(t.api.S.mode === "vendor", "expected vendor mode, got " + t.api.S.mode);
  for (let guard = 0; guard < 6000 && t.api.S.mode === "vendor"; guard++) {
    const v = t.api.S.vg;
    if (v.phase === "decide") { const ven = v.list[v.i]; t.api.press(!ven.ai || (ven.disc && ven.test) ? "a" : "b"); }
    else if (v.phase === "end" && v.t > 45) t.api.press("a");
    t.step(1);
  }
  expect(t.api.S.vendorSeal && t.api.S.vendorBest === 8, "seal " + t.api.S.vendorSeal + " best " + t.api.S.vendorBest);
});

test("full run: assets, Cranium Mode, both bosses, report", () => {
  const t = boot(); startGame(t); clearMessages(t);
  const S = t.api.S;
  S.gear = { lantern: true, blade: true, shield: true };
  for (const [k, r] of Object.entries(S.rooms)) {
    teleport(t, k);
    for (const o of [r.model, r.scroll].filter(Boolean)) { S.p.x = o.tx * 16 + 3; S.p.y = o.ty * 16 + 3; S.p.inv = 999; t.step(3); }
    while (S.mode === "transform") t.step(1);
    S.msg = null; S.queue.length = 0;
  }
  expect(S.found === t.api.NASSET, "found " + S.found);
  expect(S.cranium, "Cranium Mode should be on");
  teleport(t, "1,1"); S.p.x = 123; S.p.y = 20;
  for (let i = 0; i < 40; i++) { t.api.keys.up = true; t.step(1); } t.api.keys.up = false;
  expect(S.rx === 1 && S.ry === 0, "should be in the Arena");
  for (let i = 0; i < 400 && S.mode !== "dialog"; i++) t.step(1);
  for (let i = 0; i < 60 && S.mode === "dialog"; i++) { t.api.press("a"); t.step(4); }
  expect(S.boss.active, "boss should be active");
  clearMessages(t);
  S.xr = 100; t.api.press("c"); t.step(2);
  expect(S.xray > 0, "AgentSensor scan should fire");
  for (let n = 0; !S.boss.dead && n < 500; n++) { S.boss.shield = false; S.p.inv = 999; S.p.x = S.boss.x - 5; S.p.y = S.boss.y + 12; S.p.face = "up"; S.p.cd = 0; S.p.atk = 0; t.api.press("a"); t.step(15); S.msg = null; S.queue.length = 0; }
  expect(S.boss.dead, "Rogue Model should die");
  for (let i = 0; i < 500 && S.mode !== "dialog"; i++) t.step(1);
  for (let i = 0; i < 60 && S.mode === "dialog"; i++) { t.api.press("a"); t.step(4); }
  expect(S.hydra.active, "Hydra should be active");
  for (let n = 0; !S.hydra.dead && n < 3000; n++) {
    const h = S.hydra; S.p.inv = 999; S.msg = null; S.queue.length = 0;
    const hd = h.heads.find((x) => x.alive);
    const [tx, ty] = hd ? [hd.x, hd.y] : [h.x, h.y + 4];
    S.p.x = tx - 5; S.p.y = ty + 10; S.p.face = "up"; S.p.cd = 0; S.p.atk = 0; t.api.press("a"); t.step(15);
  }
  expect(S.hydra.dead, "Hydra should die");
  t.step(300);
  expect(S.mode === "win" && S.final && S.final.score > 3000, "expected win with score, got " + S.mode);
});

test("hard mode: fewer hearts, death posts progress, respawn works", () => {
  const t = boot(); t.api.PLAYER.tag = "HARD"; t.api.PLAYER.co = "QA";
  t.api.newGame("intro", true); for (let i = 0; i < 8 && t.api.S.mode !== "play"; i++) { t.step(25); t.api.press("a"); t.step(2); }
  const S = t.api.S; clearMessages(t);
  expect(S.p.max === 2, "hard mode max hearts " + S.p.max);
  S.found = 3; teleport(t, "0,1"); S.p.x = 60; S.p.y = 50;
  for (let i = 0; i < 3000 && S.mode !== "over"; i++) { S.p.inv = 0; t.step(1); if (S.mode === "dialog") { S.mode = "play"; S.dialog = null; } S.msg = null; S.queue.length = 0; }
  expect(S.mode === "over", "player should eventually die");
  expect(S.postedBest > 0, "death should post a progress score");
  t.step(60); t.api.press("a"); t.step(2);
  expect(S.mode === "play" && S.rx === 1 && S.ry === 1, "respawn at Citadel");
});

test("reduce effects disables screen shake", () => {
  const t = boot(); startGame(t);
  t.api.setCalm(false); t.api.shake(6);
  expect(t.api.S.shake > 0, "shake should work with full effects");
  t.api.S.shake = 0; t.api.setCalm(true); t.api.shake(6);
  expect(t.api.S.shake === 0, "shake should be off with reduced effects");
});

test("finished runs include the clear bonus", () => {
  const t = boot(); startGame(t);
  expect(t.api.computeFinal().score >= 3000, "a finished run includes the clear bonus");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
