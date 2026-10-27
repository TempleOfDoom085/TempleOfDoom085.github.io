/* ================= UPDATE ================= */
function update() {
  S.frame++;
  const A = aQ,
    B = bQ,
    MN = mQ,
    C = cQ;
  aQ = bQ = mQ = cQ = false;
  updateFX();
  setDuck(S.mode === "dialog" || S.mode === "inv" ? 0.35 : 1);
  if (S.mode === "transform") {
    updateTransform();
    return;
  }
  if (S.mode === "cine") {
    updateCine();
    updateAmbient(room());
    return;
  }
  if (S.mode === "title") {
    setSong(ac ? "main" : null);
    if (B) {
      S.hard = !S.hard;
      sfx(S.hard ? 220 : 660, 0.12, "square", S.hard ? -80 : 200, 0.05);
    }
    if (A) openEntry();
    return;
  }
  if (S.mode === "entry") return;
  if (S.mode === "intro") {
    S.intro.t++;
    setSong("dark");
    if (A) {
      if (S.intro.t < 20) return;
      S.intro.scene++;
      S.intro.t = 0;
      sfx(660, 0.05);
    }
    if (S.intro.scene > 3) {
      S.mode = "controls";
      S.ctT = 0;
    }
    return;
  }
  if (S.mode === "controls") {
    S.ctT++;
    if (A && S.ctT > 20) {
      S.mode = "play";
      msg({ kind: "room", title: room().name, body: ROOMFACT["1,1"], own: true, pause: true });
      sfx(660, 0.06);
    }
    return;
  }
  if (S.mode === "win") {
    S.winT++;
    if (A && S.winT > 90) {
      const h = S.hard;
      hideClaim();
      newGame("title", h);
    }
    return;
  }
  if (S.mode === "over") {
    S.overT++;
    if (A && S.overT > 40) respawn();
    return;
  }
  if (S.mode === "inv") {
    if (A || MN || B) {
      S.mode = "play";
      sfx(500, 0.05);
    }
    return;
  }
  if (S.mode === "vendor") {
    setSong("gate");
    updateVendor(A, B);
    return;
  }
  if (S.mode === "dialog") {
    const d = S.dialog,
      full = d.lines[d.i].t.length;
    d.c = Math.min(full, d.c + 1.3);
    if (S.frame % 3 === 0 && d.c < full) sfx(880, 0.02, "square", 0, 0.015);
    if (A) {
      if (d.c < full) d.c = full;
      else {
        d.i++;
        d.c = 0;
        sfx(660, 0.05);
        if (d.i >= d.lines.length) {
          S.dialog = null;
          S.mode = "play";
          d.done && d.done();
        }
      }
    }
    return;
  }
  if (S.mode === "bossdeath") {
    S.playT++;
    const b = S.boss;
    b.deathT++;
    if (b.deathT % 5 === 0) {
      burst(
        b.x + (Math.random() - 0.5) * 34,
        b.y + (Math.random() - 0.5) * 34,
        ["#ff3b3b", "#f2c14e", "#d63ad6", "#ffffff"],
        12,
        2.4,
      );
      shake(3);
      sfx(90 + Math.random() * 200, 0.12, "sawtooth", -60, 0.05);
    }
    if (b.deathT === 60) announce("MODEL QUARANTINED", "But something stirs...", false);
    updateMessages(A);
    if (b.deathT > 160) {
      S.mode = "play";
      S.hydraDelay = 40;
    }
    return;
  }
  if (S.mode === "hydradeath") {
    S.playT++;
    const h = S.hydra;
    h.deathT++;
    if (h.deathT % 4 === 0) {
      burst(
        h.x + (Math.random() - 0.5) * 60,
        h.y + (Math.random() - 0.5) * 50 + 20,
        ["#38a169", "#d97a2b", "#ffe066", "#ffffff"],
        12,
        2.6,
      );
      shake(4);
      sfx(80 + Math.random() * 180, 0.14, "sawtooth", -60, 0.05);
    }
    if (h.deathT === 60) announce("SUPPLY CHAIN VALIDATED", "The kingdom is secure.", false);
    updateMessages(A);
    if (h.deathT > 180) win();
    return;
  }
  if (S.freeze > 0) {
    S.freeze--;
    aQ = aQ || A;
    bQ = bQ || B;
    cQ = cQ || C;
    mQ = mQ || MN;
    return;
  }
  // ---- play ----
  if (S.trans) {
    aQ = aQ || A;
    bQ = bQ || B;
    cQ = cQ || C;
    return;
  }
  updateAmbient(room());
  // A paused message holds the world still; B/C presses wait for it to clear.
  if (updateMessages(A)) {
    bQ = bQ || B;
    cQ = cQ || C;
    return;
  }
  if (MN) {
    S.mode = "inv";
    sfx(500, 0.05);
    return;
  }
  S.playT++;
  const p = S.p;
  const R0 = room(),
    fight = (S.boss.active && !S.boss.dead) || (S.hydra.active && !S.hydra.dead);
  setSong(
    R0.boss
      ? fight
        ? "boss"
        : "dark"
      : R0.theme === "cata" || R0.theme === "spire"
        ? "dark"
        : R0.theme === "gate"
          ? "gate"
          : "main",
  );
  {
    const c0 = pc();
    intensity =
      fight || S.xray > 0
        ? 2
        : R0.enemies.some((e) => e.alive && Math.hypot(e.x + 6 - c0.x, e.y + 6 - c0.y) < 100)
          ? 1
          : 0;
    tempoMul =
      S.boss.active && !S.boss.dead
        ? [1, 1, 1.08, 1.16][S.boss.phase]
        : S.hydra.active && !S.hydra.dead
          ? hydraOpen()
            ? 1.2
            : 1.1
          : 1;
  }
  if (S.lockMsg > 0) S.lockMsg--;
  if (S.shieldMsg > 0) S.shieldMsg--;
  if (S.hydraDelay > 0 && --S.hydraDelay === 0 && room().boss && !S.hydra.active && !S.hydra.dead) {
    startCine("hydra");
    return;
  }
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  p.moving = !!(dx || dy);
  if (dx || dy) {
    if (p.atk <= 0 && p.spin <= 0) {
      if (dx) p.face = dx > 0 ? "right" : "left";
      else p.face = dy > 0 ? "down" : "up";
    }
    p.step++;
    if (p.step % 12 === 1) {
      const c0 = pc();
      S.parts.push({
        x: c0.x + (Math.random() * 4 - 2),
        y: c0.y + 5,
        vx: -dx * 0.25,
        vy: -0.15,
        l: 20,
        c: "rgba(210,205,220,.5)",
        s: 3,
      });
    }
  }
  const sp = p.spin > 0 ? 1.1 : p.atk > 0 ? 0.6 : p.charge > 40 ? 0.8 : 1.35,
    n = dx && dy ? Math.SQRT1_2 : 1;
  tryMove(dx * sp * n, dy * sp * n);
  if (Math.abs(p.kx) + Math.abs(p.ky) > 0.05) {
    tryMove(p.kx, 0);
    tryMove(0, p.ky);
    p.kx *= 0.8;
    p.ky *= 0.8;
  }
  if (p.inv > 0) p.inv--;
  if (p.cd > 0) p.cd--;
  if (p.atk > 0) p.atk--;
  if (p.spin > 0) p.spin--;
  if (p.shield > 0) p.shield--;
  if (p.scd > 0) p.scd--;
  const R = room(),
    c = pc();
  if (A) {
    let acted = false;
    if (R.npc && Math.hypot(c.x - (R.npc.x + 8), c.y - (R.npc.y + 8)) < 28) {
      talk(R);
      acted = true;
    } else if (
      R.chest &&
      !R.chest.open &&
      Math.hypot(c.x - (R.chest.tx * T + 8), c.y - (R.chest.ty * T + 8)) < 26
    ) {
      openChest(R);
      acted = true;
    }
    if (!acted && p.cd <= 0) {
      p.atk = 14;
      p.cd = 16;
      p.hitSet = new Set();
      p.charge = 0;
      sfx(520, 0.08, "square", -300, 0.035);
    }
  }
  if (S.mode !== "play") return;
  if (S.gear.blade && aDown) {
    p.charge++;
    if (p.charge === CH()) {
      sfx(1200, 0.12, "square", 400, 0.04);
      burst(c.x, c.y, "#b07cff", 10, 1.2);
    }
  } else {
    if (p.charge >= CH()) {
      p.spin = 22;
      p.spinDmg = 2;
      p.hitSet = new Set();
      p.atk = 0;
      shake(2);
      sfx(260, 0.25, "sawtooth", 500, 0.05);
      burst(c.x, c.y, ["#b07cff", "#ffffff"], 18, 2.6);
    }
    p.charge = 0;
  }
  if (B && p.scd <= 0 && p.spin <= 0) {
    p.spin = 18;
    p.spinDmg = 1;
    p.hitSet = new Set();
    p.atk = 0;
    p.charge = 0;
    p.scd = 50;
    sfx(420, 0.16, "sawtooth", 380, 0.045);
    burst(c.x, c.y, "#ffffff", 8, 1.6);
    if (S.gear.shield) {
      p.shield = 30;
      sfx(700, 0.12, "triangle", 300, 0.04);
    }
  }
  if (C) {
    if (!S.cranium) {
      if (S.shieldMsg <= 0) {
        toast("AGENTSENSOR LOCKED", "Inventory all " + NASSET + " shadow AI to unlock Cranium Mode.", 170);
        S.shieldMsg = 300;
      }
    } else if (S.xr >= 100 && S.xray <= 0) {
      S.xray = 180;
      S.xr = 0;
      shake(5);
      sfx(150, 0.8, "sawtooth", 1200, 0.06);
      sfx(60, 0.8, "sine", -20, 0.1);
    } else if (S.xray <= 0) {
      floatT(c.x, c.y - 14, "CHARGING " + Math.floor(S.xr) + "%", "#b07cff");
      sfx(300, 0.05, "square", 0, 0.02);
    }
  }
  if (S.cranium) {
    if (S.xray > 0) {
      S.xray--;
      if (S.xray === 150 || S.xray === 100 || S.xray === 50) xrayPulse(S.xray === 150);
    } else S.xr = Math.min(100, S.xr + 0.04);
    if ((dx || dy) && S.frame % 3 === 0)
      S.parts.push({
        x: c.x + (Math.random() * 6 - 3),
        y: c.y + 5,
        vx: 0,
        vy: -0.2,
        l: 16,
        c: S.frame % 2 ? "#b07cff" : "#6d3fa8",
      });
    if (S.xr >= 100 && S.frame % 40 === 0) burst(c.x, c.y, "#b07cff", 3, 0.6);
  }
  const tick = S.xray <= 0 || S.frame % 3 === 0;
  if (c.x < 0) changeRoom(-1, 0);
  else if (c.x > COLS * T) changeRoom(1, 0);
  else if (c.y < 0) changeRoom(0, -1);
  else if (c.y > PH) changeRoom(0, 1);
  const RR = room();
  if (p.atk > 4) attackHit(swordBox(), 1, p.hitSet);
  if (p.atk === 9) {
    const a0 = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.face],
      c1 = pc(),
      tx = c1.x + Math.cos(a0) * 17,
      ty = c1.y + Math.sin(a0) * 17;
    if (solidAt(tx, ty, true)) {
      burst(tx, ty, ["#ffe066", "#ffffff"], 8, 1.8);
      sfx(1800, 0.04, "square", -900, 0.03);
    }
  }
  if (p.spin > 0) attackHit({ x: p.x - 19, y: p.y - 19, w: 48, h: 48 }, p.spinDmg || 2, p.hitSet);
  if (tick) for (const e of RR.enemies) if (e.alive) updateEnemy(e, RR);
  for (const it of RR.items) {
    it.t--;
    if (ov(it, p)) {
      it.t = 0;
      p.hp = Math.min(p.max, p.hp + 1);
      sfx(880, 0.1, "square", 300, 0.05);
      burst(it.x + 4, it.y + 4, "#ff4d6d", 8, 1);
    }
  }
  RR.items = RR.items.filter((i) => i.t > 0);
  const m = RR.model;
  if (m && !m.found && S.gear.lantern && ov({ x: m.tx * T + 2, y: m.ty * T + 2, w: 12, h: 12 }, p)) {
    m.found = true;
    S.found++;
    burst(m.tx * T + 8, m.ty * T + 8, ["#d63ad6", "#b07cff", "#ffffff"], 30, 2.4);
    shake(3);
    jingle([660, 880, 1175, 1568]);
    if (S.found === NASSET) {
      S.rooms["1,1"].map[0][7] = ".";
      S.rooms["1,1"].map[0][8] = ".";
      S.mode = "transform";
      S.tf = 0;
      clearMessages();
      setSong(null);
      return;
    } else
      toast(
        "SHADOW AI " + S.found + "/" + NASSET + " · " + m.src,
        m.desc + ". Inventoried and governed.",
        240,
      );
  }
  const sc = RR.scroll;
  if (sc && !sc.taken && ov({ x: sc.tx * T + 2, y: sc.ty * T + 2, w: 12, h: 12 }, p)) {
    sc.taken = true;
    S.scrolls++;
    p.max++;
    p.hp = p.max;
    burst(sc.tx * T + 8, sc.ty * T + 8, ["#f2c14e", "#ffffff"], 22, 2);
    jingle([784, 988, 1175]);
    toast(
      sc.name + " MAPPED",
      "Framework " + S.scrolls + "/" + NSCROLL + " · +1 max heart. Fully healed.",
      220,
    );
  }
  if (tick) {
    if (RR.boss) {
      updateBoss();
      updateHydra();
    }
    updateBolts(RR);
  }
}
function xrayPulse(first) {
  const R = room(),
    c = pc();
  S.pulse = 24;
  S.ab = 1.2;
  shake(5);
  sfx(90, 0.45, "sawtooth", -40, 0.08);
  sfx(1600, 0.2, "square", -1200, 0.03);
  if (first) {
    for (const b of S.bolts) if (!b.friendly) burst(b.x, b.y, "#b07cff", 3, 0.8);
    S.bolts = S.bolts.filter((b) => b.friendly);
  }
  for (const e of R.enemies.slice()) if (e.alive) damageEnemy(e, 2);
  if (R.boss) {
    const b = S.boss,
      h = S.hydra;
    if (b.active && !b.dead) {
      b.shield = false;
      b.st = 0;
      bossHit(2, "SCANNED");
    } else if (h.active && !h.dead) {
      for (const hd of h.heads) if (hd.alive) hydraHitHead(hd, 2);
      if (hydraOpen() && S.mode === "play") hydraHitCore(2);
    }
  }
}
function updateTransform() {
  S.tf++;
  const c = pc(),
    t = S.tf;
  if (t < 90 && t % 2 === 0) {
    const a = Math.random() * 7,
      r = 64;
    S.parts.push({
      x: c.x + Math.cos(a) * r,
      y: c.y + Math.sin(a) * r,
      vx: -Math.cos(a) * 2.3,
      vy: -Math.sin(a) * 2.3,
      l: 26,
      c: ["#b07cff", "#d63ad6", "#ffffff"][t % 3],
    });
  }
  if (t % 10 === 0 && t < 90) sfx(180 + t * 9, 0.1, "square", 0, 0.03);
  if (t === 90) {
    S.cranium = true;
    S.xr = 100;
    shake(9);
    burst(c.x, c.y, ["#b07cff", "#ffffff", "#d63ad6"], 70, 3.6);
    sfx(70, 0.9, "sawtooth", 700, 0.08);
    jingle([523, 659, 784, 1047, 1319, 1568], 0.07);
    if (xrBtn) xrBtn.classList.remove("locked");
  }
  if (t > 210) {
    S.mode = "play";
    announce("CRANIUM MODE", "Press C (or SCAN) for an AgentSensor scan. It recharges as you fight.");
    announce("THE ARENA IS OPEN", "All " + NASSET + " shadow AI inventoried. The gate is north of the High CISO.");
  }
}
function updateFX() {
  for (const q of S.parts) {
    q.x += q.vx;
    q.y += q.vy;
    q.vx *= 0.92;
    q.vy *= 0.92;
    q.l--;
  }
  S.parts = S.parts.filter((q) => q.l > 0);
  for (const f of S.floats) {
    f.y -= 0.4;
    f.l--;
  }
  S.floats = S.floats.filter((f) => f.l > 0);
  if (S.shake > 0) S.shake *= 0.85;
  if (S.shake < 0.3) S.shake = 0;
  if (S.pulse > 0) S.pulse--;
  S.lb += (S.lbT - S.lb) * 0.12;
  S.ab *= 0.88;
  if (S.flash > 0) S.flash--;
  for (const r of S.rings) {
    r.r += 2.2;
    r.l--;
  }
  S.rings = S.rings.filter((r) => r.l > 0);
  if (S.card) {
    S.card.t++;
    if (S.card.t > 120) S.card = null;
  }
  if (S.trans) {
    S.trans.t++;
    if (S.trans.t >= S.trans.n) S.trans = null;
  }
}
function respawn() {
  const p = S.p;
  p.hp = p.max;
  p.inv = 90;
  p.kx = p.ky = 0;
  p.charge = p.spin = p.shield = 0;
  S.rx = 1;
  S.ry = 1;
  p.x = 123;
  p.y = 120;
  S.bolts = [];
  S.parts = [];
  S.floats = [];
  clearMessages();
  msg({ kind: "room", title: room().name, dur: 70 });
  S.hydraDelay = 0;
  S.cracks = null;
  S.zoom = 1;
  S.lbT = 0;
  S.cine = null;
  S.trans = null;
  S.card = null;
  S.amb = [];
  const b = S.boss;
  if (!b.dead) {
    Object.assign(b, { hp: b.max, phase: 1, active: false, st: 0, shield: true, fire: 0 });
    S.rooms["1,0"].enemies = [];
  }
  if (!S.hydra.dead) hydraInit();
  S.mode = "play";
}
function talk(R) {
  const n = R.npc,
    who = n.who;
  if (n.key === "ciso") {
    if (!S.talked.ciso)
      say(
        [
          { who, t: "Sentinel! The kingdom adopted AI faster than anyone could track it." },
          {
            who,
            t: "Shadow AI now hides in our code, our cloud, our vendors, our agents, even the bank and the hospital.",
          },
          {
            who,
            t: "Take Detect AI, our shadow-AI lantern. It reveals the AI no one inventoried. Strike with A, spin with B.",
          },
          {
            who,
            t:
              "Find all " +
              NASSET +
              " shadow models and map our frameworks. Then face what waits in THE ARENA.",
          },
        ],
        () => {
          S.talked.ciso = true;
          S.gear.lantern = true;
          jingle([523, 659, 784, 1047], 0.08);
          announce("DETECT AI ONLINE", "Hidden AI now glows wherever you go.");
        },
      );
    else if (S.found < NASSET) {
      const all = [
        ["0,1", "the Code Catacombs (west)"],
        ["2,1", "the Cloud Keep (east)"],
        ["2,0", "the Vendor Bazaar (north of the Cloud Keep)"],
        ["0,0", "the Agent Spire (north of the Catacombs)"],
        ["0,2", "the Bank Vault (through the Vendor Gate, south)"],
        ["2,2", "the Hospital Wing (through the Vendor Gate, south)"],
      ];
      const left = all.filter(([k]) => !S.rooms[k].model.found).map((x) => x[1]);
      say([
        {
          who,
          t:
            NASSET -
            S.found +
            " shadow model" +
            (NASSET - S.found === 1 ? "" : "s") +
            " remain. Search " +
            left.slice(0, 2).join(" and ") +
            ".",
        },
      ]);
    } else
      say([
        {
          who,
          t: "Full visibility at last. The Arena gate is open, right behind me. Red team whatever is in there!",
        },
      ]);
  } else if (n.key === "vendor") {
    if (!S.talked.vendor)
      say(
        [
          { who, t: "Every vendor in this bazaar swears their product has no AI inside." },
          { who, t: "Trust, but verify. Third-party AI is still your risk." },
          {
            who,
            t: "Take this Arena Shield. It upgrades your B spin: now it also reflects attacks back at their source.",
          },
        ],
        () => {
          S.talked.vendor = true;
          S.gear.shield = true;
          jingle([392, 523, 659, 784], 0.08);
          announce("ARENA SHIELD", "Your B spin now reflects bolts back at whoever fired them.");
        },
      );
    else
      say([
        {
          who,
          t: S.rooms["2,0"].model.found
            ? "You found the hidden chatbot. Validate every vendor like that."
            : "One of these stalls is hiding an AI feature. Detect AI will show it.",
        },
      ]);
  } else if (n.key === "gate") {
    if (!S.gear.lantern) {
      say([{ who, t: "Halt. You need Detect AI from the High CISO before you can scan vendors." }]);
      return;
    }
    if (S.vendorSeal) {
      say([
        {
          who,
          t: "The line is validated, Sentinel. The bank and the hospital are through the side doors.",
        },
      ]);
      return;
    }
    say(
      [
        { who, t: "Eight vendors want through this gate. Some hide AI in their products." },
        { who, t: "Each card shows what the vendor claims. Detect AI scans what they actually ship." },
        {
          who,
          t: "ALLOW: no AI found, or AI they disclosed AND red-team tested. BLOCK: hidden AI, or AI that was never red teamed.",
        },
        { who, t: "Get 6 of 8 right to earn the Vendor Seal. Ready?" },
      ],
      startVendor,
    );
  }
}
function openChest(R) {
  R.chest.open = true;
  S.gear.blade = true;
  sfx(440, 0.1);
  burst(R.chest.tx * T + 8, R.chest.ty * T + 8, ["#f2c14e", "#b07cff"], 20, 2);
  say(
    [
      {
        who: "ARENA BLADE",
        t: "Named for Cranium Arena, which red teams AI using MITRE ATLAS and OWASP attacks. Hold A to charge, release to spin.",
      },
    ],
    () => {
      announce("ARENA BLADE", "Hold A to charge, release for a double-damage spin.");
      jingle([523, 784, 1047]);
    },
  );
}

function updateEnemy(e, R) {
  const c = pc(),
    D = DIFF();
  if (e.hurt > 0) e.hurt--;
  const ex = e.x + e.w / 2,
    ey = e.y + e.h / 2,
    tx = c.x - ex,
    ty = c.y - ey,
    d = Math.hypot(tx, ty) || 1;
  const walk = (mx, my) => {
    mx = mx * D + e.kx;
    my = my * D + e.ky;
    if (!blocked(e.x + mx, e.y, e.w, e.h, true)) e.x += mx;
    else e.wx *= -1;
    if (!blocked(e.x, e.y + my, e.w, e.h, true)) e.y += my;
    else e.wy *= -1;
  };
  const fly = (mx, my) => {
    e.x = Math.max(T, Math.min(COLS * T - T - e.w, e.x + mx * D + e.kx));
    e.y = Math.max(T, Math.min(PH - T - e.h, e.y + my * D + e.ky));
  };
  switch (e.type) {
    case "gob":
      if (d < 95) walk((tx / d) * 0.6, (ty / d) * 0.6);
      else {
        if (--e.wt <= 0) {
          e.wt = 60 + Math.random() * 80;
          const a = Math.random() * 7;
          e.wx = Math.cos(a) * 0.4;
          e.wy = Math.sin(a) * 0.4;
        }
        walk(e.wx, e.wy);
      }
      if (--e.th <= 0) {
        e.th = (170 + Math.random() * 130) / D;
        if (d < 130) {
          S.bolts.push({
            x: ex,
            y: ey,
            vx: (tx / d) * 1.3 * D,
            vy: (ty / d) * 1.3 * D,
            l: 200,
            kind: "glyph",
          });
          sfx(700, 0.06, "square", -200, 0.02);
        }
      }
      break;
    case "spec":
      e.ph += 0.05;
      fly((tx / d) * 0.42 + Math.cos(e.ph) * 0.3, (ty / d) * 0.42 + Math.sin(e.ph * 1.3) * 0.3);
      if (S.frame % 9 === 0)
        S.parts.push({
          x: ex + (Math.random() * 8 - 4),
          y: ey + 5,
          vx: 0,
          vy: 0.4,
          l: 20,
          c: R.theme === "hosp" ? "#ff4d6d" : "#a99cf2",
        });
      break;
    case "imp":
      if (e.blink > 0) {
        e.blink--;
        if (e.blink === 0) {
          for (let k = 0; k < 20; k++) {
            const a = Math.random() * 7,
              r = 36 + Math.random() * 24,
              nx = c.x + Math.cos(a) * r - 6,
              ny = c.y + Math.sin(a) * r - 6;
            if (
              nx > T &&
              ny > T &&
              nx < COLS * T - T - 12 &&
              ny < PH - T - 12 &&
              !blocked(nx, ny, 12, 12, true)
            ) {
              burst(ex, ey, "#e0435f", 10);
              e.x = nx;
              e.y = ny;
              burst(nx + 6, ny + 6, "#e0435f", 10);
              sfx(1000, 0.08, "square", -600, 0.03);
              break;
            }
          }
          e.tp = (130 + Math.random() * 90) / D;
        }
      } else {
        walk((tx / d) * 0.5, (ty / d) * 0.5);
        if (--e.tp <= 0) e.blink = 30;
      }
      break;
    case "slime":
      if (--e.hop <= 0) {
        e.hop = (e.big ? 55 : 40) / D;
        e.hx = (tx / d) * (e.big ? 1 : 1.3);
        e.hy = (ty / d) * (e.big ? 1 : 1.3);
        e.ht = 18;
      }
      if (e.ht > 0) {
        e.ht--;
        walk(e.hx, e.hy);
      } else walk(0, 0);
      break;
    case "drone":
      e.ph += 0.08;
      fly((tx / d) * 0.85 + Math.cos(e.ph) * 0.4, (ty / d) * 0.85 + Math.sin(e.ph) * 0.4);
      break;
  }
  e.kx *= 0.82;
  e.ky *= 0.82;
  if (e.alive && ov(S.p, { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 })) {
    if (S.p.shield > 0) {
      e.kx = (-tx / d) * 3;
      e.ky = (-ty / d) * 3;
    } else hurtPlayer(ex, ey);
  }
}

function updateBoss() {
  const b = S.boss,
    c = pc();
  if (b.dead || !b.active) return;
  b.t++;
  b.st++;
  if (b.hurt > 0) b.hurt--;
  const spd = [0, 1, 1.5, 2][b.phase] * (S.hard ? 1.15 : 1);
  b.x = 128 + 70 * Math.sin(b.t * 0.011 * spd);
  b.y = 66 + 32 * Math.sin(b.t * 0.019 * spd);
  const sd = [0, 210, 180, 150][b.phase],
    vd = [0, 120, 110, 100][b.phase];
  if (b.shield && b.st > sd) {
    b.shield = false;
    b.st = 0;
    sfx(330, 0.3, "sawtooth", -200, 0.05);
    floatT(b.x, b.y - 26, "VULNERABLE", "#ff4d6d");
    if (b.phase === 3) radial(10, 1.1);
  } else if (!b.shield && b.st > vd) {
    b.shield = true;
    b.st = 0;
    sfx(220, 0.2, "square", 300, 0.04);
    if (b.phase >= 2) spawnDrones(b.phase === 2 ? 1 : 2);
  }
  if (b.shield) {
    b.fire++;
    const hv = S.hard ? 1.15 : 1;
    if (b.phase === 1 && b.fire > 75 / hv) {
      b.fire = 0;
      radial(8, 1.05 * hv);
    }
    if (b.phase === 2) {
      if (b.fire % 70 === 0) radial(10, 1.15 * hv);
      if (b.fire % 110 === 55) aimed(3, 1.6 * hv);
    }
    if (b.phase === 3) {
      if (b.fire % 6 === 0) {
        b.spiral += 0.42;
        for (const o of [0, Math.PI])
          S.bolts.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(b.spiral + o) * 1.25 * hv,
            vy: Math.sin(b.spiral + o) * 1.25 * hv,
            l: 240,
            kind: "boss",
          });
      }
      if (b.fire % 90 === 45) aimed(5, 1.7 * hv);
    }
  }
  if (ov(S.p, { x: b.x - 14, y: b.y - 14, w: 28, h: 28 })) hurtPlayer(b.x, b.y);
}
function radial(n, v) {
  const b = S.boss,
    off = b.t * 0.07;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    S.bolts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 260, kind: "boss" });
  }
  sfx(500, 0.08, "square", -250, 0.03);
}
function aimed(n, v) {
  const b = S.boss,
    c = pc(),
    a0 = Math.atan2(c.y - b.y, c.x - b.x);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * 0.22;
    S.bolts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 240, kind: "boss" });
  }
  sfx(620, 0.08, "square", -300, 0.03);
}
function updateBolts(R) {
  const p = S.p,
    c = pc();
  for (const b of S.bolts) {
    b.x += b.vx;
    b.y += b.vy;
    b.l--;
    if (solidAt(b.x, b.y, true)) {
      b.l = 0;
      burst(b.x, b.y, b.friendly ? "#b07cff" : "#d63ad6", 4, 0.8);
      continue;
    }
    if (!b.friendly) {
      if (p.shield > 0 && Math.hypot(b.x - c.x, b.y - c.y) < 19) {
        b.friendly = true;
        let tx = b.x - b.vx * 40,
          ty = b.y - b.vy * 40;
        if (R.boss) {
          const bs = S.boss,
            h = S.hydra;
          if (bs.active && !bs.dead) {
            tx = bs.x;
            ty = bs.y;
          } else if (h.active && !h.dead) {
            const hd = h.heads.find((x) => x.alive);
            if (hd) {
              tx = hd.x;
              ty = hd.y;
            } else {
              tx = h.x;
              ty = h.y;
            }
          }
        }
        const d = Math.hypot(tx - b.x, ty - b.y) || 1;
        b.vx = ((tx - b.x) / d) * 2.4;
        b.vy = ((ty - b.y) / d) * 2.4;
        b.l = 200;
        sfx(1300, 0.06, "square", 300, 0.03);
        burst(b.x, b.y, "#b07cff", 5);
        continue;
      }
      if (ov(p, { x: b.x - 2, y: b.y - 2, w: 4, h: 4 })) {
        b.l = 0;
        hurtPlayer(b.x - b.vx * 5, b.y - b.vy * 5);
      }
    } else {
      for (const e of R.enemies)
        if (e.alive && ov(e, { x: b.x - 3, y: b.y - 3, w: 6, h: 6 })) {
          b.l = 0;
          damageEnemy(e, 1);
          break;
        }
      if (b.l <= 0 || !R.boss) continue;
      const bs = S.boss;
      if (bs.active && !bs.dead && Math.hypot(b.x - bs.x, b.y - bs.y) < 20) {
        b.l = 0;
        bossHit(1, "REFLECTED");
        continue;
      }
      const h = S.hydra;
      if (h.active && !h.dead) {
        for (const hd of h.heads)
          if (hd.alive && Math.hypot(b.x - hd.x, b.y - hd.y) < 10) {
            b.l = 0;
            hydraHitHead(hd, 1);
            break;
          }
        if (b.l > 0 && hydraOpen() && Math.hypot(b.x - h.x, b.y - h.y - 4) < 16) {
          b.l = 0;
          hydraHitCore(1);
        }
      }
    }
  }
  S.bolts = S.bolts.filter((b) => b.l > 0);
}
