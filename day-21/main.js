// Day 21 · Ink Diary
// The diary from the zoomable year, told in ink. Each level (year, month, day)
// is painted to its own canvas. Opening a month or a day drops ink where you
// clicked, and the next page blooms out of the current one through the same
// reaction-diffusion mask as the ink-in-water prints. The ink takes the colour
// of the mood you are opening: a month blooms in its most common mood, a day
// in its own. Going back up blooms in plain iron-gall black.

import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("page");
const crumbs = document.getElementById("crumbs");
const upBtn = document.getElementById("up");
const hint = document.getElementById("hint");

const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif';
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYNAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PAPER = "#ece3d1", GALL = "#221f1b", SOFT = "#6b6458";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ---------- Moods and their inks ---------- */

const MOODS = [
  { name: "calm", ink: [31, 93, 110], words: ["quiet", "slow", "fog", "home", "still"] },
  { name: "bright", ink: [208, 138, 18], words: ["sun", "bright", "good", "swim", "light"] },
  { name: "busy", ink: [196, 61, 38], words: ["busy", "away", "windy", "rush", "loud"] },
  { name: "tender", ink: [122, 59, 108], words: ["letters", "garden", "rain", "soft", "missing"] },
  { name: "low", ink: [74, 79, 92], words: ["tired", "stuck", "grey", "flat", "late"] },
];
const css = (c, a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

/* ---------- A year of entries ---------- */

let seed = 21;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];

const NOTES = [
  "Coffee on the step before anyone else was up", "Rain all morning, the good kind", "Finished the chapter with the lighthouse",
  "Long call with Mum about the garden", "Bike chain came off on the hill again", "First tomatoes, small and very sour",
  "Wrote three pages, kept one", "The fox was back by the bins", "Bread didn't rise. Ate it anyway", "Swam to the buoy and back",
  "Train late, read the whole way", "Sorted the box of old letters", "New notebook, same handwriting", "Cut my hair myself. Mistake",
  "Watched the storm from the window", "Lunch outside for the first time this year", "Walked home the long way",
  "Paid the bills, felt like an adult", "Couldn't sleep, made tea, wrote this", "Market had the first strawberries",
  "Fixed the dripping tap at last", "Saw the swifts leave", "Sat with the cat for an hour", "Painted the door blue",
  "Lost an umbrella, found a better one", "Planted garlic in the dark", "Ran the river loop without stopping",
  "Wrote a letter I won't send", "Too tired to write much", "Picnic in the park with everyone",
  "Heard the band through the wall", "Bought flowers for no reason",
];
const PLACES = ["kitchen", "back step", "train", "desk", "garden", "café", "bed", "park bench", "library", "allotment"];

const YEAR = 2026;
const months = [];
for (let m = 0; m < 12; m++) {
  const n = new Date(YEAR, m + 1, 0).getDate();
  const offset = (new Date(YEAR, m, 1).getDay() + 6) % 7;
  const days = [];
  for (let d = 1; d <= n; d++) {
    const season = 0.5 + 0.5 * Math.sin(((m * 30 + d) / 365) * Math.PI * 2 - 1.4); // 0 winter … 1 summer
    // Summer leans bright and busy, winter calm and low; tender days come any time.
    const w = [0.9 - season * 0.4, 0.2 + season * 1.1, 0.35 + season * 0.4, 0.4, 0.8 - season * 0.55];
    let r = rand() * w.reduce((a, b) => a + b), mood = 0;
    while (r > w[mood]) r -= w[mood++];
    const count = rand() < 0.1 ? 0 : 1 + Math.floor(rand() * (mood === 4 ? 2.4 : 4.6));
    const hours = [];
    while (hours.length < count) {
      const h = 7 + Math.floor(rand() * 16);
      if (!hours.includes(h)) hours.push(h);
    }
    hours.sort((a, b) => a - b);
    days.push({
      m, d, dow: (offset + d - 1) % 7, col: (offset + d - 1) % 7, row: Math.floor((offset + d - 1) / 7),
      mood, count, word: pick(MOODS[mood].words), seed: Math.floor(rand() * 1e6),
      notes: hours.map((h, i, all) => ({ h, text: NOTES[(Math.floor(rand() * NOTES.length) + i * 7) % NOTES.length], place: pick(PLACES), temp: Math.round(3 + season * 19 + rand() * 4) })),
    });
  }
  const tally = [0, 0, 0, 0, 0];
  for (const d of days) if (d.count) tally[d.mood] += d.count;
  months.push({ m, days, mood: tally.indexOf(Math.max(...tally)) });
}
const hourLabel = (h) => (h === 12 ? "12 pm" : h > 12 ? `${h - 12} pm` : `${h} am`);

/* ---------- Painting ---------- */

let W = 0, H = 0, dpr = 1;
const paperCanvas = document.createElement("canvas");
const layers = [document.createElement("canvas"), document.createElement("canvas")];

function makePaper() {
  paperCanvas.width = Math.round(W * dpr);
  paperCanvas.height = Math.round(H * dpr);
  const g = paperCanvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (W * H) / 260; i++) {
    g.fillStyle = r() < 0.5 ? `rgb(80 60 30 / ${r() * 0.05})` : `rgb(255 255 255 / ${r() * 0.12})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 9, 1);
  }
}

// A watercolour blot: an uneven pool, a darker dried edge, and a lighter bloom inside.
function blot(g, x, y, r, ink, alpha, sd) {
  let s = sd + 1;
  const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ph = [rr() * 6.3, rr() * 6.3, rr() * 6.3];
  const shape = (scale) => {
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const k = 1 + 0.09 * Math.sin(a * 3 + ph[0]) + 0.06 * Math.sin(a * 5 + ph[1]) + 0.04 * Math.sin(a * 9 + ph[2]);
      const px = x + Math.cos(a) * r * k * scale, py = y + Math.sin(a) * r * k * scale * 0.94;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };
  shape(1);
  g.fillStyle = css(ink, alpha * 0.55);
  g.fill();
  g.lineWidth = Math.max(0.8, r * 0.07);
  g.strokeStyle = css(ink, alpha * 0.75);
  g.stroke();
  shape(0.55);
  g.fillStyle = css(ink, alpha * 0.22);
  g.fill();
}

let hits = [];

function paintYear(g) {
  hits = [];
  const top = 110, bottom = 50, side = W < 700 ? 18 : 48;
  const cols = W < 700 ? 3 : W < 1100 ? 4 : 6;
  const rows = 12 / cols;
  const gapX = W < 700 ? 14 : 36, gapY = 22, title = W < 700 ? 26 : 34;
  let cell = (W - side * 2 - gapX * (cols - 1)) / cols / 7;
  cell = Math.min(cell, (H - top - bottom - gapY * (rows - 1)) / rows / 6 - title / 6);
  const mw = cell * 7, mh = title + cell * 6;
  const ox = (W - (cols * mw + (cols - 1) * gapX)) / 2;
  const oy = top + Math.max(0, (H - top - bottom - (rows * mh + (rows - 1) * gapY)) / 2);
  for (const mo of months) {
    const x = ox + (mo.m % cols) * (mw + gapX);
    const y = oy + Math.floor(mo.m / cols) * (mh + gapY);
    g.fillStyle = GALL;
    g.font = `400 ${Math.min(26, title * 0.8)}px ${SERIF}`;
    g.textBaseline = "alphabetic";
    g.fillText(MONTHS[mo.m], x, y + title * 0.7);
    for (const d of mo.days) {
      const cx = x + (d.col + 0.5) * cell, cy = y + title + (d.row + 0.5) * cell;
      if (d.count) blot(g, cx, cy, cell * (0.24 + 0.05 * d.count), MOODS[d.mood].ink, 0.95, d.seed);
      else { g.fillStyle = css([107, 100, 88], 0.35); g.beginPath(); g.arc(cx, cy, Math.max(1, cell * 0.06), 0, 7); g.fill(); }
    }
    hits.push({ x: x - gapX / 2, y, w: mw + gapX, h: mh + gapY, go: { level: "month", m: mo.m } });
  }
}

function paintMonth(g, m) {
  hits = [];
  const mo = months[m];
  const top = 120, bottom = 50, side = W < 700 ? 16 : 56;
  const head = 30;
  const cw = (W - side * 2) / 7;
  const ch = Math.min(cw * 0.86, (H - top - bottom - head) / 6);
  const ox = side, oy = top;
  g.textBaseline = "alphabetic";
  g.fillStyle = SOFT;
  g.font = `400 13px ${SANS}`;
  for (let c = 0; c < 7; c++) g.fillText(DOW[c], ox + c * cw + 10, oy + 16);
  for (const d of mo.days) {
    const x = ox + d.col * cw, y = oy + head + d.row * ch;
    const ink = MOODS[d.mood].ink;
    if (d.count) blot(g, x + cw * 0.5, y + ch * 0.52, Math.min(cw, ch) * (0.15 + 0.045 * d.count), ink, 0.9, d.seed);
    g.fillStyle = GALL;
    g.font = `600 ${clamp(ch * 0.17, 12, 20)}px ${SANS}`;
    g.fillText(String(d.d), x + 10, y + clamp(ch * 0.2, 16, 26));
    if (d.count && cw > 70) {
      g.font = `italic 400 ${clamp(ch * 0.2, 14, 26)}px ${SERIF}`;
      g.fillStyle = css(ink.map((v) => v * 0.7), 1);
      const tw = g.measureText(d.word).width;
      g.fillText(d.word, x + cw - 10 - tw, y + ch - 12);
    }
    hits.push({ x, y, w: cw, h: ch, go: { level: "day", m, d: d.d } });
  }
}

function wrapText(g, text, x, y, max, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > max && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  g.fillText(line, x, y);
  return y + lh;
}

function paintDay(g, m, dn) {
  hits = [];
  const d = months[m].days[dn - 1];
  const mood = MOODS[d.mood];
  const narrow = W < 800;
  const side = narrow ? 20 : 72;
  const leftW = narrow ? W - side * 2 : W * 0.42;
  const top = narrow ? 110 : 140;
  // The day's own blot, large, with its word written into the wet ink.
  const br = narrow ? Math.min(W, H) * 0.2 : Math.min(leftW * 0.34, H * 0.19);
  const bx = side + br * 1.05, by = top + br * 1.1;
  blot(g, bx, by, br, mood.ink, d.count ? 1 : 0.4, d.seed);
  g.textBaseline = "alphabetic";
  g.fillStyle = GALL;
  g.font = `400 ${narrow ? 44 : 72}px ${SERIF}`;
  g.fillText(`${DAYNAME[d.dow]} ${d.d}`, side, by + br + (narrow ? 60 : 96));
  g.font = `italic 400 ${narrow ? 26 : 36}px ${SERIF}`;
  g.fillStyle = css(mood.ink.map((v) => v * 0.75), 1);
  g.fillText(`a ${d.word} day`, side, by + br + (narrow ? 96 : 146));

  const lx = narrow ? side : side + leftW + 48;
  let ly = narrow ? by + br + 140 : top + 16;
  const maxW = narrow ? W - side * 2 : W - lx - side;
  if (!d.count) {
    g.font = `italic 400 30px ${SERIF}`;
    g.fillStyle = SOFT;
    g.fillText("Nothing written today.", lx, ly + 30);
  }
  for (const n of d.notes) {
    g.fillStyle = css(mood.ink, 1);
    g.beginPath(); g.arc(lx + 5, ly + 9, 5, 0, 7); g.fill();
    g.fillStyle = SOFT;
    g.font = `600 13px ${SANS}`;
    g.fillText(hourLabel(n.h).toUpperCase(), lx + 22, ly + 14);
    g.fillStyle = GALL;
    g.font = `400 ${narrow ? 24 : 34}px ${SERIF}`;
    ly = wrapText(g, n.text, lx, ly + (narrow ? 44 : 54), maxW, narrow ? 28 : 38);
    g.fillStyle = SOFT;
    g.font = `400 14px ${SANS}`;
    g.fillText(`${n.place} · ${n.temp}°`, lx, ly - 8);
    ly += narrow ? 20 : 30;
  }
  hits.push({ x: 0, y: 0, w: W, h: H, go: { level: "month", m } });
}

function paint(layer, state) {
  layer.width = Math.round(W * dpr);
  layer.height = Math.round(H * dpr);
  const g = layer.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(paperCanvas, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.level === "year") paintYear(g);
  else if (state.level === "month") paintMonth(g, state.m);
  else paintDay(g, state.m, state.d);
}

/* ---------- GPU: the ink-in-water mask, reused ---------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

const textures = layers.map((c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
});

let MW = 240, MH = 150, rtA = null, rtB = null;
const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };

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
    uTexel: { value: new THREE.Vector2() },
    uAsp: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDrop: { value: new THREE.Vector4() },
    uSeed: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D uPrev;
    uniform vec2 uTexel, uAsp;
    uniform float uTime, uSeed;
    uniform vec4 uDrop;
    varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * uAsp * 2.6 + uSeed * 7.13;
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
      float ease = smoothstep(-0.35, 0.45, fbm(p * 1.7 + 3.1));
      float D = 0.05 + 0.19 * ease;
      float grow = 0.06 + 0.08 * ease;
      float m = c + D * (l + r + u + d - 4.0 * c) + grow * c * (1.0 - c);
      vec2 q = (vUv - uDrop.xy) * uAsp;
      float wob = 1.0 + 0.35 * noise(normalize(q + 1e-4) * 3.0 + uSeed);
      m = max(m, uDrop.w * smoothstep(uDrop.z * wob, uDrop.z * wob * 0.4, length(q)));
      gl_FragColor = vec4(clamp(m, 0.0, 1.0), 0.0, 0.0, 1.0);
    }
  `,
});
const clearMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }` });
const viewMat = new THREE.ShaderMaterial({
  uniforms: {
    uA: { value: textures[0] },
    uB: { value: textures[1] },
    uMask: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uAsp: { value: new THREE.Vector2(1, 1) },
    uInk: { value: new THREE.Vector3(0.13, 0.12, 0.11) },
    uTime: { value: 0 },
    uSeed: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D uA, uB, uMask;
    uniform vec2 uTexel, uAsp;
    uniform vec3 uInk;
    uniform float uTime, uSeed;
    varying vec2 vUv;
    ${NOISE}
    void main() {
      float m = texture2D(uMask, vUv).r;
      vec2 g = vec2(
        texture2D(uMask, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uMask, vUv - vec2(uTexel.x, 0.0)).r,
        texture2D(uMask, vUv + vec2(0.0, uTexel.y)).r - texture2D(uMask, vUv - vec2(0.0, uTexel.y)).r);
      float front = m * (1.0 - m) * 4.0;
      vec2 wob = g * 0.008 + front * 0.003 * vec2(noise(vUv * uAsp * 14.0 + uTime * 0.6), noise(vUv * uAsp * 14.0 - uTime * 0.6));
      vec3 a = texture2D(uA, vUv + wob).rgb;
      vec3 b = texture2D(uB, vUv - wob * 0.5).rgb;
      float n = fbm(vUv * uAsp * 5.0 + uSeed * 3.7) * 0.22;
      float t = smoothstep(0.42, 0.62, m + n);
      vec3 col = mix(a, b, t);
      // The bloom's rim and the wisps ahead of it are in the mood's ink,
      // multiplied into the paper the way real ink sits in it.
      float rim = smoothstep(0.06, 0.4, m + n) * (1.0 - smoothstep(0.4, 0.72, m + n));
      float wisp = smoothstep(0.55, 0.9, fbm(vUv * uAsp * 18.0 + uSeed)) * smoothstep(0.02, 0.2, m) * (1.0 - t);
      float k = clamp(rim * 0.85 + wisp * 0.55, 0.0, 1.0);
      col = mix(col, col * uInk * 1.15, k);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

function clearMask() {
  quad.material = clearMat;
  for (const rt of [rtA, rtB]) { renderer.setRenderTarget(rt); renderer.render(scene, camera); }
  renderer.setRenderTarget(null);
}

/* ---------- State ---------- */

let state = { level: "year" };
let front = 0; // which layer shows the current page
let active = false, pending = null, started = 0, clock = 0, seedN = 0, frameN = 0;
let readBuf = null;

function resize() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  MH = 120; MW = Math.round((MH * W) / H);
  rtA?.dispose(); rtB?.dispose();
  rtA = new THREE.WebGLRenderTarget(MW, MH, rtOpts);
  rtB = new THREE.WebGLRenderTarget(MW, MH, rtOpts);
  readBuf = new Uint16Array(MW * MH * 4);
  for (const u of [stepMat.uniforms, viewMat.uniforms]) {
    u.uTexel.value.set(1 / MW, 1 / MH);
    u.uAsp.value.set(W / H, 1);
  }
  makePaper();
  paint(layers[front], state);
  textures[front].needsUpdate = true;
  viewMat.uniforms.uA.value = textures[front];
  viewMat.uniforms.uB.value = textures[front];
  active = false;
  clearMask();
}

function setCrumbs() {
  const parts = ["2026"];
  if (state.level !== "year") parts.push(MONTHS[state.m]);
  if (state.level === "day") parts.push(String(state.d));
  const spans = [...crumbs.children];
  parts.forEach((p, i) => {
    if (spans[i] && spans[i].textContent === p) return;
    const el = document.createElement("span");
    el.textContent = p;
    if (spans[i]) spans[i].replaceWith(el); else crumbs.appendChild(el);
    spans[i] = el;
  });
  while (crumbs.children.length > parts.length) crumbs.lastChild.remove();
  upBtn.hidden = state.level === "year";
  hint.textContent = state.level === "year" ? "Click a month" : state.level === "month" ? "Click a day" : "Click to go back";
}

function go(next, sx, sy) {
  if (active) finish(); // a click mid-bloom settles the current page first
  const deeper = (next.level === "month" && state.level === "year") || next.level === "day";
  const ink = next.level === "day" ? MOODS[months[next.m].days[next.d - 1].mood].ink
    : next.level === "month" && deeper ? MOODS[months[next.m].mood].ink : [34, 31, 27];
  state = next;
  const back = 1 - front;
  paint(layers[back], state);
  textures[back].needsUpdate = true;
  viewMat.uniforms.uA.value = textures[front];
  viewMat.uniforms.uB.value = textures[back];
  viewMat.uniforms.uInk.value.set(ink[0] / 255, ink[1] / 255, ink[2] / 255);
  setCrumbs();
  if (reduceMotion) { finish(); return; }
  active = true;
  started = clock;
  pending = [sx / W, 1 - sy / H, 0.11, 1];
}
function finish() {
  front = 1 - front;
  viewMat.uniforms.uA.value = textures[front];
  viewMat.uniforms.uB.value = textures[front];
  seedN += 1;
  active = false;
  clearMask();
}
function goUp(sx = W / 2, sy = H / 2) {
  if (state.level === "day") go({ level: "month", m: state.m }, sx, sy);
  else if (state.level === "month") go({ level: "year" }, sx, sy);
}

canvas.addEventListener("click", (e) => {
  const h = hits.find((r) => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h);
  if (h) go(h.go, e.clientX, e.clientY);
});
canvas.addEventListener("mousemove", (e) => {
  canvas.style.cursor = hits.some((r) => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) ? "pointer" : "default";
});
upBtn.addEventListener("click", () => goUp(upBtn.getBoundingClientRect().left, 40));
addEventListener("keydown", (e) => { if (e.key === "Escape") goUp(); });
window.__inkGo = (x, y) => canvas.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, bubbles: true }));
window.__inkUp = () => goUp(W - 80, 50);
window.__inkHits = () => hits.map((h) => ({ x: h.x + h.w / 2, y: h.y + h.h / 2, go: h.go }));

/* ---------- Loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  clock += dt;
  frameN++;
  stepMat.uniforms.uTime.value = clock;
  stepMat.uniforms.uSeed.value = seedN;
  viewMat.uniforms.uTime.value = clock;
  viewMat.uniforms.uSeed.value = seedN;
  if (active) {
    quad.material = stepMat;
    for (let i = 0; i < 18; i++) {
      stepMat.uniforms.uPrev.value = rtA.texture;
      stepMat.uniforms.uDrop.value.set(...(pending && i === 0 ? pending : [0, 0, 0, 0]));
      renderer.setRenderTarget(rtB);
      renderer.render(scene, camera);
      [rtA, rtB] = [rtB, rtA];
    }
    pending = null;
    if (frameN % 8 === 0 && clock - started > 0.6) {
      renderer.readRenderTargetPixels(rtA, 0, 0, MW, MH, readBuf);
      let lo = 1;
      for (let i = 0; i < readBuf.length; i += 4 * 29) lo = Math.min(lo, THREE.DataUtils.fromHalfFloat(readBuf[i]));
      if (lo > 0.96) finish();
    }
  }
  quad.material = viewMat;
  viewMat.uniforms.uMask.value = rtA.texture;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener("resize", resize);
resize();
setCrumbs();
document.fonts.ready.then(() => { if (!active) resize(); });
requestAnimationFrame(frame);
