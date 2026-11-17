// Day 18 · Loom Loader
// A loading screen that weaves. Cream warp threads hang taut on a small
// wooden loom; as the page "loads", a shuttle runs across row by row laying
// coloured weft, the beater knocks each row down, and a stitched landscape
// (a fat cloud over green hills, after the thread-texture pictures) builds
// up from the bottom in a 5/1 twill. Bare warp above the cloth trembles a
// little under tension and jumps when the beater lands. At 100% the warps
// are cut, a fringe is left on top, and the cloth moves aside for the page.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("cloth");
const g = canvas.getContext("2d");
const pctEl = document.getElementById("pct");
const copy = document.getElementById("copy");
const again = document.getElementById("again");
const loom = document.querySelector(".loom");

const CW = 540, CH = 600;
const COLS = 60, ROWS = 50, CELL = 8;
const X0 = (CW - COLS * CELL) / 2, BOTTOM = 566, TOPBEAM = 44;
const fellY = (rows) => BOTTOM - rows * CELL;

let seed = 18;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ---------- The picture, one stitch per cell ---------- */

const YARN = {
  sky1: "#5e98c2", sky2: "#78acd0", sky3: "#9cc4dc",
  cloud: "#fdfaf2", cloudShade: "#e2e3de", cloudDeep: "#bcc6cb",
  sun: "#f3c650",
  hillFar: "#5e8a5a", hillMid: "#3f6b3a", field1: "#93b84d", field2: "#a9c65e", field3: "#7aa23f",
  path: "#d9c08a", warp: "#cdbf9f",
};
function stitch(c, r) {
  // c: 0..COLS-1 left to right; r: 0..ROWS-1 bottom to top.
  const u = (c + 0.5) / COLS, v = (r + 0.5) / ROWS;
  const n = rand() - 0.5;
  // Hills: a far ridge, then a near one striped with fields and a path.
  const far = 0.42 + 0.07 * Math.sin(u * 5.2 + 0.6) + 0.04 * Math.sin(u * 11 + 2);
  const near = 0.3 + 0.12 * Math.sin(u * 3.1 - 1.2) - 0.05 * u;
  if (v < near) {
    const pathX = 0.62 + (near - v) * 0.9 * Math.sin(v * 9) * 0.4 + (near - v) * 0.5;
    if (Math.abs(u - pathX) < 0.018 + (near - v) * 0.09) return YARN.path;
    const band = Math.floor((v + u * 0.35) * 14 + n * 0.6);
    return [YARN.field1, YARN.field2, YARN.field3][((band % 3) + 3) % 3];
  }
  if (v < far) return n > 0.42 ? YARN.hillMid : YARN.hillFar;
  // A low sun, top right.
  if (Math.hypot((u - 0.82) * 1.1, v - 0.86) < 0.065) return YARN.sun;
  // The cloud: a cluster of overlapping puffs, shaded underneath.
  const puffs = [[0.36, 0.66, 0.15], [0.52, 0.72, 0.17], [0.66, 0.65, 0.12], [0.24, 0.6, 0.1], [0.46, 0.6, 0.14], [0.6, 0.59, 0.11]];
  let inside = 0;
  for (const [px, py, pr] of puffs) {
    const d = Math.hypot((u - px) * 1.05, (v - py) * 1.25) / pr;
    if (d < 1) inside = Math.max(inside, 1 - d);
  }
  if (inside > 0 && v > 0.52) {
    const under = (0.64 - v) * 6 + n * 0.5;
    if (under > 0.45) return YARN.cloudDeep;
    if (under > -0.05 || inside < 0.08) return YARN.cloudShade;
    return YARN.cloud;
  }
  const t = v + n * 0.05;
  return t > 0.8 ? YARN.sky1 : t > 0.6 ? YARN.sky2 : YARN.sky3;
}
const picture = [];
for (let r = 0; r < ROWS; r++) {
  picture.push([]);
  for (let c = 0; c < COLS; c++) picture[r].push(stitch(c, r));
}
// 5/1 twill: the warp shows through on a fine diagonal, one cell in six.
const warpShows = (c, r) => (c + r) % 6 === 0;

/* ---------- Thread sprites ---------- */

let dpr = 1;
const sprites = new Map();
function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const f = (x) => Math.max(0, Math.min(255, Math.round(x * k)));
  return `rgb(${f(v >> 16)} ${f((v >> 8) & 255)} ${f(v & 255)})`;
}
function sprite(hex, vertical) {
  const key = hex + vertical;
  if (sprites.has(key)) return sprites.get(key);
  const w = vertical ? CELL - 2.5 : CELL + 1, h = vertical ? CELL + 1 : CELL - 0.8;
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const s = c.getContext("2d");
  s.scale(dpr, dpr);
  const gr = vertical ? s.createLinearGradient(0, 0, w, 0) : s.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, shade(hex, 0.68));
  gr.addColorStop(0.45, shade(hex, 1.08));
  gr.addColorStop(1, shade(hex, 0.62));
  s.fillStyle = gr;
  s.beginPath(); s.roundRect(0, 0, w, h, Math.min(w, h) / 2); s.fill();
  // The ply: two faint slanted strokes, like a twisted yarn.
  s.strokeStyle = shade(hex, 0.8);
  s.lineWidth = 0.6;
  s.beginPath();
  if (vertical) { s.moveTo(0.5, h * 0.3); s.lineTo(w - 0.5, h * 0.1); s.moveTo(0.5, h * 0.8); s.lineTo(w - 0.5, h * 0.6); }
  else { s.moveTo(w * 0.3, h - 0.5); s.lineTo(w * 0.45, 0.5); s.moveTo(w * 0.7, h - 0.5); s.lineTo(w * 0.85, 0.5); }
  s.stroke();
  const out = { c, w, h };
  sprites.set(key, out);
  return out;
}

/* ---------- Woven cloth, cached row by row ---------- */

const cloth = document.createElement("canvas");
const cg = cloth.getContext("2d");
let cached = 0;
function size() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = CW * dpr; canvas.height = CH * dpr;
  cloth.width = CW * dpr; cloth.height = CH * dpr;
  sprites.clear();
  cached = 0;
  cg.setTransform(1, 0, 0, 1, 0, 0);
  cg.clearRect(0, 0, cloth.width, cloth.height);
}
function drawCell(ctx, c, r) {
  const x = X0 + c * CELL, y = fellY(r + 1);
  if (warpShows(c, r)) {
    const s = sprite(YARN.warp, true);
    ctx.drawImage(s.c, x + 1, y - 0.5, s.w, s.h);
  } else {
    const s = sprite(picture[r][c], false);
    ctx.drawImage(s.c, x - 0.5, y + 0.4, s.w, s.h);
  }
}
function cacheRows(upTo) {
  cg.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (; cached < upTo; cached++) for (let c = 0; c < COLS; c++) drawCell(cg, c, cached);
}

/* ---------- The fake load ---------- */

// Real loads arrive in uneven bursts; so does this one.
const CURVE = [[0, 0], [0.7, 0.1], [1.5, 0.16], [2.5, 0.41], [3.2, 0.46], [4.4, 0.7], [5.3, 0.74], [6.4, 0.93], [7.2, 1]];
function loaded(t) {
  for (let i = 1; i < CURVE.length; i++) {
    const [t0, p0] = CURVE[i - 1], [t1, p1] = CURVE[i];
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return p0 + (p1 - p0) * (k * k * (3 - 2 * k)); }
  }
  return 1;
}

let clock = 0, woven = 0, beat = 0, cut = 0, done = false, lastRow = 0;

function reset() {
  clock = 0; woven = reduceMotion ? ROWS : 0; beat = 0; cut = 0; done = false; lastRow = 0;
  size();
}

/* ---------- Drawing ---------- */

function wood(x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#a8754a"); gr.addColorStop(1, "#6e4527");
  g.fillStyle = gr;
  g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2.4); g.fill();
}

function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, CW, CH);
  const rows = Math.floor(woven);
  const frac = woven - rows;
  const fell = fellY(rows);
  const frameA = 1 - clamp(cut * 1.6);

  // Loom posts and beams fade once the cloth is cut free.
  g.globalAlpha = frameA;
  wood(X0 - 22, TOPBEAM - 26, 10, BOTTOM - TOPBEAM + 50);
  wood(CW - X0 + 12, TOPBEAM - 26, 10, BOTTOM - TOPBEAM + 50);
  g.globalAlpha = 1;

  // Bare warp: from the cloth up to the top beam, trembling under tension.
  const warpA = 1 - clamp(cut * 2.2);
  if (warpA > 0 && rows < ROWS) {
    g.lineCap = "round";
    for (let c = 0; c < COLS; c++) {
      const x = X0 + c * CELL + CELL / 2;
      const amp = 0.35 + beat * 1.8;
      const wob = Math.sin(clock * 9 + c * 1.7) * amp;
      const lift = c % 2 ? 0 : 0.8; // the shed: alternate threads raised
      g.strokeStyle = c % 2 ? "#e6dcc6" : "#d9cdb4";
      g.lineWidth = 2.2;
      g.globalAlpha = warpA;
      g.beginPath();
      g.moveTo(x, fell + 1);
      g.quadraticCurveTo(x + wob + lift, (fell + TOPBEAM) / 2, x, TOPBEAM - cut * 40);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // The cloth so far.
  cacheRows(rows);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(cloth, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  // The row in progress, laid as far as the shuttle has gone.
  if (rows < ROWS) {
    const ltr = rows % 2 === 0;
    const n = Math.floor(frac * COLS);
    for (let k = 0; k < n; k++) drawCell(g, ltr ? k : COLS - 1 - k, rows);
    // Shuttle: a small wooden boat with a pirn of the next colour.
    const sx = X0 + (ltr ? frac : 1 - frac) * COLS * CELL;
    const sy = fell - CELL / 2 - 2;
    g.save();
    g.translate(sx, sy);
    g.fillStyle = "#7a4b2a";
    g.beginPath();
    g.moveTo(-20, 0); g.quadraticCurveTo(-10, -6, 0, -6); g.quadraticCurveTo(10, -6, 20, 0);
    g.quadraticCurveTo(10, 6, 0, 6); g.quadraticCurveTo(-10, 6, -20, 0); g.fill();
    const col = picture[rows][Math.min(COLS - 1, Math.max(0, Math.floor((sx - X0) / CELL)))];
    g.fillStyle = col;
    g.beginPath(); g.roundRect(-8, -2.5, 16, 5, 2.5); g.fill();
    g.restore();
  }

  // The beater (reed) rides just above the cloth and knocks each row down.
  if (warpA > 0 && rows < ROWS + 1) {
    const by = fell - 18 + beat * 12;
    g.globalAlpha = warpA;
    wood(X0 - 14, by - 4, COLS * CELL + 28, 7);
    g.globalAlpha = 1;
  }

  // Beams over everything at top and bottom.
  g.globalAlpha = frameA;
  wood(X0 - 30, TOPBEAM - 12, COLS * CELL + 60, 13);
  wood(X0 - 30, BOTTOM + 4, COLS * CELL + 60, 15);
  g.globalAlpha = 1;

  // After the cut: a fringe of warp ends left on top of the cloth.
  if (cut > 0) {
    const top = fellY(ROWS);
    g.strokeStyle = "#bfae8a";
    g.lineWidth = 2;
    g.lineCap = "round";
    const len = 14 * clamp(cut * 1.5);
    for (let c = 0; c < COLS; c++) {
      const x = X0 + c * CELL + CELL / 2;
      g.beginPath();
      g.moveTo(x, top + 1);
      g.lineTo(x + Math.sin(c * 2.3) * 1.5, top - len - (c % 3));
      g.stroke();
    }
  }
}

/* ---------- Layout change, animated (FLIP) ---------- */

function setLoaded(on) {
  const before = loom.getBoundingClientRect();
  document.body.classList.toggle("loading", !on);
  copy.setAttribute("aria-hidden", String(!on));
  const after = loom.getBoundingClientRect();
  if (reduceMotion) return;
  const dx = before.left + before.width / 2 - (after.left + after.width / 2);
  const dy = before.top - after.top;
  loom.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
    { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
}

again.addEventListener("click", () => {
  reset();
  setLoaded(false);
});

/* ---------- Loop ---------- */

let last = performance.now();
reset();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  clock += dt;
  if (!done) {
    // Weave towards what has loaded, never faster than a shuttle can go.
    const target = loaded(clock) * ROWS;
    woven = Math.min(ROWS, woven + Math.min(Math.max(0, target - woven), dt * 16));
    const r = Math.floor(woven);
    if (r > lastRow) { beat = 1; lastRow = r; }
    pctEl.textContent = Math.floor((woven / ROWS) * 100);
    if (woven >= ROWS) { done = clock; pctEl.textContent = 100; }
  } else {
    cut = Math.min(1, cut + dt * 1.2 * (clock - done > 0.35 ? 1 : 0));
    if (cut >= 1 && document.body.classList.contains("loading")) setLoaded(true);
  }
  beat = Math.max(0, beat - dt * 6);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
