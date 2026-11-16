// Day 16 · Ink in Water
// Each print change is an ink drop. A mask texture holds how far the ink has
// reached, and every frame it is stepped forward on the GPU with a reaction-
// diffusion rule (Fisher-KPP: spread plus growth), so a drop keeps blooming
// on its own after you stop. Noise varies how easily ink spreads and a slow
// curl-noise current drags it, which gives the fronts their cloudy, tendrilled
// edge. The print shader mixes the current and next prints through the mask,
// darkens a thin band at the front like the rim of an ink cloud, and lets the
// image wobble a little where the water is moving. When the next print has
// filled the frame it becomes the current one and the mask is cleared.

import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("print");
const nameEl = document.getElementById("name");
const countEl = document.getElementById("count");
const nextBtn = document.getElementById("next");

/* ---------- Four prints, painted in code ---------- */

const PW = 640, PH = 800;
let seed = 16;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function paper(g, colour) {
  g.fillStyle = colour;
  g.fillRect(0, 0, PW, PH);
  // A little fibre in the paper.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgb(0 0 0 / ${rand() * 0.035})`;
    g.fillRect(rand() * PW, rand() * PH, 1 + rand() * 7, 1);
  }
}
function ridge(g, base, amp, freq, phase, colour) {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(0, PH);
  for (let x = 0; x <= PW; x += 8) {
    const y = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.7 + phase * 1.9)) - amp * 0.3 * Math.abs(Math.sin(x * freq * 0.5 + phase));
    g.lineTo(x, y);
  }
  g.lineTo(PW, PH);
  g.closePath();
  g.fill();
}

const PRINTS = [
  {
    name: "Mist",
    paint(g) {
      paper(g, "#ece7dc");
      g.fillStyle = "#d9cdb4";
      g.beginPath(); g.arc(440, 230, 70, 0, Math.PI * 2); g.fill();
      ridge(g, 380, 60, 0.011, 1.2, "#b9c0cf");
      ridge(g, 470, 70, 0.009, 3.1, "#8892ad");
      ridge(g, 560, 80, 0.008, 0.4, "#56618a");
      ridge(g, 660, 70, 0.013, 2.2, "#2e3a66");
      ridge(g, 760, 50, 0.017, 5.0, "#18213f");
    },
  },
  {
    name: "Red sun",
    paint(g) {
      paper(g, "#f2ebdc");
      g.fillStyle = "#d8432c";
      g.beginPath(); g.arc(PW / 2, 290, 150, 0, Math.PI * 2); g.fill();
      // Waves: overlapping arcs, row on row.
      const R = 46;
      for (let row = 0; row < 13; row++) {
        const y = 470 + row * (R * 0.62);
        for (let col = -1; col < PW / R + 1; col++) {
          const x = col * R * 1.6 + (row % 2 ? R * 0.8 : 0);
          for (let k = 4; k >= 1; k--) {
            g.fillStyle = k % 2 ? "#1f3570" : "#f2ebdc";
            g.beginPath(); g.arc(x, y, (R * k) / 4, Math.PI, 0); g.fill();
          }
        }
      }
    },
  },
  {
    name: "Bamboo",
    paint(g) {
      paper(g, "#e6ecd6");
      const stalks = [[90, 26, "#6f8f4e"], [210, 34, "#3f6b3a"], [330, 22, "#89a868"], [450, 38, "#2f5530"], [560, 24, "#6f8f4e"]];
      for (const [x, w, c] of stalks) {
        g.fillStyle = c;
        g.fillRect(x - w / 2, -10, w, PH + 20);
        g.fillStyle = "rgb(0 0 0 / 0.25)";
        for (let y = 60 + rand() * 80; y < PH; y += 120 + rand() * 60) g.fillRect(x - w / 2 - 2, y, w + 4, 5);
      }
      // Leaves.
      for (let i = 0; i < 46; i++) {
        const x = rand() * PW, y = rand() * PH * 0.9, a = (rand() - 0.5) * 1.6 + (rand() < 0.5 ? 0 : Math.PI);
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = rand() < 0.5 ? "#2f5530" : "#4f7a3f";
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(45, -14, 95, 0); g.quadraticCurveTo(45, 12, 0, 0); g.fill();
        g.restore();
      }
    },
  },
  {
    name: "Pine moon",
    paint(g) {
      const gr = g.createLinearGradient(0, 0, 0, PH);
      gr.addColorStop(0, "#3d3a4e"); gr.addColorStop(1, "#8a7f86");
      g.fillStyle = gr; g.fillRect(0, 0, PW, PH);
      g.fillStyle = "#f4e7c8";
      g.beginPath(); g.arc(420, 260, 120, 0, Math.PI * 2); g.fill();
      // A pine bough reaching in from the left.
      g.strokeStyle = "#141218"; g.lineCap = "round";
      const branch = (x, y, a, len, w, depth) => {
        if (depth === 0 || len < 8) {
          g.fillStyle = "#1b2a22";
          g.beginPath(); g.ellipse(x, y, 34, 14, a, 0, Math.PI * 2); g.fill();
          return;
        }
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, a - 0.45 + rand() * 0.2, len * 0.7, w * 0.62, depth - 1);
        branch(x2, y2, a + 0.4 + rand() * 0.2, len * 0.62, w * 0.6, depth - 1);
      };
      branch(-20, 560, -0.32, 190, 26, 5);
      g.fillStyle = "#24212c";
      g.fillRect(0, 720, PW, 80);
    },
  },
];

const textures = PRINTS.map((p) => {
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  p.paint(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  return t;
});

/* ---------- GPU setup ---------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

const MW = 256, MH = 320;
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
let rtA = new THREE.WebGLRenderTarget(MW, MH, rtOpts);
let rtB = new THREE.WebGLRenderTarget(MW, MH, rtOpts);

const NOISE = /* glsl */ `
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
`;
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const stepMat = new THREE.ShaderMaterial({
  uniforms: {
    uPrev: { value: null },
    uTexel: { value: new THREE.Vector2(1 / MW, 1 / MH) },
    uTime: { value: 0 },
    uDrop: { value: new THREE.Vector4(0, 0, 0, 0) }, // x, y (uv), radius (uv), amount
    uSeed: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D uPrev;
    uniform vec2 uTexel;
    uniform float uTime, uSeed;
    uniform vec4 uDrop;
    varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 aspect = vec2(1.0, 1.25);
      vec2 p = vUv * aspect * 3.0 + uSeed * 7.13;
      // A slow current: the curl of a noise field, so it swirls without sinking.
      float e = 0.02;
      float n1 = fbm(p + vec2(0.0, e) + uTime * 0.03), n2 = fbm(p - vec2(0.0, e) + uTime * 0.03);
      float n3 = fbm(p + vec2(e, 0.0) + uTime * 0.03), n4 = fbm(p - vec2(e, 0.0) + uTime * 0.03);
      vec2 curl = vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
      vec2 uv = vUv - curl * uTexel * 0.55;
      float c = texture2D(uPrev, uv).r;
      float l = texture2D(uPrev, uv - vec2(uTexel.x, 0.0)).r;
      float r = texture2D(uPrev, uv + vec2(uTexel.x, 0.0)).r;
      float d = texture2D(uPrev, uv - vec2(0.0, uTexel.y)).r;
      float u = texture2D(uPrev, uv + vec2(0.0, uTexel.y)).r;
      // Some water takes ink easily, some barely: the fronts come out ragged.
      float ease = smoothstep(-0.35, 0.45, fbm(p * 1.7 + 3.1));
      float D = 0.04 + 0.2 * ease;
      float grow = 0.05 + 0.07 * ease;
      float m = c + D * (l + r + u + d - 4.0 * c) + grow * c * (1.0 - c);
      // A fresh drop.
      vec2 q = (vUv - uDrop.xy) * aspect;
      float wob = 1.0 + 0.35 * noise(normalize(q + 1e-4) * 3.0 + uSeed);
      m = max(m, uDrop.w * smoothstep(uDrop.z * wob, uDrop.z * wob * 0.4, length(q)));
      gl_FragColor = vec4(clamp(m, 0.0, 1.0), 0.0, 0.0, 1.0);
    }
  `,
});

const clearMat = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
});

const viewMat = new THREE.ShaderMaterial({
  uniforms: {
    uA: { value: textures[0] },
    uB: { value: textures[1] },
    uMask: { value: null },
    uTexel: { value: new THREE.Vector2(1 / MW, 1 / MH) },
    uTime: { value: 0 },
    uSeed: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D uA, uB, uMask;
    uniform vec2 uTexel;
    uniform float uTime, uSeed;
    varying vec2 vUv;
    ${NOISE}
    void main() {
      float m = texture2D(uMask, vUv).r;
      vec2 g = vec2(
        texture2D(uMask, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uMask, vUv - vec2(uTexel.x, 0.0)).r,
        texture2D(uMask, vUv + vec2(0.0, uTexel.y)).r - texture2D(uMask, vUv - vec2(0.0, uTexel.y)).r);
      // Where the ink is moving the picture wobbles, as if seen through water.
      float front = m * (1.0 - m) * 4.0;
      vec2 wob = g * 0.012 + front * 0.004 * vec2(noise(vUv * 18.0 + uTime * 0.6), noise(vUv * 18.0 - uTime * 0.6));
      vec3 a = texture2D(uA, vUv + wob).rgb;
      vec3 b = texture2D(uB, vUv - wob * 0.5).rgb;
      float n = fbm(vUv * vec2(6.0, 7.5) + uSeed * 3.7) * 0.22;
      float t = smoothstep(0.42, 0.62, m + n);
      vec3 col = mix(a, b, t);
      // The rim of the cloud: a soft band of sumi where the ink is thinnest,
      // with feathered wisps running ahead of it.
      float rim = smoothstep(0.08, 0.4, m + n) * (1.0 - smoothstep(0.4, 0.7, m + n));
      float wisp = smoothstep(0.55, 0.9, fbm(vUv * 22.0 + uSeed)) * smoothstep(0.02, 0.2, m) * (1.0 - t);
      vec3 sumi = vec3(0.11, 0.105, 0.14);
      col = mix(col, sumi, rim * 0.45 + wisp * 0.35);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

function sizeCanvas() {
  const r = canvas.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(r.width, r.height, false);
}
sizeCanvas();
addEventListener("resize", sizeCanvas);

function clearMask() {
  quad.material = clearMat;
  for (const rt of [rtA, rtB]) { renderer.setRenderTarget(rt); renderer.render(scene, camera); }
  renderer.setRenderTarget(null);
}
clearMask();

/* ---------- State ---------- */

let cur = 0;
let pending = null; // a drop waiting for the next step
let active = false; // ink in the water
let started = 0;
let clock = 0;
let seedN = 0;
const readBuf = new Uint16Array(MW * MH * 4);

function label() {
  nameEl.textContent = PRINTS[cur].name;
  countEl.textContent = `${cur + 1} / ${PRINTS.length}`;
}
label();

function drop(u, v, radius, amount) {
  if (!active) { active = true; started = clock; }
  pending = [u, v, radius, amount];
}

function finish() {
  cur = (cur + 1) % PRINTS.length;
  viewMat.uniforms.uA.value = textures[cur];
  viewMat.uniforms.uB.value = textures[(cur + 1) % PRINTS.length];
  seedN += 1;
  clearMask();
  active = false;
  label();
}

function uvFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
}
let lastMove = null;
canvas.addEventListener("pointerdown", (e) => {
  const [u, v] = uvFromEvent(e);
  drop(u, v, 0.07, 1);
});
canvas.addEventListener("pointermove", (e) => {
  const [u, v] = uvFromEvent(e);
  // Moving over the print lets fall a thin trail of drops.
  if (lastMove && Math.hypot(u - lastMove[0], v - lastMove[1]) > 0.025) {
    drop(u, v, 0.025, 0.75);
    lastMove = [u, v];
  } else if (!lastMove) lastMove = [u, v];
});
canvas.addEventListener("pointerleave", () => { lastMove = null; });
canvas.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dropNext(); }
});
const SPOTS = [[0.3, 0.68], [0.72, 0.36], [0.5, 0.5], [0.24, 0.3]];
function dropNext() {
  const [u, v] = SPOTS[seedN % SPOTS.length];
  drop(u, v, 0.08, 1);
}
nextBtn.addEventListener("click", dropNext);

/* ---------- Loop ---------- */

let last = performance.now(), frameN = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  frameN++;
  stepMat.uniforms.uTime.value = clock;
  stepMat.uniforms.uSeed.value = seedN;
  viewMat.uniforms.uTime.value = clock;
  viewMat.uniforms.uSeed.value = seedN;

  if (active) {
    // A few small steps per frame keep the diffusion stable and the bloom quick.
    const steps = reduceMotion ? 24 : 5;
    quad.material = stepMat;
    for (let i = 0; i < steps; i++) {
      stepMat.uniforms.uPrev.value = rtA.texture;
      stepMat.uniforms.uDrop.value.set(...(pending && i === 0 ? pending : [0, 0, 0, 0]));
      renderer.setRenderTarget(rtB);
      renderer.render(scene, camera);
      [rtA, rtB] = [rtB, rtA];
    }
    pending = null;
    // Every so often, see whether the new print has filled the frame.
    if (frameN % 12 === 0 && clock - started > 1) {
      renderer.readRenderTargetPixels(rtA, 0, 0, MW, MH, readBuf);
      let lo = 1;
      for (let i = 0; i < readBuf.length; i += 4 * 37) lo = Math.min(lo, THREE.DataUtils.fromHalfFloat(readBuf[i]));
      if (lo > 0.97) finish();
    }
  }

  quad.material = viewMat;
  viewMat.uniforms.uMask.value = rtA.texture;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
