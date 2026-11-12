// Day 13 · Murmuration
// A few thousand starlings, each following three local rules (keep apart,
// match your neighbours, stay with them), plus a slow roaming pull that keeps
// the flock in the sky. Every so often, or when you press Gather, each bird is
// handed one pixel of a word and steers to it: the flock holds the word for a
// moment, then breaks and pours back into the sky. The cursor is a hawk: birds
// near it swerve away. Neighbours come from a uniform grid, so the whole flock
// costs a few milliseconds a frame. Drawn as Three.js Points, each point a
// small flapping chevron cut in the fragment shader.

import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("sky");
const button = document.getElementById("gather");
const WORD = "DUSK";

let seed = 13;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- Flock state ---------- */

let W = innerWidth, H = innerHeight;
const N = Math.round(Math.min(5000, Math.max(1500, (W * H) / 300)));
const px = new Float32Array(N), py = new Float32Array(N);
const vx = new Float32Array(N), vy = new Float32Array(N);
const tx = new Float32Array(N), ty = new Float32Array(N);
const ang = new Float32Array(N), phase = new Float32Array(N), depth = new Float32Array(N);

for (let i = 0; i < N; i++) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * Math.min(W, H) * 0.22;
  px[i] = W * 0.42 + Math.cos(a) * r * 1.6;
  py[i] = H * 0.36 + Math.sin(a) * r * 0.7;
  vx[i] = 150 + rand() * 30;
  vy[i] = (rand() - 0.5) * 40;
  ang[i] = Math.atan2(vy[i], vx[i]);
  phase[i] = rand() * Math.PI * 2;
  depth[i] = rand();
}

/* ---------- The word, as a list of targets ---------- */

async function buildTargets() {
  await document.fonts.load(`100px "Archivo Black"`).catch(() => {});
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  const size = Math.min(W * 0.27, H * 0.38, 360);
  g.font = `400 ${size}px "Archivo Black", "Arial Black", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const cx = W * 0.5, cy = W < 640 ? H * 0.34 : H * 0.4;
  g.fillText(WORD, cx, cy);
  const data = g.getImageData(0, 0, W, H).data;
  const pts = [];
  const step = 2;
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
  }
  // Pick N of them, spread evenly through the letters.
  const s = 13;
  let r = s;
  const pick = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  const chosen = [];
  for (let i = 0; i < N; i++) {
    const p = pts[i % pts.length] || [cx, cy];
    chosen.push([p[0] + (pick() - 0.5) * 1.5, p[1] + (pick() - 0.5) * 1.5]);
  }
  // Left birds go to the left of the word, right birds to the right:
  // the flock folds into the letters instead of criss-crossing.
  const order = [...Array(N).keys()].sort((a, b) => px[a] + py[a] * 0.25 - (px[b] + py[b] * 0.25));
  chosen.sort((a, b) => a[0] + a[1] * 0.25 - (b[0] + b[1] * 0.25));
  order.forEach((bird, k) => { tx[bird] = chosen[k][0]; ty[bird] = chosen[k][1]; });
}

/* ---------- Renderer ---------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: false });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
let camera;

const pos = new Float32Array(N * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
const angAttr = new THREE.BufferAttribute(ang, 1).setUsage(THREE.DynamicDrawUsage);
const flapAttr = new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
geo.setAttribute("aAng", angAttr);
geo.setAttribute("aFlap", flapAttr);
geo.setAttribute("aDepth", new THREE.BufferAttribute(depth, 1));

const mat = new THREE.ShaderMaterial({
  transparent: true,
  depthTest: false,
  uniforms: { uScale: { value: 1 }, uInk: { value: new THREE.Color("#1c1222") } },
  vertexShader: /* glsl */ `
    attribute float aAng;
    attribute float aFlap;
    attribute float aDepth;
    uniform float uScale;
    varying float vAng;
    varying float vFlap;
    varying float vAlpha;
    varying float vSize;
    void main() {
      vAng = aAng;
      vFlap = aFlap;
      vAlpha = 0.62 + 0.38 * aDepth;
      vSize = (7.0 + 6.0 * aDepth) * uScale;
      gl_PointSize = vSize;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uInk;
    varying float vAng;
    varying float vFlap;
    varying float vAlpha;
    varying float vSize;
    float seg(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float s = sin(vAng), co = cos(vAng);
      vec2 q = vec2(c.x * co + c.y * s, -c.x * s + c.y * co); // x points forward
      float span = 0.12 + 0.3 * (0.5 + 0.5 * vFlap);
      float sweep = -0.06 - 0.12 * (0.5 - 0.5 * vFlap);
      float d = seg(q, vec2(0.2, 0.0), vec2(-0.16, 0.0));
      d = min(d, seg(q, vec2(0.04, 0.0), vec2(sweep, span)));
      d = min(d, seg(q, vec2(0.04, 0.0), vec2(sweep, -span)));
      float edge = 1.2 / vSize;
      float a = 1.0 - smoothstep(0.055, 0.055 + edge, d);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uInk, a * vAlpha);
    }
  `,
});
scene.add(new THREE.Points(geo, mat));

function resize() {
  W = innerWidth; H = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  mat.uniforms.uScale.value = dpr * (W < 640 ? 0.85 : 1);
  camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10); // y down, in CSS pixels
  buildTargets();
}
resize();
addEventListener("resize", resize);

/* ---------- The hawk ---------- */

const hawk = { x: -1e4, y: -1e4, on: false };
canvas.addEventListener("pointermove", (e) => { hawk.x = e.clientX; hawk.y = e.clientY; hawk.on = true; });
canvas.addEventListener("pointerdown", (e) => { hawk.x = e.clientX; hawk.y = e.clientY; hawk.on = true; });
document.addEventListener("pointerleave", () => { hawk.on = false; });
canvas.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") hawk.on = false; });

/* ---------- Gathering ---------- */

let gathered = reduceMotion;
let form = gathered ? 1 : 0; // eased 0..1
let clock = 0;
let manual = false;
let nextToggle = 7.5;
const HOLD = 5, FLY = 9;

function setGathered(on, byHand) {
  if (on === gathered) return;
  gathered = on;
  if (byHand) manual = on;
  button.setAttribute("aria-pressed", String(on));
  button.textContent = on ? "Release" : "Gather";
  if (!on) {
    // Break the word: a burst outward and upward, as if startled.
    let cx = 0, cy = 0;
    for (let i = 0; i < N; i++) { cx += px[i]; cy += py[i]; }
    cx /= N; cy /= N;
    for (let i = 0; i < N; i++) {
      const dx = px[i] - cx, dy = py[i] - cy, d = Math.hypot(dx, dy) + 1;
      vx[i] += (dx / d) * 160 + 60;
      vy[i] += (dy / d) * 120 - 70;
    }
  }
  nextToggle = clock + (on ? HOLD : FLY);
}
button.addEventListener("click", () => setGathered(!gathered, true));

/* ---------- Simulation ---------- */

const R = 24, RS = 9, CELL = R;
let cols = 0, rows = 0, head = new Int32Array(1);
const next = new Int32Array(N);

function step(dt) {
  clock += dt;
  if (!reduceMotion && !manual && clock >= nextToggle) setGathered(!gathered, false);
  const goal = gathered ? 1 : 0;
  form += (goal - form) * (1 - Math.exp(-dt * (gathered ? 1.6 : 3.2)));
  const f = form, flock = 1 - f;

  // Bucket birds into the grid.
  cols = Math.ceil(W / CELL) + 2; rows = Math.ceil(H / CELL) + 2;
  if (head.length < cols * rows) head = new Int32Array(cols * rows);
  head.fill(-1, 0, cols * rows);
  const cellOf = (x, y) => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL) + 1));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL) + 1));
    return cy * cols + cx;
  };
  for (let i = 0; i < N; i++) { const c = cellOf(px[i], py[i]); next[i] = head[c]; head[c] = i; }

  // A roaming centre the flock is loosely tied to: it wanders a figure of eight.
  const rx = W * (0.5 + 0.26 * Math.sin(clock * 0.21)), ry = H * (0.36 + 0.12 * Math.sin(clock * 0.37 + 1));
  const R2 = R * R, RS2 = RS * RS;
  const hawkR = 150;

  for (let i = 0; i < N; i++) {
    const x = px[i], y = py[i];
    let ax = 0, ay = 0;

    if (flock > 0.001) {
      let n = 0, sx = 0, sy = 0, svx = 0, svy = 0, epx = 0, epy = 0;
      const gx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL) + 1));
      const gy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL) + 1));
      for (let oy = -1; oy <= 1; oy++) {
        const yy = gy + oy; if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = gx + ox; if (xx < 0 || xx >= cols) continue;
          for (let j = head[yy * cols + xx]; j !== -1; j = next[j]) {
            if (j === i) continue;
            const dx = px[j] - x, dy = py[j] - y, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            n++; sx += px[j]; sy += py[j]; svx += vx[j]; svy += vy[j];
            if (d2 < RS2 && d2 > 0.0001) { epx -= dx / d2; epy -= dy / d2; }
          }
        }
      }
      let fx = 0, fy = 0;
      if (n) {
        fx += (svx / n - vx[i]) * 1.9 + (sx / n - x) * 1.6 + epx * 900;
        fy += (svy / n - vy[i]) * 1.9 + (sy / n - y) * 1.6 + epy * 900;
      }
      // Loosely tied to the roaming centre, harder near the edges of the sky.
      fx += (rx - x) * 0.55;
      fy += (ry - y) * 0.6;
      const m = Math.min(120, W * 0.12);
      if (x < m) fx += (m - x) * 6;
      if (x > W - m) fx -= (x - (W - m)) * 6;
      if (y > H * 0.74) fy -= (y - H * 0.74) * 6;
      if (y < 40) fy += (40 - y) * 6;
      ax += fx * flock; ay += fy * flock;
    }

    if (f > 0.001) {
      // Steer to your pixel of the word, arriving gently.
      let dvx = (tx[i] - x) * 3.4, dvy = (ty[i] - y) * 3.4;
      const m = Math.hypot(dvx, dvy);
      if (m > 520) { dvx *= 520 / m; dvy *= 520 / m; }
      ax += (dvx - vx[i]) * 6 * f;
      ay += (dvy - vy[i]) * 6 * f;
    }

    if (hawk.on) {
      const dx = x - hawk.x, dy = y - hawk.y, d = Math.hypot(dx, dy);
      if (d < hawkR && d > 0.01) {
        const k = (1 - d / hawkR) ** 2 * 5200;
        ax += (dx / d) * k; ay += (dy / d) * k;
      }
    }

    let nvx = vx[i] + ax * dt, nvy = vy[i] + ay * dt;
    const sp = Math.hypot(nvx, nvy);
    const maxS = 240 + 300 * f, minS = 110 * flock;
    if (sp > maxS) { nvx *= maxS / sp; nvy *= maxS / sp; }
    else if (sp < minS && sp > 0.01) { nvx *= minS / sp; nvy *= minS / sp; }
    vx[i] = nvx; vy[i] = nvy;
    px[i] = x + nvx * dt; py[i] = y + nvy * dt;

    // Heading follows velocity; a near-still bird in the word turns to face right.
    const target = sp > 25 ? Math.atan2(nvy, nvx) : 0;
    let da = target - ang[i];
    da = Math.atan2(Math.sin(da), Math.cos(da));
    ang[i] += da * Math.min(1, dt * 10);
    // Wingbeats: fast in flight, a slow, small shiver when holding the word.
    phase[i] += dt * (9 + sp * 0.03) * (0.35 + 0.65 * Math.min(1, sp / 120));
  }
}

/* ---------- Loop ---------- */

let last = performance.now(), acc = 0;
const DT = 1 / 60;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  if (reduceMotion) { acc = Math.min(acc, DT); }
  while (acc >= DT) { step(DT); acc -= DT; }
  const flap = flapAttr.array;
  for (let i = 0; i < N; i++) {
    pos[i * 3] = px[i]; pos[i * 3 + 1] = py[i];
    flap[i] = Math.sin(phase[i]);
  }
  geo.attributes.position.needsUpdate = true;
  angAttr.needsUpdate = true;
  flapAttr.needsUpdate = true;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
if (reduceMotion) {
  button.setAttribute("aria-pressed", "true");
  button.textContent = "Release";
  manual = true;
  buildTargets().then(() => { for (let i = 0; i < N; i++) { px[i] = tx[i]; py[i] = ty[i]; vx[i] = vy[i] = 0; } });
}
requestAnimationFrame(frame);
