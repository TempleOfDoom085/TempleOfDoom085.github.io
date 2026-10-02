/* Knights Templar 3D — the cinematic ("Ultra") post-processing pipeline.

   CinematicPass renders the scene once into an HDR target with a depth
   texture, then works from that depth:
   • ambient occlusion (scalable SAO, half resolution)
   • volumetric fog — ray-marched height fog with drifting 3D noise, lit by
     the room's torches and by the key light *through its shadow map*, so
     windows, arches and pillars cast real shafts of light into the mist
   • a depth-aware upsample that composites both onto the image
   • temporal anti-aliasing: the camera is jittered by a sub-pixel Halton
     offset every frame and the image is accumulated over time (history
     reprojected through the depth buffer, clipped to the current
     neighbourhood), which also smooths the noise of the fog and AO
   Then: depth of field (golden-angle bokeh), and FXAA (or, under TAA, a light
   sharpen) after grading. game3d/fx.js also carries the soft-shadow (PCSS) and
   parallax-occlusion shader patches.
   The engine falls back to its standard pipeline without WebGL2. */
(function () {
  'use strict';
  const G3D = window.G3D;
  if (!G3D || !window.THREE || !THREE.Pass) return;
  const NL = 6;   // point lights fed to the fog (matches the engine's light pool)

  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const COMMON = `
    #include <packing>
    uniform sampler2D tDepth; uniform mat4 projInv; uniform float cNear, cFar, frameN;
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
      float ang = (hash12(gl_FragCoord.xy) + frameN * 0.618034) * 6.2831853;
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
      if (puddles > 1.5) pud = 1.0;                      // a flooded floor is one mirror
      float pp = min(pud * puddles, 1.0);
      float mask = wet * mix(0.35, 1.0, pp) * floorness;
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
      gl_FragColor = vec4(min(hit, vec3(6.0)), mask * fres * mix(0.5, 1.0, pp));
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


  // ── Temporal anti-aliasing resolve ──────────────────────────────────────────
  // History is reprojected with the camera's motion through this frame's depth
  // (the nearest depth in a 3×3, so edges reproject with their foreground),
  // sampled with a 5-tap Catmull-Rom, then clipped toward the current pixel's
  // neighbourhood (mean ± σ in YCoCg) so moving characters don't smear.
  // Blending happens in a reversible tonemapped space so a bright torch can't
  // dominate its neighbours.
  const TAA_FRAG = COMMON + `
    uniform sampler2D tCur, tHist; uniform mat4 prevVP, viewInv; uniform vec2 res; uniform float reset, blend;
    vec3 tm(vec3 c){ return c / (1.0 + max(c.r, max(c.g, c.b))); }
    vec3 itm(vec3 c){ return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-4); }
    vec3 toY(vec3 c){ return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
    vec3 fromY(vec3 y){ return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
    vec3 histCR(vec2 uv){
      vec2 sp = uv * res, t1 = floor(sp - 0.5) + 0.5, f = sp - t1;
      vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
      vec2 w12 = w1 + w2, c12 = (t1 + w2 / w12) / res, c0 = (t1 - 1.0) / res, c3 = (t1 + 2.0) / res;
      vec3 r = texture2D(tHist, vec2(c12.x, c0.y)).rgb * (w12.x * w0.y) + texture2D(tHist, vec2(c0.x, c12.y)).rgb * (w0.x * w12.y)
             + texture2D(tHist, c12).rgb * (w12.x * w12.y) + texture2D(tHist, vec2(c3.x, c12.y)).rgb * (w3.x * w12.y)
             + texture2D(tHist, vec2(c12.x, c3.y)).rgb * (w12.x * w3.y);
      float w = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
      return max(r / w, vec3(0.0));
    }
    void main(){
      vec2 px = 1.0 / res;
      vec3 cur = texture2D(tCur, vUv).rgb;
      vec3 m1 = vec3(0.0), m2 = vec3(0.0); float dmin = 1.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * px;
        vec3 c = toY(tm(texture2D(tCur, uv).rgb)); m1 += c; m2 += c * c;
        dmin = min(dmin, rawDepth(uv));
      }
      vec4 W = viewInv * vec4(viewPos(vUv, dmin), 1.0);
      vec4 pc = prevVP * W; vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
      if (reset > 0.5 || pc.w <= 0.0 || puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) { gl_FragColor = vec4(cur, 1.0); return; }
      vec3 mean = m1 / 9.0, sig = sqrt(max(m2 / 9.0 - mean * mean, 0.0)) * 1.15;
      vec3 h = toY(tm(histCR(puv)));
      // Clip the history toward the mean, onto the neighbourhood box.
      vec3 d = h - mean, ext = max(sig, vec3(1e-4)), u = abs(d / ext);
      float m = max(u.x, max(u.y, u.z));
      if (m > 1.0) h = mean + d / m;
      float motion = length((puv - vUv) * res);
      float a = mix(blend, 0.3, clamp(motion / 12.0, 0.0, 1.0));
      vec3 o = mix(h, toY(tm(cur)), a);
      gl_FragColor = vec4(itm(max(fromY(o), vec3(0.0))), 1.0);
    }`;
  const COPY_FRAG = 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tSrc, vUv); }';
  // 8-sample Halton(2,3) sub-pixel jitter.
  const HALTON = [];
  (function () { const h = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }; for (let i = 1; i <= 8; i++) HALTON.push([h(i, 2) - 0.5, h(i, 3) - 0.5]); })();

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
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, grain: { value: 0.03 }, time: { value: 0 }, sharpen: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float grain, time, sharpen; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 px = 1.0 / res;
        if (sharpen > 0.0) {
          // Temporal AA already resolved the edges: restore the crispness it softens.
          vec3 m = texture2D(tDiffuse, vUv).rgb;
          vec3 nb = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb
                  + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
          vec3 mn = min(m, min(min(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb, texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb), min(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb, texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb)));
          vec3 mx = max(m, max(max(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb, texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb), max(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb, texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb)));
          vec3 c = clamp(m + (m - nb * 0.25) * sharpen, mn, mx);
          c += (hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5) * grain;
          gl_FragColor = vec4(c, 1.0); return;
        }
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


  // ── Contact-hardening soft shadows (PCSS) ───────────────────────────────────
  // Replaces three's PCF for the key light: a blocker search estimates how far
  // the occluder is from the receiver, and the filter widens with that gap, so
  // a pillar's shadow is crisp at its foot and soft far away. Per-light
  // parameters ride in shadow.radius (see the engine's applyRoom):
  //   directional (orthographic): radius = softness × 100 (uv per unit depth)
  //   spot (perspective): radius = 1000 + far + c, c = light size / (2·tan(angle)),
  //   with the spot shadow camera's near plane fixed at 0.5.
  function installPCSS() {
    const C = THREE.ShaderChunk;
    if (C.shadowmap_pars_fragment.indexOf('ktPCSS') >= 0) return true;
    const fn = `
      // ktPCSS
      vec2 ktVogel(int i, int n, float phi){ float r = sqrt((float(i) + 0.5) / float(n)); float t = float(i) * 2.39996323 + phi; return vec2(cos(t), sin(t)) * r; }
      float ktLin(float d, float far){ return (0.5 * far) / (far - d * (far - 0.5)); }
      float ktPCSS(sampler2D sm, vec2 size, float radius, vec4 sc){
        bool persp = radius > 500.0;
        float far = persp ? floor(radius - 1000.0) : 1.0;
        float c = persp ? fract(radius) : radius * 0.01;
        float phi = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float texel = 1.0 / size.x;
        float zR = persp ? ktLin(sc.z, far) : sc.z;
        float search = clamp(persp ? c * 0.5 / zR : c * 0.08, 3.0 * texel, 0.02);
        float sumB = 0.0, nB = 0.0;
        for (int i = 0; i < 12; i++) {
          float d = unpackRGBAToDepth(texture2D(sm, sc.xy + ktVogel(i, 12, phi) * search));
          if (d < sc.z) { sumB += persp ? ktLin(d, far) : d; nB += 1.0; }
        }
        if (nB < 0.5) return 1.0;
        float zB = sumB / nB;
        float pen = persp ? c * (zR - zB) / max(zB * zR, 1e-4) : c * (zR - zB);
        float r = clamp(pen, 1.5 * texel, 0.012);
        float s = 0.0;
        for (int i = 0; i < 20; i++) s += texture2DCompare(sm, sc.xy + ktVogel(i, 20, phi + 1.7) * r, sc.z);
        return s / 20.0;
      }
    `;
    let src = C.shadowmap_pars_fragment;
    const a = src.indexOf('float getShadow(');
    if (a < 0) return false;
    const b = src.indexOf('if ( frustumTest ) {', a);
    if (b < 0) return false;
    src = src.slice(0, a) + fn + src.slice(a, b) + 'if ( frustumTest ) {\n\t\t\treturn ktPCSS( shadowMap, shadowMapSize, shadowRadius, shadowCoord );' + src.slice(b + 'if ( frustumTest ) {'.length);
    origShadowChunk = C.shadowmap_pars_fragment;
    C.shadowmap_pars_fragment = src;
    return true;
  }
  let origShadowChunk = null;
  function uninstallPCSS() { if (origShadowChunk) { THREE.ShaderChunk.shadowmap_pars_fragment = origShadowChunk; origShadowChunk = null; } }

  // ── Parallax occlusion mapping for MeshStandardMaterial ─────────────────────
  // Marches the view ray into the height field (stored in the roughness map's
  // red channel) so mortar joints and flagstone seams have real depth that
  // shifts with the camera. The tangent frame comes from screen-space
  // derivatives (no tangent attribute needed); `depth` is in metres.
  function patchPOM(sh, depth) {
    sh.uniforms.pomDepth = { value: depth };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float pomDepth;
      vec2 ktPOM(vec2 uv, vec2 dx, vec2 dy, out float cavity){
        cavity = 0.0;
        vec3 V = normalize(vViewPosition);
        vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
        vec3 q1p = cross(q1, N), q0p = cross(N, q0);
        float D = dot(N, cross(q0, q1));
        float dist = length(vViewPosition);
        if (abs(D) < 1e-14 || dist > 16.0) return uv;
        vec2 duv = vec2(dot(V, q1p * dx.x + q0p * dy.x), dot(V, q1p * dx.y + q0p * dy.y)) / D;
        float vz = max(dot(V, N), 0.12);
        float fade = 1.0 - smoothstep(10.0, 16.0, dist);
        vec2 maxOff = -duv / vz * pomDepth * fade;
        float n = mix(28.0, 8.0, vz), stepD = 1.0 / n;
        vec2 cur = uv, prev = uv; float layer = 0.0, hPrev = 0.0, h = 1.0 - textureGrad(roughnessMap, uv, dx, dy).r;
        for (int i = 0; i < 28; i++) {
          if (layer >= h || float(i) >= n) break;
          prev = cur; hPrev = h - layer;
          cur += maxOff * stepD; layer += stepD;
          h = 1.0 - textureGrad(roughnessMap, cur, dx, dy).r;
        }
        float after = h - layer, before = hPrev;
        float w = after / (after - before + 1e-5);
        vec2 o = mix(cur, prev, clamp(w, 0.0, 1.0));
        cavity = clamp(layer, 0.0, 1.0) * fade;
        return o;
      }
      void main() {`)
      .replace('#include <map_fragment>', `vec2 pDx = dFdx(vUv), pDy = dFdy(vUv); float pCav;
      vec2 pUv = ktPOM(vUv, pDx, pDy, pCav);
      #ifdef USE_MAP
        vec4 texelColor = mapTexelToLinear(textureGrad(map, pUv, pDx, pDy));
        diffuseColor *= texelColor;
      #endif
      diffuseColor.rgb *= 1.0 - pCav * 0.45;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        roughnessFactor *= textureGrad(roughnessMap, pUv, pDx, pDy).g;
      #endif`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.split('texture2D( normalMap, vUv )').join('textureGrad( normalMap, pUv, pDx, pDy )'));
  }

  function mat(frag, uniforms) {
    return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  }
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); white.needsUpdate = true;

  // Renders the scene with depth, computes AO + volumetric fog, composites.
  class CinematicPass extends THREE.Pass {
    constructor(scene, camera, opts) {
      super();
      this.scene = scene; this.camera = camera;
      this.ao = opts.ao !== false; this.vol = opts.vol !== false; this.ssr = true; this.taa = opts.taa !== false;
      this.type = opts.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
      this.sceneRT = null; this.aoRT = null; this.volRT = null; this.ssrRT = null; this.compRT = null; this.hist = [null, null];
      const shared = { tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, cNear: { value: 0.05 }, cFar: { value: 400 }, frameN: { value: 0 } };
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
      this.taaMat = mat(TAA_FRAG, Object.assign({ tCur: { value: null }, tHist: { value: null }, prevVP: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() },
        res: { value: new THREE.Vector2(1, 1) }, reset: { value: 1 }, blend: { value: 0.1 } }, shared));
      this.copyMat = mat(COPY_FRAG, { tSrc: { value: null } });
      this.frame = 0; this.histIdx = 0; this.hasHist = false;
      this.prevVP = new THREE.Matrix4(); this.prevPos = new THREE.Vector3(); this.prevDir = new THREE.Vector3();
      this._P = new THREE.Matrix4(); this._v = new THREE.Vector3();
      this.quad = new THREE.FullScreenQuad(null);
      this.keyLight = null;
      this.needsSwap = true;
    }
    setSize(w, h) {
      [this.sceneRT, this.aoRT, this.volRT, this.ssrRT, this.compRT, ...this.hist].forEach(rt => rt && rt.dispose());
      const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      this.sceneRT = new THREE.WebGLRenderTarget(w, h, Object.assign({ type: this.type }, o));
      this.sceneRT.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
      this.sceneRT.depthTexture.minFilter = this.sceneRT.depthTexture.magFilter = THREE.NearestFilter;
      const hw = Math.max(1, Math.floor(w / 2)), hh = Math.max(1, Math.floor(h / 2));
      this.aoRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: THREE.UnsignedByteType, depthBuffer: false }, o));
      this.volRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: this.type, depthBuffer: false }, o));
      this.ssrRT = new THREE.WebGLRenderTarget(hw, hh, Object.assign({ type: this.type, depthBuffer: false }, o));
      const full = () => new THREE.WebGLRenderTarget(w, h, Object.assign({ type: this.type, depthBuffer: false }, o));
      this.compRT = full(); this.hist = [full(), full()]; this.hasHist = false;
      this.taaMat.uniforms.res.value.set(w, h);
      this.ssrMat.uniforms.fullRes.value.set(w, h);
      this.aoMat.uniforms.fullRes.value.set(w, h);
      this.compMat.uniforms.halfRes.value.set(hw, hh);
      this.shared.tDepth.value = this.sceneRT.depthTexture;
    }
    get depthTexture() { return this.sceneRT && this.sceneRT.depthTexture; }
    resetTAA() { this.hasHist = false; }
    render(renderer, writeBuffer) {
      const cam = this.camera, s = this.shared;
      // Sub-pixel jitter for temporal AA (undone before anything else reads the camera).
      const taa = this.taa && !!this.compRT;
      this.frame++; s.frameN.value = taa ? this.frame % 64 : 0;
      if (taa) {
        this._P.copy(cam.projectionMatrix);
        const j = HALTON[this.frame % 8], e = cam.projectionMatrix.elements;
        e[8] += j[0] * 2 / this.sceneRT.width; e[9] += j[1] * 2 / this.sceneRT.height;
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      }
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
      renderer.setRenderTarget(taa ? this.compRT : (this.renderToScreen ? null : writeBuffer));
      this.quad.render(renderer);
      if (!taa) { this.hasHist = false; return; }
      // Resolve against history, then hand the result on.
      const t = this.taaMat.uniforms, cur = this.hist[this.histIdx], prev = this.hist[1 - this.histIdx];
      const pos = this._v.setFromMatrixPosition(cam.matrixWorld);
      const dirNow = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
      const cut = pos.distanceTo(this.prevPos) > 0.8 || dirNow.dot(this.prevDir) < 0.96;
      t.reset.value = (!this.hasHist || cut) ? 1 : 0;
      t.tCur.value = this.compRT.texture; t.tHist.value = prev.texture;
      t.viewInv.value.copy(cam.matrixWorld); t.prevVP.value.copy(this.prevVP);
      this.quad.material = this.taaMat; renderer.setRenderTarget(cur); this.quad.render(renderer);
      this.copyMat.uniforms.tSrc.value = cur.texture;
      this.quad.material = this.copyMat; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
      // Undo the jitter; remember this frame's (unjittered) view-projection.
      cam.projectionMatrix.copy(this._P); cam.projectionMatrixInverse.copy(this._P).invert();
      this.prevVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.prevPos.copy(pos); this.prevDir.copy(dirNow);
      this.histIdx = 1 - this.histIdx; this.hasHist = true;
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

  G3D.fx = { CinematicPass, DOF, FXAA, lensDirt, NL, installPCSS, uninstallPCSS, patchPOM };
})();
