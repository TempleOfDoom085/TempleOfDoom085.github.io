/* Knights Templar 3D — combat impact ("juice").

   Sword trails, hit-stop and slow motion, shockwaves, camera punch and
   blood-mist on every blow, and a signature effect for each relic ability.
   Purely visual: driven by engine impact events (E.onImpact) and by wrapping
   the game's useAbility() — the numbers are the game's own. */
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  const G3D = window.G3D;
  if (!G3D || !G3D.engine || !G3D.engine.active || !G3D.engine.ctx) return;
  const E = G3D.engine, C = E.ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = G3D.clamp, calm = C.reducedMotion;

  // ── Sword trail: a ribbon between hilt and tip, sampled while swinging ─────
  const N = 22, LIFE = 0.22;
  const tpos = new Float32Array(N * 2 * 3), talpha = new Float32Array(N * 2);
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  tgeo.setAttribute('alpha', new THREE.BufferAttribute(talpha, 1));
  const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  tgeo.setIndex(idx);
  const tmat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#ffe8b0') }, gain: { value: 1 } },
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float gain; varying float vA; void main(){ gl_FragColor = vec4(color * vA * gain, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const trail = new THREE.Mesh(tgeo, tmat); trail.frustumCulled = false; trail.renderOrder = 8; C.scene.add(trail);
  const samples = [];   // { b, t, age }
  const hilt = V(0, 0.12, 0), tip = V(0, 0.95, 0);
  let power = 0, light = 0;   // ability flavours for the trail
  function updateTrail(dt) {
    samples.forEach(s => s.age += dt);
    while (samples.length && samples[samples.length - 1].age > LIFE) samples.pop();
    const k = C.knight, w = k && k.R.weapon;
    const swinging = k && k.anim && (k.anim.name === 'attack' || k.anim.name === 'divine') && !calm;
    if (swinging && w) {
      w.updateMatrixWorld(true);
      samples.unshift({ b: w.localToWorld(hilt.clone()), t: w.localToWorld(tip.clone()), age: 0 });
      if (samples.length > N) samples.length = N;
    }
    trail.visible = samples.length > 1;
    if (!trail.visible) return;
    for (let i = 0; i < N; i++) {
      const s = samples[Math.min(i, samples.length - 1)], a = i < samples.length ? Math.pow(1 - s.age / LIFE, 1.5) * (1 - i / N) : 0;
      tpos.set([s.b.x, s.b.y, s.b.z], i * 6); tpos.set([s.t.x, s.t.y, s.t.z], i * 6 + 3);
      talpha[i * 2] = a * 0.15; talpha[i * 2 + 1] = a;
    }
    tgeo.attributes.position.needsUpdate = true; tgeo.attributes.alpha.needsUpdate = true;
    tgeo.computeBoundingSphere();
    const gold = STATE.hasGoldenArmor;
    tmat.uniforms.color.value.set(power > 0 ? '#ff8a30' : light > 0 ? '#ffffff' : gold ? '#ffd36a' : '#ffe8b0');
    tmat.uniforms.gain.value = power > 0 ? 2.6 : light > 0 ? 2.2 : 1.3;
  }

  // ── Shockwaves: expanding rings on the ground and facing the camera ───────
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  function shockwave(pos, color, size, upright) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.3), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const r = new THREE.Mesh(ringGeo, m); r.position.copy(pos); r.renderOrder = 8;
    if (upright) r.lookAt(C.camera.position); else r.rotation.x = -Math.PI / 2;
    r.userData = { t: 0, size: size || 2.5, dur: upright ? 0.35 : 0.55 };
    C.scene.add(r); rings.push(r);
  }
  function updateRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], u = r.userData; u.t += dt;
      const k = u.t / u.dur, e = 1 - Math.pow(1 - Math.min(k, 1), 3);
      r.scale.setScalar(0.1 + e * u.size); r.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { C.scene.remove(r); r.material.dispose(); rings.splice(i, 1); }
    }
  }

  // ── Every blow lands ──────────────────────────────────────────────────────
  const MIST = { risen: '#5a1010', peasant: '#4a2a10', necromancer: '#2aff5a', wraith: '#7ad8e8' };
  E.onImpact = function (who, flag, pos) {
    if (who === 'enemy') {
      const crit = flag, final = STATE.enemyHp <= 0 || !STATE.inCombat;
      if (!calm) {
        E.stopT = Math.max(E.stopT, final ? 0.12 : crit ? 0.09 : 0.055);
        if (crit || final || power > 0) E.slowT = Math.max(E.slowT, final ? 0.9 : 0.5);
        E.punch(final ? 1.4 : crit ? 1 : 0.5);
      }
      const type = C.enemy && C.enemy.type;
      E.burst('smoke', pos, crit ? 26 : 14, MIST[type] || '#5a1010', 1.4);
      shockwave(pos, power > 0 ? '#ff7a20' : crit ? '#ffd27a' : '#ffe0b0', crit || power > 0 ? 1.6 : 1.0, true);
      if (crit || final || power > 0) shockwave(pos.clone().setY(0.05), power > 0 ? '#ff6a10' : '#ffd27a', final ? 5 : 3);
      if (power > 0) { E.burst('ember', pos, 80, '#ff7a20', 4); C.post.flash = Math.max(C.post.flash, 0.9); C.post.flashCol.set('#ff8a30'); power = 0; }
      if (light > 0) light = 0;
    } else {
      const blocked = flag || STATE.questFlags._ironWallActive || dome.visible;
      if (!calm) { E.stopT = Math.max(E.stopT, 0.05); E.punch(blocked ? 0.3 : 0.6); }
      if (blocked) shockwave(pos, '#8ac8ff', 1.2, true);
      else E.burst('smoke', pos, 10, '#5a0808', 1.2);
    }
  };

  // ── Relic abilities ───────────────────────────────────────────────────────
  // Iron Wall: a translucent shield dome around the knight.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 40, 24), new THREE.ShaderMaterial({
    uniforms: { time: G3D.uniforms.time, fade: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float time, fade; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
        vec2 h = vec2(atan(vP.z, vP.x) * 6.0, vP.y * 10.0);
        float hex = smoothstep(0.85, 1.0, max(abs(fract(h.x) - 0.5), abs(fract(h.y + floor(h.x) * 0.5) - 0.5)) * 2.0);
        float sweep = smoothstep(0.08, 0.0, abs(fract(vP.y * 0.4 - time * 0.6) - 0.5));
        gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * (f * 0.75 + hex * 0.22 + sweep * 0.3) * fade, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  dome.visible = false; dome.renderOrder = 7; C.scene.add(dome);
  let domeT = 0;
  // Divine Heal: a column of golden light poured onto the knight.
  const column = G3D.props.lightShaft(0.5, 1.2, 9, '#ffe6a0', 0.001); column.visible = false; C.scene.add(column);
  let columnT = 0;
  function fx(key) {
    const k = C.knight; if (!k) return;
    const at = k.R.root.position.clone();
    if (key === 'powerStrike') {
      power = 1.6;
      E.burst('ember', at.clone().setY(1.4), 50, '#ff7a20', 2.5);
      C.post.flash = Math.max(C.post.flash, 0.5); C.post.flashCol.set('#ff7a20');
    } else if (key === 'ironWall') {
      domeT = 2.6; dome.visible = true;
      shockwave(at.clone().setY(0.05), '#8ac8ff', 2.2);
    } else if (key === 'divineHeal') {
      columnT = 2.0; column.visible = true;
      column.position.set(at.x, 9.5, at.z); column.lookAt(at.x, 0, at.z); column.rotateX(-Math.PI / 2);
      E.burst('holy', at.clone().setY(0.6), 140, '#ffe08a', 2.4);
      shockwave(at.clone().setY(0.05), '#ffe08a', 2.6);
    } else if (key === 'holyLight') {
      light = 3;
      C.post.flash = Math.max(C.post.flash, 1.6); C.post.flashCol.set('#ffffff');
      E.burst('holy', at.clone().setY(1.5), 220, '#ffffff', 5);
      shockwave(at.clone().setY(1.3), '#ffffff', 3.5, true);
      if (!calm) E.slowT = Math.max(E.slowT, 0.4);
    } else if (key === 'martyr') {
      C.post.flash = 1.8; C.post.flashCol.set('#ffd36a');
      E.burst('holy', at.clone().setY(1.2), 260, '#ffd36a', 4);
      shockwave(at.clone().setY(0.05), '#ffd36a', 4);
      if (!calm) E.slowT = Math.max(E.slowT, 1.0);
    }
  }
  const origUse = window.useAbility;
  if (typeof origUse === 'function') {
    window.useAbility = function (key) {
      const before = STATE.abilityCooldowns[key] || 0, inC = STATE.inCombat;
      const r = origUse.apply(this, arguments);
      if (E.active && inC && before <= 0 && (STATE.abilityCooldowns[key] || 0) > 0) fx(key);
      return r;
    };
  }
  let rosary = !!STATE.rosaryUsed;

  function frame(dt) {
    power = Math.max(0, power - dt); light = Math.max(0, light - dt);
    updateTrail(dt); updateRings(dt);
    const k = C.knight;
    if (domeT > 0 && k) {
      domeT -= dt; dome.position.copy(k.R.root.position).y += 1.0;
      const a = Math.min(1, (2.6 - domeT) / 0.25) * Math.min(1, domeT / 0.4);
      dome.material.uniforms.fade.value = a; dome.scale.setScalar(0.85 + 0.15 * Math.min(1, (2.6 - domeT) / 0.25));
      if (domeT <= 0) dome.visible = false;
    }
    if (columnT > 0) { columnT -= dt; column.material.uniforms.strength.value = 0.6 * Math.min(1, (2 - columnT) / 0.3) * Math.min(1, columnT / 0.6); if (columnT <= 0) column.visible = false; }
    // Martyr's Resolve (the Rosary) cheats death
    if (STATE.rosaryUsed && !rosary) fx('martyr');
    rosary = !!STATE.rosaryUsed;
  }
  const prevFrame = E.onFrame;
  E.onFrame = function (dt) { if (prevFrame) prevFrame(dt); frame(dt); };
  G3D.juice = { shockwave, fx };
  }
})();
