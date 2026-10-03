/* Threat Globe — cinematic renderer (three.js r128).

   The Earth stays fixed in its true geographic frame with the real-time sun,
   and the camera orbits it, so day, night and the terminator are always where
   they are on the planet right now.

   • Earth: one shader for the day map, relief from the normal map, cloud
     shadows, a twilight band, ocean sun-glint with Fresnel, city lights on
     the night side (dimmed under cloud), and a tactical hex grid that glows
     with attack heat and scan waves
   • Clouds lit by the sun, with lightning flashing inside storm cells
   • Atmosphere: a ray-marched shell (Rayleigh blue, sunset reddening near the
     terminator, Mie forward-scatter around the sun) that tints toward the
     DEFCON colour as the threat rises
   • Attacks: glowing comet ribbons with data packets, all drawn in one
     instanced call and animated entirely on the GPU; impacts ring out on the
     surface and critical hits raise a pillar of light
   • Aurora curtains over both magnetic poles, satellites with orbit trails,
     solar wind, a Milky Way sky with twinkling stars, the Moon, and the Sun
     with a lens flare
   • HDR pipeline: 4× MSAA, soft-knee bloom, ACES, chromatic aberration, a
     shader glitch on critical alerts, vignette and grain
   • Camera: an intro fly-in, a damped orbit with inertia, scroll / pinch
     zoom, click-to-focus on a city, and an auto-director that swoops onto
     critical attacks while the viewer is idle
   One requestAnimationFrame loop, no per-frame allocation, adaptive
   resolution, and prefers-reduced-motion respected throughout. */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function latLngToVec3(lat, lng, r, out) {
    const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
    return (out || new T.Vector3()).set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  // Sub-solar point now, in the globe's frame.
  function computeSunDir(out) {
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const doy = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) / 86400000);
    const decl = -23.45 * Math.cos((360 / 365 * (doy + 10)) * Math.PI / 180) * Math.PI / 180;
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const h = (utcH / 24 - 0.5) * TAU;
    return (out || new T.Vector3()).set(Math.cos(decl) * Math.cos(h), Math.sin(decl), Math.cos(decl) * Math.sin(h)).normalize();
  }

  const FSQ_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const NOISE = `
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n3(p) * a; p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  `;

  window.createThreatGlobe = function (opts) {
    const container = opts.container, canvas = opts.canvas, CITIES = opts.cities, EVENTS = opts.eventTypes;
    const banner = opts.banner || (() => {});
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const R = 1.0;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    const gl2 = renderer.capabilities.isWebGL2;
    const small = Math.min(screen.width, screen.height) < 700;
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, 0.02, 600);
    const U = {
      time: { value: 0 }, sunDir: { value: computeSunDir() },
      defcon: { value: new T.Color(0x00ff88) }, defconAmt: { value: 0 },
    };
    const sunDir = U.sunDir.value;

    // ── Textures (vendored three.js planet maps) ─────────────────────────────
    const loader = new T.TextureLoader();
    const TEX = '/vendor/three/textures/';
    let loaded = 0;
    const tex = (name, wrap) => {
      const t = loader.load(TEX + name, () => { loaded++; }, undefined, () => { loaded++; });
      t.anisotropy = Math.min(8, aniso);
      if (wrap) t.wrapS = T.RepeatWrapping;
      return t;
    };
    const dayMap = tex(gl2 && !small ? 'earth_atmos_4096.jpg' : 'earth_atmos_2048.jpg');
    const nightMap = tex('earth_lights_2048.jpg');
    const specMap = tex('earth_specular_2048.jpg');
    const normMap = tex('earth_normal_2048.jpg');
    const cloudMap = tex('earth_clouds_2048.jpg', true);
    const moonMap = tex('moon_1024.jpg');

    // Attack heat, painted into a small equirectangular texture.
    const HW = 256, HH = 128;
    const heat = new Float32Array(HW * HH), heatPx = new Uint8Array(HW * HH * 4);
    const heatTex = new T.DataTexture(heatPx, HW, HH, T.RGBAFormat);
    heatTex.magFilter = heatTex.minFilter = T.LinearFilter; heatTex.wrapS = T.RepeatWrapping; heatTex.needsUpdate = true;
    let heatDirty = false;

    // ── Earth ────────────────────────────────────────────────────────────────
    const earthMat = new T.ShaderMaterial({
      uniforms: {
        dayMap: { value: dayMap }, nightMap: { value: nightMap }, specMap: { value: specMap }, normMap: { value: normMap },
        cloudMap: { value: cloudMap }, heatMap: { value: heatTex }, cloudOff: { value: 0 },
        sunDir: U.sunDir, time: U.time, defcon: U.defcon, defconAmt: U.defconAmt,
        scanO: { value: new T.Vector3(0, 1, 0) }, scanR: { value: -1 }, gridAmt: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vUv = uv; vN = normalize(position); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: `
        uniform sampler2D dayMap, nightMap, specMap, normMap, cloudMap, heatMap;
        uniform vec3 sunDir, defcon, scanO; uniform float time, cloudOff, defconAmt, scanR, gridAmt;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        float hexDist(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
        void main(){
          vec3 N = normalize(vN);
          vec3 east = normalize(vec3(N.z, 0.0, -N.x) + vec3(1e-5, 0.0, 0.0));
          vec3 north = cross(N, east);
          vec3 V = normalize(cameraPosition - vW);
          vec3 nm = texture2D(normMap, vUv).xyz * 2.0 - 1.0;
          vec3 n = normalize(east * nm.x * 0.9 + north * nm.y * 0.9 + N * nm.z);
          vec3 day = pow(texture2D(dayMap, vUv).rgb, vec3(2.2));
          float ocean = texture2D(specMap, vUv).r;
          float NLs = dot(N, sunDir), NL = dot(n, sunDir);
          float dayAmt = smoothstep(-0.1, 0.25, NLs);
          // Cloud cover here, and the shadow it casts (offset away from the sun).
          vec2 cu = vUv + vec2(cloudOff, 0.0);
          float cover = texture2D(cloudMap, cu).r;
          float shadow = texture2D(cloudMap, cu - vec2(dot(sunDir, east), dot(sunDir, north)) * 0.0035).r;
          day *= mix(1.0, 0.72, ocean);
          vec3 sunCol = vec3(1.0, 0.96, 0.9) * 1.25;
          vec3 col = day * sunCol * max(NL, 0.0) * smoothstep(-0.05, 0.15, NLs) * (1.0 - shadow * 0.5);
          // Twilight: warm, low light along the terminator.
          float tw = exp(-pow(NLs * 6.0, 2.0));
          col += day * vec3(1.0, 0.42, 0.16) * tw * 0.35;
          // Ocean glint: a tight sun reflection inside a broad sheen, stronger at grazing angles.
          vec3 H = normalize(sunDir + V);
          float nh = max(dot(N, H), 0.0), fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          col += vec3(1.0, 0.86, 0.66) * ocean * (pow(nh, 900.0) * 1.6 + pow(nh, 90.0) * 0.08 + pow(nh, 12.0) * 0.008) * (0.3 + fres) * (1.0 - cover) * dayAmt;
          // Night: city lights, warm and HDR so they bloom, dimmed under cloud.
          float lights = pow(texture2D(nightMap, vUv).r, 1.6);
          float night = 1.0 - smoothstep(-0.25, 0.05, NLs);
          col += vec3(1.0, 0.64, 0.3) * lights * 4.0 * night * (1.0 - cover * 0.7);
          col += day * vec3(0.006, 0.012, 0.025);
          // Blue haze at the edge of the disk.
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.18, 0.45, 1.0) * rim * smoothstep(-0.3, 0.5, NLs) * 0.3;
          // Tactical overlay: hex cells (heat-coloured) and scan waves.
          float lat = (vUv.y - 0.5) * 3.14159265, lng = vUv.x * 6.2831853 - 3.14159265;
          float S = 16.0;
          vec2 hp = vec2(lng * cos(lat), lat) * S;
          vec2 r = vec2(1.0, 1.7320508), hh = r * 0.5;
          vec2 a = mod(hp, r) - hh, b = mod(hp - hh, r) - hh;
          vec2 gv = dot(a, a) < dot(b, b) ? a : b;
          vec2 id = hp - gv;
          float edgeD = 0.5 - hexDist(gv);
          float fw = fwidth(hp.y) * 1.2 + 1e-4;
          float edge = 1.0 - smoothstep(0.0, fw * 1.5, edgeD);
          float latc = id.y / S, lngc = id.x / (S * max(cos(latc), 0.05));
          float ht = texture2D(heatMap, vec2((lngc + 3.14159265) / 6.2831853, latc / 3.14159265 + 0.5)).r;
          float polar = 1.0 - smoothstep(1.15, 1.4, abs(lat));
          vec3 heatCol = ht < 0.5 ? mix(vec3(0.0, 1.0, 0.55), vec3(1.0, 0.85, 0.0), ht * 2.0) : mix(vec3(1.0, 0.85, 0.0), vec3(1.0, 0.1, 0.05), ht * 2.0 - 1.0);
          vec3 gridCol = mix(vec3(0.0, 1.0, 0.55), defcon, defconAmt * 0.6);
          float vis = (0.45 + 0.55 * (1.0 - dayAmt)) * polar * gridAmt;
          col += gridCol * edge * 0.03 * vis;
          col += heatCol * (edge * 1.6 + 0.35 * smoothstep(0.05, 0.6, ht)) * ht * vis;
          if (scanR > 0.0) {
            float ang = acos(clamp(dot(N, scanO), -1.0, 1.0));
            float ring = exp(-pow((ang - scanR) * 22.0, 2.0)) * (1.0 - scanR / 3.2);
            col += vec3(0.0, 1.0, 0.75) * ring * (edge * 2.5 + 0.08) * polar;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      extensions: { derivatives: true },
    });
    const earth = new T.Mesh(new T.SphereGeometry(R, 160, 120), earthMat);
    earth.name = 'earth';
    scene.add(earth);

    // ── Clouds, with lightning inside storm cells ────────────────────────────
    const flashes = [0, 1, 2, 3].map(() => new T.Vector4(0, 1, 0, 0));
    const cloudMat = new T.ShaderMaterial({
      uniforms: { cloudMap: { value: cloudMap }, cloudOff: earthMat.uniforms.cloudOff, sunDir: U.sunDir, flash: { value: flashes } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vUv = uv; vN = normalize(position); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: `uniform sampler2D cloudMap; uniform float cloudOff; uniform vec3 sunDir; uniform vec4 flash[4];
        varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          float c = texture2D(cloudMap, vUv + vec2(cloudOff, 0.0)).r;
          c = smoothstep(0.08, 0.9, c);
          float ndl = dot(N, sunDir);
          vec3 col = vec3(1.0, 0.98, 0.95) * (smoothstep(-0.12, 0.35, ndl) * 0.62 + 0.012);
          col *= mix(vec3(1.0), vec3(1.0, 0.55, 0.3), exp(-pow(ndl * 5.0, 2.0)) * 0.8);
          float lit = 0.0;
          for (int i = 0; i < 4; i++) { float d = 1.0 - dot(N, flash[i].xyz); lit += flash[i].w * exp(-d * 2600.0); }
          col += vec3(0.65, 0.75, 1.0) * lit * 9.0;
          float edge = smoothstep(0.0, 0.35, dot(N, V));
          float a = c * (0.25 + 0.75 * edge) * 0.8;
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true, depthWrite: false, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
    });
    const clouds = new T.Mesh(new T.SphereGeometry(R * 1.008, 128, 96), cloudMat);
    clouds.renderOrder = 2; clouds.name = 'clouds';
    scene.add(clouds);

    // ── Atmosphere: ray-marched scattering shell ─────────────────────────────
    const ATM = R * 1.075;
    const atmoMat = new T.ShaderMaterial({
      uniforms: { sunDir: U.sunDir, defcon: U.defcon, defconAmt: U.defconAmt, Rp: { value: R }, Ra: { value: ATM } },
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: `uniform vec3 sunDir, defcon; uniform float defconAmt, Rp, Ra; varying vec3 vW;
        vec2 hit(vec3 ro, vec3 rd, float r){ float b = dot(ro, rd), c = dot(ro, ro) - r * r, d = b * b - c; if (d < 0.0) return vec2(1e5, -1e5); d = sqrt(d); return vec2(-b - d, -b + d); }
        void main(){
          vec3 ro = cameraPosition, rd = normalize(vW - cameraPosition);
          vec2 ta = hit(ro, rd, Ra); if (ta.x > ta.y) discard;
          vec2 tp = hit(ro, rd, Rp);
          float t0 = max(ta.x, 0.0), t1 = tp.x > 0.0 && tp.x < ta.y ? tp.x : ta.y;
          float ds = (t1 - t0) / 10.0, H = (Ra - Rp) * 0.28;
          vec3 bR = vec3(0.16, 0.42, 1.0);
          float mu = dot(rd, sunDir);
          float phR = 0.75 * (1.0 + mu * mu), g = 0.76, phM = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.08;
          vec3 accR = vec3(0.0); float accM = 0.0;
          for (int i = 0; i < 10; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds);
            float h = length(p) - Rp, d = exp(-h / H);
            float cz = dot(normalize(p), sunDir);
            float lit = smoothstep(-0.28, 0.12, cz);
            vec3 tr = exp(-bR * 3.2 * (1.0 - smoothstep(-0.1, 0.6, cz)));   // reddening near the terminator
            accR += d * lit * tr; accM += d * lit;
          }
          vec3 col = (accR * bR * phR + accM * phM * vec3(1.0, 0.85, 0.6)) * ds * 3.2;
          col = mix(col, col + defcon * length(col) * 0.9, defconAmt * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: T.BackSide, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    });
    const atmosphere = new T.Mesh(new T.SphereGeometry(ATM, 96, 64), atmoMat);
    atmosphere.renderOrder = 3; atmosphere.name = 'atmosphere';
    scene.add(atmosphere);

    // ── Sky: Milky Way band, nebulae, twinkling stars ────────────────────────
    const skyMat = new T.ShaderMaterial({
      uniforms: {},
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: NOISE + `varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          vec3 gN = normalize(vec3(0.2, 0.86, 0.47));
          float b = dot(d, gN);
          float band = exp(-b * b * 22.0);
          float n = fbm3(d * 3.2), dust = fbm3(d * 7.0 + 4.0);
          vec3 c = vec3(0.55, 0.6, 0.85) * band * (0.35 + n) * 0.07;
          c *= 1.0 - smoothstep(0.45, 0.75, dust) * band * 0.8;                  // dark dust lanes
          c += vec3(0.9, 0.75, 0.6) * exp(-pow(acos(clamp(dot(d, normalize(vec3(-0.6, 0.3, -0.75))), -1.0, 1.0)) * 3.0, 2.0)) * band * 0.06;   // galactic core
          float neb = smoothstep(0.55, 0.85, fbm3(d * 2.0 + 11.0));
          c += mix(vec3(0.35, 0.05, 0.4), vec3(0.0, 0.25, 0.45), n) * neb * 0.025;
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: T.BackSide, depthWrite: false,
    });
    const sky = new T.Mesh(new T.SphereGeometry(300, 48, 32), skyMat);
    sky.renderOrder = -10;
    scene.add(sky);

    const STARS = 9000;
    {
      const pos = new Float32Array(STARS * 3), col = new Float32Array(STARS * 3), sz = new Float32Array(STARS), ph = new Float32Array(STARS);
      const gN = new T.Vector3(0.2, 0.86, 0.47).normalize(), v = new T.Vector3();
      for (let i = 0; i < STARS; i++) {
        // More stars near the galactic plane.
        do { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
        v.normalize();
        if (Math.random() < 0.45) { v.addScaledVector(gN, -v.dot(gN) * (0.7 + Math.random() * 0.3)).normalize(); }
        v.multiplyScalar(250);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        const t = Math.random();
        const c = t < 0.12 ? [0.65, 0.78, 1.0] : t < 0.22 ? [1.0, 0.86, 0.62] : t < 0.25 ? [1.0, 0.6, 0.45] : [1.0, 0.97, 0.94];
        const m = Math.pow(Math.random(), 6);
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        sz[i] = 0.6 + m * 3.2; ph[i] = Math.random() * TAU;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('size', new T.BufferAttribute(sz, 1));
      g.setAttribute('phase', new T.BufferAttribute(ph, 1));
      const m = new T.ShaderMaterial({
        uniforms: { time: U.time, pr: { value: 1 } },
        vertexShader: `attribute float size; attribute float phase; attribute vec3 color; uniform float time, pr; varying vec3 vC; varying float vA;
          void main(){ vC = color; vA = (0.7 + 0.3 * sin(time * (1.3 + fract(phase) * 2.0) + phase * 7.0)) * min(1.0, size);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; gl_PointSize = max(1.0, size) * pr; }`,
        fragmentShader: `varying vec3 vC; varying float vA;
          void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; float a = exp(-r * 3.5) * vA; gl_FragColor = vec4(vC * a * 1.6, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      var stars = new T.Points(g, m);
      stars.renderOrder = -9; stars.frustumCulled = false;
      scene.add(stars);
    }

    // ── Sun ──────────────────────────────────────────────────────────────────
    const sunMat = new T.ShaderMaterial({
      uniforms: { time: U.time },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float time; varying vec2 vUv;
        void main(){ float r = length(vUv), an = atan(vUv.y, vUv.x);
          float core = smoothstep(0.075, 0.06, r) * 22.0 + exp(-r * 9.0) * 3.0 + exp(-r * 3.0) * 0.35;
          float rays = pow(abs(cos(an * 6.0 + time * 0.05)), 40.0) * exp(-r * 4.0) * 0.8;
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * (core + rays) * smoothstep(1.0, 0.7, r), 1.0); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const sun = new T.Mesh(new T.PlaneGeometry(14, 14), sunMat);
    sun.renderOrder = -8;
    scene.add(sun);

    // ── Moon ─────────────────────────────────────────────────────────────────
    const moonMat = new T.ShaderMaterial({
      uniforms: { map: { value: moonMap }, sunDir: U.sunDir },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN;
        void main(){ vec3 c = pow(texture2D(map, vUv).rgb, vec3(2.2)); float l = max(dot(normalize(vN), sunDir), 0.0); gl_FragColor = vec4(c * (l * 2.2 + 0.004), 1.0); }`,
    });
    const moon = new T.Mesh(new T.SphereGeometry(0.15, 48, 32), moonMat);
    scene.add(moon);
    let moonAngle = 1.1;

    // ── Undersea cables: light pulses running along them ─────────────────────
    const CABLES = [
      [[40.7, -74.0], [45.5, -53.0], [51.5, -0.1]], [[37.8, -122.4], [51.5, -0.1]], [[37.8, -122.4], [35.7, 139.7]],
      [[35.7, 139.7], [1.35, 103.82]], [[1.35, 103.82], [-33.9, 151.2]], [[19.08, 72.88], [1.35, 103.82]], [[51.5, -0.1], [30.04, 31.24]],
      [[30.04, 31.24], [19.08, 72.88]], [[51.5, -0.1], [6.52, 3.38]], [[6.52, 3.38], [-33.9, 18.4]], [[-33.9, 151.2], [35.7, 139.7]],
      [[37.8, -122.4], [-33.9, -70.7]], [[48.85, 2.35], [40.7, -74.0]], [[52.37, 4.9], [40.7, -74.0]],
    ];
    {
      const pos = [], us = [], tmp = new T.Vector3(), prev = new T.Vector3();
      CABLES.forEach((route, ci) => {
        let dist = ci * 0.37;
        for (let s = 0; s < route.length - 1; s++) {
          const a = latLngToVec3(route[s][0], route[s][1], 1), b = latLngToVec3(route[s + 1][0], route[s + 1][1], 1);
          const ang = a.angleTo(b), steps = Math.max(12, Math.round(ang * 60));
          for (let k = 0; k < steps; k++) {
            const p0 = new T.Vector3().copy(a).lerp(b, k / steps).normalize().multiplyScalar(R + 0.0015);
            const p1 = new T.Vector3().copy(a).lerp(b, (k + 1) / steps).normalize().multiplyScalar(R + 0.0015);
            pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
            const l = p0.distanceTo(p1);
            us.push(dist, dist + l); dist += l;
          }
        }
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aU', new T.Float32BufferAttribute(us, 1));
      var cables = new T.LineSegments(g, new T.ShaderMaterial({
        uniforms: { time: U.time },
        vertexShader: 'attribute float aU; varying float vU; void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float time; varying float vU;
          void main(){ float p = pow(fract(vU * 2.2 - time * 0.22), 18.0); gl_FragColor = vec4(vec3(0.0, 0.55, 0.85) * (0.12 + p * 2.4), 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      }));
      cables.renderOrder = 4;
      scene.add(cables);
    }

    // ── Country borders: one draw call, per-country pulses ───────────────────
    const PULSE_N = 32;
    const pulseNames = []; const pulseT = new Array(PULSE_N).fill(-100);
    const borderMat = new T.ShaderMaterial({
      uniforms: { time: U.time, pulse: { value: pulseT }, defcon: U.defcon, defconAmt: U.defconAmt },
      vertexShader: `attribute float aPid; uniform float time; uniform float pulse[${PULSE_N}]; varying float vP;
        void main(){ vP = 0.0;
          if (aPid >= 0.0) { float dt = time - pulse[int(aPid)]; vP = dt >= 0.0 ? exp(-dt * 1.4) * smoothstep(0.0, 0.15, dt) : 0.0; }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 defcon; uniform float defconAmt; varying float vP;
        void main(){ vec3 base = mix(vec3(0.0, 0.85, 0.5), defcon, defconAmt * 0.5);
          gl_FragColor = vec4(base * 0.22 + mix(vec3(0.3, 1.0, 0.7), defcon, 0.5) * vP * 2.6, 1.0); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const borders = new T.LineSegments(new T.BufferGeometry(), borderMat);
    borders.renderOrder = 4; borders.frustumCulled = false;
    scene.add(borders);
    const GEO_NAME_MAP = { 'United States of America': 'USA', 'United Kingdom': 'UK', 'Russian Federation': 'Russia', 'Republic of Korea': 'South Korea', 'Korea, Republic of': 'South Korea', 'United Arab Emirates': 'UAE' };
    const tracked = new Set(CITIES.map(c => c.country));
    async function loadBorders() {
      const URLS = ['/vendor/geo/ne_110m_admin_0_countries.geojson', 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_admin_0_countries.geojson'];
      let data = null;
      for (const u of URLS) { try { const r = await fetch(u); if (r.ok) { data = await r.json(); break; } } catch (_) {} }
      if (!data) return;
      const pos = [], pid = [], v = new T.Vector3(), w = new T.Vector3();
      const ring = (pts, id) => {
        for (let i = 0; i < pts.length - 1; i++) {
          latLngToVec3(pts[i][1], pts[i][0], R + 0.0022, v); latLngToVec3(pts[i + 1][1], pts[i + 1][0], R + 0.0022, w);
          // Long edges follow the curve of the globe instead of cutting through it.
          const n = Math.max(1, Math.ceil(v.angleTo(w) / 0.02));
          for (let k = 0; k < n; k++) {
            const a = v.clone().lerp(w, k / n).setLength(R + 0.0022), b = v.clone().lerp(w, (k + 1) / n).setLength(R + 0.0022);
            pos.push(a.x, a.y, a.z, b.x, b.y, b.z); pid.push(id, id);
          }
        }
      };
      data.features.forEach(f => {
        const p = f.properties || {}, raw = p.NAME || p.ADMIN || p.name || '';
        const name = GEO_NAME_MAP[raw] || raw;
        let id = -1;
        if (tracked.has(name) && pulseNames.length < PULSE_N) { id = pulseNames.indexOf(name); if (id < 0) { id = pulseNames.length; pulseNames.push(name); } }
        const gm = f.geometry; if (!gm) return;
        if (gm.type === 'Polygon') gm.coordinates.forEach(r => ring(r, id));
        else if (gm.type === 'MultiPolygon') gm.coordinates.forEach(poly => poly.forEach(r => ring(r, id)));
      });
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aPid', new T.Float32BufferAttribute(pid, 1));
      borders.geometry.dispose(); borders.geometry = g;
    }
    loadBorders();

    // ── City markers: core, sonar rings and hit flashes, all in one draw ─────
    const NC = CITIES.length;
    const cityPos = CITIES.map(c => latLngToVec3(c.lat, c.lng, 1));
    const cityHit = new Float32Array(NC).fill(-100);
    const cityHitAttr = new T.InstancedBufferAttribute(cityHit, 1);
    {
      const g = new T.InstancedBufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const p = new Float32Array(NC * 3), ph = new Float32Array(NC);
      cityPos.forEach((v, i) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; ph[i] = Math.random() * 3; });
      g.setAttribute('iN', new T.InstancedBufferAttribute(p, 3));
      g.setAttribute('iPh', new T.InstancedBufferAttribute(ph, 1));
      g.setAttribute('iHit', cityHitAttr);
      g.instanceCount = NC;
      const m = new T.ShaderMaterial({
        uniforms: { time: U.time, defcon: U.defcon, defconAmt: U.defconAmt },
        vertexShader: `attribute vec3 iN; attribute float iPh; attribute float iHit; uniform float time; varying vec2 vQ; varying float vPh; varying float vHit;
          void main(){ vQ = position.xy; vPh = iPh; vHit = time - iHit;
            vec3 n = normalize(iN), e = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0)), t = cross(n, e);
            float s = 0.075;
            vec3 p = n * (${R.toFixed(3)} + 0.004) + (e * position.x + t * position.y) * s;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `uniform float time; uniform vec3 defcon; uniform float defconAmt; varying vec2 vQ; varying float vPh; varying float vHit;
          void main(){ float d = length(vQ);
            vec3 c = mix(vec3(0.0, 1.0, 0.55), defcon, defconAmt * 0.5);
            float core = exp(-d * d * 260.0) * 4.0 + exp(-d * d * 40.0) * 0.5;
            float sp = fract(time * 0.33 + vPh), sr = sp * 0.95;
            float sonar = exp(-pow((d - sr) * 26.0, 2.0)) * (1.0 - sp) * 0.9;
            float hit = 0.0;
            if (vHit >= 0.0 && vHit < 1.6) { float hr = vHit * 0.75; hit = exp(-pow((d - hr) * 18.0, 2.0)) * (1.0 - vHit / 1.6) * 2.5 + exp(-d * d * 60.0) * max(0.0, 1.0 - vHit * 2.0) * 3.0; }
            float a = (core + sonar) + hit;
            if (a < 0.003) discard;
            gl_FragColor = vec4(mix(c, vec3(1.0), clamp(hit * 0.2, 0.0, 0.4)) * a, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      var cityMarks = new T.Mesh(g, m);
      cityMarks.frustumCulled = false; cityMarks.renderOrder = 5;
      scene.add(cityMarks);
    }

    // ── Attack arcs: comet ribbons, one instanced draw, animated on the GPU ──
    const MAXA = 320, SEG = 96;
    const arcGeo = new T.InstancedBufferGeometry();
    {
      const at = [], side = [], idx = [];
      for (let i = 0; i <= SEG; i++) { at.push(i / SEG, i / SEG); side.push(-1, 1); }
      for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      arcGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
      arcGeo.setAttribute('aT', new T.Float32BufferAttribute(at, 1));
      arcGeo.setAttribute('aSide', new T.Float32BufferAttribute(side, 1));
      arcGeo.setIndex(idx);
    }
    const aP0 = new T.InstancedBufferAttribute(new Float32Array(MAXA * 3), 3);
    const aP1 = new T.InstancedBufferAttribute(new Float32Array(MAXA * 3), 3);
    const aP2 = new T.InstancedBufferAttribute(new Float32Array(MAXA * 3), 3);
    const aCol = new T.InstancedBufferAttribute(new Float32Array(MAXA * 3), 3);
    const aTim = new T.InstancedBufferAttribute(new Float32Array(MAXA * 4).fill(-1000), 4);   // start, duration, width, packets
    [aP0, aP1, aP2, aCol, aTim].forEach(a => a.setUsage(T.DynamicDrawUsage));
    arcGeo.setAttribute('iP0', aP0); arcGeo.setAttribute('iP1', aP1); arcGeo.setAttribute('iP2', aP2);
    arcGeo.setAttribute('iCol', aCol); arcGeo.setAttribute('iTim', aTim);
    arcGeo.instanceCount = MAXA;
    const arcMat = new T.ShaderMaterial({
      uniforms: { time: U.time },
      vertexShader: `attribute float aT; attribute float aSide; attribute vec3 iP0; attribute vec3 iP1; attribute vec3 iP2; attribute vec3 iCol; attribute vec4 iTim;
        uniform float time; varying float vT; varying float vS; varying float vHead; varying float vFade; varying vec3 vCol; varying float vPk;
        void main(){
          float age = time - iTim.x, dur = iTim.y;
          vHead = age / dur; vFade = 1.0 - clamp((age - dur) / 1.4, 0.0, 1.0);
          if (age < 0.0 || vFade <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float t = aT, u = 1.0 - t;
          vec3 p = u * u * iP0 + 2.0 * u * t * iP1 + t * t * iP2;
          vec3 tg = normalize(2.0 * u * (iP1 - iP0) + 2.0 * t * (iP2 - iP1));
          vec3 vd = normalize(cameraPosition - p);
          vec3 sd = normalize(cross(tg, vd));
          float w = iTim.z * (0.55 + 0.45 * sin(t * 3.14159)) * (1.0 + 0.7 * exp(-pow((t - min(vHead, 1.0)) * 18.0, 2.0)));
          w *= clamp(length(cameraPosition - p) / 3.0, 0.3, 1.0);   // stay thin in close-ups
          p += sd * aSide * w;
          vT = t; vS = aSide; vCol = iCol; vPk = iTim.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float time; varying float vT; varying float vS; varying float vHead; varying float vFade; varying vec3 vCol; varying float vPk;
        void main(){
          float head = min(vHead, 1.0);
          if (vT > head + 0.01) discard;
          float across = 1.0 - vS * vS;
          float tail = smoothstep(head - 0.42, head, vT);
          float glow = exp(-pow((vT - head) * 55.0, 2.0)) * (vHead < 1.0 ? 1.0 : 0.0);
          float trail = 0.16;
          float pk = vPk > 0.0 ? pow(max(0.0, sin(vT * 6.2831 * (4.0 + vPk) - time * 9.0)), 16.0) * 1.2 : 0.0;
          float i = (tail * tail * 1.3 + trail + glow * 2.4 + pk) * pow(across, 1.6) * vFade;
          gl_FragColor = vec4(vCol * i, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const arcMesh = new T.Mesh(arcGeo, arcMat);
    arcMesh.frustumCulled = false; arcMesh.renderOrder = 6;
    scene.add(arcMesh);
    let arcSlot = 0;
    const arcs = [];   // { done, eventTypeKey, severity, end, slot, dstIdx, ... } shared with the UI

    // ── Impacts on the surface, and pillars of light for critical hits ───────
    const MAXI = 96;
    const iPos = new T.InstancedBufferAttribute(new Float32Array(MAXI * 3), 3);
    const iCol = new T.InstancedBufferAttribute(new Float32Array(MAXI * 3), 3);
    const iTim = new T.InstancedBufferAttribute(new Float32Array(MAXI * 4).fill(-1000), 4);   // start, life, size, kind (0 ring, 1 pillar, 2 emp)
    [iPos, iCol, iTim].forEach(a => a.setUsage(T.DynamicDrawUsage));
    const impGeo = new T.InstancedBufferGeometry();
    impGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    impGeo.setIndex([0, 1, 2, 0, 2, 3]);
    impGeo.setAttribute('iN', iPos); impGeo.setAttribute('iCol', iCol); impGeo.setAttribute('iTim', iTim);
    impGeo.instanceCount = MAXI;
    const impMat = new T.ShaderMaterial({
      uniforms: { time: U.time },
      vertexShader: `attribute vec3 iN; attribute vec3 iCol; attribute vec4 iTim; uniform float time;
        varying vec2 vQ; varying vec3 vCol; varying float vK; varying float vAge;
        void main(){
          float age = (time - iTim.x) / iTim.y;
          if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          vec3 n = normalize(iN), e = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0)), t = cross(n, e);
          vec3 p;
          if (iTim.w > 0.5 && iTim.w < 1.5) {
            // Pillar: a camera-facing beam standing on the surface.
            vec3 vd = normalize(cameraPosition - n);
            vec3 sd = normalize(cross(n, vd));
            p = n * (${R.toFixed(3)} + (position.y * 0.5 + 0.5) * 0.42 * iTim.z) + sd * position.x * 0.014 * iTim.z;
          } else p = n * (${R.toFixed(3)} + 0.005) + (e * position.x + t * position.y) * iTim.z;
          vQ = position.xy; vCol = iCol; vK = iTim.w; vAge = age;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `varying vec2 vQ; varying vec3 vCol; varying float vK; varying float vAge;
        void main(){
          float a = 0.0;
          if (vK > 0.5 && vK < 1.5) {
            float h = vQ.y * 0.5 + 0.5;
            a = exp(-vQ.x * vQ.x * 6.0) * (1.0 - h) * (1.0 - h) * sin(vAge * 3.14159) * 2.0 + exp(-vQ.x * vQ.x * 60.0) * (1.0 - h) * (1.0 - vAge) * 2.5;
          } else {
            float d = length(vQ);
            for (int k = 0; k < 3; k++) { float fk = float(k); float t = clamp(vAge * (vK > 1.5 ? 1.0 : 1.25) - fk * 0.12, 0.0, 1.0); float r = pow(t, 0.6) * 0.95;
              a += exp(-pow((d - r) * (vK > 1.5 ? 30.0 : 20.0), 2.0)) * (1.0 - t) * (1.0 - fk * 0.25) * step(0.0001, t); }
            a += exp(-d * d * 30.0) * max(0.0, 1.0 - vAge * 3.0) * 2.5;
            a *= smoothstep(1.0, 0.9, d);
          }
          if (a < 0.002) discard;
          gl_FragColor = vec4(vCol * a, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const impMesh = new T.Mesh(impGeo, impMat);
    impMesh.frustumCulled = false; impMesh.renderOrder = 7;
    scene.add(impMesh);
    let impSlot = 0;
    function impact(n, color, size, kind, life) {
      const s = impSlot; impSlot = (impSlot + 1) % MAXI;
      iPos.setXYZ(s, n.x, n.y, n.z); iCol.setXYZ(s, color.r, color.g, color.b);
      iTim.setXYZW(s, U.time.value, life || 1.6, size, kind || 0);
      iPos.needsUpdate = iCol.needsUpdate = iTim.needsUpdate = true;
    }

    // ── Aurora curtains over both magnetic poles ─────────────────────────────
    const auroraMat = new T.ShaderMaterial({
      uniforms: { time: U.time, sunDir: U.sunDir, surge: { value: 0 } },
      vertexShader: `attribute vec2 aUH; varying vec2 vUH; varying vec3 vB;
        void main(){ vUH = aUH; vB = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: NOISE + `uniform float time, surge; uniform vec3 sunDir; varying vec2 vUH; varying vec3 vB;
        void main(){
          float u = vUH.x, h = vUH.y;
          float fold = n3(vec3(u * 9.0, time * 0.18, 1.0)) * 0.6;
          float rays = n3(vec3((u + fold * 0.05) * 160.0, time * 0.7, 3.0));
          rays = pow(rays, 3.0) * 1.6 + 0.25;
          float body = smoothstep(0.0, 0.12, h) * pow(1.0 - h, 1.8);
          float act = smoothstep(0.25, 0.75, n3(vec3(u * 5.0 - time * 0.06, 7.0, time * 0.05))) * (0.6 + surge * 1.6);
          float dark = 1.0 - smoothstep(-0.2, 0.15, dot(vB, sunDir));
          vec3 col = mix(vec3(0.1, 1.0, 0.45), vec3(0.85, 0.15, 0.85), smoothstep(0.35, 0.95, h));
          gl_FragColor = vec4(col * rays * body * act * dark * 1.4, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    });
    {
      const pos = [], uh = [], idx = [];
      const N = 360;
      const ring = (pole) => {
        const A = latLngToVec3(pole[0], pole[1], 1).normalize();
        const B1 = new T.Vector3(0, 1, 0).cross(A).normalize(), B2 = A.clone().cross(B1);
        const base = pos.length / 3;
        for (let i = 0; i <= N; i++) {
          const th = i / N * TAU, c = (21 + Math.sin(th * 3) * 1.6) * Math.PI / 180;
          const d = A.clone().multiplyScalar(Math.cos(c)).addScaledVector(B1, Math.sin(c) * Math.cos(th)).addScaledVector(B2, Math.sin(c) * Math.sin(th));
          const lo = d.clone().multiplyScalar(R + 0.012), hi = d.clone().multiplyScalar(R + 0.085);
          pos.push(lo.x, lo.y, lo.z, hi.x, hi.y, hi.z); uh.push(i / N, 0, i / N, 1);
          if (i < N) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
      };
      ring([80.7, -72.7]); ring([-80.7, 107.3]);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aUH', new T.Float32BufferAttribute(uh, 2));
      g.setIndex(idx);
      var aurora = new T.Mesh(g, auroraMat);
      aurora.renderOrder = 4;
      scene.add(aurora);
    }

    // ── Plasma shield (DEFCON 2 and 1) ───────────────────────────────────────
    const shieldMat = new T.ShaderMaterial({
      uniforms: { time: U.time, amt: { value: 0 }, defcon: U.defcon },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: NOISE + `uniform float time, amt; uniform vec3 defcon; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
          vec3 q = vN * 14.0; vec3 cell = abs(fract(q) - 0.5);
          float hexy = smoothstep(0.45, 0.5, max(cell.x, max(cell.y, cell.z)));
          float flow = n3(vN * 6.0 + time * 0.4);
          float a = (f * 0.9 + hexy * 0.07 * flow + pow(flow, 6.0) * 0.12) * amt * (0.8 + 0.2 * sin(time * 3.0));
          gl_FragColor = vec4(mix(vec3(0.0, 0.8, 1.0), defcon, 0.7) * a, 1.0); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const shield = new T.Mesh(new T.SphereGeometry(R * 1.22, 96, 64), shieldMat);
    shield.visible = false; shield.renderOrder = 8;
    scene.add(shield);
    let shieldTarget = 0;

    // ── Satellites: orbit rings that fade into comet trails ──────────────────
    const SATS = [
      { tilt: 0.45, rot: 0.3, speed: 0.38, color: new T.Color(0x00ff88), r: 1.38 },
      { tilt: -0.7, rot: 1.6, speed: -0.3, color: new T.Color(0x00ccff), r: 1.5 },
      { tilt: 1.15, rot: -0.8, speed: 0.24, color: new T.Color(0xd8b25a), r: 1.62 },
    ];
    const satPts = new Float32Array(SATS.length * 3), satCol = new Float32Array(SATS.length * 3);
    SATS.forEach((s, i) => {
      s.angle = Math.random() * TAU;
      s.pivot = new T.Object3D(); s.pivot.rotation.set(s.tilt, s.rot, 0); s.pivot.updateMatrixWorld(true);
      const pos = [], ang = [];
      for (let k = 0; k <= 256; k++) { const a = k / 256 * TAU; pos.push(s.r * Math.cos(a), 0, s.r * Math.sin(a)); ang.push(a); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aA', new T.Float32BufferAttribute(ang, 1));
      s.uAngle = { value: s.angle };
      s.uCol = { value: s.color.clone() };
      const m = new T.ShaderMaterial({
        uniforms: { ang: s.uAngle, col: s.uCol, dir: { value: Math.sign(s.speed) } },
        vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float ang, dir; uniform vec3 col; varying float vA;
          void main(){ float d = mod((ang - vA) * dir + 6.2831853, 6.2831853); float a = 0.06 + exp(-d * 2.2) * 1.4; gl_FragColor = vec4(col * a, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      s.ring = new T.LineLoop(g, m);
      s.ring.rotation.copy(s.pivot.rotation);
      s.ring.renderOrder = 4;
      scene.add(s.ring);
      s.world = new T.Vector3();
      satCol[i * 3] = s.color.r; satCol[i * 3 + 1] = s.color.g; satCol[i * 3 + 2] = s.color.b;
    });
    const satGeo = new T.BufferGeometry();
    satGeo.setAttribute('position', new T.BufferAttribute(satPts, 3));
    satGeo.setAttribute('color', new T.BufferAttribute(satCol, 3));
    const satPrMat = new T.ShaderMaterial({
      uniforms: { pr: { value: 1 }, time: U.time },
      vertexShader: 'attribute vec3 color; uniform float pr; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 26.0 * pr / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float time; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = exp(-r * r * 30.0) * 5.0 + exp(-r * 5.0) * 0.6 * (0.7 + 0.3 * sin(time * 9.0)); gl_FragColor = vec4(vC * a, 1.0); }',
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const satPoints = new T.Points(satGeo, satPrMat);
    satPoints.frustumCulled = false; satPoints.renderOrder = 6;
    scene.add(satPoints);
    // Laser cross-links and the hijack beam (a small pool of segments).
    const LASERS = 6;
    const lzPos = new Float32Array(LASERS * 6), lzCol = new Float32Array(LASERS * 6);
    const lzGeo = new T.BufferGeometry();
    lzGeo.setAttribute('position', new T.BufferAttribute(lzPos, 3).setUsage(T.DynamicDrawUsage));
    lzGeo.setAttribute('color', new T.BufferAttribute(lzCol, 3).setUsage(T.DynamicDrawUsage));
    const lasers = new T.LineSegments(lzGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    lasers.frustumCulled = false; lasers.renderOrder = 6;
    scene.add(lasers);
    const lzState = Array.from({ length: LASERS }, () => ({ t: 1, a: null, b: null, col: new T.Color(), beam: false, city: null }));

    // ── Solar wind: particles streaming from the sun, parting round the Earth ─
    {
      const N = 1600, seed = new Float32Array(N * 4);
      for (let i = 0; i < N * 4; i++) seed[i] = Math.random();
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('seed', new T.BufferAttribute(seed, 4));
      var wind = new T.Points(g, new T.ShaderMaterial({
        uniforms: { time: U.time, sunDir: U.sunDir, pr: { value: 1 }, surge: auroraMat.uniforms.surge },
        vertexShader: `attribute vec4 seed; uniform float time, pr, surge; uniform vec3 sunDir; varying float vA;
          void main(){
            float life = fract(time * (0.05 + seed.w * 0.04) * (1.0 + surge * 2.0) + seed.x);
            vec3 up = abs(sunDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
            vec3 a = normalize(cross(sunDir, up)), b = cross(sunDir, a);
            vec2 off = (seed.yz - 0.5) * 5.0;
            vec3 p = sunDir * mix(16.0, -10.0, life) + a * off.x + b * off.y;
            // The magnetosphere: bend the stream around the planet.
            float r = length(p); p += normalize(p) * max(0.0, 2.2 - r) * 0.8;
            vA = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.7, life) * (0.3 + surge);
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = max(1.0, 2.5 * pr * (1.0 + surge)); gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 14.0) * vA; gl_FragColor = vec4(vec3(1.0, 0.75, 0.35) * a * 0.55, 1.0); }',
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      }));
      wind.frustumCulled = false; wind.renderOrder = 1;
      scene.add(wind);
    }

    // ── Orbital debris ───────────────────────────────────────────────────────
    {
      const N = 700, pos = new Float32Array(N * 3), v = new T.Vector3();
      for (let i = 0; i < N; i++) { v.set(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.6, Math.random() * 2 - 1).setLength(1.16 + Math.random() * 0.55); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      var debris = new T.Points(g, new T.ShaderMaterial({
        uniforms: { pr: { value: 1 }, sunDir: U.sunDir },
        vertexShader: 'uniform float pr; uniform vec3 sunDir; varying float vL; void main(){ vL = 0.25 + 0.75 * smoothstep(-0.2, 0.3, dot(normalize((modelMatrix * vec4(position, 1.0)).xyz), sunDir)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, 1.6 * pr); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vL; void main(){ gl_FragColor = vec4(vec3(0.45, 0.55, 0.65) * vL * 0.6, 1.0); }',
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      }));
      debris.renderOrder = 1;
      scene.add(debris);
    }

    // ── Shooting stars and the CME shock front ───────────────────────────────
    const METEORS = 4, mtPos = new Float32Array(METEORS * 6), mtCol = new Float32Array(METEORS * 6);
    const mtGeo = new T.BufferGeometry();
    mtGeo.setAttribute('position', new T.BufferAttribute(mtPos, 3).setUsage(T.DynamicDrawUsage));
    mtGeo.setAttribute('color', new T.BufferAttribute(mtCol, 3).setUsage(T.DynamicDrawUsage));
    const meteorLines = new T.LineSegments(mtGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    meteorLines.frustumCulled = false; meteorLines.renderOrder = -7;
    scene.add(meteorLines);
    const meteors = Array.from({ length: METEORS }, () => ({ life: 1, p: new T.Vector3(), d: new T.Vector3(), speed: 0 }));
    const cmeMat = new T.ShaderMaterial({
      uniforms: { amt: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: 'uniform float amt; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(normalize(vN), V)), 3.0); gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * f * amt * 2.0, 1.0); }',
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    });
    const cme = new T.Mesh(new T.SphereGeometry(1, 48, 32), cmeMat);
    cme.visible = false; cme.renderOrder = 9;
    scene.add(cme);

    // ── HDR pipeline: MSAA scene → soft-knee bloom → final grade ─────────────
    const fsq = new T.Mesh(new T.PlaneGeometry(2, 2), null);
    const fsScene = new T.Scene(); fsScene.add(fsq);
    const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (mat, target) => { fsq.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
    const rtOpt = { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };
    let sceneRT = null, bloomDown = [], bloomUp = [];
    const LEVELS = 6;
    const prefilter = new T.ShaderMaterial({ uniforms: { src: { value: null }, texel: { value: new T.Vector2() } }, depthTest: false, depthWrite: false, vertexShader: FSQ_VERT,
      fragmentShader: `uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 c = (texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.25;
          c = min(c, vec3(40.0));
          float br = max(c.r, max(c.g, c.b)), th = 1.4, knee = 0.5;
          float soft = clamp(br - th + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
          gl_FragColor = vec4(c * max(soft, br - th) / max(br, 1e-4), 1.0); }` });
    const down = new T.ShaderMaterial({ uniforms: { src: { value: null }, texel: { value: new T.Vector2() } }, depthTest: false, depthWrite: false, vertexShader: FSQ_VERT,
      fragmentShader: `uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 c = texture2D(src, vUv).rgb * 4.0;
          c += texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb;
          gl_FragColor = vec4(c / 8.0, 1.0); }` });
    const up = new T.ShaderMaterial({ uniforms: { src: { value: null }, base: { value: null }, texel: { value: new T.Vector2() }, w: { value: 1 } }, depthTest: false, depthWrite: false, vertexShader: FSQ_VERT,
      fragmentShader: `uniform sampler2D src, base; uniform vec2 texel; uniform float w; varying vec2 vUv;
        void main(){ vec3 c = vec3(0.0);
          c += texture2D(src, vUv + texel * vec2(-1.0, 0.0)).rgb * 2.0 + texture2D(src, vUv + texel * vec2(1.0, 0.0)).rgb * 2.0;
          c += texture2D(src, vUv + texel * vec2(0.0, -1.0)).rgb * 2.0 + texture2D(src, vUv + texel * vec2(0.0, 1.0)).rgb * 2.0;
          c += texture2D(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(src, vUv + texel * vec2(1.0, 1.0)).rgb;
          c /= 12.0;
          gl_FragColor = vec4(texture2D(base, vUv).rgb + c * w, 1.0); }` });
    const finalMat = new T.ShaderMaterial({
      uniforms: { scene: { value: null }, bloom: { value: null }, res: { value: new T.Vector2(1, 1) }, time: U.time, exposure: { value: 1 },
        glitch: { value: 0 }, flash: { value: 0 }, flashCol: { value: new T.Color(1, 0.6, 0.2) }, sunUv: { value: new T.Vector3(0, 0, 0) }, aspect: { value: 1 }, fade: { value: 1 } },
      depthTest: false, depthWrite: false, vertexShader: FSQ_VERT,
      fragmentShader: `uniform sampler2D scene, bloom; uniform vec2 res; uniform float time, exposure, glitch, flash, aspect, fade; uniform vec3 flashCol, sunUv; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main(){
          vec2 uv = vUv;
          // Critical alert: tearing slices and an RGB split.
          if (glitch > 0.0) {
            float band = floor(uv.y * 28.0 + floor(time * 30.0));
            float j = step(0.72, hash(vec2(band, floor(time * 24.0)))) * (hash(vec2(band, 3.1)) - 0.5);
            uv.x += j * 0.06 * glitch;
          }
          vec2 d = uv - 0.5; float r2 = dot(d, d);
          vec2 off = d * (0.0025 + glitch * 0.02) * (0.4 + r2 * 3.0);
          vec3 c = vec3(texture2D(scene, uv + off).r, texture2D(scene, uv).g, texture2D(scene, uv - off).b);
          c += texture2D(bloom, uv).rgb * 0.45;
          // Lens flare from the sun: ghosts along the line through the centre, and a halo.
          if (sunUv.z > 0.001) {
            vec2 sp = sunUv.xy, ax = vec2(0.5) - sp, asp = vec2(aspect, 1.0);
            for (int k = 0; k < 5; k++) {
              float fk = float(k);
              float t = fk == 0.0 ? 0.5 : fk == 1.0 ? 0.85 : fk == 2.0 ? 1.2 : fk == 3.0 ? 1.55 : 2.0;
              float rr = fk == 0.0 ? 0.03 : fk == 1.0 ? 0.075 : fk == 2.0 ? 0.02 : fk == 3.0 ? 0.12 : 0.05;
              vec2 q = abs((uv - (sp + ax * t)) * asp);
              float hd = max(q.x * 0.866 + q.y * 0.5, q.y);
              vec3 tint = 0.55 + 0.45 * cos(6.2831 * (fk * 0.21 + vec3(0.0, 0.33, 0.67)));
              c += tint * smoothstep(rr, rr * 0.7, hd) * sunUv.z * 0.12;
            }
            float hr = length((uv - mix(vec2(0.5), sp, 0.25)) * asp);
            c += (0.5 + 0.5 * cos(6.2831 * (hr * 3.0 + vec3(0.0, 0.33, 0.67)))) * smoothstep(0.03, 0.0, abs(hr - 0.42)) * sunUv.z * 0.06;
          }
          c += flashCol * flash;
          c = aces(c * exposure);
          c = pow(c, vec3(1.0 / 2.2));
          c *= mix(1.0, smoothstep(1.0, 0.25, sqrt(r2) * 1.3), 0.85);
          c += (hash(vUv * res + fract(time * 13.7) * 91.0) - 0.5) * 0.025;
          c *= fade;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });

    // Eye adaptation: the scene's luminance is boiled down to a 16×16 log-encoded
    // map, read back a few times a second, and the exposure eases down when the
    // frame gets bright (a close-up on the sunlit side, a swarm of attacks), so
    // the picture never washes out to white.
    const LUM = 16, lumRT = new T.WebGLRenderTarget(LUM, LUM, { type: T.UnsignedByteType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false, stencilBuffer: false });
    const lumPx = new Uint8Array(LUM * LUM * 4);
    const lumMat = new T.ShaderMaterial({ uniforms: { src: { value: null } }, depthTest: false, depthWrite: false, vertexShader: FSQ_VERT,
      fragmentShader: `uniform sampler2D src; varying vec2 vUv;
        void main(){ float L = 0.0;
          for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
            vec3 c = texture2D(src, vUv + (vec2(float(x), float(y)) - 1.5) / (4.0 * ${LUM}.0)).rgb;
            L += dot(min(c, vec3(16.0)), vec3(0.2126, 0.7152, 0.0722));
          }
          gl_FragColor = vec4(clamp(log2(L / 16.0 + 1e-4) / 18.0 + 0.75, 0.0, 1.0), 0.0, 0.0, 1.0); }` });
    const eye = { exposure: 1, target: 1, clock: 0, mean: 0 };
    function meter(dt) {
      eye.clock -= dt;
      if (eye.clock <= 0) {
        eye.clock = 0.25;
        lumMat.uniforms.src.value = sceneRT.texture; pass(lumMat, lumRT);
        try { renderer.readRenderTargetPixels(lumRT, 0, 0, LUM, LUM, lumPx); } catch (_) { return; }
        // Mean linear luminance, centre-weighted (the globe sits in the middle).
        let s = 0, ws = 0;
        for (let y = 0; y < LUM; y++) for (let x = 0; x < LUM; x++) {
          const dx = (x + 0.5) / LUM - 0.5, dy = (y + 0.5) / LUM - 0.5, w = 1.2 - Math.min(1, (dx * dx + dy * dy) * 3);
          s += Math.pow(2, (lumPx[(y * LUM + x) * 4] / 255 - 0.75) * 18) * w; ws += w;
        }
        eye.mean = s / ws;
        // Only ever darken: a dim frame keeps exposure 1.
        eye.target = clamp(KEY / Math.max(eye.mean, 1e-4), 0.45, 1);
      }
      // Darken quickly, recover slowly, like an eye.
      const k = eye.target < eye.exposure ? 2.2 : 0.5;
      eye.exposure += (eye.target - eye.exposure) * Math.min(1, dt * k);
      finalMat.uniforms.exposure.value = eye.exposure;
    }
    const KEY = 0.085;

    function makeTargets(w, h) {
      [sceneRT, ...bloomDown, ...bloomUp].forEach(t => t && t.dispose());
      if (gl2 && T.WebGLMultisampleRenderTarget && renderer.extensions.has('EXT_color_buffer_float')) {
        sceneRT = new T.WebGLMultisampleRenderTarget(w, h, Object.assign({}, rtOpt, { depthBuffer: true }));
        sceneRT.samples = 4;
      } else sceneRT = new T.WebGLRenderTarget(w, h, Object.assign({}, rtOpt, { depthBuffer: true, type: gl2 ? T.HalfFloatType : T.UnsignedByteType }));
      bloomDown = []; bloomUp = [];
      let bw = w >> 1, bh = h >> 1;
      for (let i = 0; i < LEVELS; i++) {
        bloomDown.push(new T.WebGLRenderTarget(Math.max(1, bw), Math.max(1, bh), rtOpt));
        bloomUp.push(new T.WebGLRenderTarget(Math.max(1, bw), Math.max(1, bh), rtOpt));
        bw >>= 1; bh >>= 1;
      }
    }

    function renderFrame(dt) {
      renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
      // Bloom: threshold → down chain → up chain (tent filter, accumulating).
      prefilter.uniforms.src.value = sceneRT.texture; prefilter.uniforms.texel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
      pass(prefilter, bloomDown[0]);
      for (let i = 1; i < LEVELS; i++) {
        down.uniforms.src.value = bloomDown[i - 1].texture; down.uniforms.texel.value.set(1 / bloomDown[i - 1].width, 1 / bloomDown[i - 1].height);
        pass(down, bloomDown[i]);
      }
      let src = bloomDown[LEVELS - 1];
      for (let i = LEVELS - 2; i >= 0; i--) {
        up.uniforms.src.value = src.texture; up.uniforms.base.value = bloomDown[i].texture;
        up.uniforms.texel.value.set(1 / src.width, 1 / src.height); up.uniforms.w.value = 1.0;
        pass(up, bloomUp[i]); src = bloomUp[i];
      }
      finalMat.uniforms.scene.value = sceneRT.texture; finalMat.uniforms.bloom.value = src.texture;
      meter(dt);
      pass(finalMat, null);
    }

    // ── Camera: intro, orbit with inertia, zoom, focus and the auto-director ─
    const cam = {
      lon: 0, lat: 0.32, dist: 4.1, vLon: 0, vLat: 0, distT: 4.1,
      target: null,      // { lon, lat, dist, until, ease }
      idle: 0, intro: reduced ? 1 : 0, introFrom: 0,
    };
    const HOME = 4.1;
    const sunLon = Math.atan2(sunDir.z, sunDir.x);
    // Start looking across the terminator: half day, half night.
    cam.lon = sunLon + 1.15; cam.introFrom = cam.lon - 1.6;
    const camDir = new T.Vector3();
    function dirToLonLat(v) { return { lon: Math.atan2(v.z, v.x), lat: Math.asin(clamp(v.y / v.length(), -1, 1)) }; }
    function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
    let directorOn = !reduced, nextDirect = 9, interacted = 0;
    function poke() { cam.idle = 0; cam.target = null; interacted = 1; }
    function flyTo(lon, lat, dist, hold) { cam.target = { lon, lat, dist, until: hold, t: 0 }; }

    let drag = null; const pointers = new Map();
    container.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('button, input, a, .filter-bar, #country-profile, #music-player')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX, y: e.clientY, moved: 0 }; poke();
      cam.intro = 1;
    });
    window.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const [c, d] = [...pointers.values()];
        const after = Math.hypot(c.x - d.x, c.y - d.y);
        if (before > 0) cam.distT = clamp(cam.distT * before / after, 1.5, 7);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0042 * (cam.dist / HOME);
      cam.vLon = -dx * k * 60; cam.vLat = dy * k * 60;
      cam.lon -= dx * k; cam.lat = clamp(cam.lat + dy * k, -1.25, 1.25);
    });
    let lastMoved = 0;
    const endPtr = e => { pointers.delete(e.pointerId); if (!pointers.size) { lastMoved = drag ? drag.moved : 0; drag = null; } };
    window.addEventListener('pointerup', endPtr); window.addEventListener('pointercancel', endPtr);
    container.addEventListener('wheel', e => { e.preventDefault(); poke(); cam.distT = clamp(cam.distT * Math.exp(e.deltaY * 0.0012), 1.5, 7); }, { passive: false });

    function updateCamera(dt) {
      cam.idle += dt;
      if (cam.intro < 1) {
        cam.intro = Math.min(1, cam.intro + dt / 4.2);
        const k = easeInOut(cam.intro);
        cam.dist = lerp(13, cam.distT, easeOut(cam.intro));
        cam.lon = lerp(cam.introFrom, cam.introFrom + 1.6, k);
        cam.lat = lerp(0.62, 0.32, k);
      } else if (cam.target) {
        const t = cam.target;
        t.t += dt;
        const s = 1 - Math.exp(-dt * 1.6);
        cam.lon += angDiff(cam.lon, t.lon) * s; cam.lat += (t.lat - cam.lat) * s; cam.dist += (t.dist - cam.dist) * s;
        cam.vLon = cam.vLat = 0;
        if (t.until && t.t > t.until) { cam.target = null; cam.distT = HOME; }
      } else {
        if (!pointers.size) {
          cam.lon += cam.vLon * dt; cam.lat = clamp(cam.lat + cam.vLat * dt, -1.25, 1.25);
          const damp = Math.exp(-dt * 3.2); cam.vLon *= damp; cam.vLat *= damp;
          // Gentle drift when nobody is driving.
          if (cam.idle > 2.5) { cam.lon += dt * (reduced ? 0.012 : 0.035); cam.lat += (0.3 - cam.lat) * dt * 0.08; }
        }
        cam.dist += (cam.distT - cam.dist) * (1 - Math.exp(-dt * 5));
      }
      const cl = Math.cos(cam.lat);
      camDir.set(cl * Math.cos(cam.lon), Math.sin(cam.lat), cl * Math.sin(cam.lon));
      camera.position.copy(camDir).multiplyScalar(cam.dist);
      // Slight breathing, and look a touch above centre so the globe sits low in frame like a planet shot.
      if (!reduced) camera.position.y += Math.sin(U.time.value * 0.3) * 0.01;
      camera.up.set(0, 1, 0);
      camera.lookAt(0, cam.dist < 2.4 ? 0.02 : 0, 0);
      // The auto-director: with no one at the controls, cut to the action.
      if (directorOn && !cam.target && cam.idle > 7 && cam.intro >= 1) {
        nextDirect -= dt;
        if (nextDirect <= 0) {
          nextDirect = 11 + Math.random() * 6;
          const live = arcs.filter(a => !a.done && (a.severity === 'CRITICAL' || a.severity === 'HIGH'));
          const a = live.length ? live[live.length - 1] : null;
          if (a) {
            const mid = tmpV.copy(a.p0).add(a.p2).normalize();
            const ll = dirToLonLat(mid);
            flyTo(ll.lon + (Math.random() - 0.5) * 0.6, clamp(ll.lat + 0.12, -1.1, 1.1), 2.7 + Math.random() * 0.4, 6.5);
          }
        }
      }
    }
    const tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), tmpC = new T.Color();

    // ── Public: attacks ──────────────────────────────────────────────────────
    function spawnArc(src, dst, severity, evKey) {
      const ev = EVENTS[evKey] || EVENTS.scan;
      const p0 = latLngToVec3(src.lat, src.lng, R + 0.004), p2 = latLngToVec3(dst.lat, dst.lng, R + 0.004);
      const dist = p0.distanceTo(p2);
      const p1 = p0.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(R + 0.12 + dist * 0.42);
      const slot = arcSlot; arcSlot = (arcSlot + 1) % MAXA;
      const dur = clamp(1.1 / ((ev.arcSpeed || 0.008) * 60), 0.9, 3.8);
      const width = evKey === 'ddos' ? 0.0085 : evKey === 'scan' ? 0.0032 : evKey === 'ransomware' ? 0.0075 : 0.0055;
      const sevK = severity === 'CRITICAL' ? 1.6 : severity === 'HIGH' ? 1.25 : 1.0;
      tmpC.set(ev.color);
      aP0.setXYZ(slot, p0.x, p0.y, p0.z); aP1.setXYZ(slot, p1.x, p1.y, p1.z); aP2.setXYZ(slot, p2.x, p2.y, p2.z);
      aCol.setXYZ(slot, tmpC.r * sevK, tmpC.g * sevK, tmpC.b * sevK);
      const packets = evKey === 'botnet' ? 3 : evKey === 'ddos' ? 2 : evKey === 'scan' ? 1 : 0;
      aTim.setXYZW(slot, U.time.value, dur, width, packets);
      aP0.needsUpdate = aP1.needsUpdate = aP2.needsUpdate = aCol.needsUpdate = aTim.needsUpdate = true;
      const dstIdx = CITIES.indexOf(dst);
      const arc = { done: false, eventTypeKey: evKey, severity, end: U.time.value + dur, p0, p2, color: tmpC.clone(), dstIdx, slot };
      // A recycled slot ends the arc that used it.
      for (let i = arcs.length - 1; i >= 0; i--) if (arcs[i].slot === slot) { finish(arcs[i]); arcs.splice(i, 1); }
      arcs.push(arc);
      return arc;
    }
    function finish(a) {
      if (a.done) return;
      a.done = true;
      const n = tmpV2.copy(a.p2).normalize();
      const big = a.severity === 'CRITICAL' ? 0.16 : a.severity === 'HIGH' ? 0.12 : 0.085;
      impact(n, a.color, big, 0, 1.6);
      if (a.severity === 'CRITICAL') impact(n, tmpC.copy(a.color).multiplyScalar(1.3), 1.0, 1, 2.4);
      if (a.dstIdx >= 0) { cityHit[a.dstIdx] = U.time.value; cityHitAttr.needsUpdate = true; }
      if (opts.onArcDone) opts.onArcDone(a);
    }
    function addHeat(lat, lng, amount) {
      const cx = (lng + 180) / 360 * HW, cy = (lat + 90) / 180 * HH;
      const rad = 7, sig = 2.6;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
        if (y < 0 || y >= HH) continue;
        const squash = Math.max(0.2, Math.cos((y / HH - 0.5) * Math.PI));
        for (let x = Math.floor(cx - rad / squash); x <= cx + rad / squash; x++) {
          const dx = (x - cx) * squash, dy = y - cy, w = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
          const xi = ((x % HW) + HW) % HW, i = y * HW + xi;
          heat[i] = Math.min(1, heat[i] + amount * w);
        }
      }
      heatDirty = true;
    }
    let heatClock = 0;
    function updateHeat(dt) {
      heatClock += dt;
      if (heatClock < 0.1) return;
      const k = Math.pow(0.975, heatClock / 0.1); heatClock = 0;
      for (let i = 0; i < heat.length; i++) { const v = heat[i] *= k; heatPx[i * 4] = v * 255; }
      heatTex.needsUpdate = true; heatDirty = false;
    }
    function pulseCountry(name) {
      const i = pulseNames.indexOf(name);
      if (i >= 0) pulseT[i] = U.time.value;
    }
    const DEFCON_GLOW = { 5: 0x00ff88, 4: 0x88ff44, 3: 0xffcc00, 2: 0xff8800, 1: 0xff3333 };
    let defconAmtT = 0;
    function setDefcon(lvl) {
      U.defcon.value.setHex(DEFCON_GLOW[lvl] || 0x00ff88);
      defconAmtT = (5 - lvl) / 4;
      shieldTarget = lvl <= 2 ? (lvl === 1 ? 1 : 0.6) : 0;
    }
    let glitchT = 0, flashT = 0;
    function glitch() { if (!reduced) glitchT = 1; }

    // ── World events: EMP, CME, satellite hijack, lightning, meteors ─────────
    const ev = { emp: 30 + Math.random() * 60, cme: 240 + Math.random() * 180, hack: 90 + Math.random() * 60, scan: 18 + Math.random() * 17, light: 0.5, meteor: 1, laser: 2 };
    let scanT = -1, hacked = null, hackEnd = 0, cmeT = -1;
    function emp() {
      const c = CITIES[Math.floor(Math.random() * CITIES.length)];
      banner(`⚡ EMP PULSE — ${c.name.toUpperCase()}`, '#00ffff');
      const n = latLngToVec3(c.lat, c.lng, 1);
      for (let k = 0; k < 4; k++) setTimeout(() => impact(n, tmpC.setRGB(0.3, 1.6, 2.0), 0.35 + k * 0.18, 2, 2.2), k * 180);
      addHeat(c.lat, c.lng, 0.9);
      flashT = Math.max(flashT, 0.25); finalMat.uniforms.flashCol.value.setRGB(0.3, 0.9, 1.0);
    }
    function startCme() { cmeT = 0; cme.visible = true; }
    function satHack() {
      const s = SATS[Math.floor(Math.random() * SATS.length)];
      hacked = s; hackEnd = U.time.value + 18 + Math.random() * 10;
      s.uCol.value.setRGB(1.6, 0.12, 0.02);
      banner('⚠ SATELLITE COMPROMISED — ADVERSARY CONTROL DETECTED', '#ff3300');
      const slot = lzState.find(l => l.t >= 1) || lzState[0];
      slot.beam = true; slot.t = 0; slot.a = s; slot.city = CITIES[Math.floor(Math.random() * CITIES.length)]; slot.col.setRGB(1.5, 0.1, 0.02);
    }
    function updateEvents(dt, t) {
      // Scan wave across the hex grid.
      if ((ev.scan -= dt) <= 0) { ev.scan = 18 + Math.random() * 17; scanT = 0; earthMat.uniforms.scanO.value.copy(cityPos[Math.floor(Math.random() * NC)]); }
      if (scanT >= 0) { scanT += dt; earthMat.uniforms.scanR.value = scanT * 0.8; if (scanT * 0.8 > 3.2) { scanT = -1; earthMat.uniforms.scanR.value = -1; } }
      if ((ev.emp -= dt) <= 0) { ev.emp = 60 + Math.random() * 90; emp(); }
      if ((ev.cme -= dt) <= 0) { ev.cme = 240 + Math.random() * 180; startCme(); }
      if (!hacked && (ev.hack -= dt) <= 0) { ev.hack = 90 + Math.random() * 60; satHack(); }
      if (hacked && t > hackEnd) {
        hacked.uCol.value.copy(hacked.color);
        lzState.forEach(l => { if (l.beam) { l.beam = false; l.t = 1; } });
        hacked = null;
      }
      // CME: a shock front from the sun; the aurora surges when it arrives.
      const surge = auroraMat.uniforms.surge;
      if (cmeT >= 0) {
        cmeT += dt;
        const k = cmeT / 4.0;
        cme.position.copy(sunDir).multiplyScalar(lerp(14, -2, Math.min(1, k)));
        cme.scale.setScalar(lerp(0.4, 9, Math.min(1, k)));
        cmeMat.uniforms.amt.value = Math.sin(Math.min(1, k) * Math.PI) * 0.8;
        if (k >= 0.8 && !cme.userData.hit) {
          cme.userData.hit = true;
          flashT = 0.6; finalMat.uniforms.flashCol.value.setRGB(1.0, 0.55, 0.2);
          surge.value = 1;
          for (let i = 0; i < heat.length; i++) heat[i] = Math.max(heat[i], Math.random() * 0.25);
          banner('☀ CORONAL MASS EJECTION — GEOMAGNETIC STORM INBOUND', '#ff8800');
        }
        if (k >= 1) { cmeT = -1; cme.visible = false; cme.userData.hit = false; }
      }
      surge.value = Math.max(0, surge.value - dt * 0.04);
      // Lightning in storm cells on the night side.
      if ((ev.light -= dt) <= 0) {
        ev.light = 0.3 + Math.random() * 1.6;
        const f = flashes.find(x => x.w <= 0.01) || flashes[0];
        for (let tries = 0; tries < 6; tries++) {
          latLngToVec3((Math.random() - 0.5) * 120, Math.random() * 360 - 180, 1, tmpV);
          if (tmpV.dot(sunDir) < 0.1 || tries === 5) break;
        }
        f.set(tmpV.x, tmpV.y, tmpV.z, 1.0 + Math.random());
      }
      flashes.forEach(f => { f.w = f.w > 0.01 ? f.w * Math.pow(0.0005, dt) * (Math.random() < 0.15 ? 2.5 : 1) : 0; f.w = Math.min(f.w, 2.5); });
      // Shooting stars.
      if ((ev.meteor -= dt) <= 0) {
        ev.meteor = 1.5 + Math.random() * 4;
        const m = meteors.find(x => x.life >= 1);
        if (m) { m.life = 0; m.p.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).setLength(120); m.d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(); m.speed = 60 + Math.random() * 60; }
      }
      meteors.forEach((m, i) => {
        if (m.life >= 1) { for (let k = 0; k < 6; k++) mtCol[i * 6 + k] = 0; return; }
        m.life = Math.min(1, m.life + dt * 1.4); m.p.addScaledVector(m.d, m.speed * dt);
        const a = Math.sin(m.life * Math.PI);
        mtPos[i * 6] = m.p.x; mtPos[i * 6 + 1] = m.p.y; mtPos[i * 6 + 2] = m.p.z;
        mtPos[i * 6 + 3] = m.p.x - m.d.x * 8; mtPos[i * 6 + 4] = m.p.y - m.d.y * 8; mtPos[i * 6 + 5] = m.p.z - m.d.z * 8;
        mtCol[i * 6] = mtCol[i * 6 + 1] = mtCol[i * 6 + 2] = a * 1.5; mtCol[i * 6 + 3] = mtCol[i * 6 + 4] = mtCol[i * 6 + 5] = 0;
      });
      mtGeo.attributes.position.needsUpdate = mtGeo.attributes.color.needsUpdate = true;
    }

    function updateSats(dt) {
      SATS.forEach((s, i) => {
        s.angle += s.speed * dt; s.uAngle.value = ((s.angle % TAU) + TAU) % TAU;
        s.world.set(s.r * Math.cos(s.angle), 0, s.r * Math.sin(s.angle)).applyMatrix4(s.pivot.matrixWorld);
        satPts[i * 3] = s.world.x; satPts[i * 3 + 1] = s.world.y; satPts[i * 3 + 2] = s.world.z;
        const c = s.uCol.value; satCol[i * 3] = c.r; satCol[i * 3 + 1] = c.g; satCol[i * 3 + 2] = c.b;
      });
      satGeo.attributes.position.needsUpdate = satGeo.attributes.color.needsUpdate = true;
      if ((ev.laser -= dt) <= 0) {
        ev.laser = 1.5 + Math.random() * 5;
        const slot = lzState.find(l => l.t >= 1 && !l.beam);
        if (slot) { const a = SATS[Math.floor(Math.random() * 3)], b = SATS[(SATS.indexOf(a) + 1 + Math.floor(Math.random() * 2)) % 3]; slot.t = 0; slot.a = a; slot.b = b; slot.col.copy(a.uCol.value).multiplyScalar(1.5); }
      }
      lzState.forEach((l, i) => {
        let a = 0;
        if (l.beam) { a = 0.75 + 0.25 * Math.sin(U.time.value * 12); latLngToVec3(l.city.lat, l.city.lng, R + 0.01, tmpV); }
        else if (l.t < 1) { l.t += dt * 2.6; a = Math.max(0, 1 - l.t); tmpV.copy(l.b.world); }
        if (a <= 0) { for (let k = 0; k < 6; k++) lzCol[i * 6 + k] = 0; return; }
        const s = l.a.world;
        lzPos[i * 6] = s.x; lzPos[i * 6 + 1] = s.y; lzPos[i * 6 + 2] = s.z; lzPos[i * 6 + 3] = tmpV.x; lzPos[i * 6 + 4] = tmpV.y; lzPos[i * 6 + 5] = tmpV.z;
        for (let k = 0; k < 2; k++) { lzCol[i * 6 + k * 3] = l.col.r * a; lzCol[i * 6 + k * 3 + 1] = l.col.g * a; lzCol[i * 6 + k * 3 + 2] = l.col.b * a; }
      });
      lzGeo.attributes.position.needsUpdate = lzGeo.attributes.color.needsUpdate = true;
    }

    // Sun on screen: position and how much of it the Earth hides, for the flare.
    const sunScreen = new T.Vector3();
    function updateSun() {
      sun.position.copy(sunDir).multiplyScalar(160);
      sun.lookAt(camera.position);
      sunScreen.copy(sun.position).project(camera);
      const on = sunScreen.z < 1 && Math.abs(sunScreen.x) < 1.2 && Math.abs(sunScreen.y) < 1.2;
      // Closest approach of the eye→sun ray to the Earth's centre.
      const o = camera.position, d = tmpV.copy(sun.position).sub(o).normalize();
      const tc = -o.dot(d), closest = tc > 0 ? tmpV2.copy(o).addScaledVector(d, tc).length() : 99;
      const vis = smooth(R * 1.0, R * 1.09, closest) * (on ? 1 : 0) * clamp(1.2 - Math.max(Math.abs(sunScreen.x), Math.abs(sunScreen.y)), 0, 1);
      finalMat.uniforms.sunUv.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5, vis);
      sun.visible = closest > R * 0.98 || tc < 0;
    }
    function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

    // ── Sizing and adaptive resolution ───────────────────────────────────────
    let prMax = Math.min(window.devicePixelRatio || 1, 2), pr = Math.min(prMax, 1.5), W = 1, Hh = 1;
    function resize() {
      W = Math.max(1, container.clientWidth); Hh = Math.max(1, container.clientHeight);
      renderer.setPixelRatio(pr);
      renderer.setSize(W, Hh, false);
      camera.aspect = W / Hh;
      // Keep the globe framed in a tall, narrow panel: widen the vertical FOV so the horizontal one stays at 36°.
      camera.fov = W >= Hh ? 36 : 2 * Math.atan(Math.tan(18 * Math.PI / 180) / camera.aspect) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      const w = Math.floor(W * pr), h = Math.floor(Hh * pr);
      makeTargets(w, h);
      finalMat.uniforms.res.value.set(w, h); finalMat.uniforms.aspect.value = W / Hh;
      [satPrMat, stars.material, wind.material, debris.material].forEach(m => { if (m.uniforms.pr) m.uniforms.pr.value = pr; });
    }
    window.addEventListener('resize', resize);
    resize();
    let perf = { acc: 0, n: 0 };
    function adapt(dt) {
      perf.acc += dt; perf.n++;
      if (perf.acc < 2) return;
      const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
      if (avg > 1 / 40 && pr > 0.75) { pr = Math.max(0.75, pr - 0.25); resize(); }
      else if (avg < 1 / 58 && pr < prMax) { pr = Math.min(prMax, pr + 0.25); resize(); }
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    let last = performance.now(), running = true;
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.hidden) return;
      step(dt, now);
    }
    function step(dt, now) {
      const t = U.time.value += dt;
      if (opts.onFrame) opts.onFrame(now, dt);
      // Arcs that have arrived.
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        if (!a.done && t >= a.end) finish(a);
        if (a.done && t > a.end + 1.5) arcs.splice(i, 1);
      }
      updateCamera(dt);
      updateEvents(dt, t);
      updateSats(dt);
      updateHeat(dt);
      earthMat.uniforms.cloudOff.value = (t * 0.0022) % 1;
      moonAngle += dt * 0.02;
      moon.position.set(Math.cos(moonAngle) * 5.2, -Math.sin(moonAngle) * 5.2 * 0.22, Math.sin(moonAngle) * 5.2);
      moon.rotation.y = -moonAngle;
      debris.rotation.y += dt * 0.025; debris.rotation.x += dt * 0.006;
      U.defconAmt.value += (defconAmtT - U.defconAmt.value) * Math.min(1, dt * 0.8);
      const sa = shieldMat.uniforms.amt;
      sa.value += (shieldTarget - sa.value) * Math.min(1, dt * 2);
      shield.visible = sa.value > 0.01;
      glitchT = Math.max(0, glitchT - dt * 2.2); finalMat.uniforms.glitch.value = glitchT * glitchT;
      flashT = Math.max(0, flashT - dt * 1.6); finalMat.uniforms.flash.value = flashT * flashT;
      // Fade in from black once the maps are ready.
      const f = finalMat.uniforms.fade;
      if (loaded >= 4 || t > 4) f.value = Math.min(1, f.value + dt * 1.2); else f.value = Math.min(f.value, 0.0);
      updateSun();
      renderFrame(dt);
      adapt(dt);
    }
    finalMat.uniforms.fade.value = 0;
    requestAnimationFrame(frame);
    // Sun position drifts with the real clock.
    setInterval(() => computeSunDir(sunDir), 60000);

    // ── Picking ──────────────────────────────────────────────────────────────
    const ray = new T.Raycaster(), m2 = new T.Vector2();
    function pickCity(clientX, clientY) {
      const r = container.getBoundingClientRect();
      m2.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(m2, camera);
      const o = ray.ray.origin, d = ray.ray.direction;
      const b = o.dot(d), c = o.dot(o) - R * R, disc = b * b - c;
      if (disc < 0) return -1;
      const p = tmpV.copy(o).addScaledVector(d, -b - Math.sqrt(disc)).normalize();
      let best = -1, bd = 0.09;
      cityPos.forEach((v, i) => { const a = v.angleTo(p); if (a < bd) { bd = a; best = i; } });
      return best;
    }
    function focusCity(i, hold) {
      const ll = dirToLonLat(cityPos[i]);
      cam.idle = 0; cam.intro = 1;
      flyTo(ll.lon, clamp(ll.lat + 0.08, -1.2, 1.2), 2.55, hold || 0);
    }

    return {
      arcs, spawnArc, addHeat, pulseCountry, setDefcon, glitch, pickCity, focusCity,
      lookAt(lat, lng, dist, hold) { const ll = dirToLonLat(latLngToVec3(lat, lng, 1)); cam.idle = 0; cam.intro = 1; flyTo(ll.lon, clamp(ll.lat, -1.2, 1.2), dist || 2.4, hold || 0); },
      release() { cam.target = null; cam.distT = HOME; },
      setBorders(on) { borders.visible = !!on; },
      setDirector(on) { directorOn = !!on && !reduced; return directorOn; },
      get director() { return directorOn; },
      wasDragged() { return lastMoved > 6; },
      step(n, dt) { for (let i = 0; i < n; i++) step(dt || 1 / 60, performance.now()); },
      pause(p) { running = !p; if (running) { last = performance.now(); requestAnimationFrame(frame); } },
      debug: () => ({ exposure: +eye.exposure.toFixed(3), lum: +eye.mean.toFixed(4), pr, loaded, arcs: arcs.length, gl2, msaa: !!(sceneRT && sceneRT.isWebGLMultisampleRenderTarget), cam: { lon: cam.lon, lat: cam.lat, dist: cam.dist } }),
      renderer, camera, scene,
    };
  };
})();
