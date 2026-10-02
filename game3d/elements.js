/* Knights Templar 3D — water and fire (v18).

   Water: rooms with a water surface switch on caustics (light from the
   moving water dancing over the stone, game3d/core.js) and drive the
   surface's ripple rings (game3d/props.js, P.water): a wake at every step the
   knight takes through it, rings where his foe moves, and drips falling from
   the vault.
   Fire: every flame in a room breathes embers and, now and then, a curl of
   smoke, so torches and braziers feel hot and alive. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx) return;
  const E = G3D.engine, C = E.ctx, U = G3D.uniforms;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const calm = C.reducedMotion;
  const rnd = (a, b) => a + Math.random() * (b - a);
  if (!U.ripples) U.ripples = { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) };
  if (!U.caustic) U.caustic = { value: 0 };
  if (!U.causticY) U.causticY = { value: 0 };

  const st = { water: null, waterY: 0, box: null, flames: [], slot: 0, drip: 0, caustic: 0, lastFoe: null };

  function ripple(x, z, strength) {
    const r = U.ripples.value[st.slot]; st.slot = (st.slot + 1) % 8;
    r.set(x, z, U.time.value, strength);
  }

  function scan(spec) {
    st.water = null; st.flames = []; st.box = null;
    U.ripples.value.forEach(r => r.set(0, 0, -100, 0));
    if (!spec || !spec.group) return;
    const wp = V(), box = new THREE.Box3();
    spec.group.updateMatrixWorld(true);
    spec.group.traverse(o => {
      if (o.userData && o.userData.water && !st.water) {
        st.water = o; o.getWorldPosition(wp); st.waterY = wp.y;
        box.setFromObject(o); st.box = box.clone();
      }
      // Flames: G3D.flame meshes (camera-facing shader planes with a power uniform).
      if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.power && o.material.uniforms.seed) {
        o.getWorldPosition(wp);
        st.flames.push({ o, pos: wp.clone(), size: o.scale.y, color: '#' + o.material.uniforms.color.value.getHexString(), next: rnd(0, 1) });
      }
    });
    U.causticY.value = st.waterY;
  }

  // Footsteps in water leave wakes.
  const prevStep = E.onStep;
  E.onStep = function (actor) {
    if (prevStep) prevStep(actor);
    if (!st.water || calm) return;
    const p = actor.R.root.position;
    if (st.box && p.x > st.box.min.x && p.x < st.box.max.x && p.z > st.box.min.z && p.z < st.box.max.z && p.y < st.waterY + 0.35)
      ripple(p.x + rnd(-0.1, 0.1), p.z + rnd(-0.1, 0.1), actor === C.knight ? 1.0 : 0.8);
  };

  const prevRoom = E.onRoom, prevFrame = E.onFrame;
  E.onRoom = function (id, spec) { if (prevRoom) prevRoom(id, spec); scan(spec); };
  E.onFrame = function (dt) {
    if (prevFrame) prevFrame(dt);
    // Caustics ease in and out with the room.
    const want = st.water ? 1.0 : 0;
    st.caustic += (want - st.caustic) * Math.min(1, dt * 2);
    U.caustic.value = st.caustic < 0.01 ? 0 : st.caustic;
    if (calm || E.cinema) return;
    // Drips from the vault, and the slow wake of anything drifting in the water.
    if (st.water && st.box) {
      st.drip -= dt;
      if (st.drip <= 0) { st.drip = rnd(0.5, 2.2); ripple(rnd(st.box.min.x + 0.5, st.box.max.x - 0.5), rnd(st.box.min.z + 0.5, Math.min(st.box.max.z, 2) - 0.5), rnd(0.35, 0.7)); }
      const foe = C.enemy;
      if (foe && foe.alive && foe.R.root.visible) {
        const p = foe.R.root.position;
        if (!st.lastFoe || st.lastFoe.distanceTo(p) > 0.45) { if (st.lastFoe) ripple(p.x, p.z, foe.kind === 'wraith' ? 0.6 : 0.8); st.lastFoe = p.clone(); }
      }
    }
    // Fire: embers lift off every flame in view; bigger fires throw more, and a little smoke.
    for (let i = 0; i < st.flames.length; i++) {
      const f = st.flames[i];
      if (!f.o.visible) continue;
      f.next -= dt * (0.6 + f.size * 1.2);
      if (f.next > 0) continue;
      f.next = rnd(0.25, 0.9);
      const p = f.pos.clone(); p.y += f.size * 0.6; p.x += rnd(-0.06, 0.06); p.z += rnd(-0.06, 0.06);
      E.burst('ember', p, f.size > 0.9 ? 3 : 1, f.color, 0.35 + f.size * 0.25);
      if (f.size > 0.8 && Math.random() < 0.18) E.burst('smoke', p.add(V(0, f.size * 0.6, 0)), 1, '#2a2420', 0.4);
    }
  };
  if (C.roomId) scan(C.room);
  G3D.elements = { state: st, ripple };
  }
})();
