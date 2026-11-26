// Day 22 · Pointillist Weather
// A weather map painted the way the pointillists painted: in separate dabs of
// pure colour. Two GPU passes. The first works out the weather on a coarse
// grid with one texel per brush dab: temperature, wind and land height for an
// imaginary archipelago through the day. The second paints the dabs. Each
// one sits jittered in its cell, is stretched and turned to lie along the
// wind, and takes one pure colour from the paint box. Temperature picks the two
// neighbouring paints and an ordered threshold per dab decides which one it
// gets, so a 17° field reads as a mix of sap green and ochre dabs, the way the
// eye mixes a Seurat.

import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("map");
const hourEl = document.getElementById("hour");
const playBtn = document.getElementById("play");
const probe = document.getElementById("probe");

// Prussian blue, cobalt, viridian, sap green, yellow ochre, cadmium orange, alizarin.
const PALETTE = ["#1f3a5f", "#3d6fb0", "#3f8f7a", "#8fa34a", "#d9a53a", "#e0702a", "#b8323a"];
const T_MIN = -4, T_MAX = 30;
document.getElementById("swatches").innerHTML = PALETTE.map((c) => `<li style="background:${c}"></li>`).join("");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec2 h22(vec2 p) { float a = h21(p); return vec2(a, h21(p + a * 17.0)); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y) * 2.0 - 1.0;
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---- Pass 1: the weather, one texel per dab.
const fieldMat = new THREE.ShaderMaterial({
  uniforms: { uRes: { value: new THREE.Vector2() }, uCell: { value: 12 }, uTime: { value: 0 }, uHour: { value: 6 }, uZoom: { value: 2.6 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform vec2 uRes;
    uniform float uCell, uTime, uHour, uZoom;
    ${NOISE}
    float landAt(vec2 p) {
      // One long main island, a smaller one to the south-east, and a few rocks.
      float main = 0.55 - length((p - vec2(-0.35, 0.1)) * vec2(0.7, 1.25)) + fbm(p * 1.4 + vec2(3.1, 7.4)) * 0.55;
      float isle = 0.28 - length((p - vec2(0.75, -0.4)) * vec2(1.0, 1.2)) + fbm(p * 2.2 + 9.0) * 0.35;
      float rocks = 0.12 - length((p - vec2(0.55, 0.45)) * 1.4) + fbm(p * 3.0 + 2.0) * 0.3;
      return max(main, max(isle, rocks));
    }
    void main() {
      vec2 px = gl_FragCoord.xy * uCell;
      vec2 p = (px - uRes * 0.5) / min(uRes.x, uRes.y) * uZoom;
      float land = landAt(p);
      float L = smoothstep(-0.02, 0.06, land);
      float day = sin((uHour - 9.0) / 24.0 * 6.2832); // warmest mid-afternoon
      float front = fbm(p * 0.75 + vec2(-uTime * 0.05, uTime * 0.012) + 11.0);
      float T = 12.5 - p.y * 5.5 + front * 16.0;
      T += mix(1.6 * day, 7.5 * day + 2.0, L);
      T -= L * max(land - 0.2, 0.0) * 22.0; // high ground stays cold
      // Wind: a south-westerly with eddies, from the curl of a drifting field.
      vec2 q = p * 0.85 + vec2(uTime * 0.04, uTime * 0.01);
      float e = 0.05;
      float a = fbm(q + vec2(0.0, e)), b = fbm(q - vec2(0.0, e));
      float c = fbm(q + vec2(e, 0.0)), d = fbm(q - vec2(e, 0.0));
      vec2 curl = vec2(a - b, -(c - d)) / (2.0 * e);
      vec2 w = vec2(0.8, 0.35) + curl * 0.32;
      w *= mix(1.0, 0.55, L);
      gl_FragColor = vec4(T, w, land);
    }
  `,
});

// ---- Pass 2: the dabs.
const dabMat = new THREE.ShaderMaterial({
  uniforms: {
    uField: { value: null },
    uFieldRes: { value: new THREE.Vector2() },
    uRes: { value: new THREE.Vector2() },
    uCell: { value: 12 },
    uPal: { value: PALETTE.map((h) => new THREE.Vector3(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)) }, // raw sRGB, drawn as is
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D uField;
    uniform vec2 uFieldRes, uRes;
    uniform float uCell;
    uniform vec3 uPal[7];
    ${NOISE}
    vec3 paint(int i) {
      if (i <= 0) return uPal[0];
      if (i == 1) return uPal[1];
      if (i == 2) return uPal[2];
      if (i == 3) return uPal[3];
      if (i == 4) return uPal[4];
      if (i == 5) return uPal[5];
      return uPal[6];
    }
    void main() {
      vec2 px = gl_FragCoord.xy;
      // Primed linen with a faint weave.
      vec3 col = vec3(0.913, 0.874, 0.792) * (0.965 + 0.035 * sin(px.x * 1.9) * sin(px.y * 1.9));
      vec2 id0 = floor(px / uCell);
      float best = -1.0;
      for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
          vec2 id = id0 + vec2(float(dx), float(dy));
          vec2 r = h22(id);
          vec2 c = (id + 0.5 + (r - 0.5) * 0.7) * uCell;
          vec4 f = texture2D(uField, (clamp(id, vec2(0.0), uFieldRes - 1.0) + 0.5) / uFieldRes);
          float sp = length(f.yz);
          vec2 dir = f.yz / max(sp, 1e-4);
          vec2 dd = px - c;
          float u = dot(dd, dir), v = dot(dd, vec2(-dir.y, dir.x));
          float rr = h21(id + 3.7);
          float len = uCell * (0.55 + 0.55 * clamp(sp / 1.3, 0.0, 1.0)) * (0.85 + 0.3 * rr);
          float wid = uCell * 0.36 * (0.85 + 0.3 * fract(rr * 7.31));
          float sea = step(f.w, 0.0);
          len *= 1.0 - 0.12 * sea;
          wid *= 1.0 - 0.3 * sea; // the sea is painted thinner, so more linen breathes through
          float e = (u * u) / (len * len) + (v * v) / (wid * wid);
          float ragged = 1.0 + 0.16 * sin(atan(v, u) * 5.0 + rr * 20.0);
          float z = h21(id + 9.1);
          if (e < ragged && z > best) {
            best = z;
            float land = f.w;
            float s = clamp((f.x - ${T_MIN.toFixed(1)}) / ${(T_MAX - T_MIN).toFixed(1)} * 6.0, 0.0, 5.999);
            int i = int(floor(s));
            // One pure paint per dab: the threshold decides between the two neighbours.
            vec3 k = paint(fract(s) > h21(id + 1.3) ? i + 1 : i);
            if (land < 0.0) {
              k = mix(k, vec3(0.913, 0.874, 0.792), 0.22); // the sea is a paler wash
              if (h21(id + 5.5) < 0.015 + 0.05 * sp) k = vec3(0.95, 0.92, 0.85); // whitecaps
            } else if (h21(id + 5.5) < 0.02) k = vec3(0.96, 0.93, 0.86);
            // The coast, drawn in umber: dabs whose cell sits on the edge of land.
            vec2 cl = clamp(id, vec2(1.0), uFieldRes - 2.0);
            float lr = texture2D(uField, (cl + vec2(1.0, 0.0) + 0.5) / uFieldRes).w;
            float ll = texture2D(uField, (cl - vec2(1.0, 0.0) + 0.5) / uFieldRes).w;
            float lu = texture2D(uField, (cl + vec2(0.0, 1.0) + 0.5) / uFieldRes).w;
            float ld = texture2D(uField, (cl - vec2(0.0, 1.0) + 0.5) / uFieldRes).w;
            if (land >= 0.0 && min(min(lr, ll), min(lu, ld)) < 0.0) k = vec3(0.17, 0.13, 0.1);
            // Bristle streaks along the stroke and a little impasto shading.
            k *= 0.9 + 0.1 * sin(v / wid * 9.0 + rr * 30.0);
            k *= 1.04 - 0.08 * (u / len) - 0.12 * smoothstep(0.55, 1.0, e);
            col = k;
          }
        }
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

// ---- Sizing
let W = 0, H = 0, dpr = 1, cell = 12, FW = 1, FH = 1, rtField = null;
function resize() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  cell = (W < 700 ? 10 : 12) * dpr;
  const rw = Math.round(W * dpr), rh = Math.round(H * dpr);
  FW = Math.ceil(rw / cell); FH = Math.ceil(rh / cell);
  rtField?.dispose();
  rtField = new THREE.WebGLRenderTarget(FW, FH, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  fieldMat.uniforms.uRes.value.set(rw, rh);
  fieldMat.uniforms.uCell.value = cell;
  fieldMat.uniforms.uZoom.value = W < H ? 3.4 : 2.6; // on a tall phone, step back so the islands fit across
  dabMat.uniforms.uRes.value.set(rw, rh);
  dabMat.uniforms.uCell.value = cell;
  dabMat.uniforms.uFieldRes.value.set(FW, FH);
  dabMat.uniforms.uField.value = rtField.texture;
}
addEventListener("resize", resize);
resize();

// ---- Clock: an hour a second while playing.
let hour = 6, playing = !reduceMotion, clock = 0;
playBtn.textContent = playing ? "Pause" : "Play";
playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "Pause" : "Play";
});
const pad = (n) => String(n).padStart(2, "0");

// ---- Probe: read the weather texel under the cursor.
const mouse = { x: -1, y: -1, on: false };
canvas.addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; });
canvas.addEventListener("pointerleave", () => { mouse.on = false; probe.hidden = true; });
const px4 = new Uint16Array(4);
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function readProbe() {
  const cx = Math.floor((mouse.x * dpr) / cell), cy = Math.floor(((H - mouse.y) * dpr) / cell);
  if (cx < 0 || cy < 0 || cx >= FW || cy >= FH) return;
  renderer.readRenderTargetPixels(rtField, cx, cy, 1, 1, px4);
  const [T, wx, wy, land] = [...px4].map((v) => THREE.DataUtils.fromHalfFloat(v));
  // The vector says where the air is going; forecasts name where it comes from.
  const from = Math.atan2(-wx, -wy); // 0 = north, clockwise
  const name = COMPASS[(Math.round((from / (Math.PI * 2)) * 8) + 8) % 8];
  probe.textContent = `${Math.round(T)}° · ${Math.round(Math.hypot(wx, wy) * 28)} km/h ${name}${land < 0 ? " · sea" : ""}`;
  probe.hidden = false;
  const left = Math.min(mouse.x + 16, W - probe.offsetWidth - 8);
  probe.style.translate = `${left}px ${mouse.y + 18}px`;
}

// ---- Loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (playing) { clock += dt; hour = (hour + dt) % 24; }
  fieldMat.uniforms.uTime.value = clock;
  fieldMat.uniforms.uHour.value = hour;
  hourEl.textContent = `${pad(Math.floor(hour))}:00`;

  quad.material = fieldMat;
  renderer.setRenderTarget(rtField);
  renderer.render(scene, camera);
  quad.material = dabMat;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  if (mouse.on) readProbe();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
