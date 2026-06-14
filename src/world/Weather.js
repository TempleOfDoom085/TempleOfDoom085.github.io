import * as THREE from 'three';

// Weather states in cycle order
const STATE = { CLEAR: 0, OVERCAST: 1, RAIN: 2, HEAVY_RAIN: 3 };

// Cycle durations in seconds: [CLEAR, OVERCAST, RAIN, HEAVY_RAIN, RAIN(back), CLEAR(back)]
// Full cycle ~3 minutes, using a simple index that drives smooth transitions
const CYCLE = [
  { state: STATE.CLEAR,      duration: 50 },
  { state: STATE.OVERCAST,   duration: 30 },
  { state: STATE.RAIN,       duration: 35 },
  { state: STATE.HEAVY_RAIN, duration: 40 },
  { state: STATE.RAIN,       duration: 30 },
  { state: STATE.OVERCAST,   duration: 20 },
];

const TOTAL_CYCLE = CYCLE.reduce((s, c) => s + c.duration, 0);

// Rain particle count
const PARTICLE_COUNT = 3000;

// Vertex shader for rain drops — GPU renders them as line-like streaks via gl_PointSize
const RAIN_VERT = `
uniform float uSize;
attribute float alpha;
varying float vAlpha;
void main() {
  vAlpha = alpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const RAIN_FRAG = `
varying float vAlpha;
void main() {
  // Elongated raindrop shape: fade on sides, bright streak down center
  vec2 uv = gl_PointCoord - 0.5;
  float streak = 1.0 - smoothstep(0.0, 0.5, abs(uv.x) * 4.0);
  float fade   = 1.0 - smoothstep(0.0, 0.5, abs(uv.y));
  float alpha  = streak * fade * vAlpha;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(0.78, 0.88, 1.0, alpha);
}
`;

export class Weather {
  /**
   * @param {THREE.Scene}   scene
   * @param {object}        lighting  - Lighting instance with .ambient, .sunLight, .scene
   * @param {THREE.Camera}  camera    - Main camera, used to centre the rain volume
   */
  constructor(scene, lighting, camera) {
    this.scene    = scene;
    this.lighting = lighting;
    this._camera  = camera || null;

    // --- Rain particles ---
    this._positions = new Float32Array(PARTICLE_COUNT * 3);
    this._alphas    = new Float32Array(PARTICLE_COUNT);
    this._velocities = new Float32Array(PARTICLE_COUNT * 3); // dx, dy, dz per particle

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geo.setAttribute('alpha',    new THREE.BufferAttribute(this._alphas,    1));

    this._rainMat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 1.8 } },
      vertexShader:   RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this._rainPoints = new THREE.Points(geo, this._rainMat);
    this._rainPoints.frustumCulled = false;
    this._rainPoints.visible = false;
    scene.add(this._rainPoints);

    // Initialise particles spread in a large volume around origin
    this._initParticles();

    // --- Wind ---
    this._windAngle = 0;          // radians, direction particles drift
    this._windSpeed = 0.8;        // horizontal speed units/sec
    this._windChangeTimer = 0;

    // --- Weather cycle ---
    this._cycleTime  = 0;         // seconds elapsed in current full cycle
    this._intensity  = 0;         // 0–1 rain intensity (smooth)
    this._targetIntensity = 0;

    // --- Fog baseline (from Lighting constructor: FogExp2 density 0.0013–0.0023) ---
    this._baseFogDensity = scene.fog ? scene.fog.density : 0.0018;

    // --- Lightning ---
    this._lightningTimer   = this._nextLightningDelay();
    this._lightningActive  = false;
    this._lightningFlicker = [];   // queue of { time, intensity } events
    this._origAmbient      = null; // saved ambient intensity before flash

  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Returns 0–1 rain intensity */
  getIntensity() {
    return this._intensity;
  }

  /**
   * Call each frame.
   * @param {number} dt  seconds since last frame
   */
  update(dt) {
    this._updateCycle(dt);
    this._updateWind(dt);
    this._updateRain(dt);
    this._updateFog();
    this._updateLightning(dt);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _initParticles() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._resetParticle(i, true);
    }
  }

  /** Place a particle randomly in the rain volume around the camera/origin */
  _resetParticle(i, randomY = false) {
    const i3 = i * 3;
    const spread = 120;
    const height = 60;
    this._positions[i3]     = (Math.random() - 0.5) * spread;
    this._positions[i3 + 1] = randomY
      ? Math.random() * height
      : height + Math.random() * 5;
    this._positions[i3 + 2] = (Math.random() - 0.5) * spread;
    // Each particle gets a slight random velocity variation
    this._velocities[i3]     = (Math.random() - 0.5) * 0.4;
    this._velocities[i3 + 1] = -(14 + Math.random() * 6); // fall speed
    this._velocities[i3 + 2] = (Math.random() - 0.5) * 0.4;
    this._alphas[i]          = 0.4 + Math.random() * 0.5;
  }

  _updateCycle(dt) {
    this._cycleTime = (this._cycleTime + dt) % TOTAL_CYCLE;

    // Find current segment
    let t = this._cycleTime;
    let seg = CYCLE[0];
    for (const s of CYCLE) {
      if (t < s.duration) { seg = s; break; }
      t -= s.duration;
    }

    // Determine target intensity from state
    const intensityMap = {
      [STATE.CLEAR]:      0.0,
      [STATE.OVERCAST]:   0.0,
      [STATE.RAIN]:       0.45,
      [STATE.HEAVY_RAIN]: 1.0,
    };
    this._targetIntensity = intensityMap[seg.state];

    // Smooth transition
    const lerpRate = 0.3 * dt; // ~3s to transition
    this._intensity += (this._targetIntensity - this._intensity) * Math.min(lerpRate, 1);
    this._intensity = Math.max(0, Math.min(1, this._intensity));
  }

  _updateWind(dt) {
    this._windChangeTimer -= dt;
    if (this._windChangeTimer <= 0) {
      // Slowly drift wind direction
      this._windAngle += (Math.random() - 0.5) * 0.8;
      this._windSpeed  = 0.5 + Math.random() * 1.8;
      this._windChangeTimer = 8 + Math.random() * 12;
    }
  }

  _updateRain(dt) {
    const visible = this._intensity > 0.01;
    this._rainPoints.visible = visible;
    if (!visible) return;

    // Shift rain volume to follow camera
    let camX = 0, camY = 10, camZ = 0;
    if (this._camera) {
      camX = this._camera.position.x;
      camY = this._camera.position.y;
      camZ = this._camera.position.z;
    }

    const windDX = Math.sin(this._windAngle) * this._windSpeed * dt;
    const windDZ = Math.cos(this._windAngle) * this._windSpeed * dt;

    const spread = 120;
    const height = 60;
    const posAttr = this._rainPoints.geometry.attributes.position;
    const alpAttr = this._rainPoints.geometry.attributes.alpha;

    // Fade in/out based on intensity
    const alphaMult = this._intensity;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Apply velocity + wind
      this._positions[i3]     += this._velocities[i3]     * dt + windDX;
      this._positions[i3 + 1] += this._velocities[i3 + 1] * dt;
      this._positions[i3 + 2] += this._velocities[i3 + 2] * dt + windDZ;

      // The rain volume is centred on camera; compute world-space bounds
      const minY = camY - 55;
      // Reset if out of bounds
      if (
        this._positions[i3 + 1] < minY ||
        this._positions[i3]     < camX - spread * 0.5 ||
        this._positions[i3]     > camX + spread * 0.5 ||
        this._positions[i3 + 2] < camZ - spread * 0.5 ||
        this._positions[i3 + 2] > camZ + spread * 0.5
      ) {
        // Reset to top of volume
        this._positions[i3]     = camX + (Math.random() - 0.5) * spread;
        this._positions[i3 + 1] = camY + height * 0.5 + Math.random() * 5;
        this._positions[i3 + 2] = camZ + (Math.random() - 0.5) * spread;
        this._velocities[i3]     = (Math.random() - 0.5) * 0.4;
        this._velocities[i3 + 2] = (Math.random() - 0.5) * 0.4;
      }

      this._alphas[i] = (0.4 + Math.random() * 0.1) * alphaMult;
    }

    posAttr.needsUpdate = true;
    alpAttr.needsUpdate = true;
  }

  _updateFog() {
    if (!this.scene.fog) return;
    // Base density comes from Lighting (0.0013–0.0023 depending on day/night)
    // We add extra density during overcast/rain
    const extraDensity = this._intensity * 0.004 +
      (this._targetIntensity > 0 ? 0.001 : 0); // slight overcast boost
    // Let Lighting handle base; we just nudge on top
    // (Lighting sets fog.density each frame, so we modify AFTER Lighting.update — but
    //  Weather.update is called after lighting.update in main.js, so this is fine)
    this.scene.fog.density = (this.scene.fog.density || 0.0018) + extraDensity;
  }

  _updateLightning(dt) {
    if (this._intensity < 0.6) {
      // No lightning below heavy rain threshold
      this._lightningTimer = this._nextLightningDelay();
      this._cancelLightning();
      return;
    }

    this._lightningTimer -= dt;

    // Process flicker queue
    if (this._lightningFlicker.length > 0) {
      this._lightningFlicker[0].time -= dt;
      if (this._lightningFlicker[0].time <= 0) {
        const flicker = this._lightningFlicker.shift();
        if (flicker.intensity > 0) {
          this._flashAmbient(flicker.intensity);
        } else {
          this._restoreAmbient();
        }
      }
      return;
    }

    if (this._lightningTimer <= 0) {
      this._triggerLightning();
      this._lightningTimer = this._nextLightningDelay();
    }
  }

  _nextLightningDelay() {
    return 8 + Math.random() * 7; // 8–15 seconds
  }

  _triggerLightning() {
    if (!this.lighting || !this.lighting.ambient) return;
    this._origAmbient = this.lighting.ambient.intensity;

    // Build flicker sequence: flash → off → flash → off → flash → restore
    // Each entry: { time: delay before this event, intensity: 0=restore, >0=flash }
    this._lightningFlicker = [
      { time: 0,     intensity: 8   },   // main flash
      { time: 0.08,  intensity: 0   },   // restore
      { time: 0.06,  intensity: 5   },   // flicker 1
      { time: 0.04,  intensity: 0   },   // off
      { time: 0.05,  intensity: 6   },   // flicker 2
      { time: 0.08,  intensity: -1  },   // final restore (intensity -1 = full restore)
    ];
  }

  _flashAmbient(intensity) {
    if (!this.lighting || !this.lighting.ambient) return;
    this.lighting.ambient.color.set(0xffffff);
    this.lighting.ambient.intensity = intensity;
    // Also briefly whiten the sun direction for realism
    if (this.lighting.sunLight) {
      this.lighting.sunLight.color.set(0xffffff);
    }
  }

  _restoreAmbient() {
    if (!this.lighting || !this.lighting.ambient) return;
    if (this._origAmbient !== null) {
      this.lighting.ambient.intensity = this._origAmbient;
    }
    this.lighting.ambient.color.set(0xffffff);
    // Restore sun colour
    if (this.lighting.sunLight) {
      this.lighting.sunLight.color.set(0xfffbe8);
    }
  }

  _cancelLightning() {
    if (this._lightningFlicker.length > 0) {
      this._lightningFlicker = [];
      this._restoreAmbient();
    }
  }
}
