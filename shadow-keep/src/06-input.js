/* ================= INPUT ================= */
const keys = {};
let aQ = false,
  bQ = false,
  mQ = false,
  cQ = false,
  aDown = false;
const CK = new Set(["KeyC", "KeyL"]);
const KM = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
const AK = new Set(["Space", "KeyJ", "KeyZ", "Enter"]),
  BK = new Set(["KeyX", "KeyK", "ShiftLeft", "ShiftRight"]),
  MK = new Set(["KeyI", "Escape", "Tab", "KeyP"]);
const typing = (e) => e.target && e.target.closest && e.target.closest("input,textarea,select,button,a");
addEventListener("keydown", (e) => {
  if (typing(e)) return;
  audio();
  if (KM[e.code]) {
    keys[KM[e.code]] = true;
    e.preventDefault();
  }
  if (AK.has(e.code)) {
    if (!e.repeat) aQ = true;
    aDown = true;
    e.preventDefault();
  }
  if (BK.has(e.code)) {
    if (!e.repeat) bQ = true;
    e.preventDefault();
  }
  if (MK.has(e.code)) {
    if (!e.repeat) mQ = true;
    e.preventDefault();
  }
  if (CK.has(e.code)) {
    if (!e.repeat) cQ = true;
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  if (KM[e.code]) keys[KM[e.code]] = false;
  if (AK.has(e.code)) aDown = false;
});
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  aDown = false;
});
document.querySelectorAll(".face [data-k]").forEach((b) => {
  const k = b.dataset.k;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio();
    document.body.classList.add("touch");
    try {
      b.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (k === "a") {
      aQ = true;
      aDown = true;
    } else if (k === "b") bQ = true;
    else if (k === "menu") mQ = true;
    else if (k === "c") cQ = true;
    else keys[k] = true;
    b.classList.add("on");
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
    b.addEventListener(ev, () => {
      if (k === "a") aDown = false;
      else if (!["b", "menu", "c"].includes(k)) keys[k] = false;
      b.classList.remove("on");
    }),
  );
  b.addEventListener("contextmenu", (e) => e.preventDefault());
});
// Touch D-pad: the whole pad is one control. Slide your thumb anywhere on it for
// 8-way movement; a tap in the center opens the AI inventory.
const dpad = document.querySelector(".dpad"),
  dpadBtns = { up: dpad.querySelector(".u"), down: dpad.querySelector(".d"), left: dpad.querySelector(".l"), right: dpad.querySelector(".r") };
let dpadPointer = null;
function dpadAim(e) {
  const r = dpad.getBoundingClientRect(),
    dx = e.clientX - (r.left + r.width / 2),
    dy = e.clientY - (r.top + r.height / 2),
    dead = r.width * 0.12,
    ax = Math.abs(dx),
    ay = Math.abs(dy);
  // Each axis counts once it clears the dead zone and isn't dwarfed by the other
  // axis, so the corners between arrows give diagonals.
  keys.left = dx < -dead && ax > ay * 0.45;
  keys.right = dx > dead && ax > ay * 0.45;
  keys.up = dy < -dead && ay > ax * 0.45;
  keys.down = dy > dead && ay > ax * 0.45;
  for (const k in dpadBtns) dpadBtns[k].classList.toggle("on", !!keys[k]);
}
function dpadRelease() {
  dpadPointer = null;
  keys.up = keys.down = keys.left = keys.right = false;
  for (const k in dpadBtns) dpadBtns[k].classList.remove("on");
}
dpad.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  audio();
  document.body.classList.add("touch");
  if (e.target.closest(".m")) {
    mQ = true;
    return;
  }
  dpadPointer = e.pointerId;
  try {
    dpad.setPointerCapture(e.pointerId);
  } catch (_) {}
  dpadAim(e);
});
dpad.addEventListener("pointermove", (e) => {
  if (e.pointerId === dpadPointer) dpadAim(e);
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
  dpad.addEventListener(ev, (e) => {
    if (e.pointerId === dpadPointer) dpadRelease();
  }),
);
dpad.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointerdown", (e) => {
  audio();
  if (e.pointerType === "touch") document.body.classList.add("touch");
  if (S.mode === "vendor" && S.vg) {
    if (S.vg.phase === "decide") {
      const r = cv.getBoundingClientRect();
      if ((e.clientX - r.left) / r.width < 0.5) aQ = true;
      else bQ = true;
    } else aQ = true;
    return;
  }
  if (S.mode !== "play") {
    aQ = true;
  }
});
