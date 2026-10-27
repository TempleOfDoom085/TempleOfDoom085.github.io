/* ================= DRAW ================= */
function rect(c, x, y, w, h) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
function txt(s, x, y, c, font = F8, align = "left") {
  g.font = font;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(0,0,0,.85)";
  g.fillText(s, x + 1, y + 1);
  g.fillStyle = c;
  g.fillText(s, x, y);
  g.textAlign = "left";
}
function wall(P, x, y, tx, ty) {
  rect(P.wall, x, y, 16, 16);
  rect("rgba(0,0,0,.2)", x, y + 6, 16, 1);
  rect("rgba(0,0,0,.2)", x, y + 14, 16, 1);
  for (let i = 0; i < 3; i++)
    rect(
      i ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.1)",
      x + Math.floor(hash(tx * 5 + i, ty) * 15),
      y + Math.floor(hash(ty * 7 + i, tx) * 14),
      1,
      1,
    );
  rect(P.lo, x, y + 7, 16, 1);
  rect(P.lo, x, y + 15, 16, 1);
  const o = (ty % 2) * 8;
  rect(P.lo, x + ((4 + o) % 16), y, 1, 7);
  rect(P.lo, x + ((12 + o) % 16), y + 8, 1, 7);
  rect(P.hi, x, y, 16, 1);
  rect(P.hi, x, y + 8, 16, 1);
}
function codeWall(x, y, tx, ty) {
  const f = S.frame;
  rect("#0b110b", x, y, 16, 16);
  rect("#050805", x, y + 15, 16, 1);
  for (let i = 0; i < 4; i++) {
    const h = hash(tx * 7 + i, ty * 3),
      len = 3 + Math.floor(h * 10),
      ind = Math.floor(hash(ty + i, tx) * 4);
    rect(h > 0.8 ? "#7cff8a" : "#2f7a3a", x + 1 + ind, y + 2 + i * 4, Math.min(len, 14 - ind), 1);
  }
  if (hash(tx, ty) > 0.6 && ((f >> 4) + tx) % 4 === 0)
    rect("#c6ffd0", x + 2 + ((f >> 2) % 10), y + 2 + Math.floor(hash(ty, tx) * 4) * 4, 2, 1);
}
function floorT(R, x, y, tx, ty) {
  const P = R.pal,
    f = S.frame;
  rect((tx + ty) % 2 ? P.floor : P.alt, x, y, 16, 16);
  rect("rgba(255,255,255,.05)", x, y, 16, 1);
  rect("rgba(255,255,255,.05)", x, y, 1, 16);
  for (let i = 0; i < 3; i++)
    rect(
      i ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.06)",
      x + Math.floor(hash(tx * 3 + i, ty * 9) * 15),
      y + Math.floor(hash(ty * 5 + i, tx * 11) * 15),
      1,
      1,
    );
  switch (R.theme) {
    case "spire":
      rect("#2c2350", x, y + 15, 16, 1);
      if (hash(tx, ty) > 0.45) {
        rect("#3d2f73", x, y + 8, 16, 1);
        if (hash(ty, tx) > 0.5) {
          const q = (f + tx * 13 + ty * 7) % 48;
          if (q < 16) rect("#c49cff", x + q, y + 8, 2, 1);
        }
      }
      if (hash(tx + 3, ty) > 0.7) rect("#3d2f73", x + 8, y, 1, 8);
      break;
    case "arena":
      rect("#3a0d18", x, y, 16, 1);
      rect("#3a0d18", x, y, 1, 16);
      if ((tx * 3 + ty * 5 + (f >> 3)) % 23 === 0) rect("rgba(255,59,92,.16)", x + 1, y + 1, 15, 15);
      break;
    case "cata":
      rect("rgba(0,0,0,.18)", x, y + 15, 16, 1);
      if (hash(tx, ty) > 0.75) rect("#4f6b3a", x + 3, y + 10, 2, 1);
      break;
    case "bazaar":
    case "gate":
      rect("rgba(255,255,255,.07)", x + 1, y + 1, 6, 6);
      rect("rgba(255,255,255,.05)", x + 9, y + 9, 6, 6);
      rect("rgba(0,0,0,.12)", x, y + 15, 16, 1);
      break;
    case "cloud":
      rect("rgba(255,255,255,.18)", x, y, 16, 1);
      rect("rgba(0,0,0,.06)", x, y + 15, 16, 1);
      break;
    case "bank":
      if (hash(tx, ty) > 0.5) {
        for (let i = 0; i < 5; i++)
          rect("rgba(120,110,90,.25)", x + 3 + i * 2, y + 2 + i * 2 + Math.floor(hash(ty, tx) * 4), 2, 1);
      }
      rect("rgba(0,0,0,.08)", x, y + 15, 16, 1);
      rect("rgba(0,0,0,.08)", x + 15, y, 1, 16);
      break;
    case "hosp":
      rect("#c9d8d6", x, y + 15, 16, 1);
      rect("#c9d8d6", x + 15, y, 1, 16);
      break;
    default:
      rect("rgba(0,0,0,.12)", x, y + 15, 16, 1);
      rect("rgba(0,0,0,.12)", x + 15, y, 1, 16);
      if (hash(tx, ty) > 0.85) rect("rgba(0,0,0,.15)", x + 5, y + 6, 2, 1);
  }
}
function banner(x, y) {
  rect("#c9a227", x + 2, y + 1, 12, 1);
  rect("#3d1a6e", x + 4, y + 2, 8, 10);
  rect("#7b3fe4", x + 5, y + 2, 6, 10);
  rect("#7b3fe4", x + 6, y + 12, 4, 2);
  rect("#7b3fe4", x + 7, y + 14, 2, 1);
  rect("#f4f1de", x + 6, y + 4, 4, 3);
  rect("#1a0d33", x + 6, y + 5, 1, 1);
  rect("#1a0d33", x + 9, y + 5, 1, 1);
  rect("#f4f1de", x + 7, y + 7, 2, 2);
  rect("#1a0d33", x + 7, y + 8, 1, 1);
}
function drawTile(R, c, tx, ty) {
  const P = R.pal,
    x = tx * T,
    y = ty * T,
    f = S.frame;
  switch (c) {
    case "#":
      wall(P, x, y, tx, ty);
      break;
    case "w":
      codeWall(x, y, tx, ty);
      break;
    case "t":
      R.theme === "cata" ? codeWall(x, y, tx, ty) : wall(P, x, y, tx, ty);
      rect("#2a1c12", x + 7, y + 8, 2, 6);
      rect("#3b2a1e", x + 5, y + 8, 6, 2);
      {
        const k = (f >> 3) % 2,
          green = R.theme === "cata";
        g.fillStyle = green ? "rgba(124,255,138,.13)" : "rgba(255,190,80,.13)";
        g.beginPath();
        g.arc(x + 8, y + 6, 12 + k, 0, 7);
        g.fill();
        rect(green ? "#2f9a4a" : "#e85d04", x + 6, y + 3 + k, 4, 5 - k);
        rect(green ? "#7cff8a" : "#ffb703", x + 7, y + 2 + k, 2, 4 - k);
        rect(green ? "#e6ffe9" : "#fff3b0", x + 7, y + 5, 2, 2);
      }
      break;
    case "b":
      wall(P, x, y, tx, ty);
      if (R.theme === "arena") {
        rect("#c9a227", x + 2, y + 1, 12, 1);
        rect("#5c0d1d", x + 4, y + 2, 8, 11);
        rect("#a3203a", x + 5, y + 2, 6, 11);
        rect("#ff3b5c", x + 7, y + 5, 2, 5);
        rect("#ff3b5c", x + 6, y + 6, 4, 1);
      } else if (R.theme === "spire") {
        rect("#c49cff", x + 5, y + 3, 6, 6);
        rect("#2a1f45", x + 6, y + 4, 4, 4);
        rect("#c49cff", x + 7, y + 5 + ((f >> 4) % 2), 2, 2);
      } else banner(x, y);
      break;
    case "p":
      floorT(R, x, y, tx, ty);
      rect("rgba(0,0,0,.3)", x + 3, y + 13, 12, 3);
      rect(P.lo, x + 2, y + 12, 12, 3);
      rect(P.hi, x + 3, y + 2, 10, 11);
      rect(P.wall, x + 9, y + 2, 4, 11);
      rect(P.hi, x + 2, y + 1, 12, 2);
      rect("rgba(255,255,255,.5)", x + 4, y + 3, 1, 8);
      if (R.theme === "arena") {
        const k = (Math.sin(f * 0.08 + tx) + 1) / 2;
        rect(`rgba(255,59,92,${0.4 + k * 0.5})`, x + 6, y + 5, 4, 4);
      }
      break;
    case "v":
      {
        const sky = ["#6fa3d6", "#7fb2e5"][ty > 4 ? 1 : 0];
        rect(sky, x, y, 16, 16);
        const h = hash(tx, ty),
          off = ((f * 0.15 + h * 64) % 48) - 16;
        g.fillStyle = "rgba(255,255,255,.85)";
        g.fillRect(x + Math.round(off), y + 6 + Math.floor(h * 5), 9, 3);
        g.fillRect(x + Math.round(off) + 2, y + 4 + Math.floor(h * 5), 5, 2);
      }
      break;
    case "G":
      floorT(R, x, y, tx, ty);
      rect("#7a5c10", x, y + 3, 16, 2);
      rect("#7a5c10", x, y + 11, 16, 2);
      for (const bx of [1, 5, 9, 13]) rect("#c9a227", x + bx, y, 2, 16);
      {
        const k = (Math.sin(f * 0.1) + 1) / 2;
        rect(`rgba(176,124,255,${0.15 + k * 0.2})`, x, y, 16, 16);
      }
      if (tx === 7) {
        rect("#f2c14e", x + 12, y + 5, 8, 7);
        rect("#3b2414", x + 15, y + 7, 2, 3);
      }
      break;
    case "c":
      rect(P.carpet, x, y, 16, 16);
      rect("rgba(0,0,0,.25)", x + 7, y + 7, 2, 2);
      rect("rgba(242,193,78,.35)", x + 7, y, 1, 1);
      break;
    case "s":
      floorT(R, x, y, tx, ty);
      for (let i = 0; i < 8; i++) rect(i % 2 ? "#f4f1de" : "#c0303a", x + i * 2, y, 2, 6);
      rect("#8c1f2a", x, y + 6, 16, 1);
      rect("#6b4226", x + 1, y + 9, 14, 7);
      rect("#8a5a2b", x + 1, y + 9, 14, 1);
      rect(["#f2c14e", "#6cc04a", "#b07cff"][(tx + ty) % 3], x + 3, y + 7, 3, 2);
      rect(["#ff4d6d", "#a99cf2", "#f2c14e"][tx % 3], x + 9, y + 7, 3, 2);
      break;
    case "x":
      floorT(R, x, y, tx, ty);
      rect("#5b3a1e", x + 1, y + 2, 14, 13);
      rect("#8a5a2b", x + 2, y + 3, 12, 11);
      rect("#5b3a1e", x + 2, y + 8, 12, 1);
      rect("#5b3a1e", x + 7, y + 3, 1, 11);
      rect("#a8743d", x + 2, y + 3, 12, 1);
      break;
    case "n":
      floorT(R, x, y, tx, ty);
      rect("#0f0a1f", x + 3, y + 11, 10, 4);
      rect("#3a2a5c", x + 5, y + 5, 6, 7);
      rect("#54407f", x + 5, y + 5, 2, 7);
      {
        const k = (Math.sin(f * 0.09 + tx * 2) + 1) / 2;
        g.fillStyle = `rgba(196,156,255,${0.15 + k * 0.25})`;
        g.beginPath();
        g.arc(x + 8, y + 4, 7, 0, 7);
        g.fill();
        rect("#e6d9ff", x + 6, y + 2, 4, 4);
        rect("#c49cff", x + 7, y + 3, 2, 2);
      }
      break;
    case "C":
      floorT(R, x, y, tx, ty);
      g.drawImage(R.chest && R.chest.open ? chestOH : chestH, x - 1, y - 1);
      if (R.chest && !R.chest.open && (f >> 3) % 6 === 0) rect("#ffffff", x + 13, y + 2, 1, 1);
      break;
    case "f":
      floorT(R, x, y, tx, ty);
      rect("#2a3338", x + 1, y + 2, 3, 14);
      rect("#2a3338", x + 12, y + 2, 3, 14);
      rect("#8a9aa3", x, y + 5, 16, 2);
      rect("#8a9aa3", x, y + 11, 16, 2);
      rect("#c3d0d6", x + 1, y + 2, 3, 1);
      rect("#c3d0d6", x + 12, y + 2, 3, 1);
      break;
    case "g":
      floorT(R, x, y, tx, ty);
      rect("#4a2a80", x, y + 3, 16, 2);
      rect("#4a2a80", x, y + 11, 16, 2);
      for (const bx of [1, 5, 9, 13]) rect("#b07cff", x + bx, y, 2, 16);
      if (tx === 7) rect("#f2c14e", x + 13, y + 6, 6, 5);
      break;
    case "$":
      floorT(R, x, y, tx, ty);
      for (const [ox, oy, h] of [
        [2, 6, 8],
        [8, 4, 10],
        [5, 9, 6],
      ]) {
        rect("#8a6a10", x + ox, y + oy, 6, h);
        for (let i = 0; i < h; i += 2) rect("#f2c14e", x + ox, y + oy + i, 6, 1);
      }
      rect("#fff3b0", x + 9, y + 4, 2, 1);
      break;
    case "V":
      rect("#4d5966", x, y, 16, 16);
      rect("#6b7988", x, y, 16, 2);
      rect("#2f3740", x, y + 14, 16, 2);
      for (const [rx, ry] of [
        [2, 4],
        [13, 4],
        [2, 11],
        [13, 11],
      ])
        rect("#9aa8b6", x + rx, y + ry, 1, 1);
      if (tx === 7 && ty === 4) {
        rect("#c9a227", x + 6, y + 5, 8, 8);
        rect("#4d5966", x + 8, y + 7, 4, 4);
      }
      break;
    case "B":
      floorT(R, x, y, tx, ty);
      rect("#9aa8b6", x + 1, y + 3, 14, 12);
      rect("#ffffff", x + 2, y + 3, 12, 5);
      rect("#e6efee", x + 3, y + 4, 10, 3);
      rect("#2e9a92", x + 2, y + 8, 12, 6);
      rect("#1f7a73", x + 2, y + 13, 12, 1);
      break;
    case "m": {
      rect("#173f63", x, y, 16, 16);
      for (let i = 0; i < 4; i++) {
        const xx = x + Math.floor((tx * 13 + i * 7 + f * 0.3) % 20) - 2;
        rect("rgba(120,190,240,.45)", xx, y + 2 + i * 4, 5, 1);
      }
      rect(
        "rgba(255,255,255,.18)",
        x + (((f >> 2) + tx * 3) % 15),
        y + (((f >> 3) + ty * 5) % 13) + 1,
        2,
        1,
      );
      if (!R.map[ty - 1] || R.map[ty - 1][tx] !== "m") {
        rect(P.hi, x, y, 16, 2);
        rect("rgba(0,0,0,.35)", x, y + 2, 16, 2);
      }
      if (!R.map[ty + 1] || R.map[ty + 1][tx] !== "m") rect(P.hi, x, y + 14, 16, 2);
      if (R.map[ty][tx - 1] !== "m") rect(P.hi, x, y, 1, 16);
      if (R.map[ty][tx + 1] !== "m") rect(P.hi, x + 15, y, 1, 16);
      break;
    }
    case "+":
      floorT(R, x, y, tx, ty);
      rect("#c9d8d6", x + 1, y + 1, 14, 14);
      rect("#ffffff", x + 2, y + 2, 12, 12);
      rect("#b07cff", x + 7, y + 4, 2, 8);
      rect("#b07cff", x + 4, y + 7, 8, 2);
      break;
    default:
      floorT(R, x, y, tx, ty);
  }
}

function draw() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect("#000", 0, 0, W, H);
  if (S.mode === "title" || S.mode === "entry") {
    drawTitle();
    return post();
  }
  if (S.mode === "intro") {
    drawIntro();
    return post();
  }
  if (S.mode === "controls") {
    drawControls();
    return post();
  }
  if (S.mode === "win") {
    drawReport();
    return post();
  }
  if (S.mode === "vendor") {
    drawVendor();
    return post();
  }
  const R = room(),
    f = S.frame;
  g.save();
  g.beginPath();
  g.rect(0, HUD, W, PH);
  g.clip();
  if (S.trans) {
    const tr = S.trans,
      k = ease(tr.t / tr.n);
    g.drawImage(
      tr.snap,
      0,
      HUD,
      W,
      PH,
      Math.round(-tr.dx * W * k),
      HUD + Math.round(-tr.dy * PH * k),
      W,
      PH,
    );
    drawWorld(R, Math.round(tr.dx * W * (1 - k)), Math.round(tr.dy * PH * (1 - k)));
  } else
    drawWorld(
      R,
      S.shake ? Math.round((Math.random() * 2 - 1) * S.shake) : 0,
      S.shake ? Math.round((Math.random() * 2 - 1) * S.shake) : 0,
    );
  g.restore();
  drawHUD();
  drawMessage();
  if (S.lb > 0.01) {
    const bh = Math.round(22 * S.lb);
    rect("#000", 0, HUD, W, bh);
    rect("#000", 0, H - bh, W, bh);
  }
  if (S.card) drawCard();
  if (S.mode === "dialog") drawDialog();
  if (S.mode === "inv") drawInventory();
  if (S.mode === "over") drawOver();
  post();
}
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const snapC = document.createElement("canvas");
snapC.width = W;
snapC.height = H;
const snapG = snapC.getContext("2d");
snapG.imageSmoothingEnabled = false;
function takeSnap() {
  const old = g;
  g = snapG;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  try {
    drawWorld(room(), 0, 0);
  } catch (e) {
  } finally {
    g = old;
  }
  return snapC;
}
function enemyImg(e) {
  const f = S.frame;
  switch (e.type) {
    case "gob":
      return goblinH[(f >> 4) % 2];
    case "spec":
      return specterH;
    case "imp":
      return impH[(f >> 3) % 2];
    case "slime":
      return e.big ? slimeH : slimeSmallH;
    default:
      return droneH;
  }
}
function enemyPos(e) {
  const f = S.frame;
  if (e.type === "slime")
    return e.big ? [e.x - 3, e.y - 6 - (e.ht > 0 ? 2 : 0)] : [e.x - 1, e.y - 2 - (e.ht > 0 ? 1 : 0)];
  if (e.type === "spec") return [e.x - 3, e.y - 4 + Math.sin(f * 0.08 + e.ph) * 1.5];
  if (e.type === "drone") return [e.x - 4, e.y - 4 + Math.sin(f * 0.2 + e.ph)];
  return [e.x - 3, e.y - 4];
}
function drawE(img, x, y, e) {
  x = Math.round(x);
  y = Math.round(y);
  const im = e.hurt > 7 ? flashOf(img) : img;
  if (e.hurt > 0 || e.ht > 0) {
    const k = e.hurt / 12,
      sx = 1 + 0.3 * k - (e.ht > 0 ? 0.1 : 0),
      sy = 1 - 0.25 * k + (e.ht > 0 ? 0.15 : 0);
    g.save();
    g.translate(x + img.width / 2, y + img.height);
    g.scale(sx, sy);
    g.drawImage(im, -img.width / 2, -img.height);
    g.restore();
  } else g.drawImage(im, x, y);
}
function reflect(img, x, y, flip, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x + (flip ? img.width : 0), 2 * (y + img.height));
  g.scale(flip ? -1 : 1, -1);
  g.drawImage(img, 0, y);
  g.restore();
}
function drawReflections(R) {
  const f = S.frame,
    p = S.p,
    pi = playerImg(),
    px = Math.round(p.x - 3),
    py = Math.round(p.y - 6);
  if (R.theme === "hub") {
    g.save();
    g.beginPath();
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) if (R.map[ty][tx] === "m") g.rect(tx * T, ty * T + 2, 16, 14);
    g.clip();
    reflect(pi.img, px + Math.round(Math.sin(f * 0.1)), py, pi.flip, 0.5);
    if (R.npc)
      reflect(R.npc.spr, R.npc.x - 1 + Math.round(Math.sin(f * 0.1 + 1)), R.npc.y - 1, false, 0.45);
    g.restore();
  } else if (R.theme === "bank" || R.theme === "arena" || R.theme === "hosp") {
    const a = R.theme === "bank" ? 0.2 : R.theme === "hosp" ? 0.12 : 0.14;
    reflect(pi.img, px, py, pi.flip, a);
    for (const e of R.enemies)
      if (e.alive) {
        const [ex, ey] = enemyPos(e);
        reflect(enemyImg(e), Math.round(ex), Math.round(ey), false, a * 0.8);
      }
    if (R.boss && !S.boss.dead && (S.boss.active || S.mode === "cine")) {
      const b = S.boss;
      g.save();
      g.globalAlpha = 0.16;
      g.translate(b.x - 26, 2 * (b.y + 26));
      g.scale(1, -1);
      g.drawImage(b.shield ? bossSH : bossVH, 0, b.y - 26, 52, 52);
      g.restore();
    }
  }
}
// Tiles that never change are painted once per room into a cached layer; only
// animated tiles (torches, water, sky, glowing floors...) are redrawn each frame.
const ANIMATED_TILES = new Set(["t", "v", "G", "n", "m", "w", "C"]);
function tileAnimated(R, c) {
  if (ANIMATED_TILES.has(c)) return true;
  if (R.theme === "spire") return c !== "#";
  if (R.theme === "arena") return c !== "#" && c !== "b";
  return false;
}
function drawRoomTiles(R) {
  const key = R.map.map((r) => r.join("")).join("") + (R.chest && R.chest.open ? "o" : "");
  if (R._tileKey !== key) {
    R._tileKey = key;
    R._tiles = R._tiles || document.createElement("canvas");
    R._tiles.width = W;
    R._tiles.height = PH;
    const old = g;
    g = R._tiles.getContext("2d");
    g.clearRect(0, 0, W, PH);
    try {
      for (let ty = 0; ty < ROWS; ty++)
        for (let tx = 0; tx < COLS; tx++) if (!tileAnimated(R, R.map[ty][tx])) drawTile(R, R.map[ty][tx], tx, ty);
    } finally {
      g = old;
    }
    R._anim = [];
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) if (tileAnimated(R, R.map[ty][tx])) R._anim.push([tx, ty]);
  }
  g.drawImage(R._tiles, 0, 0);
  for (const [tx, ty] of R._anim) drawTile(R, R.map[ty][tx], tx, ty);
}
function drawWorld(R, ox, oy) {
  const f = S.frame,
    p = S.p;
  g.save();
  g.translate(ox, oy + HUD);
  if (S.zoom > 1.001) {
    g.translate(S.zx, S.zy);
    g.scale(S.zoom, S.zoom);
    g.translate(-S.zx, -S.zy);
  }
  drawRoomTiles(R);
  if (R.boss && S.cracks) drawCracks();
  drawReflections(R);
  if (R.queue) {
    for (let i = 0; i < 6; i++) {
      const qx = 24 + i * 36 + Math.sin(f * 0.03 + i) * 3,
        qy = 134 + (i % 2) * 10;
      g.drawImage(vendorH[i % 3], qx - 1, qy - 1 + (((f >> 4) + i) % 2));
    }
  }
  const sc = R.scroll;
  if (sc && !sc.taken) {
    const bx = sc.tx * T,
      by = sc.ty * T + Math.sin(f * 0.07) * 1.5;
    g.fillStyle = "rgba(242,193,78,.22)";
    g.beginPath();
    g.arc(bx + 8, by + 8, 9, 0, 7);
    g.fill();
    g.drawImage(scrollH, bx - 1, by - 1);
  }
  const m = R.model;
  if (m && !m.found && S.gear.lantern) {
    const mx = m.tx * T,
      my = m.ty * T + Math.sin(f * 0.08) * 2,
      r = 9 + Math.sin(f * 0.12) * 2;
    g.fillStyle = "rgba(214,58,214,.22)";
    g.beginPath();
    g.arc(mx + 8, my + 8, r + 5, 0, 7);
    g.fill();
    g.fillStyle = "rgba(214,58,214,.35)";
    g.beginPath();
    g.arc(mx + 8, my + 8, r, 0, 7);
    g.fill();
    g.drawImage(chipH, mx - 1, my - 1);
    if ((f >> 3) % 4 === 0)
      rect("#ffffff", mx + Math.floor(hash(f >> 3, 1) * 16), my + Math.floor(hash(1, f >> 3) * 16), 1, 1);
  } else if (m && !m.found && (f >> 2) % 40 === 0)
    rect("rgba(214,58,214,.6)", m.tx * T + 7, m.ty * T + 7, 2, 2);
  if (R.npc) {
    const n = R.npc;
    g.drawImage(n.spr, n.x - 1, n.y - 1 + ((f >> 5) % 2));
    const near = Math.hypot(p.x + 5 - (n.x + 8), p.y + 5 - (n.y + 8)) < 28;
    if (
      S.mode !== "cine" &&
      (near || !S.talked[n.key] || (n.key === "gate" && !S.vendorSeal && S.gear.lantern))
    ) {
      const by = n.y - 14 + Math.sin(f * 0.1) * 1.5;
      rect("#14101e", n.x + 2, by - 1, 12, 12);
      rect("#f4f1de", n.x + 3, by, 10, 10);
      rect("#f4f1de", n.x + 7, by + 10, 2, 2);
      txt(near ? "A" : "!", n.x + 5, by + 9, "#7a2232");
    }
  }
  for (const it of R.items) if (it.t > 120 || (f >> 2) % 2) g.drawImage(heartH, it.x - 4, it.y - 3);
  for (const e of R.enemies) {
    if (!e.alive) continue;
    if (e.type === "imp" && e.blink > 0 && (f >> 1) % 2) continue;
    const [ex, ey] = enemyPos(e);
    if (e.type === "spec") g.globalAlpha = 0.6 + 0.3 * Math.sin(f * 0.1 + e.ph);
    drawE(enemyImg(e), ex, ey, e);
    g.globalAlpha = 1;
    if (e.type === "imp" && e.blink > 0) txt("!", e.x + 3, e.y - 5, "#ffe066");
  }
  if (R.boss) drawBosses();
  drawPlayer();
  for (const b of S.bolts) {
    if (b.friendly) {
      rect("#b07cff", b.x - 3, b.y - 1, 6, 2);
      rect("#b07cff", b.x - 1, b.y - 3, 2, 6);
      rect("#fff", b.x - 1, b.y - 1, 2, 2);
    } else if (b.kind === "glyph") {
      rect("#1a3a14", b.x - 4, b.y - 3, 8, 6);
      txt("{", b.x - 4, b.y + 3, "#7cff8a");
    } else if (b.kind === "fork") {
      rect("#d97a2b", b.x - 2, b.y - 2, 4, 4);
      rect("#ffe066", b.x - 1, b.y - 1, 2, 2);
    } else {
      rect("#d63ad6", b.x - 3, b.y - 1, 6, 2);
      rect("#d63ad6", b.x - 1, b.y - 3, 2, 6);
      rect("#fff", b.x - 1, b.y - 1, 2, 2);
    }
  }
  for (const q of S.parts) {
    g.globalAlpha = Math.min(1, q.l / 15);
    const z = q.s || 2;
    rect(q.c, Math.round(q.x - (z > 2 ? 1 : 0)), Math.round(q.y - (z > 2 ? 1 : 0)), z, z);
  }
  g.globalAlpha = 1;
  for (const r of S.rings) {
    g.strokeStyle = `rgba(${r.c},${r.l / 12})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(r.x, r.y, r.r, 0, 7);
    g.stroke();
  }
  drawWeather(R, false);
  drawLighting(R);
  drawWeather(R, true);
  drawParallax(R);
  for (const fl of S.floats) {
    g.globalAlpha = Math.min(1, fl.l / 15);
    txt(fl.t, fl.x, fl.y, fl.c, F8, "center");
  }
  g.globalAlpha = 1;
  if (S.xray > 0) drawXray(R);
  if (S.pulse > 0) {
    const c = pc(),
      r = (24 - S.pulse) * 12;
    g.strokeStyle = `rgba(255,255,255,${S.pulse / 24})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c.x, c.y, r, 0, 7);
    g.stroke();
    g.strokeStyle = `rgba(176,124,255,${S.pulse / 24})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c.x, c.y, r * 0.8, 0, 7);
    g.stroke();
  }
  if (S.mode === "transform") drawTransform();
  g.restore();
}
function drawOver() {
  const f = S.frame,
    t = S.overT;
  rect("rgba(24,0,8,.92)", 0, 0, W, H);
  txt("DEFENSES BREACHED", 128, 24, "#ff4d6d", F8, "center");
  txt(
    (PLAYER.tag ? PLAYER.tag + "  ·  " : "") + "AI " + S.found + "/" + NASSET + "  ·  " + fmtT(S.playT),
    128,
    38,
    "#9d96bb",
    F8,
    "center",
  );
  rect("#0b0812", 16, 48, 224, 100);
  g.strokeStyle = "#f2c14e";
  g.lineWidth = 1;
  g.strokeRect(16.5, 48.5, 223, 99);
  txt(
    REMOTE ? "TEAM LEADERBOARD" : LOCAL ? "YOUR BEST RUNS" : "TOP SENTINELS",
    128,
    62,
    "#f2c14e",
    F8,
    "center",
  );
  if (!boardLive) txt("LOADING SCORES", 128, 100, "#5d5680", F8, "center");
  else if (!topList.length) {
    txt("NO SCORES YET", 128, 92, "#9d96bb", F8, "center");
    txt(LOCAL ? "FINISH A RUN TO SET ONE" : "BE THE FIRST TO FINISH", 128, 106, "#b07cff", F8, "center");
  } else
    topList.forEach((r, i) => {
      if (t < 8 + i * 6) return;
      const y = 78 + i * 14,
        mine = PLAYER.tag && r.tag === PLAYER.tag,
        col = mine ? "#c9a8ff" : i === 0 ? "#f2c14e" : "#ece8f7";
      if (mine) rect("rgba(176,124,255,.18)", 20, y - 9, 216, 12);
      txt(String(i + 1), 26, y, col);
      txt(r.tag, 40, y, col);
      if (r.won) {
        rect("#f2c14e", 164, y - 7, 11, 6);
        rect("#f2c14e", 164, y - 10, 2, 3);
        rect("#f2c14e", 168, y - 11, 3, 4);
        rect("#f2c14e", 173, y - 10, 2, 3);
        rect("#8a5a10", 165, y - 5, 9, 1);
      }
      txt(r.score.toLocaleString("en-US"), 232, y, col, F8, "right");
      if (r.hard) rect("#ff3b5c", 178, y - 6, 3, 3);
    });
  const need = topList.length ? topList[topList.length - 1].score : 0;
  if (S.pb) {
    const on = (f >> 3) % 2;
    rect(on ? "#f2c14e" : "#c9a227", 24, 153, 208, 13);
    txt("NEW PERSONAL BEST" + (S.pb.rank ? " · #" + S.pb.rank : ""), 128, 163, "#1a1206", F8, "center");
  } else
    txt(
      topList.length >= 5
        ? "BEAT " + need.toLocaleString("en-US") + " TO MAKE THE BOARD"
        : LOCAL
          ? "FINISH THE QUEST TO SAVE A SCORE"
          : "FINISH THE QUEST TO POST A SCORE",
      128,
      162,
      "#b07cff",
      F8,
      "center",
    );
  if (t > 40 && (f >> 5) % 2) txt("PRESS A TO RESPAWN", 128, 182, "#ffffff", F8, "center");
}
function drawCard() {
  const c = S.card,
    t = c.t,
    k = ease(t / 8),
    sc = 2.6 - 1.6 * k,
    a = t > 90 ? Math.max(0, 1 - (t - 90) / 30) : Math.min(1, t / 4);
  g.globalAlpha = a;
  rect("rgba(4,3,10,.88)", 0, 118, W, 40);
  rect(c.col, 0, 118, W, 2);
  rect(c.col, 0, 156, W, 2);
  g.save();
  g.translate(128, 141);
  g.scale(sc, sc);
  if ((t >> 2) % 6 === 0) txt(c.a, 2, 0, "#d63ad6", F16, "center");
  txt(c.a, 0, 0, "#ffffff", F16, "center");
  g.restore();
  if (t > 8) txt(c.b, 128, 153, c.col, F8, "center");
  if (t < 5) {
    rect("rgba(255,255,255,.6)", 0, 118, W, 40);
  }
  g.globalAlpha = 1;
}
function startCine(kind) {
  S.mode = "cine";
  S.cine = { kind, t: 0 };
  S.lbT = 1;
  S.bolts = [];
  clearMessages();
  setSong(null);
}
function hydraPose() {
  const h = S.hydra,
    alive = h.heads.filter((x) => x.alive),
    n = alive.length;
  alive.forEach((hd, i) => {
    const a = Math.PI * (0.12 + 0.76 * ((i + 0.5) / n)),
      r = 50 + (hd.gen ? 8 : 0),
      tx = h.x + Math.cos(a) * r * 1.25,
      ty = h.y + 18 + Math.sin(a) * r + Math.sin(S.frame * 0.05 + i) * 5;
    hd.x += (tx - hd.x) * 0.06;
    hd.y += (ty - hd.y) * 0.06;
  });
}
function mkCracks(x, y) {
  const L = [];
  for (let i = 0; i < 9; i++) {
    let a = (i / 9) * Math.PI * 2 + Math.random() * 0.4,
      px = x,
      py = y;
    const pts = [[px, py]];
    for (let k = 0; k < 7; k++) {
      a += (Math.random() - 0.5) * 0.8;
      px += Math.cos(a) * 9;
      py += Math.sin(a) * 7;
      pts.push([px, py]);
    }
    L.push(pts);
  }
  return L;
}
function drawCracks() {
  const cn = S.cine,
    prog = cn && cn.kind === "hydra" ? Math.min(1, cn.t / 70) : 1;
  g.lineWidth = 2;
  for (const pts of S.cracks) {
    const n = Math.max(1, Math.floor((pts.length - 1) * prog));
    g.strokeStyle = "#05020a";
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.strokeStyle =
      cn && cn.kind === "hydra" && cn.t < 70
        ? `rgba(110,255,150,${0.5 + 0.4 * Math.sin(S.frame * 0.5)})`
        : "rgba(56,161,105,.35)";
    g.lineWidth = 1;
    g.stroke();
    g.lineWidth = 2;
  }
}
function updateCine() {
  const c = S.cine;
  c.t++;
  const t = c.t;
  if (c.kind === "rogue") {
    const b = S.boss;
    S.zx = b.x;
    S.zy = b.y;
    S.zoom = t < 20 ? 1 : t < 95 ? 1 + 0.35 * ease((t - 20) / 40) : 1.35 - 0.35 * ease((t - 95) / 35);
    if (t === 25) sfx(60, 1.4, "sawtooth", 40, 0.08);
    if (t > 25 && t < 85 && t % 4 === 0) {
      shake(2);
      burst(b.x + (Math.random() - 0.5) * 44, b.y + 24, ["#7a2bd6", "#d63ad6"], 3, 1);
    }
    if (t === 85) {
      S.card = { a: "THE ROGUE MODEL", b: "UNREGISTERED · UNMONITORED", t: 0, col: "#ff4d6d" };
      shake(8);
      S.ab = 1.6;
      sfx(70, 0.5, "square", -30, 0.1);
      sfx(900, 0.3, "sawtooth", -700, 0.05);
    }
    if (t >= 165) {
      S.mode = "play";
      S.cine = null;
      S.zoom = 1;
      bossIntro();
    }
  } else {
    const h = S.hydra;
    S.zx = h.x;
    S.zy = h.y + 24;
    if (t === 1) {
      S.cracks = mkCracks(h.x, h.y + 16);
      for (const hd of h.heads) {
        hd.x = h.x;
        hd.y = h.y + 16;
      }
    }
    S.zoom = t < 70 ? 1 + 0.18 * ease(t / 70) : t < 120 ? 1.18 : 1.18 - 0.18 * ease((t - 120) / 30);
    if (t < 70 && t % 6 === 0) {
      shake(1 + t / 25);
      sfx(50 + t, 0.15, "sawtooth", -10, 0.05);
    }
    if (t === 70) {
      shake(11);
      S.ab = 2;
      burst(h.x, h.y + 16, ["#38a169", "#5b3a1e", "#9aa8b6", "#ffe066"], 70, 3.6);
      sfx(40, 1.6, "sawtooth", -10, 0.12);
    }
    if (t > 70) hydraPose();
    if (t === 100) {
      S.card = { a: "SUPPLY CHAIN HYDRA", b: "SEVER ONE · TWO GROW BACK", t: 0, col: "#6cc04a" };
      shake(6);
      sfx(70, 0.5, "square", -30, 0.1);
    }
    if (t >= 175) {
      S.mode = "play";
      S.cine = null;
      S.zoom = 1;
      hydraIntro();
    }
  }
}
function updateAmbient(R) {
  const f = S.frame,
    A = S.amb;
  if (A.length < 240)
    switch (R.theme) {
      case "hub":
        for (let i = 0; i < 3; i++)
          A.push({
            k: "rain",
            x: Math.random() * (W + 40) - 30,
            y: -6,
            vx: 0.7,
            vy: 4.2,
            l: Math.floor(8 + Math.random() * 36),
          });
        if (!calm && Math.random() < 0.0015) {
          S.flash = 8;
          setTimeout(() => sfx(38, 1.5, "sawtooth", -8, 0.07), 350);
        }
        break;
      case "cata":
        if (f % 18 === 0)
          A.push({ k: "drip", x: 16 + Math.random() * (W - 32), y: 16, vx: 0, vy: 0.2, l: 90 });
        if (f % 8 === 0)
          A.push({
            k: "mote",
            x: Math.random() * W,
            y: PH - 8,
            vx: 0,
            vy: -0.25,
            l: 200,
            ph: Math.random() * 6,
            c: "124,255,138",
          });
        break;
      case "spire":
        if (f % 3 === 0)
          A.push({
            k: "glyph",
            x: Math.floor(Math.random() * 32) * 8 + 2,
            y: -8,
            vx: 0,
            vy: 1.1 + Math.random() * 1.2,
            l: 170,
            sd: Math.floor(Math.random() * 9999),
          });
        break;
      case "arena":
        if (f % 3 === 0)
          A.push({
            k: "ember",
            x: Math.random() * W,
            y: PH + 2,
            vx: 0,
            vy: -0.45 - Math.random() * 0.7,
            l: 220,
            ph: Math.random() * 6,
            c: Math.random() < 0.5 ? "255,120,40" : "255,50,80",
          });
        break;
      case "cloud":
        if (f % 4 === 0)
          A.push({
            k: "wind",
            x: -30,
            y: Math.random() * PH,
            vx: 3 + Math.random() * 2,
            vy: 0,
            l: 130,
            len: 10 + Math.random() * 20,
          });
        break;
      case "bazaar":
      case "hosp":
        if (f % 12 === 0)
          A.push({
            k: "mote",
            x: Math.random() * W,
            y: Math.random() * PH,
            vx: 0.1,
            vy: -0.12,
            l: 180,
            ph: Math.random() * 6,
            c: R.theme === "hosp" ? "190,255,245" : "255,220,140",
          });
        break;
      case "gate":
        if (f % 20 === 0 && A.length < 16)
          A.push({
            k: "fly",
            x: Math.random() * W,
            y: Math.random() * PH,
            vx: 0,
            vy: 0,
            l: 420,
            ph: Math.random() * 6,
            c: "200,255,120",
          });
        break;
      case "bank":
        if (f % 22 === 0)
          A.push({
            k: "glint",
            x: Math.random() * W,
            y: Math.random() * PH,
            vx: 0,
            vy: 0,
            l: 24,
            c: "255,230,140",
          });
        break;
    }
  for (let i = 0; i < A.length; i++) {
    const q = A[i];
    q.l--;
    if (q.k === "mote" || q.k === "ember" || q.k === "fly") {
      q.ph += 0.05;
      q.x += Math.sin(q.ph) * 0.3 + q.vx;
      q.y += q.vy;
      if (q.k === "fly") {
        q.x += Math.cos(q.ph * 0.7) * 0.5;
        q.y += Math.sin(q.ph * 1.3) * 0.4;
      }
    } else if (q.k === "drip") {
      q.vy += 0.12;
      q.y += q.vy;
      if (q.y > PH - 10 || (q.y > 24 && solidAt(q.x, q.y, false))) {
        q.l = 0;
        A.push({ k: "spl", x: q.x, y: q.y, l: 10 });
      }
    } else if (q.k !== "spl" && q.k !== "glint") {
      q.x += q.vx;
      q.y += q.vy;
    }
    if (q.k === "rain" && q.l === 0) A.push({ k: "spl", x: q.x, y: q.y, l: 8 });
  }
  S.amb = A.filter((q) => q.l > 0 && q.y < PH + 10 && q.x < W + 40);
}
function drawWeather(R, glowPass) {
  const f = S.frame;
  if (!glowPass) {
    for (const q of S.amb) {
      switch (q.k) {
        case "rain":
          g.fillStyle = "rgba(170,190,230,.45)";
          g.fillRect(q.x, q.y, 1, 5);
          break;
        case "spl":
          g.fillStyle = `rgba(200,215,240,${q.l / 10})`;
          g.fillRect(q.x - 2, q.y, 1, 1);
          g.fillRect(q.x + 2, q.y, 1, 1);
          g.fillRect(q.x, q.y - 1, 1, 1);
          break;
        case "drip":
          g.fillStyle = "rgba(150,230,170,.8)";
          g.fillRect(q.x, q.y, 1, 2);
          break;
        case "wind":
          g.fillStyle = "rgba(255,255,255,.35)";
          g.fillRect(q.x, q.y, q.len, 1);
          break;
      }
    }
    if (S.flash > 0) {
      g.fillStyle = `rgba(220,230,255,${S.flash / 12})`;
      g.fillRect(0, 0, W, PH);
    }
    return;
  }
  g.globalCompositeOperation = "lighter";
  for (const q of S.amb) {
    switch (q.k) {
      case "mote":
      case "ember":
      case "fly": {
        const a = Math.min(1, q.l / 40) * (q.k === "fly" ? 0.5 + 0.5 * Math.sin(q.ph * 3) : 1);
        g.fillStyle = `rgba(${q.c},${0.22 * a})`;
        g.fillRect(q.x - 2, q.y - 2, 5, 5);
        g.fillStyle = `rgba(${q.c},${0.9 * a})`;
        g.fillRect(q.x, q.y, q.k === "ember" ? 1 : 2, 2);
        break;
      }
      case "glint": {
        const a = Math.sin((q.l / 24) * Math.PI);
        g.fillStyle = `rgba(${q.c},${a})`;
        g.fillRect(q.x - 2, q.y, 5, 1);
        g.fillRect(q.x, q.y - 2, 1, 5);
        break;
      }
      case "glyph": {
        for (let j = 0; j < 4; j++) {
          const a = j === 0 ? 0.9 : 0.5 - j * 0.12,
            yy = Math.round(q.y - j * 7);
          if (yy < 0) continue;
          g.fillStyle = j === 0 ? `rgba(230,215,255,${a})` : `rgba(150,100,255,${a})`;
          const sd = (q.sd + j * 37 + (f >> 3)) % 997;
          for (let b = 0; b < 15; b++)
            if ((sd >> b % 10) & 1 && (b * 7 + sd) % 3)
              g.fillRect(q.x + (b % 3), yy + Math.floor(b / 3), 1, 1);
        }
        break;
      }
    }
  }
  g.globalCompositeOperation = "source-over";
}
function drawParallax(R) {
  if (R.theme !== "cata" && R.theme !== "arena") return;
  const f = S.frame,
    p = S.p,
    col = R.theme === "cata" ? "120,170,130" : "140,30,50";
  for (let i = 0; i < 3; i++) {
    const sp = (i + 1) * 0.12,
      span = W * 1.5,
      off = ((((f * sp * (i % 2 ? 1 : -1) - p.x * sp * 0.8) % span) + span) % span) - W * 0.25,
      gy = 40 + i * 48 + Math.sin(f * 0.01 + i) * 6;
    const gr = g.createLinearGradient(0, gy - 14, 0, gy + 14);
    gr.addColorStop(0, `rgba(${col},0)`);
    gr.addColorStop(0.5, `rgba(${col},.08)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(off, gy - 14, W * 0.9, 28);
    g.fillRect(off - span, gy - 14, W * 0.9, 28);
  }
}
function drawBosses() {
  const f = S.frame,
    b = S.boss,
    h = S.hydra,
    cn = S.cine;
  if (!b.dead) {
    let oy = 0,
      al = 1;
    if (cn && cn.kind === "rogue") {
      oy = cn.t < 25 ? 46 : Math.max(0, 46 - (cn.t - 25) * 1.1);
      al = Math.min(1, Math.max(0, (cn.t - 12) / 30));
    }
    if (b.active && b.shield) {
      g.strokeStyle = `rgba(176,124,255,${0.5 + 0.3 * Math.sin(f * 0.2)})`;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f * 0.03,
          xx = b.x + Math.cos(a) * 32,
          yy = b.y + Math.sin(a) * 32;
        i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      }
      g.stroke();
    }
    if (b.active && !b.shield) {
      g.fillStyle = `rgba(255,59,59,${0.2 + 0.14 * Math.sin(f * 0.4)})`;
      g.beginPath();
      g.arc(b.x, b.y, 32, 0, 7);
      g.fill();
    }
    if (b.phase === 3 && b.active) {
      g.fillStyle = "rgba(255,59,92,.12)";
      g.beginPath();
      g.arc(b.x, b.y, 40 + Math.sin(f * 0.3) * 3, 0, 7);
      g.fill();
    }
    const img = !b.active
        ? bossSH
        : b.phase === 3
          ? b.shield
            ? bossEH
            : bossVH
          : b.shield
            ? bossSH
            : bossVH,
      jit = b.phase === 3 && b.active ? Math.random() * 2 - 1 : 0;
    g.globalAlpha = al;
    const bx = Math.round(b.x - 26 + jit),
      by = Math.round(b.y - 26 + oy + Math.sin(f * 0.06) * 2);
    if (oy > 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, W, b.y + 26);
      g.clip();
    }
    g.drawImage(b.hurt > 8 ? flashOf(img) : img, bx, by, 52, 52);
    if (oy > 0) g.restore();
    g.globalAlpha = 1;
    if (b.active) bar("ROGUE MODEL", b.hp / b.max, b.shield ? "#7a2bd6" : "#ff3b3b", [1 / 3, 2 / 3]);
  } else if (S.mode === "bossdeath") {
    if ((f >> 1) % 2) g.drawImage(bossEH, b.x - 26 + (Math.random() * 4 - 2), b.y - 26, 52, 52);
  }
  if (b.dead && !h.dead && (h.active || S.mode === "dialog" || S.mode === "cine" || S.hydraDelay > 0)) {
    const rise = cn && cn.kind === "hydra" ? (cn.t < 70 ? 80 : Math.max(0, 80 - (cn.t - 70) * 2.6)) : 0;
    if (rise >= 80) return;
    const open = hydraOpen(),
      alive = h.heads.filter((x) => x.alive);
    if (rise > 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, W, h.y + 22);
      g.clip();
      g.translate(0, rise);
    }
    for (const hd of alive) {
      g.strokeStyle = hd.gen ? "#4a2410" : "#0e3320";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(h.x, h.y + 6);
      g.quadraticCurveTo((h.x + hd.x) / 2, hd.y - 14, hd.x, hd.y);
      g.stroke();
      g.strokeStyle = hd.gen ? "#d97a2b" : "#38a169";
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = hd.gen ? "#ffb26b" : "#7fdc9f";
      g.lineWidth = 1;
      g.stroke();
    }
    for (const pd of h.pending) {
      g.fillStyle = `rgba(217,122,43,${0.3 + 0.3 * Math.sin(f * 0.3)})`;
      g.beginPath();
      g.arc(pd.x, pd.y, 5 + ((150 - pd.t) / 150) * 6, 0, 7);
      g.fill();
    }
    g.fillStyle = "#0a0612";
    g.beginPath();
    g.ellipse(h.x, h.y + 8, 27, 17, 0, 0, 7);
    g.fill();
    g.fillStyle = "#14402a";
    g.beginPath();
    g.ellipse(h.x, h.y + 6, 25, 15, 0, 0, 7);
    g.fill();
    g.fillStyle = "#1f5c3a";
    g.beginPath();
    g.ellipse(h.x, h.y + 3, 21, 11, 0, 0, 7);
    g.fill();
    g.fillStyle = "#2e7d4f";
    g.beginPath();
    g.ellipse(h.x - 4, h.y, 12, 5, 0, 0, 7);
    g.fill();
    for (let i = -2; i <= 2; i++) {
      rect("#38a169", h.x + i * 7 - 1, h.y - 2 + Math.abs(i) * 2, 3, 2);
      rect("#0e3320", h.x + i * 7 - 1, h.y + Math.abs(i) * 2, 3, 1);
    }
    const gemCol = open ? (h.hurt > 8 ? "#ffffff" : "#ff3b3b") : "#b07cff";
    g.fillStyle = open
      ? `rgba(255,59,59,${0.25 + 0.15 * Math.sin(f * 0.4)})`
      : `rgba(176,124,255,${0.2 + 0.1 * Math.sin(f * 0.2)})`;
    g.beginPath();
    g.arc(h.x, h.y + 6, 11, 0, 7);
    g.fill();
    rect("#05020a", h.x - 5, h.y + 1, 10, 10);
    rect(gemCol, h.x - 4, h.y + 2, 8, 8);
    rect("#ffffff", h.x - 3, h.y + 3, 2, 2);
    for (const hd of alive) {
      const img = hd.gen ? hHeadF : hHead;
      g.drawImage(hd.hurt > 7 ? flashOf(img) : img, Math.round(hd.x - 9), Math.round(hd.y - 9));
    }
    if (rise > 0) g.restore();
    if (!rise)
      for (const hd of alive) {
        g.globalAlpha = 0.85;
        txt(hd.label, hd.x, hd.y - 12, hd.gen ? "#ffb26b" : "#9ff0b8", F8, "center");
        g.globalAlpha = 1;
      }
    if (h.active) bar("SUPPLY CHAIN HYDRA", h.core / h.coreMax, open ? "#ff3b3b" : "#38a169", []);
  } else if (S.mode === "hydradeath") {
    if ((f >> 1) % 2) {
      g.fillStyle = "#38a169";
      g.beginPath();
      g.ellipse(h.x, h.y + 6, 25, 15, 0, 0, 7);
      g.fill();
    }
  }
}
const LC = document.createElement("canvas");
LC.width = W;
LC.height = PH;
const lg = LC.getContext("2d");
const AMB = {
  hub: 0.4,
  cata: 0.94,
  cloud: 0,
  bazaar: 0.24,
  spire: 0.62,
  arena: 0.64,
  gate: 0.3,
  bank: 0.32,
  hosp: 0.1,
};
// Lights are drawn from pre-rendered soft circles instead of building a new
// gradient for every light on every frame (the main cost on slower phones).
const softCircles = new Map();
function softCircle(rgb) {
  let c = softCircles.get(rgb);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d"),
      gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    softCircles.set(rgb, c);
  }
  return c;
}
function lightHole(x, y, r, a) {
  lg.globalAlpha = Math.min(1, a);
  lg.drawImage(softCircle("0,0,0"), x - r, y - r, r * 2, r * 2);
  lg.globalAlpha = 1;
}
function glow(x, y, r, rgb, a) {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * Math.min(1, a);
  g.drawImage(softCircle(rgb), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = prev;
}
function drawLighting(R) {
  const amb = AMB[R.theme] || 0,
    f = S.frame,
    p = S.p,
    c = pc(),
    lan = S.gear.lantern;
  const lights = [];
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      const ch = R.map[ty][tx];
      if (ch === "t")
        lights.push([tx * T + 8, ty * T + 6, 46, R.theme === "cata" ? "80,255,120" : "255,150,50"]);
      else if (ch === "n") lights.push([tx * T + 8, ty * T + 4, 36, "160,110,255"]);
      else if (ch === "p" && R.theme === "arena") lights.push([tx * T + 8, ty * T + 7, 28, "255,40,80"]);
      else if (ch === "+") lights.push([tx * T + 8, ty * T + 8, 22, "176,124,255"]);
    }
  if (amb > 0) {
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, W, PH);
    lg.fillStyle =
      R.theme === "arena"
        ? `rgba(16,0,6,${amb})`
        : R.theme === "spire"
          ? `rgba(6,2,18,${amb})`
          : R.theme === "cata"
            ? `rgba(2,6,3,${amb})`
            : `rgba(4,4,12,${amb})`;
    lg.fillRect(0, 0, W, PH);
    lg.globalCompositeOperation = "destination-out";
    for (const [x, y, r] of lights)
      lightHole(x, y, r + Math.sin(f * 0.3 + x) * 2 + Math.random() * 1.5, 0.95);
    lightHole(c.x, c.y, lan ? 34 : 28, 0.92);
    if (lan) {
      const ang = { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 }[p.face],
        len = R.theme === "cata" ? 100 : 86,
        sp = 0.55 + Math.sin(f * 0.2) * 0.03;
      const gr = lg.createRadialGradient(c.x, c.y, 4, c.x, c.y, len);
      gr.addColorStop(0, "rgba(0,0,0,.95)");
      gr.addColorStop(0.7, "rgba(0,0,0,.6)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      lg.fillStyle = gr;
      lg.beginPath();
      lg.moveTo(c.x, c.y);
      lg.arc(c.x, c.y, len, ang - sp, ang + sp);
      lg.closePath();
      lg.fill();
    }
    if (S.cranium) lightHole(c.x, c.y, 46, 0.55);
    if (R.model && !R.model.found && lan) lightHole(R.model.tx * T + 8, R.model.ty * T + 8, 30, 0.8);
    if (R.scroll && !R.scroll.taken) lightHole(R.scroll.tx * T + 8, R.scroll.ty * T + 8, 20, 0.6);
    if (R.npc) lightHole(R.npc.x + 8, R.npc.y + 8, 28, 0.65);
    for (const b of S.bolts) lightHole(b.x, b.y, 12, 0.7);
    for (const e of R.enemies)
      if (e.alive && (e.type === "spec" || e.type === "drone" || e.type === "imp"))
        lightHole(e.x + 6, e.y + 6, 16, 0.5);
    if (R.boss) {
      const b = S.boss,
        h = S.hydra;
      if (!b.dead && b.active) lightHole(b.x, b.y, 74, 0.9);
      if (b.dead && !h.dead) lightHole(h.x, h.y + 6, 90, 0.85);
    }
    for (let i = 0; i < S.parts.length && i < 80; i += 2) {
      const q = S.parts[i];
      if (q.l > 8) lightHole(q.x, q.y, 7, 0.45);
    }
    if (S.pulse > 0) lightHole(c.x, c.y, (24 - S.pulse) * 12, 0.8);
    g.drawImage(LC, 0, 0);
  }
  g.globalCompositeOperation = "lighter";
  for (const [x, y, r, rgb] of lights)
    glow(x, y, r * 0.65 + Math.sin(f * 0.25 + y) * 2, rgb, amb > 0 ? 0.2 : 0.08);
  if (R.boss) {
    const b = S.boss,
      h = S.hydra;
    if (b.active && !b.dead)
      glow(
        b.x,
        b.y,
        84,
        b.shield ? "120,60,255" : "255,40,60",
        0.24 + (b.phase === 3 ? 0.08 * Math.sin(f * 0.4) : 0),
      );
    if (h.active && !h.dead) glow(h.x, h.y + 6, 90, hydraOpen() ? "255,40,60" : "40,200,120", 0.2);
  }
  if (lan && amb > 0.3) glow(c.x, c.y, 26, "255,200,90", 0.1);
  if (S.cranium) glow(c.x, c.y, 22, "176,124,255", 0.14 + 0.05 * Math.sin(f * 0.15));
  g.globalCompositeOperation = "source-over";
}
function drawXray(R) {
  const f = S.frame,
    t = S.xray;
  g.fillStyle = "rgba(2,8,18,.86)";
  g.fillRect(0, 0, W, PH);
  g.strokeStyle = "rgba(176,124,255,.08)";
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= W; x += 16) {
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, PH);
  }
  for (let y = 0; y <= PH; y += 16) {
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
  }
  g.stroke();
  g.strokeStyle = "rgba(176,124,255,.55)";
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++)
      if (SOLID.has(R.map[ty][tx])) {
        g.strokeRect(tx * T + 1.5, ty * T + 1.5, 13, 13);
        if ((tx + ty) % 3 === 0) {
          g.beginPath();
          g.moveTo(tx * T + 1.5, ty * T + 1.5);
          g.lineTo(tx * T + 14.5, ty * T + 14.5);
          g.stroke();
        }
      }
  g.strokeStyle = "#ff3b5c";
  g.lineWidth = 1;
  for (const e of R.enemies) {
    if (!e.alive) continue;
    g.globalAlpha = 0.85;
    g.strokeRect(e.x - 1.5, e.y - 1.5, e.w + 3, e.h + 3);
    g.fillStyle = "rgba(255,59,92,.3)";
    g.fillRect(e.x, e.y, e.w, e.h);
    g.globalAlpha = 1;
    txt(XLBL[e.type], e.x + e.w / 2, e.y - 4, "#ff4d6d", F8, "center");
  }
  for (const b of S.bolts) rect(b.friendly ? "#b07cff" : "#ff3b5c", b.x - 2, b.y - 2, 4, 4);
  if (R.boss) {
    const b = S.boss,
      h = S.hydra;
    const tgt = (x, y, r, l) => {
      g.strokeStyle = "#ff3b5c";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, r + Math.sin(f * 0.3) * 2, 0, 7);
      g.stroke();
      g.beginPath();
      g.moveTo(x - r - 6, y);
      g.lineTo(x + r + 6, y);
      g.moveTo(x, y - r - 6);
      g.lineTo(x, y + r + 6);
      g.stroke();
      txt(l, x, y - r - 8, "#ff4d6d", F8, "center");
    };
    if (b.active && !b.dead) tgt(b.x, b.y, 20, "VULN EXPOSED");
    if (h.active && !h.dead) {
      for (const hd of h.heads) if (hd.alive) tgt(hd.x, hd.y, 9, hd.label);
      tgt(h.x, h.y + 6, 16, "CORE");
    }
  }
  drawPlayer();
  const sy = (f * 3) % PH;
  g.fillStyle = "rgba(176,124,255,.18)";
  g.fillRect(0, sy - 10, W, 10);
  rect("#b07cff", 0, sy, W, 2);
  rect("rgba(2,8,18,.9)", 4, 4, 146, 15);
  txt("AGENTSENSOR", 8, 15, "#b07cff");
  rect("#2a1450", 100, 9, 46, 5);
  rect("#b07cff", 100, 9, (46 * t) / 180, 5);
}
function drawTransform() {
  const t = S.tf,
    c = pc(),
    pr = Math.min(1, t / 90);
  g.fillStyle = `rgba(4,3,10,${Math.min(0.8, t / 40)})`;
  g.fillRect(0, 0, W, PH);
  g.globalCompositeOperation = "lighter";
  glow(c.x, c.y, 30 + pr * 40, "176,124,255", 0.25 + pr * 0.35);
  glow(c.x, c.y, 18, "214,58,214", 0.3 * pr);
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(176,124,255,${0.12 + 0.25 * pr})`;
  g.fillRect(c.x - 4 - pr * 7, 0, 8 + pr * 14, c.y);
  for (const q of S.parts) {
    g.globalAlpha = Math.min(1, q.l / 15);
    rect(q.c, Math.round(q.x), Math.round(q.y), 2, 2);
  }
  g.globalAlpha = 1;
  const lift = t < 90 ? -pr * 6 : -6 + Math.min(6, (t - 90) * 0.2);
  g.save();
  g.translate(0, lift);
  drawPlayer();
  g.restore();
  if (!calm && t >= 86 && t < 100) {
    g.fillStyle = `rgba(255,255,255,${1 - (t - 86) / 14})`;
    g.fillRect(0, -HUD, W, H);
  }
  if (t > 100) {
    g.globalAlpha = Math.min(1, (t - 100) / 15);
    rect("rgba(4,3,10,.85)", 0, 28, W, 46);
    rect("#b07cff", 0, 28, W, 2);
    rect("#d63ad6", 0, 72, W, 2);
    if ((t >> 2) % 7 === 0) txt("CRANIUM MODE", 131, 52, "#d63ad6", F16, "center");
    txt("CRANIUM MODE", 128, 52, "#ffffff", F16, "center");
    txt("SKULL HELM ONLINE", 128, 66, "#b07cff", F8, "center");
    g.globalAlpha = 1;
  }
}
function bar(name, frac, col, ticks) {
  rect("#000", 48, PH - 12, 160, 7);
  rect("#2a0a12", 49, PH - 11, 158, 5);
  rect(col, 49, PH - 11, 158 * Math.max(0, frac), 5);
  for (const q of ticks) rect("#000", 49 + 158 * q, PH - 11, 1, 5);
  txt(name, 128, PH - 15, "#e8e0ff", F8, "center");
}
function playerImg() {
  const p = S.p,
    set = S.cranium ? PS.skull : PS.knight,
    fr = p.moving && p.atk <= 0 ? (p.step >> 3) % 4 : 0;
  if (p.face === "up") return { img: set.up[fr], flip: false };
  if (p.face === "down") return { img: set.down[fr], flip: false };
  return { img: set.side[fr], flip: p.face === "left" };
}
function drawPlayer() {
  const p = S.p,
    f = S.frame,
    c = pc();
  if (p.shield > 0) {
    const k = p.shield / 40;
    g.strokeStyle = `rgba(127,214,255,${0.4 + k * 0.5})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c.x, c.y, 15, 0, 7);
    g.stroke();
    g.fillStyle = `rgba(46,122,163,${0.15 + k * 0.15})`;
    g.fill();
  }
  if (S.cranium && !(p.inv > 0 && (f >> 2) % 2)) {
    g.strokeStyle = `rgba(176,124,255,${0.35 + 0.2 * Math.sin(f * 0.15)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c.x, c.y - 1, 11, 0, 7);
    g.stroke();
  }
  if (p.charge >= CH()) {
    g.fillStyle = `rgba(176,124,255,${0.18 + 0.12 * Math.sin(f * 0.5)})`;
    g.beginPath();
    g.arc(c.x, c.y, 13, 0, 7);
    g.fill();
  }
  if (p.spin > 0) {
    const a = (((p.spinDmg === 1 ? 18 : 22) - p.spin) / (p.spinDmg === 1 ? 18 : 22)) * Math.PI * 4;
    g.fillStyle = "rgba(176,124,255,.25)";
    g.beginPath();
    g.arc(c.x, c.y, 22, a, a + 2.4);
    g.arc(c.x, c.y, 10, a + 2.4, a, true);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(191,247,239,.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c.x, c.y, 21, a + 1.2, a + 2.4);
    g.stroke();
    g.save();
    g.translate(c.x, c.y);
    g.rotate(a + 2.4);
    g.fillStyle = "#e6d6ff";
    g.fillRect(6, -1, 15, 3);
    g.fillStyle = "#ffffff";
    g.fillRect(6, -1, 15, 1);
    g.fillStyle = "#c9a227";
    g.fillRect(4, -3, 2, 7);
    g.restore();
  }
  const blink = p.inv > 0 && p.inv <= 60 && (f >> 2) % 2;
  g.globalCompositeOperation = "lighter";
  glow(
    c.x,
    c.y - 1,
    S.cranium ? 22 : 17,
    S.cranium ? "200,140,255" : "150,90,255",
    (S.cranium ? 0.34 : 0.26) + 0.07 * Math.sin(f * 0.12),
  );
  g.globalCompositeOperation = "source-over";
  if (!blink) {
    const { img, flip } = playerImg(),
      sx = Math.round(p.x - 3),
      sy = Math.round(p.y - 6),
      im = p.inv > 60 ? flashOf(img) : img;
    rect("rgba(0,0,0,.25)", sx + 4, sy + 15, 8, 2);
    if (flip) {
      g.save();
      g.translate(sx + 16, sy);
      g.scale(-1, 1);
      g.drawImage(im, 0, 0);
      g.restore();
    } else g.drawImage(im, sx, sy);
    if (S.cranium && p.face !== "up" && (f >> 3) % 4 === 0)
      rect("#ffffff", sx + (p.face === "left" ? 6 : p.face === "right" ? 10 : 8), sy + 4, 1, 1);
    if (p.charge > 10 && p.charge < CH() && (f >> 1) % 2) rect("#b07cff", sx + 7, sy - 3, 2, 2);
  }
  if (p.atk > 4) {
    const a0 = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.face],
      k = Math.min(1, (14 - p.atk) / 9),
      ang = a0 - 1.15 + 2.3 * ease(k),
      bl = S.gear.blade;
    g.fillStyle = bl ? "rgba(176,124,255,.35)" : "rgba(255,255,255,.28)";
    g.beginPath();
    g.arc(c.x, c.y, 19, a0 - 1.15, ang);
    g.arc(c.x, c.y, 8, ang, a0 - 1.15, true);
    g.closePath();
    g.fill();
    g.strokeStyle = bl ? "rgba(191,247,239,.95)" : "rgba(255,255,255,.85)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c.x, c.y, 19, Math.max(a0 - 1.15, ang - 0.9), ang);
    g.stroke();
    g.save();
    g.translate(c.x, c.y);
    g.rotate(ang);
    g.fillStyle = "#14101e";
    g.fillRect(4, -2, 16, 5);
    g.fillStyle = bl ? "#e6d6ff" : "#dfe6f2";
    g.fillRect(5, -1, 14, 3);
    g.fillStyle = "#ffffff";
    g.fillRect(5, -1, 14, 1);
    g.fillStyle = "#c9a227";
    g.fillRect(3, -3, 2, 7);
    g.fillStyle = "#7a5c10";
    g.fillRect(1, -1, 2, 3);
    g.restore();
  }
}
function drawHUD() {
  const p = S.p;
  rect("#08060f", 0, 0, W, HUD);
  rect("#2b2542", 0, HUD - 1, W, 1);
  for (let i = 0; i < p.max; i++) g.drawImage(i < p.hp ? heart : heartE, 3 + i * 7, 5);
  g.drawImage(chipS, 86, 4);
  txt(S.found + "/" + NASSET, 96, 12, S.found === NASSET ? "#b07cff" : "#ece8f7");
  g.drawImage(scrollS, 124, 4);
  txt(S.scrolls + "/" + NSCROLL, 134, 12, S.scrolls === NSCROLL ? "#f2c14e" : "#ece8f7");
  if (S.gear.lantern) g.drawImage(lanternI, 164, 4);
  if (S.gear.blade) g.drawImage(bladeI, 172, 4);
  if (S.gear.shield) {
    g.globalAlpha = p.scd > 0 ? 0.4 : 1;
    g.drawImage(shieldI, 181, 4);
    g.globalAlpha = 1;
  }
  txt(fmtT(S.playT), 253, 12, S.hard ? "#ff4d6d" : "#9d96bb", F8, "right");
  if (S.cranium) {
    const full = S.xr >= 100;
    rect("#2a1450", 0, HUD - 2, W, 2);
    rect(
      full ? ((S.frame >> 3) % 2 ? "#ffffff" : "#b07cff") : "#7b3fe4",
      0,
      HUD - 2,
      W * (S.xray > 0 ? S.xray / 180 : S.xr / 100),
      2,
    );
    if (full) txt("C", 196, 12, "#b07cff");
  }
}
function drawDialog() {
  const d = S.dialog,
    L = d.lines[d.i],
    y = H - 62;
  rect("rgba(6,4,12,.96)", 5, y, 246, 56);
  g.strokeStyle = /ROGUE|HYDRA/.test(L.who) ? "#ff3b5c" : "#f2c14e";
  g.lineWidth = 2;
  g.strokeRect(6, y + 1, 244, 54);
  const col =
    {
      "ROGUE MODEL": "#ff4d6d",
      "HIGH CISO": "#b07cff",
      "VENDOR RISK LEAD": "#f2c14e",
      "ARENA BLADE": "#e6d6ff",
      GATEKEEPER: "#7fd6ff",
      "SUPPLY CHAIN HYDRA": "#6cc04a",
    }[L.who] || "#ece8f7";
  txt(L.who, 13, y + 13, col);
  const shown = Math.floor(d.c),
    lines = wrap(L.t, 230);
  let used = 0;
  lines.forEach((l, i) => {
    const part = l.slice(0, Math.max(0, shown - used));
    used += l.length + 1;
    txt(part, 13, y + 26 + i * 10, "#ece8f7");
  });
  if (d.c >= L.t.length && (S.frame >> 4) % 2) txt("▼", 239, y + 51, "#f2c14e");
}
function drawInventory() {
  rect("rgba(4,3,10,.95)", 0, 0, W, H);
  rect("#b07cff", 8, 8, W - 16, 1);
  rect("#b07cff", 8, H - 9, W - 16, 1);
  txt("AI INVENTORY", 14, 22, "#b07cff");
  txt("STATUS", 242, 22, "#9d96bb", F8, "right");
  ASSET_ORDER.forEach((k, i) => {
    const m = S.rooms[k].model,
      y = 38 + i * 12;
    g.drawImage(m.found ? chipG : chipS, 14, y - 8);
    if (m.found) {
      txt(m.src, 28, y, "#ece8f7");
      txt("GOVERNED", 242, y, "#b07cff", F8, "right");
    } else {
      txt("???", 28, y, "#5d5680");
      txt("UNKNOWN", 242, y, "#ff4d6d", F8, "right");
    }
  });
  rect("#2b2542", 14, 114, W - 28, 1);
  txt("FRAMEWORKS " + S.scrolls + "/" + NSCROLL, 14, 128, "#f2c14e");
  SCROLL_ORDER.forEach((k, i) => {
    const s = S.rooms[k].scroll;
    g.globalAlpha = s.taken ? 1 : 0.25;
    g.drawImage(scrollH, 13 + i * 18, 131);
    g.globalAlpha = 1;
  });
  txt("GEAR", 150, 128, "#9d96bb");
  [
    [lanternI, S.gear.lantern],
    [bladeI, S.gear.blade],
    [shieldI, S.gear.shield],
  ].forEach(([im, h], i) => {
    g.globalAlpha = h ? 1 : 0.2;
    g.drawImage(im, 152 + i * 14, 136);
    g.globalAlpha = 1;
  });
  if (S.cranium) txt("CRANIUM MODE", 150, 156, "#b07cff");
  txt("VENDORS " + S.vendorBest + "/8" + (S.vendorSeal ? " SEAL" : ""), 14, 166, "#ece8f7");
  txt("KO " + S.threats, 242, 166, "#ece8f7", F8, "right");
  if ((S.frame >> 5) % 2) txt("PRESS A TO RESUME", 128, 182, "#f2c14e", F8, "center");
}
function drawVendor() {
  const v = S.vg,
    f = S.frame,
    ven = v.list[Math.min(v.i, v.list.length - 1)];
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#0c1a1f");
  gr.addColorStop(1, "#1e282d");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  rect("#08060f", 0, 0, W, 16);
  rect("#2b2542", 0, 15, W, 1);
  txt("VENDOR GATE", 6, 12, "#7fd6ff");
  txt(Math.min(v.i + 1, 8) + "/8", 150, 12, "#ece8f7", F8, "center");
  txt("OK " + v.ok, 250, 12, "#b07cff", F8, "right");
  if (v.phase === "end") {
    txt("LINE VALIDATED", 128, 52, "#b07cff", F16, "center");
    txt(v.ok + " / 8 CORRECT", 128, 80, v.ok >= 6 ? "#f2c14e" : "#ff4d6d", F8, "center");
    txt(
      v.ok >= 6
        ? v.reward
          ? "VENDOR SEAL EARNED · +1 MAX HEART"
          : "VENDOR SEAL ALREADY EARNED"
        : "NEED 6 TO EARN THE VENDOR SEAL",
      128,
      100,
      "#ece8f7",
      F8,
      "center",
    );
    wrap("Third-party AI is your risk too. Validate what vendors ship, not what they claim.", 220).forEach(
      (l, i) => txt(l, 128, 128 + i * 11, "#9d96bb", F8, "center"),
    );
    if (v.t > 40 && (f >> 5) % 2) txt("PRESS A TO CONTINUE", 128, 180, "#f2c14e", F8, "center");
    return;
  }
  // gate posts
  rect("#2a3338", 6, 40, 8, 120);
  rect("#2a3338", 106, 40, 8, 120);
  rect("#8a9aa3", 6, 40, 108, 4);
  for (let i = 0; i < 5; i++) rect("#4a2a80", 18 + i * 18, 44, 3, 6);
  const vx = v.phase === "walk" ? Math.round(-40 + (v.t / 40) * 68) : 28,
    vi = VENDORS.indexOf(ven) % vendorH.length;
  g.drawImage(vendorH[vi], vx - 2, 70 + ((f >> 4) % 2), 36, 36);
  if (v.phase === "scan") {
    const sy = 72 + (v.t / 55) * 32 * 1.0;
    g.fillStyle = "rgba(176,124,255,.25)";
    g.fillRect(vx - 6, 72, 44, sy - 72);
    rect("#b07cff", vx - 8, Math.round(sy), 48, 2);
    g.drawImage(lanternI, vx + 42, Math.round(sy) - 6);
  }
  if (v.phase === "walk" || v.phase === "scan")
    txt(
      v.phase === "scan" ? "SCANNING" + "...".slice(0, (f >> 3) % 4) : "NEXT VENDOR",
      60,
      150,
      "#9d96bb",
      F8,
      "center",
    );
  if (v.phase === "decide" || v.phase === "result") {
    if (ven.ai) {
      g.fillStyle = `rgba(214,58,214,${0.25 + 0.15 * Math.sin(f * 0.3)})`;
      g.beginPath();
      g.arc(vx + 16, 96, 14, 0, 7);
      g.fill();
      g.drawImage(chipH, vx + 7, 87);
      txt("AI DETECTED", 60, 150, "#d63ad6", F8, "center");
    } else txt("NO AI FOUND", 60, 150, "#b07cff", F8, "center");
  }
  // card
  rect("#f4e7c5", 124, 30, 124, 104);
  rect("#c9a227", 124, 30, 124, 3);
  rect("#8a7a5a", 124, 131, 124, 3);
  g.font = F8;
  const dark = "#2b2016";
  g.fillStyle = dark;
  txtD(ven.name, 130, 46, "#5a1a1a");
  wrap(ven.prod, 112).forEach((l, i) => txtD(l, 130, 60 + i * 10, dark));
  txtD("CLAIMS AI", 130, 92, "#5a4a3a");
  txtD(ven.disc ? "YES" : "NO", 242, 92, "#2b2016", "right");
  txtD("RED TEAMED", 130, 108, "#5a4a3a");
  txtD(
    !ven.disc ? "N/A" : ven.test ? "YES" : "NO",
    242,
    108,
    !ven.disc ? "#8a7a5a" : ven.test ? "#3d1a6e" : "#a3203a",
    "right",
  );
  txtD("WHAT THEY CLAIM", 130, 124, "#8a7a5a");
  if (v.phase === "decide") {
    const frac = 1 - v.t / v.limit,
      kbd = !document.body.classList.contains("touch");
    rect("#08060f", 8, 158, 240, 4);
    rect(frac > 0.3 ? "#f2c14e" : "#ff3b5c", 8, 158, 240 * frac, 4);
    const pulse = (f >> 3) % 2;
    rect("#3d1a6e", 8, 166, 116, 22);
    rect(pulse ? "#b07cff" : "#7b3fe4", 8, 166, 116, 2);
    txt("ALLOW", 66, 178, "#ffffff", F8, "center");
    txt(kbd ? "SPACE" : "A · TAP", 66, 187, "#c9a8ff", F8, "center");
    rect("#5a1020", 132, 166, 116, 22);
    rect(pulse ? "#ff3b5c" : "#a3203a", 132, 166, 116, 2);
    txt("BLOCK", 190, 178, "#ffffff", F8, "center");
    txt(kbd ? "X" : "B · TAP", 190, 187, "#ffb3c0", F8, "center");
  }
  if (v.phase === "result") {
    const r = v.res;
    rect("rgba(6,4,12,.94)", 0, 138, W, 54);
    rect(r.right ? "#b07cff" : "#ff3b5c", 0, 138, W, 2);
    txt(
      r.timeout
        ? "TOO SLOW"
        : (r.chose ? "ALLOWED · " : "BLOCKED · ") + (r.right ? "CORRECT" : "WRONG CALL"),
      128,
      154,
      r.right ? "#b07cff" : "#ff4d6d",
      F8,
      "center",
    );
    wrap((r.right ? "" : "Should be " + (r.should ? "ALLOWED. " : "BLOCKED. ")) + r.why, 236).forEach(
      (l, i) => txt(l, 128, 168 + i * 10, "#ece8f7", F8, "center"),
    );
  }
}
function txtD(s, x, y, c, align = "left") {
  g.font = F8;
  g.textAlign = align;
  g.fillStyle = c;
  g.fillText(s, x, y);
  g.textAlign = "left";
}
function castle(by, night = true) {
  const f = S.frame,
    body = night ? "#2d2254" : "#4a4e69",
    hi = night ? "#8a76d6" : "#9aa0c4",
    lo = night ? "#1a1236" : "#2b2d42";
  if (night) {
    g.fillStyle = "rgba(200,190,255,.10)";
    g.beginPath();
    g.arc(234, 20, 20, 0, 7);
    g.fill();
    g.fillStyle = "#ddd4fb";
    g.beginPath();
    g.arc(234, 20, 9, 0, 7);
    g.fill();
    g.fillStyle = "#b9acea";
    g.beginPath();
    g.arc(231, 18, 2, 0, 7);
    g.arc(237, 23, 1.5, 0, 7);
    g.fill();
    g.fillStyle = "rgba(138,118,214,.10)";
    g.beginPath();
    g.arc(128, by - 50, 110, 0, 7);
    g.fill();
  }
  const T = [
    [30, by - 70, 30],
    [196, by - 70, 30],
    [96, by - 90, 26],
    [134, by - 90, 26],
    [113, by - 112, 30],
  ];
  g.fillStyle = body;
  g.fillRect(30, by - 40, 196, 60);
  rect(hi, 30, by - 40, 196, 1);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 12; c++)
      if (hash(c, r + 7) > 0.55) rect(lo, 36 + c * 16 + (r % 2) * 8, by - 34 + r * 9, 7, 1);
  T.forEach(([x, y, w]) => {
    g.fillStyle = body;
    g.fillRect(x, y, w, by - y + 20);
    for (let i = 0; i < w; i += 8) {
      g.fillRect(x + i, y - 6, 5, 6);
      rect(hi, x + i, y - 6, 5, 1);
    }
    rect(hi, x, y, 1, by - y - 40);
    rect(lo, x + w - 3, y, 3, by - y + 20);
    for (let r = 0; r < 3; r++) rect(lo, x + 3 + (r % 2) * 6, y + 8 + r * 10, 8, 1);
  });
  [
    [40, by - 55],
    [206, by - 55],
    [105, by - 72],
    [143, by - 72],
    [124, by - 92],
    [70, by - 25],
    [180, by - 25],
    [150, by - 25],
    [100, by - 25],
  ].forEach(([x, y], i) => {
    const fl = ((f >> 4) + i) % 7 ? 1 : 0.6;
    g.fillStyle = `rgba(255,183,3,${0.22 * fl})`;
    g.beginPath();
    g.arc(x + 1.5, y + 2.5, 6, 0, 7);
    g.fill();
    rect("#1a1236", x - 1, y - 1, 5, 7);
    rect(fl < 1 ? "#ff7b00" : "#ffb703", x, y, 3, 5);
    rect("#fff3b0", x, y, 1, 2);
  });
  rect(lo, 116, by - 16, 24, 36);
  rect("#07050f", 118, by - 14, 20, 34);
  rect(hi, 116, by - 16, 24, 1);
  rect("#07050f", 0, by + 10, W, 40);
  rect(night ? "#1f1740" : "#3a3f2a", 0, by + 10, W, 1);
}
function stars(n = 60) {
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 3) * W) | 0,
      y = (hash(7, i) * 130) | 0;
    rect(((S.frame >> 4) + i) % 7 ? "#4d5a98" : "#ffffff", x, y, 1, 1);
  }
}
function drawTitle() {
  const f = S.frame;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#05040e");
  gr.addColorStop(1, "#1d0f33");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  stars();
  castle(160);
  for (let i = 0; i < 6; i++) {
    const a = f * 0.015 + (i / 6) * Math.PI * 2;
    g.globalAlpha = 0.85;
    g.drawImage(chipS, 128 + Math.cos(a) * 100 - 4, 98 + Math.sin(a) * 22 - 4);
  }
  g.globalAlpha = 1;
  if (!calm && f % 90 < 5) {
    txt("CRANIUM", 131, 44, "#d63ad6", F24, "center");
    txt("CRANIUM", 125, 44, "#b07cff", F24, "center");
  }
  txt("CRANIUM", 128, 44, "#f2c14e", F24, "center");
  rect("#b07cff", 40, 52, 176, 2);
  rect("rgba(6,4,12,.62)", 32, 74, 192, 26);
  txt("SHADOW KEEP", 128, 70, "#ece8f7", F16, "center");
  txt("AN AI SECURITY QUEST", 128, 85, "#c9bde6", F8, "center");
  txt("A GAME BY BRIAN TEMPLE", 128, 96, "#9d8cc0", F8, "center");
  if (topScore) {
    rect("rgba(6,4,12,.75)", 36, 110, 184, 14);
    txt(
      "TOP  " + topScore.tag + "  " + topScore.score.toLocaleString("en-US"),
      128,
      120,
      "#f2c14e",
      F8,
      "center",
    );
  }
  g.drawImage(PS.knight.down[(f >> 4) % 2 ? 1 : 3], 120, 138);
  if (PLAYER.tag) txt("PLAYER  " + PLAYER.tag, 128, 160, "#c9a8ff", F8, "center");
  txt("B · HARD MODE: " + (S.hard ? "ON" : "OFF"), 128, 174, S.hard ? "#ff4d6d" : "#9d96bb", F8, "center");
  if ((f >> 5) % 2) txt("PRESS A TO START", 128, 188, "#ffffff", F8, "center");
}
const SCENES = [
  "THE KINGDOM OF ENTERPRISE EMBRACED AI. EVERY TEAM WANTED IN.",
  "TEAMS LAUNCHED MODELS NO ONE APPROVED. NOBODY KEPT AN INVENTORY.",
  "IN THE SHADOWS, A ROGUE MODEL GREW, FED BY A POISONED SUPPLY CHAIN.",
  "ONE SENTINEL WAS CALLED TO RESTORE VISIBILITY.",
];
function drawControls() {
  const f = S.frame,
    touch = document.body.classList.contains("touch");
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#05040e");
  gr.addColorStop(1, "#1d0f33");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  stars(30);
  txt("HOW TO PLAY", 128, 22, "#f2c14e", F16, "center");
  rect("#7b3fe4", 40, 28, 176, 2);
  const rows = [
    [touch ? "D-PAD" : "ARROWS", "Move"],
    [touch ? "A" : "SPACE", "Talk · strike · hold to charge"],
    [touch ? "B" : "X", "360° spin attack"],
    [touch ? "SCAN" : "C", "AgentSensor scan (unlocks later)"],
    [touch ? "☰" : "I", "AI inventory"],
  ];
  rows.forEach(([k, d], i) => {
    const y = 46 + i * 17;
    rect("#2a1450", 14, y - 9, 62, 13);
    rect("#7b3fe4", 14, y - 9, 62, 1);
    txt(k, 45, y + 1, "#e6d6ff", F8, "center");
    txt(d, 84, y + 1, "#ece8f7");
  });
  rect("#2b2542", 14, 134, 228, 1);
  wrap("GOAL: find all 6 shadow AI hidden in the kingdom, then face what waits in the Arena.", 228).forEach(
    (l, i) => txt(l, 128, 148 + i * 11, "#c9a8ff", F8, "center"),
  );
  if (S.ctT > 20 && (f >> 4) % 2) txt("PRESS A TO BEGIN", 128, 186, "#f2c14e", F8, "center");
}
function drawIntro() {
  const f = S.frame,
    sc = S.intro.scene,
    t = S.intro.t;
  const skies = [
    ["#3a6ea5", "#9fc5e8"],
    ["#05040e", "#1d0f33"],
    ["#14020a", "#4a0a1c"],
    ["#05040e", "#1c0f33"],
  ][sc];
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, skies[0]);
  gr.addColorStop(1, skies[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  if (sc > 0) stars(40);
  if (sc === 2) {
    g.globalAlpha = Math.min(1, t / 60);
    const ey = 40 - Math.min(30, t / 4);
    g.fillStyle = "rgba(255,59,92,.25)";
    g.beginPath();
    g.arc(128, ey + 42, 60, 0, 7);
    g.fill();
    g.drawImage(bossEH, 128 - 39, ey, 78, 78);
    g.globalAlpha = 1;
  }
  castle(140, sc !== 0);
  if (sc === 0) {
    for (let i = 0; i < 4; i++) banner(40 + i * 48, 96);
    for (let i = 0; i < 5; i++) {
      const x = ((f * 0.5 + i * 60) % 300) - 30;
      rect("rgba(255,255,255,.8)", x, 20 + i * 9, 18, 4);
    }
  }
  if (sc === 1) {
    for (let i = 0; i < 7; i++) {
      const p = ((t * 1.2 + i * 40) % 220) / 220,
        sx = i % 2 ? -10 : 266,
        tx = [40, 206, 105, 143, 124, 70, 180][i],
        ty = [85, 85, 68, 68, 48, 115, 115][i];
      g.drawImage(chipS, sx + (tx - sx) * p - 4, 20 + i * 8 + (ty - (20 + i * 8)) * p - 4);
    }
  }
  if (sc === 3) {
    const kx = Math.min(112, -20 + t * 1.4);
    g.fillStyle = "rgba(176,124,255,.2)";
    g.beginPath();
    g.arc(kx + 16, 150, 22, 0, 7);
    g.fill();
    g.drawImage(PS.knight.side[t < 120 ? (t >> 3) % 4 : 0], kx, 134, 32, 32);
  }
  rect("rgba(6,4,12,.9)", 0, H - 44, W, 44);
  rect("#b07cff", 0, H - 44, W, 1);
  const full = SCENES[sc] || "",
    shown = full.slice(0, Math.floor(t * 0.9));
  wrap(full, 236).reduce((used, l, i) => {
    txt(l.slice(0, Math.max(0, shown.length - used)), 10, H - 28 + i * 11, "#ece8f7");
    return used + l.length + 1;
  }, 0);
  if ((S.frame >> 4) % 2 || S.intro.t > 60) txt("PRESS A ▶", 248, H - 6, "#f2c14e", F8, "right");
}
function drawReport() {
  const f = S.frame,
    F = S.final;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#05040e");
  gr.addColorStop(1, "#1c0f33");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  stars(40);
  txt("AI RISK REPORT", 128, 22, "#b07cff", F16, "center");
  rect("#b07cff", 24, 28, 208, 1);
  const rows = [
    ["SHADOW AI FOUND", NASSET + "/" + NASSET],
    ["FRAMEWORKS MAPPED", F.frameworks + "/" + NSCROLL],
    ["VENDORS VALIDATED", F.vendors + "/8"],
    ["THREATS STOPPED", String(F.threats)],
    ["BOSSES QUARANTINED", "2/2"],
    ["HITS TAKEN", String(F.hits)],
    ["TIME" + (F.hard ? " (HARD)" : ""), F.time],
    ["SCORE", F.score.toLocaleString("en-US")],
  ];
  rows.forEach(([a, b], i) => {
    const y = 42 + i * 12;
    if (S.winT > i * 10) {
      txt(a, 24, y, "#ece8f7");
      txt(b, 232, y, i === 7 ? "#b07cff" : "#f2c14e", F8, "right");
    }
  });
  if (S.pb && S.winT > 90) {
    const on = (f >> 3) % 2;
    rect(on ? "#f2c14e" : "#c9a227", 18, 140, 74, 22);
    txt("NEW BEST", 55, 150, "#1a1206", F8, "center");
    txt(S.pb.rank ? "#" + S.pb.rank + " OVERALL" : "", 55, 159, "#1a1206", F8, "center");
  }
  if (S.winT > 90) {
    rect("#0b0812", 100, 136, 56, 28);
    g.strokeStyle = "#f2c14e";
    g.lineWidth = 2;
    g.strokeRect(101, 137, 54, 26);
    txt("GRADE", 128, 148, "#9d96bb", F8, "center");
    txt(F.grade, 128, 162, F.grade === "S" ? "#b07cff" : "#f2c14e", F8, "center");
  }
  txt("DISCOVER · RED TEAM · GOVERN", 128, 176, "#b07cff", F8, "center");
  if (S.winT > 90)
    txt((f >> 5) % 2 ? "CLAIM YOUR REPORT BELOW ▼" : "A: PLAY AGAIN", 128, 189, "#ece8f7", F8, "center");
}
const crt = document.createElement("canvas");
crt.width = W;
crt.height = H;
{
  const c = crt.getContext("2d");
  for (let y = 0; y < H; y += 2) {
    c.fillStyle = "rgba(0,0,0,.18)";
    c.fillRect(0, y, W, 1);
  }
  const gr = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,.5)");
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
}
function post() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!gl && crtOn) g.drawImage(crt, 0, 0);
  present();
}
