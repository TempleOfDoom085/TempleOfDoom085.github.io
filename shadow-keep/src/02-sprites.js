/* ================= SPRITES ================= */
function spr(rows, pal, s) {
  const h = rows.length,
    w = rows[0].length,
    c = document.createElement("canvas");
  c.width = w * s;
  c.height = h * s;
  const x = c.getContext("2d");
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch !== "." && pal[ch]) {
        x.fillStyle = pal[ch];
        x.fillRect(i * s, j * s, s, s);
      }
    }
  return c;
}
function shadeHex(h, a) {
  const n = parseInt(h.slice(1), 16),
    f = (v) => Math.max(0, Math.min(255, Math.round(a > 0 ? v + (255 - v) * a : v * (1 + a))));
  return "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")";
}
/**
 * Turns a small character-grid sprite into the game's 16-bit style: EPX 2x smoothing,
 * top-light / bottom-shadow shading, and a dark outline.
 */
function hd(rows, pal, outline = "#0d0a16") {
  const h = rows.length,
    w = rows[0].length,
    get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x]);
  const H2 = h * 2,
    W2 = w * 2,
    o = [];
  for (let y = 0; y < H2; y++) o.push(new Array(W2).fill("."));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = get(x, y),
        A = get(x, y - 1),
        B = get(x + 1, y),
        C = get(x - 1, y),
        D = get(x, y + 1);
      let e1 = P,
        e2 = P,
        e3 = P,
        e4 = P;
      if (C === A && C !== D && A !== B) e1 = A;
      if (A === B && A !== C && B !== D) e2 = B;
      if (D === C && D !== B && C !== A) e3 = C;
      if (B === D && B !== A && D !== C) e4 = D;
      o[y * 2][x * 2] = e1;
      o[y * 2][x * 2 + 1] = e2;
      o[y * 2 + 1][x * 2] = e3;
      o[y * 2 + 1][x * 2 + 1] = e4;
    }
  const c = document.createElement("canvas");
  c.width = W2 + 2;
  c.height = H2 + 2;
  const x2 = c.getContext("2d"),
    at = (x, y) => (x < 0 || y < 0 || x >= W2 || y >= H2 ? "." : o[y][x]);
  for (let y = -1; y <= H2; y++)
    for (let x = -1; x <= W2; x++) {
      const ch = at(x, y);
      if (ch === "." || !pal[ch]) {
        if (at(x - 1, y) !== "." || at(x + 1, y) !== "." || at(x, y - 1) !== "." || at(x, y + 1) !== ".") {
          x2.fillStyle = outline;
          x2.fillRect(x + 1, y + 1, 1, 1);
        }
        continue;
      }
      let col = pal[ch];
      if (at(x, y - 1) === ".") col = shadeHex(col, 0.24);
      else if (at(x, y + 1) === ".") col = shadeHex(col, -0.3);
      else if (at(x + 1, y) === ".") col = shadeHex(col, -0.16);
      else if (at(x - 1, y) === ".") col = shadeHex(col, 0.1);
      x2.fillStyle = col;
      x2.fillRect(x + 1, y + 1, 1, 1);
    }
  return c;
}
function flashOf(img) {
  if (!img._w) {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, c.width, c.height);
    img._w = c;
  }
  return img._w;
}
const XLBL = { gob: "INJECT", spec: "LEAK", imp: "JAILBRK", slime: "POISON", drone: "AGENT" };
const CH = () => (S.cranium ? 28 : 42);
const GP = { g: "#3f8f3a", G: "#6cc04a", y: "#ffe066", r: "#c0303a" };
const IMPP = { r: "#8a1c3c", R: "#e0435f", y: "#ffe066", k: "#2a0a14" };
const SLP = { g: "#5e7f18", G: "#a8d93a", w: "#ffffff", k: "#1a2406" },
  slimeRows = ["..gggg..", ".gGGGGg.", "gGwGGwGg", "gGkGGkGg", "gGGGGGGg", ".gggggg."];
const CHIPP = { d: "#b07be0", D: "#3a1d5c", m: "#d63ad6", e: "#ffffff" },
  CHIPR = [".d.dd.d.", "dDDDDDDd", ".DmmmmD.", "dDmeemDd", ".DmeemD.", "dDmmmmDd", ".DDDDDD.", ".d.dd.d."];
const chipS = spr(CHIPR, CHIPP, 1),
  chipG = spr(CHIPR, { d: "#c9a8ff", D: "#2a1450", m: "#b07cff", e: "#ffffff" }, 1);
const SAGE = [
  "...BB...",
  "..BBBB..",
  ".BsssSB.",
  "..WWWW..",
  ".BWWWWB.",
  ".BBYBBB.",
  ".BBBBBB.",
  "BBBBBBBB",
];
const MR = ["..oooo..", ".oooooo.", "..ssss..", "..skks..", ".GGGGGG.", "GGYGGYGG", ".GGGGGG.", ".G....G."];
const HR = [".rr.rr.", "rRRrRRr", "rRRRRRr", ".rRRRr.", "..rRr..", "...r..."];
const heart = spr(HR, { r: "#9e1b32", R: "#ff4d6d" }, 1),
  heartE = spr(HR, { r: "#2a2440", R: "#3d365c" }, 1);
const SCR = [
    ".wwwwww.",
    "wYYYYYYw",
    ".pppppp.",
    ".pkkkkp.",
    ".pppppp.",
    ".pkkk.p.",
    ".pppppp.",
    "wYYYYYYw",
  ],
  SCP = { w: "#8a5a2b", Y: "#c9a227", p: "#f4e7c5", k: "#8a7a5a" };
const scrollS = spr(SCR, SCP, 1);
const lanternI = spr(
  ["..gg..", ".g..g.", "gYYYYg", "gYwwYg", "gYwwYg", "gYYYYg", ".gggg."],
  { g: "#c9a227", Y: "#ffb703", w: "#fff3b0" },
  1,
);
const bladeI = spr(
  ["......w", ".....wW", "....wW.", "...wW..", "g.wW...", ".gg....", "gYg....", "g......"],
  { w: "#dfe6f2", W: "#ffffff", g: "#c9a227", Y: "#b07cff" },
  1,
);
const shieldI = spr(
  [".bbbbbb.", "bBBBBBBb", "bBwwwwBb", "bBwBBwBb", "bBBwwBBb", ".bBBBBb.", "..bBBb..", "...bb..."],
  { b: "#1d4f6e", B: "#2e7aa3", w: "#bfeaff" },
  1,
);
const CHR = ["kkkkkkkk", "kYbbbbYk", "kbbbbbbk", "kYYggYYk", "kbbbbbbk", "kbbbbbbk", "kkkkkkkk"],
  CHP = { b: "#8a5a2b", Y: "#c9a227", g: "#f2c14e", k: "#3b2414", d: "#140c06" };
const BR = [
  "..c.c..c.c..",
  "..cccccccc..",
  ".KKKKKKKKKK.",
  "KKkkkkkkkkKK",
  "KkkRRRRRRkkK",
  "KkRRWWWWRRkK",
  "KkRRWbbWRRkK",
  "KkRRWbbWRRkK",
  "KkRRWWWWRRkK",
  "KkkRRRRRRkkK",
  "KKkkkkkkkkKK",
  ".K.K.KK.K.K.",
];
const HHR = [
  ".g....g.",
  "gGg..gGg",
  "gGGGGGGg",
  "gGyGGyGg",
  "gGGGGGGg",
  ".grrrrg.",
  ".gwgwgg.",
  "..gggg..",
];
const hHead = hd(HHR, { g: "#1f5c3a", G: "#38a169", y: "#ffe066", r: "#7a1020", w: "#ffffff" }),
  hHeadF = hd(HHR, { g: "#6b3a1a", G: "#d97a2b", y: "#ffe066", r: "#7a1020", w: "#ffffff" });
const bossSH = hd(BR, {
    c: "#f2c14e",
    K: "#1b1030",
    k: "#5b2a86",
    R: "#7a2bd6",
    W: "#e8e0ff",
    b: "#0b0612",
  }),
  bossVH = hd(BR, { c: "#f2c14e", K: "#3a0d14", k: "#a3203a", R: "#ff3b3b", W: "#fff0f0", b: "#0b0612" }),
  bossEH = hd(BR, { c: "#ff3b3b", K: "#0b0612", k: "#ff3b5c", R: "#ffb703", W: "#ffffff", b: "#ff0000" });
const goblinH = [
  hd(["..g..g..", ".gggggg.", "gGyGGyGg", ".gGGGGg.", "..grrg..", ".gggggg.", "g.gggg.g", "..g..g.."], GP),
  hd(["g.....g.", ".gggggg.", "gGyGGyGg", ".gGGGGg.", "..grrg..", ".gggggg.", "..gggg..", ".g....g."], GP),
];
const specterH = hd(
  ["..pppp..", ".pPPPPp.", "pPwPPwPp", "pPPPPPPp", "pPPkkPPp", "pPPPPPPp", "pP.PP.Pp", "p..p..p."],
  { p: "#5b4fc4", P: "#a99cf2", w: "#ffffff", k: "#2a2050" },
);
const impH = [
  hd(
    ["r......r", "rr....rr", ".rRRRRr.", "rRyRRyRr", ".rRkkRr.", "..rRRr..", ".r.rr.r.", "r......r"],
    IMPP,
  ),
  hd(
    ["r......r", "rr....rr", ".rRRRRr.", "rRyRRyRr", ".rRkkRr.", "..rRRr..", "..r..r..", ".r....r."],
    IMPP,
  ),
];
const slimeH = hd(slimeRows, SLP),
  droneH = hd(["...rr...", ".kkkkkk.", "kDDDDDDk", "kDDrrDDk", "kDDDDDDk", ".kkkkkk.", "k..kk..k"], {
    k: "#2a2040",
    D: "#6d5fd1",
    r: "#ff3b3b",
  });
const cisoH = hd(SAGE, { B: "#2d5fa8", s: "#e0ac8a", S: "#c48f6e", W: "#f4f1de", Y: "#f2c14e" });
const keeperH = hd(
  ["..hhhh..", ".hHHHHh.", ".hssssh.", "..sKKs..", ".AAAAAA.", "AAYAAYAA", ".AAAAAA.", ".A....A."],
  { h: "#3a4a52", H: "#7fd6ff", s: "#c48f6e", K: "#222222", A: "#2e6f8a", Y: "#f2c14e" },
);
const merchantH = hd(MR, { o: "#c46a1a", s: "#e0ac8a", k: "#222222", G: "#3a7d44", Y: "#f2c14e" });
const KP16 = {
  o: "#14101e",
  H: "#eef2f8",
  h: "#a9b4c9",
  d: "#5d6880",
  v: "#b07cff",
  V: "#efe4ff",
  t: "#3d1a6e",
  T: "#7b3fe4",
  L: "#b58cff",
  w: "#f4f1de",
  a: "#7d879c",
  g: "#3a2418",
  G: "#6b4430",
};
const SK16 = {
  o: "#14101e",
  H: "#ffffff",
  h: "#d8ece8",
  d: "#8fb5ae",
  v: "#0b1a1a",
  V: "#b07cff",
  t: "#2a1245",
  T: "#6d3fa8",
  L: "#a07ad8",
  w: "#b07cff",
  a: "#5a4a7a",
  g: "#1a1030",
  G: "#3a2a5a",
};
const B16D = [
  "......oooo......",
  ".....oHHHho.....",
  "....oHHHhhho....",
  "....oHhhhhdo....",
  "....ovVvvvvo....",
  "....odhhhhdo....",
  ".....oddddo.....",
  "...ooTTLLTToo...",
  "..oaoTwwwwToao..",
  "..oaoTTwwTToao..",
  "..ogoTTTTTToGo..",
  "...ootTTTTtoo...",
];
const B16U = [
  "......oooo......",
  ".....oHHHho.....",
  "....oHHHhhho....",
  "....ohhhhhdo....",
  "....ohhhhhdo....",
  "....oddddddo....",
  ".....oddddo.....",
  "...ootTTTTtoo...",
  "..oaotTTTTtoao..",
  "..oaotTLLTtoao..",
  "..ogotTTTTtoGo..",
  "...oottttttoo...",
];
const B16S = [
  "......oooo......",
  ".....oHHHHo.....",
  "....oHHHHhho....",
  "....ohHhhhvo....",
  "....ohhhhvVo....",
  "....odhhhddo....",
  ".....oddddo.....",
  "....ooTTLTo.....",
  "....oTTwwTao....",
  "....oTTwwTao....",
  "....oTTTTTgo....",
  "....otTTTTo.....",
];
const LGA = ["....ottootto....", "....oggoogGo....", "....oGgoogGo....", ".....oo..oo....."],
  LGB = ["....ottootto....", "...oggo..ogGo...", "...oGGo...oo....", "....oo.........."],
  LGC = ["....ottootto....", "...ogGo..oggo...", "....oo...oGGo...", "..........oo...."],
  LGS = ["....ottotto.....", "....oggoGgo.....", "....oGgoGgo.....", ".....oo.oo......"];
function pset(pal) {
  const m = (b, l) => spr(b.concat(l), pal, 1);
  return {
    down: [m(B16D, LGA), m(B16D, LGB), m(B16D, LGA), m(B16D, LGC)],
    up: [m(B16U, LGA), m(B16U, LGB), m(B16U, LGA), m(B16U, LGC)],
    side: [m(B16S, LGS), m(B16S, LGB), m(B16S, LGS), m(B16S, LGC)],
  };
}
const PS = { knight: pset(KP16), skull: pset(SK16) };

/** 1x sprite with the same outline + shading as hd(), for tiny things (small slimes). */
function outlined(rows, pal, outline = "#0d0a16") {
  const h = rows.length,
    w = rows[0].length,
    at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x]);
  const c = document.createElement("canvas");
  c.width = w + 2;
  c.height = h + 2;
  const x2 = c.getContext("2d");
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      const ch = at(x, y);
      if (ch === "." || !pal[ch]) {
        if (at(x - 1, y) !== "." || at(x + 1, y) !== "." || at(x, y - 1) !== "." || at(x, y + 1) !== ".") {
          x2.fillStyle = outline;
          x2.fillRect(x + 1, y + 1, 1, 1);
        }
        continue;
      }
      x2.fillStyle = at(x, y - 1) === "." ? shadeHex(pal[ch], 0.24) : at(x, y + 1) === "." ? shadeHex(pal[ch], -0.3) : pal[ch];
      x2.fillRect(x + 1, y + 1, 1, 1);
    }
  return c;
}

// 16-bit versions of the items, props and NPCs (everything in the world uses these).
const chipH = hd(CHIPR, CHIPP);
const scrollH = hd(SCR, SCP);
const heartH = hd(HR, { r: "#9e1b32", R: "#ff4d6d" });
const chestH = hd(CHR, CHP);
const chestOH = hd(["kkkkkkkk", "kddddddk", "kddddddk", "kYYggYYk", "kbbbbbbk", "kbbbbbbk", "kkkkkkkk"], CHP);
const slimeSmallH = outlined(slimeRows, SLP);
const VENDOR_PALS = [
  { o: "#c46a1a", s: "#e0ac8a", k: "#222222", G: "#3a7d44", Y: "#f2c14e" },
  { o: "#3a3a6a", s: "#c48f6e", k: "#222222", G: "#6d5fd1", Y: "#e6ecf6" },
  { o: "#7a1a2a", s: "#8d5a3a", k: "#222222", G: "#c0303a", Y: "#f2c14e" },
  { o: "#1a5a5a", s: "#e0ac8a", k: "#222222", G: "#2e7aa3", Y: "#bfeaff" },
];
const vendorH = VENDOR_PALS.map((p) => hd(MR, p));
