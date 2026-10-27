/* ================= STATE ================= */
let S,
  curHard = false;
const PLAYER = { tag: "", co: "" };
try {
  const pj = JSON.parse(localStorage.getItem("shadowkeep-player") || "{}");
  PLAYER.tag = String(pj.tag || "").slice(0, 12);
  PLAYER.co = String(pj.co || "").slice(0, 28);
} catch (e) {}
function newGame(mode = "title", hard = false) {
  curHard = hard;
  S = {
    mode,
    hard,
    frame: 0,
    rooms: makeRooms(),
    rx: 1,
    ry: 1,
    found: 0,
    scrolls: 0,
    threats: 0,
    hits: 0,
    deaths: 0,
    playT: 0,
    intelI: 0,
    intelOrder: null,
    gear: { lantern: false, blade: false, shield: false },
    talked: {},
    vendorBest: 0,
    vendorSeal: false,
    vg: null,
    hydraDelay: 0,
    p: {
      x: 123,
      y: 120,
      w: 10,
      h: 10,
      face: "up",
      hp: hard ? 2 : 3,
      max: hard ? 2 : 3,
      inv: 0,
      atk: 0,
      cd: 0,
      kx: 0,
      ky: 0,
      step: 0,
      hitSet: new Set(),
      charge: 0,
      spin: 0,
      shield: 0,
      scd: 0,
    },
    bolts: [],
    parts: [],
    floats: [],
    dialog: null,
    visited: { "1,1": true },
    shake: 0,
    freeze: 0,
    boss: {
      x: 128,
      y: 64,
      hp: hard ? 32 : 24,
      max: hard ? 32 : 24,
      phase: 1,
      t: 0,
      st: 0,
      shield: true,
      active: false,
      dead: false,
      deathT: 0,
      hurt: 0,
      fire: 0,
      spiral: 0,
    },
    hydra: {},
    intro: { scene: 0, t: 0 },
    lockMsg: 0,
    shieldMsg: 0,
    winT: 0,
    overT: 0,
    final: null,
    cranium: false,
    xr: 0,
    xray: 0,
    tf: 0,
    pulse: 0,
    lb: 0,
    lbT: 0,
    zoom: 1,
    zx: 128,
    zy: 88,
    cine: null,
    card: null,
    ab: 0,
    postedBest: 0,
    pb: null,
    ctT: 0,
    rings: [],
    amb: [],
    cracks: null,
    trans: null,
    flash: 0,
    msg: null, // message on screen (see 07b-messages.js)
    queue: [], // messages waiting their turn
  };
  hydraInit();
  if (xrBtn) xrBtn.classList.add("locked");
}
function nextIntel() {
  if (!S.intelOrder) {
    S.intelOrder = INTEL.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  return S.intelI < INTEL.length ? INTEL[S.intelOrder[S.intelI++]] : "";
}
newGame();
const room = () => S.rooms[S.rx + "," + S.ry];
