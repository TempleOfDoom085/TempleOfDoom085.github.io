/* ================= LOOP ================= */
let last = performance.now(),
  acc = 0;
function loop(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    update();
    acc -= 1000 / 60;
  }
  draw();
  requestAnimationFrame(loop);
}
(document.fonts
  ? Promise.all([document.fonts.load(F8), document.fonts.load(F24)]).catch(() => {})
  : Promise.resolve()
).finally(() => requestAnimationFrame(loop));

// Test hook: lets tests/run.mjs drive the game without a browser.
if (globalThis.__SK_TEST__) {
  globalThis.__SK_TEST__({
    get S() { return S; },
    update,
    draw,
    keys,
    press(button) {
      if (button === "a") aQ = true;
      else if (button === "b") bQ = true;
      else if (button === "c") cQ = true;
      else if (button === "menu") mQ = true;
    },
    hold(button, down) { if (button === "a") aDown = down; },
    newGame,
    room,
    PLAYER,
    INTEL,
    ROOMFACT,
    NASSET,
    computeFinal,
    wrap,
    shake,
    setCalm(v) { calm = v; },
  });
}
