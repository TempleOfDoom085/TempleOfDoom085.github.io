/* ================= VENDOR GATE ================= */
function startVendor() {
  const list = VENDORS.slice().sort(() => Math.random() - 0.5);
  S.vg = { list, i: 0, phase: "walk", t: 0, ok: 0, res: null, limit: S.hard ? 360 : 480, done: false };
  S.mode = "vendor";
  jingle([523, 659, 784], 0.08);
}
function vendorDecide(allow) {
  const v = S.vg,
    ven = v.list[v.i],
    should = !ven.ai || (ven.disc && ven.test);
  const why = !ven.ai
    ? "No AI inside. Cleared."
    : ven.disc && ven.test
      ? "AI disclosed and red-team tested. Cleared."
      : !ven.disc
        ? "Hidden AI. Undisclosed third-party AI is your risk."
        : "AI disclosed, but never red-team tested.";
  const right = allow !== null && allow === should;
  if (right) {
    v.ok++;
    sfx(988, 0.12, "square", 300, 0.05);
  } else sfx(140, 0.25, "sawtooth", -60, 0.06);
  v.res = { right, timeout: allow === null, should, why, chose: allow };
  v.phase = "result";
  v.t = 0;
}
function updateVendor(A, B) {
  const v = S.vg;
  v.t++;
  if (v.phase === "walk" && v.t > 40) {
    v.phase = "scan";
    v.t = 0;
    sfx(600, 0.4, "triangle", 600, 0.03);
  } else if (v.phase === "scan" && v.t > 55) {
    v.phase = "decide";
    v.t = 0;
    sfx(v.list[v.i].ai ? 1100 : 500, 0.15, "square", 0, 0.04);
  } else if (v.phase === "decide") {
    if (A) vendorDecide(true);
    else if (B) vendorDecide(false);
    else if (v.t > v.limit) vendorDecide(null);
  } else if (v.phase === "result" && (v.t > 150 || (v.t > 45 && (A || B)))) {
    v.i++;
    v.t = 0;
    v.phase = v.i >= v.list.length ? "end" : "walk";
    if (v.phase === "end") {
      const prev = S.vendorBest;
      S.vendorBest = Math.max(S.vendorBest, v.ok);
      if (v.ok >= 6 && !S.vendorSeal) {
        S.vendorSeal = true;
        S.p.max++;
        S.p.hp = S.p.max;
        v.reward = true;
        jingle([523, 659, 784, 1047, 1319], 0.1);
      } else jingle(v.ok >= 6 ? [659, 784, 988] : [392, 330, 262], 0.12);
    }
  } else if (v.phase === "end" && v.t > 40 && (A || B)) {
    S.mode = "play";
    S.vg = null;
    if (S.vendorBest < 6)
      toast(
        "VENDOR LINE NOT CLEARED",
        "Validate at least 6 of 8 vendors to earn the Vendor Seal. Talk to the Gatekeeper to retry.",
        260,
      );
    else if (S.vendorSeal) toast("VENDOR SEAL EARNED", "Third-party AI validated. +1 max heart.", 220);
  }
}
