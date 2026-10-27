/* ================= LEADERBOARD · LEADS · SHARE ================= */
let boardScores = [];
let db = null,
  user = null,
  uid = null,
  owner = false,
  downloads = null,
  topScore = null,
  topList = [],
  boardLive = false,
  saved = false,
  LOCAL = false,
  REMOTE = false;
const SUPA = CONFIG.supabase;
const $ = (id) => document.getElementById(id);
const boardBody = $("boardBody"),
  boardNote = $("boardNote");
function cell(text, cls) {
  const td = document.createElement("td");
  td.textContent = text;
  if (cls) td.className = cls;
  return td;
}
function renderBoard(docs) {
  const seen = new Set();
  docs = docs
    .filter((d) => {
      const o = d.data() || {},
        k = String(o.tag || "") + "|" + String(o.company || "").toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 10);
  boardScores = docs.map((d) => {
    const o = d.data() || {};
    return {
      tag: String(o.tag || ""),
      co: String(o.company || "").toLowerCase(),
      score: Number(o.score || 0),
    };
  });
  boardBody.textContent = "";
  boardLive = true;
  const won = (o) => !!(o.grade && /^[SABC]$/.test(String(o.grade)));
  topList = docs.slice(0, 5).map((d) => {
    const s = d.data() || {};
    return {
      tag: String(s.tag || "???").slice(0, 12),
      co: String(s.company || "").slice(0, 10),
      score: Number(s.score || 0),
      hard: !!s.hard,
      won: won(s),
    };
  });
  if (!docs.length) {
    const tr = document.createElement("tr");
    const td = cell("No scores yet. Play a run to post the first one.", "empty");
    td.colSpan = 5;
    tr.appendChild(td);
    boardBody.appendChild(tr);
    topScore = null;
    return;
  }
  docs.forEach((d, i) => {
    const s = d.data() || {};
    const tr = document.createElement("tr");
    if (i === 0) tr.className = "top1";
    tr.appendChild(cell(String(i + 1), "num"));
    const tg = cell(String(s.tag || "???"));
    if (won(s)) {
      const ch = document.createElement("span");
      ch.className = "chip win";
      ch.textContent = "CLEARED";
      tg.appendChild(ch);
    }
    if (s.hard) {
      const ch = document.createElement("span");
      ch.className = "chip";
      ch.textContent = "HARD";
      tg.appendChild(ch);
    }
    tr.appendChild(tg);
    tr.appendChild(cell(String(s.company || "—")));
    tr.appendChild(cell(Number(s.score || 0).toLocaleString("en-US"), "num"));
    tr.appendChild(cell(String(s.time || ""), "num"));
    boardBody.appendChild(tr);
  });
  const t = docs[0].data() || {};
  topScore = { tag: String(t.tag || "???").slice(0, 12), score: Number(t.score || 0) };
}
(async () => {
  const use = window.claude && window.claude.use;
  if (!use) {
    if (SUPA.url && SUPA.key) remoteMode();
    else localMode();
    return;
  }
  try {
    [db, user, downloads] = await Promise.all([
      window.claude.use("db"),
      window.claude.use("user"),
      window.claude.use("downloads"),
    ]);
  } catch (e) {}
  if (user) {
    try {
      owner = await user.isOwner();
    } catch (e) {}
    try {
      uid = await user.id();
    } catch (e) {}
  }
  if (downloads) {
    $("saveCard").hidden = false;
    $("leadsSave").hidden = false;
  }
  if (!db) {
    localMode();
    return;
  }
  db.collection("scores")
    .orderBy("score", "desc")
    .limit(60)
    .onSnapshot(
      (s) => renderBoard(s.docs),
      () => {
        boardNote.textContent = "Leaderboard paused. Reload to reconnect.";
      },
    );
  if (owner) {
    $("leads").hidden = false;
    loadLeads();
  }
})();
const LKEY = "shadowkeep-best-v1";
function loadLocal() {
  let a = [];
  try {
    a = JSON.parse(localStorage.getItem(LKEY) || "[]");
  } catch (e) {}
  return Array.isArray(a) ? a : [];
}
function renderLocal() {
  const a = loadLocal()
    .sort((x, y) => y.score - x.score)
    .slice(0, 25);
  renderBoard(a.map((o) => ({ data: () => o })));
}
function supaHeaders() {
  const h = { apikey: SUPA.key, "Content-Type": "application/json" };
  if (SUPA.key.startsWith("eyJ")) h.Authorization = "Bearer " + SUPA.key;
  return h;
}
async function fetchRemote() {
  try {
    const r = await fetch(
      SUPA.url.replace(/\/$/, "") +
        "/rest/v1/scores?select=tag,company,score,grade,time,hard,reached&order=score.desc&limit=60",
      { headers: supaHeaders() },
    );
    if (!r.ok) throw 0;
    const rows = await r.json();
    renderBoard((Array.isArray(rows) ? rows : []).map((o) => ({ data: () => o })));
    boardNote.textContent = "Live · updates every minute";
  } catch (e) {
    boardNote.textContent = "Leaderboard offline. Scores still save on this device.";
    renderLocal();
  }
}
function remoteMode() {
  REMOTE = true;
  document.querySelector("#board h2").textContent = "TEAM LEADERBOARD";
  $("fScoreOnly").textContent = "POST SCORE";
  $("fSubmit").textContent = "SEND MY AI RISK REPORT";
  document.querySelector("#claim p").textContent =
    "Your score posts to the team leaderboard automatically. Want the real version? Leave your details and Cranium will send how much shadow AI is running in your organization.";
  fetchRemote();
  setInterval(() => {
    if (!document.hidden) fetchRemote();
  }, 60000);
}
function localMode() {
  LOCAL = true;
  document.querySelector("#board h2").textContent = "YOUR BEST RUNS";
  boardNote.textContent = "Saved on this device";
  ["fName", "fEmail", "fPhone", "fTitle", "fConsent"].forEach((id) => {
    const el = $(id);
    if (el) el.closest("label").hidden = true;
  });
  $("fSubmit").hidden = true;
  $("fScoreOnly").textContent = "SAVE SCORE";
  document.querySelector("#claim h2").textContent = "SAVE YOUR RUN";
  document.querySelector("#claim p").textContent =
    "Add a tag to save this run to your best runs on this device.";
  renderLocal();
}
function renderOffline() {
  boardBody.textContent = "";
  const tr = document.createElement("tr");
  const td = cell("Sign in to claude.ai to see and post scores.", "empty");
  td.colSpan = 5;
  tr.appendChild(td);
  boardBody.appendChild(tr);
}

const form = $("claimForm"),
  fMsg = $("fMsg");
function showClaim(F) {
  saved = false;
  $("claim").hidden = false;
  $("fTag").value = PLAYER.tag;
  $("fCompany").value = PLAYER.co;
  if ((REMOTE || LOCAL) && PLAYER.tag) setTimeout(() => postScore(false), 400);
  $("share").hidden = true;
  fMsg.textContent = "";
  fMsg.className = "msg";
  $("finalLine").textContent = F.grade + " · " + F.score.toLocaleString("en-US") + " PTS";
  $("fSubmit").disabled = false;
  $("fScoreOnly").disabled = false;
  if (!db && !LOCAL) {
    fMsg.textContent = "Saving is unavailable in this view, but you can still share your run.";
    buildShare(F);
  }
  setTimeout(() => $("claim").scrollIntoView({ behavior: "smooth", block: "start" }), 2600);
}
function hideClaim() {
  $("claim").hidden = true;
  $("share").hidden = true;
}
const clean = (s, n) =>
  String(s || "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, n);
async function postScore(withLead) {
  const F = S.final;
  if (!F || (saved && !withLead)) return;
  const tag = clean($("fTag").value, 12).toUpperCase(),
    company = clean($("fCompany").value, 28);
  if (!tag) {
    fail("Add a player tag for the leaderboard.");
    $("fTag").focus();
    return;
  }
  let lead = null;
  if (withLead) {
    const name = clean($("fName").value, 60),
      email = clean($("fEmail").value, 90),
      title = clean($("fTitle").value, 60);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail("Add your name and a valid work email, or post your score only.");
      return;
    }
    if (!$("fConsent").checked) {
      fail("Tick the box so Cranium can send your report.");
      return;
    }
    const phone = clean($("fPhone").value, 20).replace(/[^0-9+()\-. ]/g, "");
    if (!uid && !REMOTE) {
      fail("This view can't store contact details. Post your score only.");
      return;
    }
    lead = {
      name,
      email,
      phone,
      company,
      title,
      tag,
      score: F.score,
      grade: F.grade,
      hard: F.hard,
      at: Date.now(),
      consent: true,
    };
  }
  if (REMOTE) {
    const base = SUPA.url.replace(/\/$/, "") + "/rest/v1/",
      hdr = Object.assign(supaHeaders(), { Prefer: "return=minimal" });
    fMsg.className = "msg";
    fMsg.textContent = lead ? "Sending…" : "Posting…";
    if (!saved) {
      try {
        const r = await fetch(base + "scores", {
          method: "POST",
          headers: hdr,
          body: JSON.stringify({
            tag,
            company,
            score: F.score,
            grade: F.grade,
            time: F.time,
            hard: F.hard,
            reached: "CLEARED",
          }),
        });
        if (!r.ok) throw 0;
        saved = true;
        $("fScoreOnly").hidden = true;
        fMsg.textContent = "Posted to the team leaderboard.";
        fetchRemote();
        buildShare(F, tag);
      } catch (e) {
        fail("Couldn't reach the leaderboard. Try again in a moment.");
      }
    }
    if (lead) {
      $("fSubmit").disabled = true;
      try {
        const r = await fetch(base + "leads", {
          method: "POST",
          headers: hdr,
          body: JSON.stringify({
            name: lead.name,
            email: lead.email,
            phone: lead.phone || null,
            org: company,
            title: lead.title || null,
            tag,
            score: F.score,
            grade: F.grade,
          }),
        });
        if (!r.ok) throw 0;
        fMsg.className = "msg";
        fMsg.textContent = "Report request sent. Cranium will be in touch.";
      } catch (e) {
        $("fSubmit").disabled = false;
        fail("Couldn't send your details. Try again in a moment.");
      }
    }
    try {
      const a = loadLocal();
      a.push({ tag, company, score: F.score, grade: F.grade, time: F.time, hard: F.hard, at: Date.now() });
      localStorage.setItem(LKEY, JSON.stringify(a.sort((x, y) => y.score - x.score).slice(0, 25)));
    } catch (e) {}
    return;
  }
  if (LOCAL) {
    try {
      const a = loadLocal();
      a.push({ tag, company, score: F.score, grade: F.grade, time: F.time, hard: F.hard, at: Date.now() });
      a.sort((x, y) => y.score - x.score);
      localStorage.setItem(LKEY, JSON.stringify(a.slice(0, 25)));
    } catch (e) {}
    saved = true;
    fMsg.className = "msg";
    fMsg.textContent = "Saved to your best runs.";
    renderLocal();
    buildShare(F, tag);
    return;
  }
  if (!db) {
    fail("Saving is unavailable in this view.");
    return;
  }
  $("fSubmit").disabled = true;
  $("fScoreOnly").disabled = true;
  fMsg.className = "msg";
  fMsg.textContent = "Saving…";
  try {
    if (!saved)
      await db
        .collection("scores")
        .add({
          tag,
          company,
          score: F.score,
          grade: F.grade,
          time: F.time,
          sec: F.sec,
          hard: F.hard,
          frameworks: F.frameworks,
          vendors: F.vendors,
          at: Date.now(),
        });
    if (lead) {
      await db.collection("leads/" + uid + "/entries").add(lead);
      try {
        await db.doc("leadIndex/" + uid).set({ at: Date.now() });
      } catch (e) {}
    }
    saved = true;
    fMsg.textContent = lead
      ? "Score posted. Report request sent to Cranium."
      : "Score posted to the leaderboard.";
    buildShare(F, tag);
    if (owner) loadLeads();
  } catch (e) {
    $("fSubmit").disabled = false;
    $("fScoreOnly").disabled = false;
    fail(
      e && e.code === "invalid_argument"
        ? "This view can't save. Ask the game's owner to share it with you as a Contributor."
        : e && e.code === "quota_exceeded"
          ? "The leaderboard is full. Tell the game's owner."
          : "Couldn't save just now. Try again.",
    );
  }
}
function fail(m) {
  fMsg.className = "msg err";
  fMsg.textContent = m;
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  postScore(true);
});
$("fScoreOnly").addEventListener("click", () => postScore(false));

function buildShare(F, tag) {
  $("share").hidden = false;
  const c = $("shareCard"),
    x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  const gr = x.createLinearGradient(0, 0, 0, 314);
  gr.addColorStop(0, "#07060d");
  gr.addColorStop(1, "#1c0f33");
  x.fillStyle = gr;
  x.fillRect(0, 0, 600, 314);
  for (let i = 0; i < 90; i++) {
    x.fillStyle = i % 9 ? "#4d5a98" : "#ffffff";
    x.fillRect((hash(i, 11) * 600) | 0, (hash(13, i) * 314) | 0, 2, 2);
  }
  for (let y = 0; y < 314; y += 4) {
    x.fillStyle = "rgba(0,0,0,.18)";
    x.fillRect(0, y, 600, 2);
  }
  const T2 = (s, px, py, col, size, al = "left") => {
    x.font = size + 'px "Press Start 2P", monospace';
    x.textAlign = al;
    x.fillStyle = "#000";
    x.fillText(s, px + 3, py + 3);
    x.fillStyle = col;
    x.fillText(s, px, py);
  };
  T2("CRANIUM", 40, 64, "#f2c14e", 36);
  x.fillStyle = "#b07cff";
  x.fillRect(40, 78, 270, 4);
  T2("SHADOW KEEP", 40, 112, "#ece8f7", 18);
  x.drawImage(PS.knight.down[0], 58, 160, 64, 64);
  x.drawImage(chipH, 138, 176, 36, 36);
  const lines = [
    ["SHADOW AI", NASSET + "/" + NASSET],
    ["FRAMEWORKS", F.frameworks + "/" + NSCROLL],
    ["VENDORS", F.vendors + "/8"],
    ["BOSSES", "2/2"],
    ["TIME", F.time + (F.hard ? " HARD" : "")],
  ];
  lines.forEach(([a, b], i) => {
    T2(a, 330, 150 + i * 24, "#9d96bb", 11);
    T2(b, 560, 150 + i * 24, "#ece8f7", 11, "right");
  });
  x.strokeStyle = "#f2c14e";
  x.lineWidth = 4;
  x.strokeRect(440, 28, 120, 84);
  T2("GRADE", 500, 54, "#9d96bb", 10, "center");
  T2(F.grade, 500, 100, F.grade === "S" ? "#b07cff" : "#f2c14e", 34, "center");
  T2(F.score.toLocaleString("en-US") + " PTS", 40, 276, "#b07cff", 14);
  if (tag) T2(tag, 560, 276, "#f2c14e", 12, "right");
  T2("DISCOVER · RED TEAM · GOVERN", 300, 300, "#7d6a9a", 9, "center");
  T2("A GAME BY BRIAN TEMPLE", 560, 20, "#7d6a9a", 8, "right");
  const post =
    "Just cleared Shadow Keep, Cranium's 8-bit AI security quest" +
    (F.hard ? " on hard mode" : "") +
    ".\n\n" +
    NASSET +
    "/" +
    NASSET +
    " shadow AI discovered across code, cloud, vendors, agents, banking and healthcare. " +
    F.frameworks +
    "/" +
    NSCROLL +
    " frameworks mapped (EU AI Act, NIST AI RMF, ISO 42001 and more). Rogue Model and Supply Chain Hydra quarantined.\n\nGrade " +
    F.grade +
    " · " +
    F.score.toLocaleString("en-US") +
    " points · " +
    F.time +
    "\n\nHow much shadow AI is running in your org? #AISecurity #ShadowAI #Cranium";
  $("postText").textContent = post;
  $("liLink").href = "https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(post);
}
async function copyText(t, msgEl) {
  try {
    await navigator.clipboard.writeText(t);
    msgEl.className = "msg";
    msgEl.textContent = "Copied.";
  } catch (e) {
    msgEl.className = "msg err";
    msgEl.textContent = "Copy blocked here. Select the text and copy it manually.";
  }
}
$("copyPost").addEventListener("click", () => copyText($("postText").textContent, $("shareMsg")));
$("saveCard").addEventListener("click", () => {
  if (!downloads) return;
  $("shareCard").toBlob(async (b) => {
    if (!b) return;
    try {
      await downloads.save({ filename: "shadow-keep-report.png", data: b });
      $("shareMsg").className = "msg";
      $("shareMsg").textContent = "Saved.";
    } catch (e) {
      $("shareMsg").className = "msg";
      $("shareMsg").textContent = "Save cancelled.";
    }
  }, "image/png");
});

let leadRows = [];
async function loadLeads() {
  if (!db || !owner) return;
  const lm = $("leadMsg");
  lm.className = "msg";
  lm.textContent = "Loading…";
  try {
    const idx = await db.collection("leadIndex").limit(500).get();
    const rows = [];
    for (const d of idx.docs) {
      try {
        const s = await db
          .collection("leads/" + d.id + "/entries")
          .limit(500)
          .get();
        s.docs.forEach((x) => rows.push(x.data() || {}));
      } catch (e) {}
    }
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    leadRows = rows;
    renderLeads();
    lm.textContent = "";
  } catch (e) {
    lm.className = "msg err";
    lm.textContent = "Couldn't load leads. Try Refresh.";
  }
}
function renderLeads() {
  const b = $("leadBody");
  b.textContent = "";
  $("leadCount").textContent = "(" + leadRows.length + ")";
  if (!leadRows.length) {
    const tr = document.createElement("tr");
    const td = cell("No leads yet. Finished players who share their details show up here.", "empty");
    td.colSpan = 6;
    tr.appendChild(td);
    b.appendChild(tr);
    return;
  }
  leadRows.forEach((r) => {
    const tr = document.createElement("tr");
    [r.name, r.email, r.phone, r.company].forEach((v) => tr.appendChild(cell(String(v || "—"))));
    tr.appendChild(cell(Number(r.score || 0).toLocaleString("en-US"), "num"));
    tr.appendChild(cell(r.at ? new Date(r.at).toLocaleDateString("en-US") : "—"));
    b.appendChild(tr);
  });
}
$("leadsRefresh").addEventListener("click", loadLeads);

function openEntry() {
  S.mode = "entry";
  try {
    document.querySelector(".cab").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (_) {}
  const e = $("entry");
  e.hidden = false;
  $("eTag").value = PLAYER.tag;
  $("eCo").value = PLAYER.co;
  sfx(660, 0.06);
  setTimeout(() => {
    try {
      $("eTag").focus();
    } catch (_) {}
  }, 50);
}
function closeEntry() {
  $("entry").hidden = true;
}
$("eBack").addEventListener("click", () => {
  closeEntry();
  S.mode = "title";
});
$("entryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  audio();
  const t0 = clean($("eTag").value, 12).toUpperCase(),
    c0 = clean($("eCo").value, 28);
  if (!t0 || !c0) {
    $("eMsg").textContent = !t0 ? "Add a player tag." : "Add your organization.";
    $(!t0 ? "eTag" : "eCo").focus();
    return;
  }
  $("eMsg").textContent = "";
  PLAYER.tag = t0;
  PLAYER.co = c0;
  try {
    localStorage.setItem("shadowkeep-player", JSON.stringify(PLAYER));
  } catch (_) {}
  closeEntry();
  try {
    document.activeElement && document.activeElement.blur();
  } catch (_) {}
  const h = S.hard;
  newGame("intro", h);
  jingle([523, 659, 784, 1047]);
});
