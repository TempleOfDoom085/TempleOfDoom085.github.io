/* ================= SCORE / WIN ================= */
function computeFinal() {
  const sec = (S.playT / 60) | 0;
  let sc =
    6000 - sec * 3 - S.hits * 60 - S.deaths * 400 + S.scrolls * 200 + S.vendorBest * 100 + S.threats * 15;
  if (S.hard) sc *= 1.5;
  sc = Math.max(100, Math.round(sc));
  const k = S.hard ? 1.5 : 1,
    grade = sc >= 6500 * k ? "S" : sc >= 5000 * k ? "A" : sc >= 3500 * k ? "B" : "C";
  sc += 3000;
  return {
    score: sc,
    grade,
    sec,
    time: fmtT(S.playT),
    hard: S.hard,
    frameworks: S.scrolls,
    vendors: S.vendorBest,
    threats: S.threats,
    hits: S.hits,
  };
}
function checkPB(sc) {
  if (!PLAYER.tag) return null;
  const key = "shadowkeep-pb-" + PLAYER.tag + "|" + PLAYER.co.toLowerCase();
  let pb = 0;
  try {
    pb = Number(localStorage.getItem(key) || 0);
  } catch (e) {}
  if (sc <= pb) return null;
  try {
    localStorage.setItem(key, String(sc));
  } catch (e) {}
  const rank =
    1 +
    boardScores.filter((e) => e.score > sc && !(e.tag === PLAYER.tag && e.co === PLAYER.co.toLowerCase()))
      .length;
  return { first: pb === 0, rank: rank <= 10 ? rank : 0 };
}
function progressScore() {
  let sc =
    S.found * 200 +
    S.scrolls * 100 +
    S.vendorBest * 50 +
    S.threats * 10 +
    (S.found === NASSET ? 300 : 0) +
    (S.boss.active || S.boss.dead ? 300 : 0) +
    (S.boss.dead ? 1000 : 0) +
    (S.hydra.active ? 300 : 0);
  if (S.hard) sc *= 1.5;
  return Math.min(2900, Math.round(sc));
}
function stageLabel() {
  return S.boss.dead
    ? "HYDRA"
    : S.boss.active
      ? "BOSS"
      : S.found === NASSET
        ? "ARENA"
        : S.found + "/" + NASSET + " AI";
}
async function postProgress() {
  if (!PLAYER.tag) return;
  const sc = progressScore();
  if (sc <= S.postedBest || sc < 200) return;
  S.postedBest = sc;
  const row = {
    tag: PLAYER.tag,
    company: PLAYER.co,
    score: sc,
    grade: null,
    time: fmtT(S.playT),
    hard: S.hard,
    reached: stageLabel(),
  };
  try {
    if (REMOTE) {
      await fetch(SUPA.url.replace(/\/$/, "") + "/rest/v1/scores", {
        method: "POST",
        headers: Object.assign(supaHeaders(), { Prefer: "return=minimal" }),
        body: JSON.stringify(row),
      });
      fetchRemote();
    } else if (db) {
      await db.collection("scores").add(Object.assign({}, row, { grade: "", at: Date.now() }));
    } else if (LOCAL) {
      const a = loadLocal();
      a.push(Object.assign({}, row, { grade: "", at: Date.now() }));
      localStorage.setItem(LKEY, JSON.stringify(a.sort((x, y) => y.score - x.score).slice(0, 25)));
      renderLocal();
    }
  } catch (e) {}
}
function win() {
  S.final = computeFinal();
  S.pb = checkPB(S.final.score);
  S.mode = "win";
  S.winT = 0;
  jingle([523, 659, 784, 659, 784, 1047, 1319], 0.12);
  showClaim(S.final);
}
