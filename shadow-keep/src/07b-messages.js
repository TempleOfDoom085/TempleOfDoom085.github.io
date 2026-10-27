/* ================= MESSAGES =================
 * Every pop-up in the game goes through this one queue, so two messages can
 * never stack on top of each other. Only the front message is on screen.
 *
 *   kind     room     room name, plus a fact the first time you visit
 *            tip      how-to or enemy tip
 *            announce gear unlocked, boss phases, big moments
 *            alert    short status ("Shadow AI 2/6 found")
 *   pause    true  -> the world freezes and the message waits for A
 *            false -> it shows for `dur` frames, then the next one comes up
 */
function msg({ kind = "alert", title = "", body = "", pause = false, dur = 150, own = false, front = false }) {
  // Don't pile up repeats of the same status line (e.g. a locked door you keep bumping).
  if (!pause && (S.msg?.title === title || S.queue.some((q) => q.title === title))) return;
  const item = { kind, title, body, pause, dur, own, t: 0, closing: 0 };
  if (front) S.queue.unshift(item);
  else S.queue.push(item);
}
const toast = (title, body, dur = 220, pause = false) => msg({ kind: pause ? "tip" : "alert", title, body, dur, pause });
const announce = (title, body, pause = true) => msg({ kind: "announce", title, body, pause, dur: 130 });
function clearMessages() {
  S.msg = null;
  S.queue.length = 0;
}
/** Advances the queue. Returns true while a paused message is holding the world still. */
function updateMessages(A) {
  if (!S.msg && S.queue.length) S.msg = S.queue.shift();
  const m = S.msg;
  if (!m) return false;
  m.t++;
  if (m.closing) {
    if (--m.closing <= 0) S.msg = null;
    return m.pause;
  }
  if (m.pause) {
    if (A && m.t > 8) {
      m.closing = 10;
      sfx(660, 0.05);
    }
    return true;
  }
  if (m.t >= m.dur) m.closing = 10;
  return false;
}
/** Messages sit on the half of the screen away from the knight, below any letterbox bars. */
function messageTop(h) {
  const lb = Math.round(22 * S.lb);
  return S.p.y + 5 < PH / 2 ? H - lb - 6 - h : HUD + lb + 6;
}
function drawMessage() {
  const m = S.msg;
  if (!m || !["play", "bossdeath", "hydradeath", "transform"].includes(S.mode) || S.trans) return;
  const f = S.frame,
    lines = m.body ? wrap(m.body, 228) : [],
    h = 18 + lines.length * 10 + (lines.length ? 4 : 0),
    y0 = messageTop(h),
    alpha = m.closing ? m.closing / 10 : Math.min(1, m.t / 6),
    accent = { room: "#f2c14e", tip: "#f2c14e", announce: "#b07cff", alert: "#b07cff" }[m.kind];
  g.globalAlpha = alpha;
  rect("rgba(6,4,12,.93)", 6, y0, W - 12, h);
  rect(accent, 6, y0, W - 12, 2);
  rect(accent, 6, y0 + h - 2, W - 12, 2);
  const titleColor = m.kind === "announce" ? "#ffffff" : accent;
  if (m.kind === "announce" && !calm && (f >> 2) % 9 === 0) txt(m.title, 14, y0 + 14, "#d63ad6");
  txt(m.title, 12, y0 + 14, titleColor);
  lines.forEach((l, i) => txt(l, 12, y0 + 28 + i * 10, m.own ? "#c9a8ff" : m.kind === "announce" ? "#b07cff" : "#ece8f7"));
  if (m.pause && !m.closing) pressA(W - 72, y0 + 5);
  g.globalAlpha = 1;
}
function pressA(x, y) {
  const on = (S.frame >> 4) % 2,
    c = on ? "#f2c14e" : "#8a6a10";
  rect("#120d06", x, y, 62, 12);
  rect(c, x, y, 62, 1);
  rect(c, x, y + 11, 62, 1);
  rect(c, x, y, 1, 12);
  rect(c, x + 61, y, 1, 12);
  txt("PRESS A", x + 31, y + 9, "#f2c14e", F8, "center");
}
