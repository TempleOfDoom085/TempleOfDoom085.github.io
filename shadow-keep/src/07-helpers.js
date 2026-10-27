/* ================= HELPERS ================= */
function solidAt(px, py, oob) {
  const tx = Math.floor(px / T),
    ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return oob;
  return SOLID.has(room().map[ty][tx]);
}
function blocked(x, y, w, h, oob) {
  return (
    solidAt(x, y, oob) ||
    solidAt(x + w - 1, y, oob) ||
    solidAt(x, y + h - 1, oob) ||
    solidAt(x + w - 1, y + h - 1, oob)
  );
}
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pc = () => ({ x: S.p.x + 5, y: S.p.y + 5 });
function burst(x, y, col, n = 12, sp = 1.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      v = Math.random() * sp + 0.3;
    S.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      l: 18 + Math.random() * 22,
      c: Array.isArray(col) ? col[i % col.length] : col,
    });
  }
}
function floatT(x, y, t, c) {
  S.floats.push({ x, y, t, c, l: 50 });
}
function shake(n) {
  if (calm) return;
  S.shake = Math.max(S.shake, n);
}
function wrap(text, maxW, font = F8) {
  g.font = font;
  const words = text.split(" "),
    lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function say(lines, done) {
  const out = [];
  for (const L of lines) {
    const w = wrap(L.t, 230);
    for (let i = 0; i < w.length; i += 3) out.push({ who: L.who, t: w.slice(i, i + 3).join(" ") });
  }
  S.dialog = { lines: out, i: 0, c: 0, done };
  S.mode = "dialog";
  sfx(660, 0.06);
}
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fmtT = (f) => {
  const t = (f / 60) | 0;
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};
const DIFF = () => (S.hard ? 1.3 : 1);
