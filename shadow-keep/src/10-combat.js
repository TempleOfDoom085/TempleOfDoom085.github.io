/* ================= COMBAT ================= */
function damageEnemy(e, dmg) {
  const R = room(),
    c = pc(),
    ex = e.x + e.w / 2,
    ey = e.y + e.h / 2,
    d = Math.hypot(ex - c.x, ey - c.y) || 1;
  e.hp -= dmg;
  e.hurt = 12;
  floatT(e.x + e.w / 2, e.y - 4, "-" + dmg, "#ffffff");
  e.kx = ((ex - c.x) / d) * 3.4;
  e.ky = ((ey - c.y) / d) * 3.4;
  S.freeze = Math.max(S.freeze, 2);
  sfx(300, 0.07, "square", -150, 0.05);
  const col = { gob: "#6cc04a", spec: "#a99cf2", imp: "#e0435f", slime: "#a8d93a", drone: "#6d5fd1" }[
    e.type
  ];
  burst(ex, ey, col, 6);
  if (e.hp <= 0) {
    e.alive = false;
    S.threats++;
    if (S.cranium && S.xray <= 0) S.xr = Math.min(100, S.xr + 12);
    S.rings.push({ x: ex, y: ey, r: 3, l: 12, c: "255,255,255" });
    burst(ex, ey, [col, "#ffffff"], 20, 2.2);
    shake(2);
    sfx(200, 0.18, "triangle", -150, 0.07);
    if (e.type === "slime" && e.big) {
      for (const s of [-1, 1]) {
        const n = mk("slime", 0, 0, false);
        n.x = e.x + 2 + s * 5;
        n.y = e.y + 2;
        n.kx = s * 2.5;
        R.enemies.push(n);
      }
    }
    if (e.type !== "drone" && Math.random() < 0.3 && S.p.hp < S.p.max)
      R.items.push({ x: e.x + 2, y: e.y + 2, w: 8, h: 8, t: 600 });
  }
}
function bossHit(dmg, label) {
  const b = S.boss;
  if (b.dead) return;
  S.ab = Math.max(S.ab, 0.7);
  S.rings.push({ x: b.x, y: b.y, r: 10, l: 12, c: "255,80,90" });
  b.hp = Math.max(0, b.hp - dmg);
  b.hurt = 14;
  shake(3);
  S.freeze = 4;
  burst(b.x, b.y, ["#ff3b3b", "#f2c14e"], 16, 2.2);
  sfx(160, 0.15, "sawtooth", -80, 0.07);
  floatT(b.x + (Math.random() * 16 - 8), b.y - 22, label || "-" + dmg, "#ff4d6d");
  const np = b.hp > (b.max * 2) / 3 ? 1 : b.hp > b.max / 3 ? 2 : 3;
  if (np !== b.phase) {
    b.phase = np;
    shake(6);
    sfx(80, 0.5, "sawtooth", -40, 0.08);
    if (np === 2) announce("PHASE 2 · AGENT SWARM", "It is calling in rogue agents. Clear them, then strike.");
    else announce("PHASE 3 · JAILBREAK MODE", "Guardrails are off. Dodge the spiral and hit it when it glows red.");
    spawnDrones(np === 2 ? 2 : 3);
  }
  if (b.hp <= 0) {
    b.dead = true;
    S.threats++;
    S.bolts = [];
    S.xray = 0;
    sfx(45, 1.4, "sine", -15, 0.15);
    shake(9);
    room().enemies.forEach((e) => {
      if (e.alive) {
        e.alive = false;
        burst(e.x + 5, e.y + 5, "#6d5fd1", 10);
      }
    });
    S.mode = "bossdeath";
    b.deathT = 0;
    setSong(null);
  }
}
function spawnDrones(n) {
  const R = room();
  if (R.enemies.filter((e) => e.alive).length >= 4) return;
  const b = S.boss;
  for (let i = 0; i < n; i++) {
    const d = mk("drone", 0, 0);
    d.x = b.x - 5 + Math.cos(i * 2.1) * 20;
    d.y = b.y - 5 + Math.sin(i * 2.1) * 20;
    R.enemies.push(d);
    burst(d.x + 5, d.y + 5, "#6d5fd1", 8);
  }
}
function attackHit(box, dmg, set) {
  const R = room();
  for (const e of R.enemies)
    if (e.alive && !set.has(e) && ov(box, e)) {
      set.add(e);
      damageEnemy(e, dmg);
    }
  for (const b of S.bolts)
    if (!b.friendly && b.l > 0 && ov(box, { x: b.x - 3, y: b.y - 3, w: 6, h: 6 })) {
      b.l = 0;
      burst(b.x, b.y, "#b07cff", 6);
      sfx(1200, 0.04, "square", 0, 0.03);
    }
  if (!R.boss) return;
  const b = S.boss;
  if (b.active && !b.dead && !set.has(b) && ov(box, { x: b.x - 20, y: b.y - 20, w: 40, h: 40 })) {
    set.add(b);
    if (!b.shield) bossHit(dmg);
    else {
      sfx(1400, 0.05, "square", -400, 0.03);
      burst(b.x, b.y, "#b07cff", 5);
      floatT(b.x, b.y - 24, "BLOCKED", "#b07cff");
      if (S.shieldMsg <= 0) {
        toast(
          "ITS SHIELD IS UP",
          "Dodge, or reflect its bolts with your B spin. Strike when it glows red.",
          300,
          true,
        );
        S.shieldMsg = 420;
      }
    }
  }
  const h = S.hydra;
  if (h.active && !h.dead) {
    for (const hd of h.heads)
      if (hd.alive && !set.has(hd) && ov(box, { x: hd.x - 9, y: hd.y - 9, w: 18, h: 18 })) {
        set.add(hd);
        hydraHitHead(hd, dmg);
      }
    if (!set.has(h) && ov(box, { x: h.x - 18, y: h.y - 10, w: 36, h: 26 })) {
      set.add(h);
      if (hydraOpen()) hydraHitCore(dmg);
      else {
        floatT(h.x, h.y - 18, "CUT THE HEADS", "#b07cff");
        sfx(1400, 0.05, "square", -400, 0.03);
      }
    }
  }
}
