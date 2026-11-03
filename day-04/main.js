// Day 04 · Halftone Weather
// A portrait printed in two colours. The black screen carries the face; a blue
// screen at another angle carries the weather, read from drifting noise like a
// radar map. Cloud also darkens the black dots under it, as a shadow would.
// The pointer is the sun: dots inside its warmth shrink fast, and regrow slowly
// once it moves on, so it leaves a fading clear patch behind it.
// Everything is driven by requestAnimationFrame and performance.now, so the
// recorder can step it frame by frame.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const canvas = document.getElementById("plate");
const ctx = canvas.getContext("2d");
const rCover = document.getElementById("rCover");
const rWind = document.getElementById("rWind");
const rFrame = document.getElementById("rFrame");
const buttons = [...document.querySelectorAll(".sky button")];

const INK = "#17161c";
const CLOUD = "#2f63b0";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- Value noise ---------- */

const P = new Uint8Array(512);
{
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const X = xi & 255, Y = yi & 255;
  const a = P[P[X] + Y], b = P[P[X + 1] + Y], c = P[P[X] + Y + 1], d = P[P[X + 1] + Y + 1];
  return lerp(lerp(a, b, u), lerp(c, d, u), v) / 255;
}
function fbm(x, y) {
  return noise(x, y) * 0.55 + noise(x * 2.03 + 17.1, y * 2.03 + 3.7) * 0.3 + noise(x * 4.1 + 5.3, y * 4.1 + 31.9) * 0.15;
}

/* ---------- The portrait (a tone map, drawn once) ---------- */

// A profile facing the sun, drawn in a unit square and read back as darkness.
const tone = document.createElement("canvas");
const tctx = tone.getContext("2d", { willReadFrequently: true });
let toneData = null, TW = 0, TH = 0;

function headPath(c, s) {
  const p = (x, y) => [x * s, y * s];
  c.beginPath();
  c.moveTo(...p(0.53, 0.115));
  c.bezierCurveTo(...p(0.43, 0.115), ...p(0.37, 0.17), ...p(0.355, 0.25));
  c.bezierCurveTo(...p(0.345, 0.3), ...p(0.34, 0.34), ...p(0.335, 0.375));
  c.bezierCurveTo(...p(0.33, 0.395), ...p(0.338, 0.41), ...p(0.336, 0.425));
  c.bezierCurveTo(...p(0.32, 0.455), ...p(0.29, 0.485), ...p(0.268, 0.51));
  c.bezierCurveTo(...p(0.262, 0.528), ...p(0.29, 0.535), ...p(0.325, 0.532));
  c.bezierCurveTo(...p(0.326, 0.545), ...p(0.316, 0.56), ...p(0.317, 0.568));
  c.bezierCurveTo(...p(0.322, 0.578), ...p(0.33, 0.585), ...p(0.326, 0.59));
  c.bezierCurveTo(...p(0.316, 0.6), ...p(0.318, 0.612), ...p(0.33, 0.622));
  c.bezierCurveTo(...p(0.338, 0.63), ...p(0.334, 0.64), ...p(0.328, 0.655));
  c.bezierCurveTo(...p(0.322, 0.68), ...p(0.335, 0.705), ...p(0.37, 0.715));
  c.bezierCurveTo(...p(0.4, 0.725), ...p(0.43, 0.725), ...p(0.445, 0.75));
  c.bezierCurveTo(...p(0.45, 0.8), ...p(0.44, 0.85), ...p(0.4, 0.89));
  c.bezierCurveTo(...p(0.34, 0.93), ...p(0.24, 0.95), ...p(0.18, 1.02));
  c.lineTo(...p(1.02, 1.02));
  c.bezierCurveTo(...p(0.92, 0.93), ...p(0.8, 0.9), ...p(0.71, 0.86));
  c.bezierCurveTo(...p(0.68, 0.8), ...p(0.67, 0.72), ...p(0.69, 0.64));
  c.bezierCurveTo(...p(0.72, 0.58), ...p(0.76, 0.5), ...p(0.765, 0.4));
  c.bezierCurveTo(...p(0.77, 0.24), ...p(0.66, 0.115), ...p(0.53, 0.115));
  c.closePath();
}

function hairPath(c, s) {
  const p = (x, y) => [x * s, y * s];
  c.beginPath();
  c.moveTo(...p(0.37, 0.215));
  c.bezierCurveTo(...p(0.42, 0.2), ...p(0.47, 0.21), ...p(0.52, 0.245));
  c.bezierCurveTo(...p(0.56, 0.28), ...p(0.58, 0.33), ...p(0.6, 0.39));
  c.bezierCurveTo(...p(0.62, 0.45), ...p(0.66, 0.53), ...p(0.66, 0.63));
  c.lineTo(...p(0.9, 0.63));
  c.lineTo(...p(0.9, 0.0));
  c.lineTo(...p(0.3, 0.0));
  c.closePath();
}

function drawTone(size) {
  const s = size;
  tone.width = tone.height = s;
  const c = tctx;
  c.fillStyle = "#000";
  c.fillRect(0, 0, s, s);

    // Counter-shaded: dark in front of the lit face, pale behind the shaded back.
  const bg = c.createLinearGradient(0, 0, s, 0);
  bg.addColorStop(0, "rgb(165,165,165)");
  bg.addColorStop(0.3, "rgb(120,120,120)");
  bg.addColorStop(0.75, "rgb(30,30,30)");
  bg.addColorStop(1, "rgb(12,12,12)");
  c.fillStyle = bg;
  c.fillRect(0, 0, s, s);

  c.save();
  headPath(c, s);
  c.clip();

  // Skin: lit from the front (left), falling into shade toward the back.
  const skin = c.createLinearGradient(s * 0.28, 0, s * 0.74, 0);
  skin.addColorStop(0, "rgb(18,18,18)");
  skin.addColorStop(0.4, "rgb(50,50,50)");
  skin.addColorStop(1, "rgb(160,160,160)");
  c.fillStyle = skin;
  c.fillRect(0, 0, s, s);

  // Shade under the jaw and down the neck.
  const jaw = c.createLinearGradient(0, s * 0.68, 0, s * 0.8);
  jaw.addColorStop(0, "rgba(150,150,150,0)");
  jaw.addColorStop(1, "rgba(150,150,150,0.75)");
  c.fillStyle = jaw;
  c.fillRect(s * 0.38, s * 0.68, s * 0.4, s * 0.2);

  // Eye socket, lids and the ear.
  const dot = (x, y, rx, ry, v, a = 0) => {
    c.beginPath();
    c.ellipse(x * s, y * s, rx * s, ry * s, a, 0, Math.PI * 2);
    c.fillStyle = v;
    c.fill();
  };
  dot(0.375, 0.405, 0.04, 0.026, "rgba(170,170,170,0.55)", -0.2);
  dot(0.36, 0.408, 0.016, 0.006, "rgb(220,220,220)", -0.15);
  dot(0.585, 0.47, 0.03, 0.055, "rgb(150,150,150)", 0.15);
  dot(0.59, 0.47, 0.014, 0.03, "rgb(225,225,225)", 0.15);
  dot(0.342, 0.586, 0.014, 0.0035, "rgb(200,200,200)");
  // Cheek catching the light.
  dot(0.42, 0.52, 0.07, 0.06, "rgba(0,0,0,0.35)");

  // Hair, with a few loose strands lighter.
  hairPath(c, s);
  c.fillStyle = "rgb(225,225,225)";
  c.fill();
  c.strokeStyle = "rgba(120,120,120,0.6)";
  c.lineWidth = s * 0.006;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(s * (0.42 + i * 0.04), s * (0.16 + i * 0.01));
    c.quadraticCurveTo(s * (0.58 + i * 0.03), s * 0.24, s * (0.62 + i * 0.03), s * (0.5 + i * 0.02));
    c.stroke();
  }
  // Collar.
  c.fillStyle = "rgb(205,205,205)";
  c.beginPath();
  c.moveTo(0, s * 0.9);
  c.bezierCurveTo(s * 0.4, s * 0.92, s * 0.5, s * 0.88, s * 0.7, s * 0.86);
  c.lineTo(s, s * 0.9);
  c.lineTo(s, s);
  c.lineTo(0, s);
  c.fill();
  c.restore();

  // Bun.
  c.beginPath();
  c.arc(s * 0.79, s * 0.3, s * 0.075, 0, Math.PI * 2);
  c.fillStyle = "rgb(215,215,215)";
  c.fill();

  // Blur it into continuous tone.
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = s;
  const x = tmp.getContext("2d");
  x.filter = `blur(${Math.max(1, s * 0.0042)}px)`;
  x.drawImage(tone, 0, 0);
  c.filter = "none";
  c.clearRect(0, 0, s, s);
  c.drawImage(tmp, 0, 0);

  toneData = c.getImageData(0, 0, s, s).data;
  TW = TH = s;
}

/* ---------- Screens ---------- */

let W = 0, H = 0, dpr = 1;
let portrait = { x: 0, y: 0, s: 1 };
let ink = null, sky = null; // { pts: Float32Array [x,y,...], tone: Float32Array, cur: Float32Array }

function makeScreen(cell, angle, withTone) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const R = Math.hypot(W, H) / 2 + cell;
  const cx = W / 2, cy = H / 2;
  const pts = [], tones = [];
  for (let v = -R; v <= R; v += cell) {
    for (let u = -R; u <= R; u += cell) {
      const x = cx + u * ca - v * sa;
      const y = cy + u * sa + v * ca;
      if (x < -cell || y < -cell || x > W + cell || y > H + cell) continue;
      pts.push(x, y);
      if (withTone) {
        const tx = Math.round(((x - portrait.x) / portrait.s) * TW);
        const ty = Math.round(((y - portrait.y) / portrait.s) * TH);
        let t = 0.04;
        if (tx >= 0 && ty >= 0 && tx < TW && ty < TH) t = toneData[(ty * TW + tx) * 4] / 255;
        tones.push(t);
      }
    }
  }
  const n = pts.length / 2;
  return {
    cell,
    pts: new Float32Array(pts),
    tone: new Float32Array(tones),
    cur: new Float32Array(n),
    n,
  };
}

function layout() {
  const r = canvas.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  // The head sits a little right of centre and bleeds off the bottom.
  const s = Math.min(W * 1.05, H * 1.02);
  portrait = { x: W * 0.52 - s * 0.5, y: H - s * 0.99, s };
  if (!toneData) drawTone(560);

  const cell = W < 600 ? 7 : 9;
  ink = makeScreen(cell, Math.PI / 4, true);
  sky = makeScreen(cell * 1.15, (15 * Math.PI) / 180, false);
  first = true;
}

/* ---------- Weather and sun ---------- */

const SKIES = {
  clear: { cover: 0.12, wind: 6 },
  cloudy: { cover: 0.5, wind: 14 },
  storm: { cover: 0.88, wind: 31 },
};
let target = SKIES.cloudy;
let cover = 0.5, wind = 14;
let drift = 0;

const sun = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, onT: 0 };

function sunAt(x, y) {
  sun.tx = x;
  sun.ty = y;
  if (sun.on === 0 && sun.x < -1000) {
    sun.x = x;
    sun.y = y;
  }
  sun.onT = 1;
}

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  sunAt(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  sunAt(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener("pointerleave", () => (sun.onT = 0));

canvas.addEventListener("keydown", (e) => {
  const step = 40;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d) return;
  e.preventDefault();
  if (sun.onT === 0) sunAt(W / 2, H / 2);
  sunAt(clamp(sun.tx + d[0], 0, W), clamp(sun.ty + d[1], 0, H));
});
canvas.addEventListener("blur", () => (sun.onT = 0));

buttons.forEach((b) =>
  b.addEventListener("click", () => {
    buttons.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    target = SKIES[b.dataset.sky];
  })
);

/* ---------- Frame ---------- */

let first = true;
let last = performance.now();
let lastReadout = -1;
const start = performance.now();

function cloudAt(x, y, cov) {
  // Domain-warped fbm, scrolling with the wind.
  const sx = x * 0.0021 + drift, sy = y * 0.0021;
  const w = noise(sx * 0.7 + 11.3, sy * 0.7 - drift * 0.4) - 0.5;
  const n = fbm(sx + w * 0.9, sy + w * 0.6 + drift * 0.15);
  const edge = 1 - cov;
  return smoothstep(edge - 0.12, edge + 0.22, n);
}

function sunWarmth(x, y, R) {
  if (sun.on < 0.002) return 0;
  const dx = x - sun.x, dy = y - sun.y;
  const d2 = (dx * dx + dy * dy) / (R * R);
  if (d2 > 1) return 0;
  const t = 1 - d2;
  return t * t * sun.on;
}

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  const k = (rate) => 1 - Math.exp(-rate * dt);

  cover = lerp(cover, target.cover, k(1.6));
  wind = lerp(wind, target.wind, k(1.6));
  if (!reduceMotion) drift += dt * wind * 0.0105;

  sun.on = lerp(sun.on, sun.onT, k(sun.onT ? 6 : 1.5));
  sun.x = lerp(sun.x, sun.tx, k(9));
  sun.y = lerp(sun.y, sun.ty, k(9));
  const R = Math.min(W, H) * 0.26;

  // Clearing is quick, regrowth is slow: the sun leaves a fading hole.
  const down = first ? 1 : k(14);
  const up = first ? 1 : k(1.1);
  first = false;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Blue weather screen first, black overprints it (multiply).
  let path = new Path2D();
  {
    const { pts, cur, n, cell } = sky;
    const rmax = cell * 0.62;
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      const want = cloudAt(x, y, cover) * (1 - sunWarmth(x, y, R * 1.15));
      const c = cur[i];
      cur[i] = c + (want - c) * (want < c ? down : up);
      const r = rmax * Math.sqrt(cur[i]);
      if (r < 0.35) continue;
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = CLOUD;
  ctx.globalAlpha = 0.9;
  ctx.fill(path);

  path = new Path2D();
  {
    const { pts, cur, tone: tn, n, cell } = ink;
    const rmax = cell * 0.6;
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      const warm = sunWarmth(x, y, R);
      const shade = cloudAt(x, y, cover) * (1 - warm) * 0.45;
      const t = tn[i];
      let want = 1 - (1 - t) * (1 - shade); // cloud shadow deepens the tone
      want *= 1 - warm * 0.7; // sunlight lifts it
      const c = cur[i];
      cur[i] = c + (want - c) * (want < c ? down : up);
      const r = rmax * Math.sqrt(cur[i]);
      if (r < 0.35) continue;
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = INK;
  ctx.fill(path);
  ctx.globalCompositeOperation = "source-over";

  // Readout, a few times a second, like a radar refresh.
  const tick = Math.floor((now - start) / 250);
  if (tick !== lastReadout) {
    lastReadout = tick;
    let clouded = 0;
    for (let i = 0; i < sky.n; i++) if (sky.cur[i] > 0.25) clouded++;
    rCover.textContent = `${Math.round((clouded / sky.n) * 100)}%`;
    rWind.textContent = `W ${Math.round(wind)}`;
    const mins = 14 * 60 + Math.floor(drift * 40) * 5;
    rFrame.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }

  requestAnimationFrame(frame);
}

new ResizeObserver(layout).observe(canvas);
layout();
requestAnimationFrame(frame);
