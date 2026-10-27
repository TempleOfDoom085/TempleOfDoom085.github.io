/* ================= HYDRA ================= */
const FORK_LABELS = ["API", "DATASET", "LIBRARY", "CONNECTOR", "WEIGHTS", "AGENT TOOL"];
function mkHead(label, gen, hp) {
  return {
    label,
    gen,
    hp,
    max: hp,
    alive: true,
    hurt: 0,
    fire: 80 + Math.random() * 90,
    x: 128,
    y: 90,
    ang: Math.PI / 2,
  };
}
function hydraInit() {
  const hb = S.hard ? 1 : 0;
  S.hydra = {
    active: false,
    dead: false,
    deathT: 0,
    core: S.hard ? 14 : 10,
    coreMax: S.hard ? 14 : 10,
    hurt: 0,
    t: 0,
    fire: 0,
    x: 128,
    y: 36,
    heads: [],
    pending: [],
    forkI: 0,
  };
  ["SDK", "MODEL HUB", "PLUGIN"].forEach((l) => S.hydra.heads.push(mkHead(l, 0, 4 + hb)));
}
const hydraOpen = () => S.hydra.heads.every((h) => !h.alive) && S.hydra.pending.length === 0;
function updateHydra() {
  const h = S.hydra,
    c = pc();
  if (!h.active || h.dead) return;
  h.t++;
  if (h.hurt > 0) h.hurt--;
  h.x = 128 + 34 * Math.sin(h.t * 0.012);
  h.y = 36 + 4 * Math.sin(h.t * 0.03);
  for (const pd of h.pending) {
    if (--pd.t <= 0) {
      for (let k = 0; k < 2; k++) {
        const nh = mkHead(FORK_LABELS[h.forkI++ % FORK_LABELS.length], 1, S.hard ? 3 : 2);
        nh.x = pd.x;
        nh.y = pd.y;
        h.heads.push(nh);
      }
      burst(pd.x, pd.y, ["#d97a2b", "#ffe066"], 16, 2);
      floatT(pd.x, pd.y - 14, "+2 SUPPLIERS", "#d97a2b");
      sfx(140, 0.3, "sawtooth", 200, 0.06);
      shake(3);
      pd.done = true;
    }
  }
  h.pending = h.pending.filter((p) => !p.done);
  const alive = h.heads.filter((x) => x.alive),
    n = alive.length;
  alive.forEach((hd, i) => {
    const a = Math.PI * (0.12 + 0.76 * ((i + 0.5) / n)),
      r = 50 + (hd.gen ? 8 : 0),
      tx = h.x + Math.cos(a) * r * 1.25,
      ty = h.y + 18 + Math.sin(a) * r + Math.sin(h.t * 0.05 + i) * 5;
    hd.x += (tx - hd.x) * 0.06;
    hd.y += (ty - hd.y) * 0.06;
    if (hd.hurt > 0) hd.hurt--;
    if (--hd.fire <= 0) {
      hd.fire = (hd.gen ? 120 : 140) / (S.hard ? 1.3 : 1) + Math.random() * 60;
      const a0 = Math.atan2(c.y - hd.y, c.x - hd.x),
        spd = 1.35 * (S.hard ? 1.15 : 1);
      const shots = hd.gen ? [-0.25, 0, 0.25] : [0];
      shots.forEach((o) =>
        S.bolts.push({
          x: hd.x,
          y: hd.y,
          vx: Math.cos(a0 + o) * spd,
          vy: Math.sin(a0 + o) * spd,
          l: 240,
          kind: hd.gen ? "fork" : "boss",
        }),
      );
      sfx(420, 0.07, "square", -200, 0.03);
    }
    if (ov(S.p, { x: hd.x - 7, y: hd.y - 7, w: 14, h: 14 })) hurtPlayer(hd.x, hd.y);
  });
  if (hydraOpen()) {
    if (++h.fire > (S.hard ? 50 : 65)) {
      h.fire = 0;
      const k = 10;
      for (let i = 0; i < k; i++) {
        const a = h.t * 0.05 + (i / k) * Math.PI * 2;
        S.bolts.push({
          x: h.x,
          y: h.y + 6,
          vx: Math.cos(a) * 1.1,
          vy: Math.sin(a) * 1.1,
          l: 240,
          kind: "boss",
        });
      }
      sfx(500, 0.08, "square", -250, 0.03);
    }
  }
  if (ov(S.p, { x: h.x - 16, y: h.y - 10, w: 32, h: 22 })) hurtPlayer(h.x, h.y);
}
function hydraHitHead(hd, dmg) {
  const h = S.hydra;
  hd.hp -= dmg;
  hd.hurt = 12;
  sfx(260, 0.08, "square", -150, 0.05);
  burst(hd.x, hd.y, hd.gen ? "#d97a2b" : "#38a169", 8);
  S.freeze = Math.max(S.freeze, 2);
  if (hd.hp <= 0) {
    hd.alive = false;
    S.threats++;
    if (S.cranium && S.xray <= 0) S.xr = Math.min(100, S.xr + 12);
    burst(hd.x, hd.y, ["#38a169", "#ffffff", "#ffe066"], 22, 2.4);
    shake(3);
    floatT(hd.x, hd.y - 12, hd.label + " CUT", "#ffe066");
    if (hd.gen === 0) h.pending.push({ t: 150, x: hd.x, y: hd.y });
    if (hydraOpen()) {
      announce("SUPPLY CHAIN SEVERED", "Every head is cut. Strike the core!");
      sfx(330, 0.3, "sawtooth", -200, 0.05);
    }
  }
}
function hydraHitCore(dmg) {
  const h = S.hydra;
  S.ab = Math.max(S.ab, 0.7);
  h.core = Math.max(0, h.core - dmg);
  h.hurt = 14;
  shake(3);
  S.freeze = 4;
  burst(h.x, h.y + 4, ["#ff3b3b", "#b07cff"], 16, 2.2);
  sfx(150, 0.15, "sawtooth", -80, 0.07);
  floatT(h.x, h.y - 18, "-" + dmg, "#ff4d6d");
  if (h.core <= 0) {
    h.dead = true;
    S.threats++;
    S.bolts = [];
    S.mode = "hydradeath";
    h.deathT = 0;
    S.xray = 0;
    setSong(null);
    sfx(45, 1.6, "sine", -15, 0.16);
    sfx(1200, 0.6, "square", -1100, 0.04);
    shake(10);
  }
}
