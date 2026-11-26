import * as THREE from "three";

/* ---------- Renderer: one full-screen ray-bending shader ---------- */

const canvas = document.getElementById("sky");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uRes: { value: new THREE.Vector2(1, 1) },
  uTime: { value: 0 },
  uIncl: { value: 0.5 },
  uMin: { value: 0 },
  uHour: { value: 0 },
  uSec: { value: 0 },
  uShift: { value: 0.16 },
  uZoom: { value: 1 },
};

const frag = /* glsl */`
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime, uIncl, uMin, uHour, uSec, uShift, uZoom;
  varying vec2 vUv;

  const float RIN = 2.7, ROUT = 9.5, RMARK = 12.4;
  const float TAU = 6.2831853;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 5.3; a *= 0.5; }
    return s;
  }
  // Clock angle in the disk plane: 0 at the far side (12 o'clock), growing clockwise seen from above.
  float clockAngle(vec2 xz) { return atan(xz.x, -xz.y); }
  float near(float a, float b) { return 0.5 + 0.5 * cos(a - b); }

  vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

  // Light given off by the disk where a ray crosses it, and how opaque it is there.
  vec4 disk(vec2 xz) {
    float r = length(xz);
    float ang = clockAngle(xz);
    vec3 col = vec3(0.0);
    float a = 0.0;
    if (r > RIN && r < ROUT) {
      float omega = 1.9 * pow(r, -1.5);
      vec2 q = rot(xz, -uTime * omega);
      float n = fbm(q * 1.25) * 0.65 + 0.45 * fbm(vec2(r * 4.2, 0.0) + q * 0.35);
      float temp = pow(RIN / r, 1.35);
      float beam = 0.28 + 2.6 * pow(near(ang, uMin), 5.0);        // the minute hand
      float I = temp * (0.35 + n) * beam;
      // Seconds: a hot clump riding the inner disk.
      float sec = exp(-pow(r - 3.35, 2.0) / 0.09) * pow(near(ang, uSec), 140.0) * 3.0;
      I += sec;
      float edge = smoothstep(RIN, RIN + 0.35, r) * (1.0 - smoothstep(ROUT - 3.5, ROUT, r));
      I *= edge;
      vec3 deep = vec3(0.03, 0.2, 0.19);
      vec3 mint = vec3(0.55, 0.92, 0.82);
      vec3 hot = vec3(1.0, 1.0, 0.97);
      col = mix(deep, mint, smoothstep(0.08, 0.55, I));
      col = mix(col, hot, smoothstep(0.7, 1.6, I));
      col *= I * 1.7;
      a = clamp(I * 1.3, 0.0, 0.94) * edge;
    }
    // Hour marks: twelve small points on a ring outside the disk.
    float dr = abs(r - RMARK);
    if (dr < 0.35) {
      float k = ang / (TAU / 12.0);
      float da = abs(k - floor(k + 0.5)) * (TAU / 12.0) * RMARK;
      float dot = 1.0 - smoothstep(0.07, 0.16, length(vec2(dr, da)));
      col += vec3(0.62, 0.78, 0.72) * dot * 0.9;
      a = max(a, dot * 0.9);
    }
    return vec4(col, a);
  }

  vec3 stars(vec3 d) {
    vec3 c = vec3(0.0);
    for (int i = 0; i < 2; i++) {
      float sc = i == 0 ? 90.0 : 190.0;
      vec3 g = d * sc;
      vec3 id = floor(g);
      float h = hash3(id + float(i) * 17.0);
      if (h > 0.965) {
        vec3 f = fract(g) - 0.5;
        float s = exp(-dot(f, f) * 40.0) * (h - 0.965) * 22.0;
        c += s * mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.85, 0.7), hash3(id + 3.1));
      }
    }
    return c;
  }

  void main() {
    vec2 uv = (vUv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);
    uv.x -= uShift;
    uv /= uZoom;
    float D = 30.0;
    vec3 ro = D * vec3(0.0, sin(uIncl), cos(uIncl));
    vec3 fwd = -normalize(ro);
    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 up = cross(right, fwd);
    vec3 v = normalize(fwd + (uv.x * right + uv.y * up) * 0.42);
    vec3 p = ro;
    vec3 h = cross(p, v);
    float h2 = dot(h, h);

    // The hour star sits on the ring of marks.
    vec3 S = vec3(sin(uHour) * RMARK, 0.0, -cos(uHour) * RMARK);

    vec3 col = vec3(0.0);
    float alpha = 0.0;
    float dmin = 1e3, seen = 1.0;
    bool hole = false;
    for (int i = 0; i < 200; i++) {
      float r = length(p);
      float dt = clamp(0.06 * r, 0.03, 1.4);
      vec3 prev = p;
      v += -1.5 * h2 * p / pow(r, 5.0) * dt;
      p += v * dt;
      if (prev.y * p.y < 0.0) {
        float t = prev.y / (prev.y - p.y);
        vec4 d = disk(mix(prev, p, t).xz);
        col += (1.0 - alpha) * d.rgb;
        alpha += (1.0 - alpha) * d.a;
      }
      // Closest pass of this ray to the hour star.
      vec3 seg = p - prev;
      float st = clamp(dot(S - prev, seg) / dot(seg, seg), 0.0, 1.0);
      float ds = length(prev + seg * st - S);
      if (ds < dmin) { dmin = ds; seen = 1.0 - alpha; }
      if (r < 1.0) { hole = true; break; }
      if (r > 42.0 || alpha > 0.985) break;
    }
    if (!hole) col += (1.0 - alpha) * stars(normalize(v));
    col += vec3(1.0, 0.62, 0.26) * seen * (0.05 / (dmin * dmin + 0.012) + 0.5 * exp(-dmin * 1.6));
    col = 1.0 - exp(-col * 1.15);
    col = pow(col, vec3(0.92));
    gl_FragColor = vec4(col, 1.0);
  }`;

const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: frag,
    depthTest: false,
  }),
);
scene.add(quad);

// Ray bending is heavy, so the canvas renders below screen resolution and is scaled up.
const SCALE = 0.6;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * SCALE);
  renderer.setSize(w, h, false);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  uniforms.uRes.value.copy(size);
  const portrait = h > w;
  uniforms.uShift.value = portrait ? 0 : Math.min(0.32, (w / h - 1) * 0.42);
  uniforms.uZoom.value = portrait ? 0.7 : 1;
}
addEventListener("resize", resize);
resize();

/* ---------- Time ---------- */

const timeEl = document.getElementById("time");
const btn = document.getElementById("speed");
const FAST = 720;             // one hour every five seconds
let fast = false, rate = 1;
let virtual = Date.now();
let last = performance.now();
let shown = { m: 0, h: 0, s: 0 };

btn.addEventListener("click", () => {
  fast = !fast;
  if (!fast) virtual = Date.now();
  btn.textContent = fast ? "Real time" : "Faster";
  btn.setAttribute("aria-pressed", String(fast));
});

/* ---------- Tilt ---------- */

let incl = 0.42, target = 0.42, dragging = null;
canvas.addEventListener("pointerdown", (e) => {
  dragging = { y: e.clientY, start: target };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("dragging");
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  target = Math.min(1.25, Math.max(0.1, dragging.start + (e.clientY - dragging.y) * 0.004));
});
const stop = () => { dragging = null; canvas.classList.remove("dragging"); };
canvas.addEventListener("pointerup", stop);
canvas.addEventListener("pointercancel", stop);
addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") target = Math.min(1.25, target + 0.08);
  if (e.key === "ArrowDown") target = Math.max(0.1, target - 0.08);
});

/* ---------- Loop ---------- */

const TAU = Math.PI * 2;
// Hands turn the short way round, so a jump back to real time eases instead of spinning.
const ease = (cur, to, k) => cur + (((to - cur + Math.PI) % TAU + TAU) % TAU - Math.PI) * k;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  rate += ((fast ? FAST : 1) - rate) * Math.min(1, dt * 2.5);
  virtual += dt * 1000 * rate;
  if (!fast && rate < 1.5) virtual += (Date.now() - virtual) * Math.min(1, dt * 3);

  const d = new Date(virtual);
  const s = d.getSeconds() + d.getMilliseconds() / 1000;
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  const k = Math.min(1, dt * 8);
  shown.s = ease(shown.s, (s / 60) * TAU, rate > 30 ? 1 : k);
  shown.m = ease(shown.m, (m / 60) * TAU, k);
  shown.h = ease(shown.h, (h / 12) * TAU, k);
  uniforms.uSec.value = shown.s;
  uniforms.uMin.value = shown.m;
  uniforms.uHour.value = shown.h;
  uniforms.uTime.value += dt * (1 + Math.min(rate, 40) * 0.05);

  incl += (target - incl) * Math.min(1, dt * 5);
  uniforms.uIncl.value = incl;

  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  const txt = `${hh}:${mm}`;
  if (timeEl.textContent !== txt) { timeEl.textContent = txt; timeEl.dateTime = txt; }

  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
