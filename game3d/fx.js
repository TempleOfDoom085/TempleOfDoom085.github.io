/* Knights Templar 3D — the cinematic ("Ultra") post-processing pipeline.

   CinematicPass renders the scene once into an HDR target with a depth
   texture, then works from that depth:
   • ambient occlusion (scalable SAO, half resolution)
   • volumetric fog — ray-marched height fog with drifting 3D noise, lit by
     the room's torches and by the key light *through its shadow map*, so
     windows, arches and pillars cast real shafts of light into the mist
   • a depth-aware upsample that composites both onto the image
   Then: depth of field (golden-angle bokeh), and FXAA after grading.
   The engine falls back to its standard pipeline without WebGL2. */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE || !THREE.Pass) return;
  const NL = 6;   // point lights fed to the fog (matches the engine's light pool)

  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const COMMON = `
    #include <packing>
    uniform sampler2D tDepth; uniform mat4 projInv; uniform float cNear, cFar;
    varying vec2 vUv;
    float rawDepth(vec2 uv){ return texture2D(tDepth, uv).x; }
    vec3 viewPos(vec2 uv, float d){ vec4 p = projInv * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
    float linDepth(vec2 uv){ return -perspectiveDepthToViewZ(rawDepth(uv), cNear, cFar); }
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    // View-space normal from the depth buffer (picks the smoother side at edges).
    vec3 viewNormal(vec2 uv, vec3 P, vec2 px){
      vec3 pr = viewPos(uv + vec2(px.x, 0.0), rawDepth(uv + vec2(px.x, 0.0)));
      vec3 pl = viewPos(uv - vec2(px.x, 0.0), rawDepth(uv - vec2(px.x, 0.0)));
      vec3 pu = viewPos(uv + vec2(0.0, px.y), rawDepth(uv + vec2(0.0, px.y)));
      vec3 pd = viewPos(uv - vec2(0.0, px.y), rawDepth(uv - vec2(0.0, px.y)));
      vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
      vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
      vec3 n = normalize(cross(dx, dy));
      return dot(n, P) > 0.0 ? -n : n;
    }
  `;

  // ── Ambient occlusion (after McGuire et al., "Scalable Ambient Obscurance") ─
  const AO_FRAG = COMMON + `
    uniform vec2 fullRes; uniform float radius, intensity, bias, projScale;
    const int N = 14;
    void main(){
      float d = rawDepth(vUv);
      if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = viewPos(vUv, d);
      vec2 px = 1.0 / fullRes;
      vec3 Nn = viewNormal(vUv, P, px);
      float ssR = min(radius * projScale / -P.z, 90.0);
      if (ssR < 1.0) { gl_FragColor = vec4(1.0); return; }
      float ang = hash12(gl_FragCoord.xy) * 6.2831853;
      float r2 = radius * radius, occ = 0.0;
      for (int i = 0; i < N; i++) {
        float fi = float(i), a = (fi + 0.5) / float(N);
        float th = ang + fi * 2.39996;
        vec2 uv = vUv + vec2(cos(th), sin(th)) * (a * a * 0.85 + 0.15) * ssR * px;
        vec3 Q = viewPos(uv, rawDepth(uv));
        vec3 v = Q - P;
        float vv = dot(v, v), vn = dot(v, Nn);
        float f = max(r2 - vv, 0.0);
        occ += f * f * f * max((vn - bias) / (0.01 + vv), 0.0);
      }
      float ao = max(0.0, 1.0 - occ * intensity * 5.0 / (r2 * r2 * r2 * float(N)));
      gl_FragColor = vec4(vec3(ao), 1.0);
    }`;

  // ── Screen-space reflections on floors (wet stone, polished marble, puddles) ─
  const SSR_FRAG = COMMON + `
    uniform sampler2D tScene; uniform mat4 proj, viewInv; uniform vec2 fullRes; uniform float wet, puddles; uniform vec3 missCol;
    float vn2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      float d = rawDepth(vUv);
      if (d >= 0.99999 || wet <= 0.0) { gl_FragColor = vec4(0.0); return; }
      vec3 P = viewPos(vUv, d);
      vec2 px = 1.0 / fullRes;
      vec3 N = viewNormal(vUv, P, px);
      vec3 Nw = (viewInv * vec4(N, 0.0)).xyz;
      float floorness = smoothstep(0.82, 0.97, Nw.y);
      if (floorness < 0.01) { gl_FragColor = vec4(0.0); return; }
      // Puddles: patches of standing water in the floor, the rest just damp.
      vec3 W = (viewInv * vec4(P, 1.0)).xyz;
      float pud = smoothstep(0.52, 0.7, vn2(W.xz * 0.55) * 0.7 + vn2(W.xz * 1.7 + 3.0) * 0.3);
      float mask = wet * mix(0.35, 1.0, pud * puddles) * floorness;
      vec3 Vd = normalize(P);
      vec3 R = reflect(Vd, N);
      float stepLen = 0.12 + hash12(gl_FragCoord.xy) * 0.08, t = stepLen;
      vec3 hit = vec3(0.0); float conf = 0.0;
      for (int i = 0; i < 28; i++) {
        vec3 Q = P + R * t;
        vec4 cp = proj * vec4(Q, 1.0); vec2 uv = cp.xy / cp.w * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || Q.z > -cNear) break;
        float sz = viewPos(uv, rawDepth(uv)).z;
        float dz = sz - Q.z;
        if (dz > 0.0 && dz < 0.25 + t * 0.12) {
          // Refine the hit with a short binary search.
          float a = t - stepLen, b = t;
          for (int j = 0; j < 4; j++) {
            float m = 0.5 * (a + b); vec3 M = P + R * m; vec4 mp = proj * vec4(M, 1.0); vec2 mu = mp.xy / mp.w * 0.5 + 0.5;
            if (viewPos(mu, rawDepth(mu)).z - M.z > 0.0) { b = m; uv = mu; } else a = m;
          }
          vec2 e = smoothstep(0.0, 0.12, uv) * smoothstep(1.0, 0.88, uv);
          conf = e.x * e.y * (1.0 - float(i) / 28.0);
          hit = texture2D(tScene, uv).rgb;
          break;
        }
        t += stepLen; stepLen *= 1.13;
      }
      // Rays that leave the screen see the sky (outdoors) or the dark vault (indoors).
      hit = mix(missCol, hit, conf);
      float fres = mix(0.05, 1.0, pow(1.0 - max(dot(-Vd, N), 0.0), 3.0));
      gl_FragColor = vec4(min(hit, vec3(6.0)), mask * fres * mix(0.5, 1.0, pud * puddles));
    }`;

  // ── Volumetric fog + light ─────────────────────────────────────────────────
  const VOL_FRAG = COMMON + `
    uniform mat4 viewInv, shadowMatrix; uniform vec3 camPos;
    uniform float time, density, heightFall, floorY, noiseAmt, maxDist, ambient, lightAmt, keyAmt, anisotropy;
    uniform vec3 fogCol;
    uniform float keyType, keyCos, keyCosInner, shadowOn; uniform vec3 keyPos, keyDir, keyCol;
    uniform sampler2D tShadow;
    uniform vec3 lPos[${NL}]; uniform vec3 lCol[${NL}]; uniform float lRange[${NL}];
    const int STEPS = 22;
    float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vnoise(vec3 x){
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fogDensity(vec3 p){
      vec3 q = p * 0.55 + vec3(time * 0.11, -time * 0.03, time * 0.07);
      float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
      float h = exp(-max(p.y - floorY, 0.0) * heightFall);
      return density * h * mix(1.0, smoothstep(0.25, 0.85, n) * 2.0, noiseAmt);
    }
    float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
    float keyShadow(vec3 p){
      if (shadowOn < 0.5) return 1.0;
      vec4 sc = shadowMatrix * vec4(p, 1.0); sc.xyz /= sc.w;
      if (sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0) return 1.0;
      return step(sc.z - 0.002, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
    }
    void main(){
      float d = rawDepth(vUv);
      vec3 wp = (viewInv * vec4(viewPos(vUv, d), 1.0)).xyz;
      vec3 ray = wp - camPos; float len = length(ray); vec3 rd = ray / len;
      len = min(len, maxDist);
      float ds = len / float(STEPS);
      float t = ds * hash12(gl_FragCoord.xy + fract(time * 7.13) * 61.0);
      float T = 1.0; vec3 acc = vec3(0.0);
      float cosKey = keyType > 1.5 ? dot(keyDir, -rd) : 0.0;
      float phaseDir = hg(cosKey, anisotropy);
      for (int i = 0; i < STEPS; i++) {
        vec3 p = camPos + rd * t;
        float den = fogDensity(p);
        if (den > 0.0005) {
          vec3 L = fogCol * ambient;
          for (int j = 0; j < ${NL}; j++) {
            vec3 dv = lPos[j] - p; float dd = dot(dv, dv);
            float fall = 1.0 / (1.0 + dd * 1.6);
            float win = clamp(1.0 - dd / (lRange[j] * lRange[j] + 0.001), 0.0, 1.0);
            L += lCol[j] * fall * win * win;
          }
          if (keyType > 0.5) {
            float k = 0.0;
            if (keyType < 1.5) {
              vec3 lv = p - keyPos; float ld = length(lv); vec3 ln = lv / ld;
              float cone = smoothstep(keyCos, keyCosInner, dot(ln, keyDir));
              k = cone * hg(dot(ln, -rd), anisotropy) / (1.0 + ld * ld * 0.015);
            } else k = phaseDir;
            if (k > 0.001) L += keyCol * k * keyAmt * keyShadow(p);
          }
          float sT = exp(-den * ds);
          acc += T * (1.0 - sT) * L * lightAmt;
          T *= sT;
          if (T < 0.02) break;
        }
        t += ds;
      }
      gl_FragColor = vec4(acc, T);
    }`;

  // ── Composite: depth-aware upsample of AO + fog onto the HDR image ─────────
  const COMP_FRAG = COMMON + `
    uniform sampler2D tScene, tAO, tVol, tSSR; uniform vec2 halfRes; uniform float aoAmt, volOn, aoOn, ssrOn, ssrAmt, dbg;
    void main(){
      vec3 c = texture2D(tScene, vUv).rgb;
      float zc = linDepth(vUv);
      vec2 hp = 1.0 / halfRes;
      float ao = 0.0, wsum = 0.0; vec4 vol = vec4(0.0), ssr = vec4(0.0);
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * hp;
        float zs = linDepth(uv);
        float w = exp(-abs(zs - zc) / (0.03 * zc + 0.02)) * (x == 0 && y == 0 ? 2.0 : 1.0) + 1e-4;
        if (aoOn > 0.5) ao += texture2D(tAO, uv).r * w;
        if (volOn > 0.5) vol += texture2D(tVol, uv) * w;
        if (ssrOn > 0.5) ssr += texture2D(tSSR, uv) * w;
        wsum += w;
      }
      if (aoOn > 0.5) {
        ao /= wsum;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(1.0, ao, aoAmt * (1.0 - smoothstep(0.9, 3.0, l)));
      }
      if (ssrOn > 0.5) { ssr /= wsum; float ra = clamp(ssr.a * ssrAmt, 0.0, 0.9); c = c * (1.0 - ra * 0.55) + ssr.rgb * ra; }
      if (volOn > 0.5) { vol /= wsum; c = c * vol.a + vol.rgb; }
      if (dbg > 0.5) c = dbg < 1.5 ? vec3(ssr.a * 3.0) : dbg < 2.5 ? ssr.rgb : vec3(ao);   // debug views
      gl_FragColor = vec4(c, 1.0);
    }`;

  // ── Depth of field: golden-angle gather weighted by each tap's own blur ────
  const DOF = {
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, cNear: { value: 0.05 }, cFar: { value: 400 }, projInv: { value: new THREE.Matrix4() },
      res: { value: new THREE.Vector2(1, 1) }, focus: { value: 5 }, aperture: { value: 0 }, maxBlur: { value: 9 } },
    vertexShader: VERT,
    fragmentShader: COMMON + `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float focus, aperture, maxBlur;
      float cocZ(float z){ return clamp(abs(z - focus) / max(z, 0.001) * aperture, 0.0, 1.0); }
      void main(){
        float z0 = linDepth(vUv), c0 = cocZ(z0);
        vec3 sum = texture2D(tDiffuse, vUv).rgb; float wsum = 1.0;
        vec2 px = 1.0 / res;
        float ang = hash12(gl_FragCoord.xy) * 0.6;
        for (int i = 1; i < 28; i++) {
          float fi = float(i), r = sqrt(fi / 28.0) * maxBlur;
          float th = ang + fi * 2.39996;
          vec2 uv = vUv + vec2(cos(th), sin(th)) * r * px;
          float zs = linDepth(uv), cs = cocZ(zs);
          // Nearer taps spread by their own blur; farther ones never bleed onto a sharper pixel.
          float cu = zs < z0 ? max(cs, c0) : min(cs, c0);
          float w = clamp(cu * maxBlur - r + 1.0, 0.0, 1.0);
          sum += texture2D(tDiffuse, uv).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(sum / wsum, 1.0);
      }`,
  };

  // ── FXAA (after grading, on display-referred colour) + film grain ──────────
  const FXAA = {
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, grain: { value: 0.03 }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float grain, time; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 px = 1.0 / res;
        vec3 nw = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb, ne = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
        vec3 sw = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb, se = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb;
        vec3 m = texture2D(tDiffuse, vUv).rgb;
        float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(m);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
        float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
        float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
        dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
        vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
        vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
        float lB = luma(b);
        vec3 c = (lB < lMin || lB > lMax) ? a : b;
        c += (hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5) * grain;
        gl_FragColor = vec4(c, 1.0);
      }`,
  };

  function mat(frag, uniforms) {
    return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  }
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); white.needsUpdate = true;

  // Renders the scene with depth, computes AO + volumetric fog, composites.
  class CinematicPass extends THREE.Pass {
    constructor(scene, camera, opts) {
      super();
      this.scene = scene; this.camera = camera;
      this.ao = opts.ao !== false; this.vol = opts.vol !== false; this.ssr = true;
      this.type = opts.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
      this.sceneRT = null; this.aoRT = null; this.volRT = null; this.ssrRT = null;
      const shared = { tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, cNear: { value: 0.05 }, cFar: { value: 400 } };
      this.shared = shared;
      this.aoMat = mat(AO_FRAG, Object.assign({ fullRes: { value: new THREE.Vector2(1, 1) }, radius: { value: 0.55 }, intensity: { value: 0.9 }, bias: { value: 0.02 }, projScale: { value: 300 } }, shared));
      const lp = [], lc = [], lr = [];
      for (let i = 0; i < NL; i++) { lp.push(new THREE.Vector3()); lc.push(new THREE.Vector3()); lr.push(1); }
      this.volMat = mat(VOL_FRAG, Object.assign({
        viewInv: { value: new THREE.Matrix4() }, shadowMatrix: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
        time: { value: 0 }, density: { value: 0.06 }, heightFall: { value: 0.35 }, floorY: { value: 0 }, noiseAmt: { value: 0.7 }, maxDist: { value: 26 },
        ambient: { value: 0.35 }, lightAmt: { value: 1 }, keyAmt: { value: 1 }, anisotropy: { value: 0.45 }, fogCol: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
        keyType: { value: 0 }, keyCos: { value: 0.8 }, keyCosInner: { value: 0.9 }, shadowOn: { value: 0 },
        keyPos: { value: new THREE.Vector3() }, keyDir: { value: new THREE.Vector3(0, -1, 0) }, keyCol: { value: new THREE.Vector3() },
        tShadow: { value: white }, lPos: { value: lp }, lCol: { value: lc }, lRange: { value: lr },
      }, shared));
      this.ssrMat = mat(SSR_FRAG, Object.assign({ tScene: { value: null }, proj: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() },
        fullRes: { value: new THREE.Vector2(1, 1) }, wet: { value: 0.3 }, puddles: { value: 0.5 }, missCol: { value: new THREE.Vector3() } }, shared));
      this.compMat = mat(COMP_FRAG, Object.assign({ tScene: { value: null }, tAO: { value: white }, tVol: { value: white }, tSSR: { value: white }, halfRes: { value: new THREE.Vector2(1, 1) },
        aoAmt: { value: 0.85 }, aoOn: { value: 1 }, volOn: { value: 1 }, ssrOn: { value: 1 }, ssrAmt: { value: 1.4 }, dbg: { value: 0 } }, shared));
      this.quad = new THREE.FullScreenQuad(null);
      this.keyLight = null;
      this.needsSwap = true;
    }
    setSize(w, h) {
      [this.sceneRT, this.aoRT, this.volRT, this.ssrRT].forEach(rt => rt && rt.dispose());
      const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      this.sceneRT = new THREE.WebGLRenderTarget(w, h, Object.assign({ type: this.type }, o));
      this.sceneRT.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
      this.sceneRT.depthTexture.minFilter = this.sceneRT.depthTexture.magFilter = THREE.NearestFilter;
      const hw = Math.max(1, Math.floor(w / 2)), hh = Math.max(1, Math.floor(h / 2));
      this.aoRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: THREE.UnsignedByteType, depthBuffer: false }, o));
      this.volRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: this.type, depthBuffer: false }, o));
      this.ssrRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: this.type, depthBuffer: false }, o));
      this.ssrMat.uniforms.fullRes.value.set(w, h);
      this.aoMat.uniforms.fullRes.value.set(w, h);
      this.compMat.uniforms.halfRes.value.set(hw, hh);
      this.shared.tDepth.value = this.sceneRT.depthTexture;
    }
    get depthTexture() { return this.sceneRT && this.sceneRT.depthTexture; }
    render(renderer, writeBuffer) {
      const cam = this.camera, s = this.shared;
      renderer.setRenderTarget(this.sceneRT);
      renderer.clear();
      renderer.render(this.scene, cam);
      // Key-light shadow map, fresh from this render, for shafts of light in the fog.
      const k = this.keyLight, vu = this.volMat.uniforms;
      if (k && k.visible && k.castShadow && k.shadow.map) { vu.tShadow.value = k.shadow.map.texture; vu.shadowMatrix.value.copy(k.shadow.matrix); vu.shadowOn.value = 1; }
      else { vu.tShadow.value = white; vu.shadowOn.value = 0; }
      s.projInv.value.copy(cam.projectionMatrixInverse); s.cNear.value = cam.near; s.cFar.value = cam.far;
      if (this.ao) {
        this.aoMat.uniforms.projScale.value = cam.projectionMatrix.elements[5] * 0.5 * this.sceneRT.height;
        this.quad.material = this.aoMat; renderer.setRenderTarget(this.aoRT); this.quad.render(renderer);
      }
      const doSSR = this.ssr && this.ssrMat.uniforms.wet.value > 0;
      if (doSSR) {
        const r = this.ssrMat.uniforms;
        r.tScene.value = this.sceneRT.texture; r.proj.value.copy(cam.projectionMatrix); r.viewInv.value.copy(cam.matrixWorld);
        this.quad.material = this.ssrMat; renderer.setRenderTarget(this.ssrRT); this.quad.render(renderer);
      }
      if (this.vol) {
        const u = this.volMat.uniforms;
        u.viewInv.value.copy(cam.matrixWorld); u.camPos.value.setFromMatrixPosition(cam.matrixWorld);
        this.quad.material = this.volMat; renderer.setRenderTarget(this.volRT); this.quad.render(renderer);
      }
      const c = this.compMat.uniforms;
      c.tScene.value = this.sceneRT.texture; c.tAO.value = this.ao ? this.aoRT.texture : white; c.tVol.value = this.vol ? this.volRT.texture : white;
      c.aoOn.value = this.ao ? 1 : 0; c.volOn.value = this.vol ? 1 : 0;
      c.tSSR.value = doSSR ? this.ssrRT.texture : white; c.ssrOn.value = doSSR ? 1 : 0;
      this.quad.material = this.compMat;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    }
  }

  // Procedural lens dirt: soft smudges and a few streaks.
  function lensDirt() {
    const S = 256, c = G3D.canvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * rnd() * 26, a = 0.04 + rnd() * 0.12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.6, `rgba(255,255,255,${a * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { ctx.lineWidth = 1 + rnd() * 3; ctx.beginPath(); const x = rnd() * S, y = rnd() * S; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + rnd() * 60 - 30, y + rnd() * 60 - 30, x + rnd() * 90 - 45, y + rnd() * 90 - 45); ctx.stroke(); }
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
    return t;
  }

  G3D.fx = { CinematicPass, DOF, FXAA, lensDirt, NL };
})();
