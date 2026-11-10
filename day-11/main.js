// Day 11 · Stained Glass
// Scroll the nave and a pointed window assembles from loose pieces of glass,
// lowest pieces first. Keep going and the sun comes round: a band of light
// crosses the glass, the room picks up its colour, and on the stone wall below
// the window's colours land as a soft, skewed spill that drifts with the sun.
// Plain scroll position drives everything through one rAF loop.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = 440, H = 760;
const SPRING = W * Math.sqrt(3) / 2; // an equilateral arch: its apex sits at y = 0

/* ---------- Cutting the glass ---------- */

let seed = 23;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function inside(x, y) {
  if (x < 0 || x > W || y > H) return false;
  if (y >= SPRING) return true;
  return Math.hypot(x, y - SPRING) <= W && Math.hypot(x - W, y - SPRING) <= W;
}
// How far a point is inside the arch, roughly, for the border band.
function depth(x, y) {
  let d = Math.min(x, W - x, H - y);
  if (y < SPRING) d = Math.min(d, W - Math.hypot(x, y - SPRING), W - Math.hypot(x - W, y - SPRING));
  return d;
}

const COLOURS = {
  ruby: [178, 22, 46], amber: [240, 160, 32], cobalt: [31, 63, 168], deep: [22, 40, 112],
  violet: [92, 42, 134], emerald: [29, 138, 78], clear: [214, 228, 238], rose: [214, 72, 92],
};

// Grid of shared, jittered corners: neighbouring pieces fit like real glass.
const CELL = 16;
const NX = Math.ceil(W / CELL) + 1, NY = Math.ceil(H / CELL) + 1;
const corners = [];
for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
  const edge = i === 0 || j === 0 || i === NX || j === NY;
  corners.push([i * CELL + (edge ? 0 : (rand() - 0.5) * 11), j * CELL + (edge ? 0 : (rand() - 0.5) * 11)]);
}
const C = (i, j) => corners[j * (NX + 1) + i];

const ROSE = [W / 2, 290];
function colourAt(x, y) {
  const dr = Math.hypot(x - ROSE[0], y - ROSE[1]);
  if (depth(x, y) < 20) return Math.floor((x + y) / 40) % 2 ? COLOURS.amber : COLOURS.ruby;
  if (dr < 34) return COLOURS.amber;
  if (dr < 70) return COLOURS.ruby;
  if (dr < 132) {
    const a = Math.atan2(y - ROSE[1], x - ROSE[0]);
    const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12);
    const inPetal = Math.abs(((a + Math.PI) / (Math.PI * 2)) * 12 - k - 0.5) < 0.32 && dr > 80;
    return inPetal ? COLOURS.amber : k % 2 ? COLOURS.violet : COLOURS.rose;
  }
  if (dr < 146) return COLOURS.amber;
  if (y > H - 110) return Math.sin(x * 0.04) * 22 + H - 70 < y ? COLOURS.emerald : COLOURS.clear;
  // The field: cobalt, deepening towards the top, with the odd clear pane.
  if (rand() < 0.05) return COLOURS.clear;
  return y < 200 || rand() < 0.35 ? COLOURS.deep : COLOURS.cobalt;
}

const tiles = [];
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const pts = [C(i, j), C(i + 1, j), C(i + 1, j + 1), C(i, j + 1)];
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
  const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  if (!inside(cx, cy)) continue;
  // Pieces on the edge are trimmed to the arch.
  const clipped = pts.map(([x, y]) => {
    if (inside(x, y)) return [x, y];
    let t = 0;
    for (let k = 0; k < 12; k++) {
      const mx = x + (cx - x) * t, my = y + (cy - y) * t;
      if (inside(mx, my)) break;
      t += 1 / 12;
    }
    return [x + (cx - x) * t, y + (cy - y) * t];
  });
  const col = colourAt(cx, cy);
  const v = 0.86 + rand() * 0.28;
  const ang = rand() * Math.PI * 2;
  const dist = 260 + rand() * 520;
  tiles.push({
    cx, cy,
    rel: clipped.map(([x, y]) => [x - cx, y - cy]),
    col: col.map((c) => Math.min(255, c * v)),
    // Where it starts: thrown out of the frame, turned, and lower down.
    fx: Math.cos(ang) * dist,
    fy: Math.abs(Math.sin(ang)) * dist * 0.6 + 260,
    fr: (rand() - 0.5) * 3,
    // Lowest pieces are set first.
    delay: (1 - cy / H) * 0.62 + rand() * 0.08,
    proj: (cx * 0.55 + cy * 0.45) / (W * 0.55 + H * 0.45),
  });
}
document.getElementById("wall").querySelector("p").textContent =
  `${(Math.round(tiles.length / 50) * 50).toLocaleString("en")} pieces of glass, each cut by hand and held in lead. On a clear afternoon the sun crosses it in about an hour.`;

/* ---------- Canvases ---------- */

const win = document.getElementById("window");
const wg = win.getContext("2d");
const spill = document.getElementById("spill");
const sg = spill.getContext("2d");
const stage = document.getElementById("stage");
const nave = document.getElementById("nave");
const wall = document.getElementById("wall");
const hint = document.getElementById("hint");
let dpr = 1;

function size() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const r = win.getBoundingClientRect();
  win.width = Math.round(r.width * dpr);
  win.height = Math.round(r.height * dpr);
  const s = spill.getBoundingClientRect();
  // Drawn small and blurred by CSS: the spill should be soft anyway.
  spill.width = Math.round(s.width * 0.4);
  spill.height = Math.round(s.height * 0.4);
}
size();
addEventListener("resize", size);

/* ---------- Drawing ---------- */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const backOut = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

function shade(col, k) {
  // k < 1 darkens towards unlit glass, k > 1 blows out towards white.
  if (k <= 1) return `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
  const w = Math.min(1, (k - 1) * 0.5);
  return `rgb(${col[0] + (255 - col[0]) * w | 0},${col[1] + (255 - col[1]) * w | 0},${col[2] + (255 - col[2]) * w | 0})`;
}

function poly(g, t, x, y, rot, scale = 1) {
  const c = Math.cos(rot), s = Math.sin(rot);
  g.beginPath();
  t.rel.forEach(([px, py], k) => {
    const X = x + (px * c - py * s) * scale, Y = y + (px * s + py * c) * scale;
    k ? g.lineTo(X, Y) : g.moveTo(X, Y);
  });
  g.closePath();
}

function light(t, sun) {
  // The whole window brightens as the sun comes round; a band of direct
  // light crosses it on the diagonal.
  const c = -0.25 + sun * 1.5;
  const band = Math.exp(-(((t.proj - c) / 0.16) ** 2));
  return 0.36 + 0.46 * smooth(clamp(sun * 2.5)) + 0.5 * band * clamp(sun * 6);
}

function drawWindow(build, sun) {
  const s = win.width / W;
  wg.setTransform(1, 0, 0, 1, 0, 0);
  wg.clearRect(0, 0, win.width, win.height);
  wg.setTransform(s, 0, 0, s, 0, 0);
  wg.lineJoin = "round";
  wg.lineWidth = 2.6;
  wg.strokeStyle = "#0b0907";
  for (const t of tiles) {
    const k = reduceMotion ? 1 : clamp((build - t.delay) / 0.3);
    if (k <= 0) continue;
    const e = backOut(k);
    const x = t.cx + t.fx * (1 - e), y = t.cy + t.fy * (1 - e);
    poly(wg, t, x, y, t.fr * (1 - e));
    wg.globalAlpha = clamp(k * 2.5);
    wg.fillStyle = shade(t.col, light(t, sun) * (0.55 + 0.45 * k));
    wg.fill();
    wg.stroke();
  }
  wg.globalAlpha = 1;
  // The frame: a thick lead outline round the arch once it is all set.
  wg.lineWidth = 7;
  wg.globalAlpha = smooth(clamp((build - 0.85) / 0.15));
  wg.beginPath();
  wg.moveTo(0, H);
  wg.lineTo(0, SPRING);
  wg.arc(W, SPRING, W, Math.PI, Math.PI + Math.PI / 3);
  wg.arc(0, SPRING, W, -Math.PI / 3, 0);
  wg.lineTo(W, H);
  wg.closePath();
  wg.stroke();
  wg.globalAlpha = 1;
}

function drawSpill(sun, built) {
  const w = spill.width, h = spill.height;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, w, h);
  const on = smooth(clamp((sun - 0.2) / 0.3)) * built;
  if (on <= 0) return;
  // The window, thrown onto the wall: stretched, sheared, softened, and
  // drifting right to left as the sun moves.
  const scale = (h * 0.72) / H;
  const x = w * (0.9 - sun * 0.75) - (W * scale) / 2;
  const y = h * 0.12;
  sg.globalAlpha = 0.48 * on;
  sg.setTransform(scale * 1.25, 0, -0.42 * scale, scale, x + H * scale * 0.42, y);
  for (const t of tiles) {
    poly(sg, t, t.cx, t.cy, 0, 1.12);
    const k = 0.6 + light(t, sun) * 0.5;
    const c = t.col.map((v) => v + (255 - v) * 0.45);
    sg.fillStyle = shade(c, Math.min(1, k));
    sg.fill();
  }
  sg.globalAlpha = 1;
}

/* ---------- Scroll ---------- */

let last = -1;
function frame() {
  const nr = nave.getBoundingClientRect();
  const p = clamp(-nr.top / (nr.height - innerHeight));
  const build = clamp(p / 0.6);
  const total = document.documentElement.scrollHeight - innerHeight;
  const g = total > 0 ? scrollY / total : 0;
  // The sun starts once the glass is nearly set and keeps moving down the wall.
  const sun = clamp((g - 0.42) / 0.58);
  const key = `${build.toFixed(4)}|${sun.toFixed(4)}|${win.width}|${spill.width}`;
  if (key !== last) {
    last = key;
    drawWindow(build, sun);
    const wr = wall.getBoundingClientRect();
    if (wr.top < innerHeight) drawSpill(sun, build);
    const glow = 0.5 * smooth(clamp(sun * 2.5));
    stage.style.setProperty("--tint", `rgb(220 120 70 / ${(0.05 + glow * 0.35).toFixed(3)})`);
    hint.style.opacity = p > 0.04 ? 0 : 1;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
