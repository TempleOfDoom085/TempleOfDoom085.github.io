/* ================= PLAYER ================= */
function tryMove(dx, dy) {
  const p = S.p;
  if (dx) {
    const nx = p.x + dx;
    if (!blocked(nx, p.y, p.w, p.h, false)) p.x = nx;
    else if (!dy) nudge("y", nx, p.y);
  }
  if (dy) {
    const ny = p.y + dy;
    if (!blocked(p.x, ny, p.w, p.h, false)) p.y = ny;
    else {
      if (S.rx === 1 && S.ry === 1 && dy < 0 && p.y < 20 && room().map[0][7] === "G" && S.lockMsg <= 0) {
        toast(
          "THE ARENA IS SEALED",
          "Discover all shadow AI first. " + S.found + "/" + NASSET + " inventoried.",
        );
        S.lockMsg = 240;
        sfx(140, 0.15);
      }
      if (!dx) nudge("x", p.x, ny);
    }
  }
}
function nudge(axis, tx, ty) {
  const p = S.p;
  for (const o of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9]) {
    if (axis === "y" ? !blocked(tx, ty + o, p.w, p.h, false) : !blocked(tx + o, ty, p.w, p.h, false)) {
      const s = Math.sign(o) * 1.1;
      if (axis === "y") {
        if (!blocked(p.x, p.y + s, p.w, p.h, false)) p.y += s;
      } else {
        if (!blocked(p.x + s, p.y, p.w, p.h, false)) p.x += s;
      }
      break;
    }
  }
}
function swordBox() {
  const p = S.p;
  switch (p.face) {
    case "right":
      return { x: p.x + 8, y: p.y - 3, w: 18, h: 16 };
    case "left":
      return { x: p.x - 16, y: p.y - 3, w: 18, h: 16 };
    case "up":
      return { x: p.x - 3, y: p.y - 16, w: 16, h: 18 };
    default:
      return { x: p.x - 3, y: p.y + 8, w: 16, h: 18 };
  }
}
function hurtPlayer(fx, fy) {
  const p = S.p;
  if (p.inv > 0) return;
  const c = pc(),
    dx = c.x - fx,
    dy = c.y - fy,
    d = Math.hypot(dx, dy) || 1;
  if (p.shield > 0) {
    p.kx = (dx / d) * 2;
    p.ky = (dy / d) * 2;
    sfx(900, 0.05, "square", -300, 0.03);
    return;
  }
  p.hp--;
  S.hits++;
  S.ab = 1.4;
  p.inv = S.hard ? 50 : 70;
  p.kx = (dx / d) * 3;
  p.ky = (dy / d) * 3;
  shake(4);
  S.freeze = 4;
  sfx(180, 0.2, "sawtooth", -120, 0.07);
  burst(c.x, c.y, "#ff4d6d", 10);
  if (p.hp <= 0) {
    S.mode = "over";
    S.overT = 0;
    S.deaths++;
    S.pb = checkPB(progressScore());
    postProgress();
    setSong(null);
    jingle([392, 330, 262, 196], 0.16);
  }
}
function changeRoom(dx, dy) {
  const p = S.p,
    snap = takeSnap();
  S.rx += dx;
  S.ry += dy;
  S.bolts = [];
  S.parts = [];
  S.floats = [];
  S.amb = [];
  S.rings = [];
  S.trans = { dx, dy, t: 0, n: 22, snap };
  if (dx === -1) p.x = COLS * T - p.w - 2;
  if (dx === 1) p.x = 2;
  if (dy === -1) p.y = PH - p.h - 2;
  if (dy === 1) p.y = 2;
  const r = room(),
    first = !S.visited[r.key];
  // New room: drop anything still queued from the last room, then show this one's
  // name. First visits add a fact and the room's enemy tip, both of which pause.
  clearMessages();
  if (!r.boss) {
    if (first) {
      const own = !!ROOMFACT[r.key];
      msg({ kind: "room", title: r.name, body: own ? ROOMFACT[r.key] : nextIntel(), own, pause: true });
      if (r.hint) msg({ kind: "tip", title: r.hint[0], body: r.hint[1], pause: true });
    } else msg({ kind: "room", title: r.name, dur: 70 });
  }
  S.visited[r.key] = true;
  if (r.boss) {
    if (!S.boss.active && !S.boss.dead)
      setTimeout(() => {
        if (S.mode === "play" && room().boss && !S.boss.active && !S.boss.dead) startCine("rogue");
      }, 1100);
    else if (S.boss.dead && !S.hydra.dead && !S.hydra.active) S.hydraDelay = 50;
  }
}
function bossIntro() {
  say(
    [
      { who: "ROGUE MODEL", t: "Unregistered. Unmonitored. Unstoppable." },
      { who: "ROGUE MODEL", t: "Your policies cannot govern what they cannot see." },
      {
        who: "HIGH CISO",
        t: "We see you now. Red team it, Sentinel! Strike when its shield drops and it glows red.",
      },
    ],
    () => {
      S.boss.active = true;
      S.lbT = 0;
      announce("RED TEAM ENGAGED", "Phase 1 · Prompt Storm");
      shake(4);
      jingle([220, 277, 330, 440], 0.1);
    },
  );
}
function hydraIntro() {
  const seen = S.talked.hydra;
  S.talked.hydra = true;
  say(
    seen
      ? [{ who: "SUPPLY CHAIN HYDRA", t: "Back again? Every supplier you cut, two more grow." }]
      : [
          {
            who: "HIGH CISO",
            t: "Wait. That model came from a compromised supplier. Something upstream is still feeding it!",
          },
          { who: "SUPPLY CHAIN HYDRA", t: "Sever one supplier and two more take its place." },
          {
            who: "HIGH CISO",
            t: "Cut every head, then strike the core. Validate the whole chain, Sentinel!",
          },
        ],
    () => {
      S.hydra.active = true;
      S.lbT = 0;
      announce("FINAL THREAT", "The Supply Chain Hydra");
      shake(6);
      jingle([196, 247, 294, 392, 494], 0.1);
    },
  );
}
