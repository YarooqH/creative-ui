// Day 07 · Colour Board
// A remix of the split-flap departure board and the Itten colour star: the flaps
// carry colours instead of letters, and the "alphabet" each tile flips through is
// Itten's twelve-hue circle. To reach its target a tile turns through the hues in
// between, so every change sweeps a band of neighbouring colours across the board.
// Pictures are drawn on a tiny canvas (one pixel per tile) and snapped to the
// nearest hue. All motion uses the Web Animations API, so the recorder can step it.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const COLS = 24, ROWS = 15;
const BLANK = "#26231f";
// Itten's twelve, clockwise from yellow. Index 12 is a blank (unlit) flap.
const WHEEL = [
  "#f4cf00", "#f6a300", "#ee7a00", "#e2521c", "#d0251f", "#a3215e",
  "#6b2d84", "#3c3b91", "#1f5aa6", "#00857a", "#3c9a3a", "#9cc12b",
];
const ALL = [...WHEEL, BLANK];
const B = 12;

const STEP_MS = 90;
const LAST_MS = 280;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- A colour flap ---------- */

class Flap {
  constructor() {
    this.c = B;
    this.queue = [];
    this.running = false;
    this.el = document.createElement("div");
    this.el.className = "flap";
    this.el.innerHTML = '<i class="t ht"></i><i class="b hb"></i><i class="t lt"></i><i class="b lb"></i>';
    [this.ht, this.hb, this.lt, this.lb] = this.el.children;
    this.paint(B);
  }
  set(node, i) { node.style.setProperty("--c", ALL[i]); }
  paint(i) { this.el.style.setProperty("--c", ALL[i]); for (const n of this.el.children) n.style.removeProperty("--c"); }

  // The hues between here and there, going round the wheel the short way.
  pathTo(t) {
    if (t === this.c) return [];
    if (t === B || this.c === B) {
      // Lighting up or going dark: pass through a couple of hues on the way.
      const from = this.c === B ? (t + 9) % 12 : this.c;
      const to = t === B ? (from + 3) % 12 : t;
      const out = [];
      for (let k = 0; k < 3; k++) out.push((from + k * (to - from + 12) % 12 / 3 | 0) % 12);
      return t === B ? [...out.slice(1), B] : [...out, t];
    }
    let d = (t - this.c + 12) % 12;
    const dir = d <= 6 ? 1 : -1;
    if (dir < 0) d = 12 - d;
    const out = [];
    for (let k = 1; k <= d; k++) out.push((this.c + dir * k + 12) % 12);
    return out;
  }

  flipTo(t, delay) {
    const path = reduceMotion ? [t] : this.pathTo(t);
    if (!path.length) return;
    this.queue = path;
    if (!this.running) this.run(delay);
  }

  async run(delay) {
    this.running = true;
    if (delay) await wait(delay);
    while (this.queue.length) {
      const next = this.queue.shift();
      await this.step(next, this.queue.length === 0);
    }
    this.running = false;
  }

  async step(next, last) {
    const cur = this.c;
    const half = (last ? LAST_MS : STEP_MS) / 2;
    this.set(this.ht, next);
    this.set(this.hb, cur);
    this.set(this.lt, cur);
    this.set(this.lb, next);
    this.lt.style.visibility = "visible";
    this.lb.style.visibility = "visible";

    const fall = this.lt.animate(
      [{ transform: "rotateX(0deg)", filter: "brightness(1)" }, { transform: "rotateX(-90deg)", filter: "brightness(0.55)" }],
      { duration: half, easing: "cubic-bezier(.55,0,1,.6)", fill: "forwards" }
    );
    await fall.finished;
    const frames = last
      ? [
          { transform: "rotateX(90deg)", offset: 0 },
          { transform: "rotateX(0deg)", offset: 0.5, easing: "cubic-bezier(.3,0,.6,1)" },
          { transform: "rotateX(14deg)", offset: 0.7 },
          { transform: "rotateX(0deg)", offset: 0.86 },
          { transform: "rotateX(3deg)", offset: 0.94 },
          { transform: "rotateX(0deg)", offset: 1 },
        ]
      : [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }];
    const rise = this.lb.animate(frames, { duration: last ? half * 2.4 : half, easing: last ? "linear" : "cubic-bezier(0,.4,.45,1)", fill: "forwards" });
    await rise.finished;

    this.c = next;
    this.paint(next);
    this.lt.style.visibility = "hidden";
    this.lb.style.visibility = "hidden";
    for (const a of this.el.getAnimations({ subtree: true })) a.cancel();
  }
}

/* ---------- Pictures ---------- */

const cv = document.createElement("canvas");
cv.width = COLS;
cv.height = ROWS;
const cx = cv.getContext("2d", { willReadFrequently: true });

function nearest(r, g, b, a) {
  if (a < 100) return B;
  let best = B, bd = Infinity;
  WHEEL.forEach((h, i) => {
    const R = parseInt(h.slice(1, 3), 16), G = parseInt(h.slice(3, 5), 16), Bl = parseInt(h.slice(5, 7), 16);
    const d = (R - r) ** 2 + (G - g) ** 2 + (Bl - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function read() {
  const d = cx.getImageData(0, 0, COLS, ROWS).data;
  const out = [];
  for (let i = 0; i < COLS * ROWS; i++) out.push(nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]));
  return out;
}
const clear = () => cx.clearRect(0, 0, COLS, ROWS);

// Each picture is a list of tile indices (0–11 hue, 12 blank).
const PICTURES = [
  {
    name: "Star",
    draw() {
      // Itten's star, drawn large and sampled at each tile's centre:
      // a rim of twelve, three secondaries on the primary triangle's edges.
      const S = 10, R = ROWS * S / 2;
      const big = document.createElement("canvas");
      big.width = COLS * S; big.height = ROWS * S;
      const g = big.getContext("2d", { willReadFrequently: true });
      g.translate(big.width / 2, big.height / 2);
      const pt = (deg, r) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
      const ang = (i) => -90 + i * 30;
      WHEEL.forEach((c, i) => {
        g.beginPath();
        g.arc(0, 0, R * 0.98, ((ang(i) - 15) * Math.PI) / 180, ((ang(i) + 15) * Math.PI) / 180);
        g.arc(0, 0, R * 0.7, ((ang(i) + 15) * Math.PI) / 180, ((ang(i) - 15) * Math.PI) / 180, true);
        g.fillStyle = c;
        g.fill();
      });
      const rc = R * 0.6, V = (i) => pt(ang(i), rc);
      const tri = (pts, c) => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(...p) : g.moveTo(...p))); g.fillStyle = c; g.fill(); };
      tri([V(0), V(2), V(4)], WHEEL[2]);
      tri([V(4), V(6), V(8)], WHEEL[6]);
      tri([V(8), V(10), V(0)], WHEEL[10]);
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      tri([[0, 0], mid(V(0), V(8)), V(0), mid(V(0), V(4))], WHEEL[0]);
      tri([[0, 0], mid(V(0), V(4)), V(4), mid(V(4), V(8))], WHEEL[4]);
      tri([[0, 0], mid(V(4), V(8)), V(8), mid(V(8), V(0))], WHEEL[8]);
      const d = g.getImageData(0, 0, big.width, big.height).data;
      const out = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const k = ((y * S + S / 2) * big.width + (x * S + S / 2)) * 4;
        out.push(nearest(d[k], d[k + 1], d[k + 2], d[k + 3]));
      }
      return out;
    },
  },
  {
    name: "Pairs",
    draw() {
      // Diagonal bands of complementary pairs.
      const out = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const band = Math.floor((x + y) / 3);
        const pair = Math.floor(band / 2) % 6;
        out.push(band % 2 ? (pair + 6) % 12 : pair);
      }
      return out;
    },
  },
  {
    name: "Flip",
    draw() {
      // The word, in hues that run round the wheel from left to right.
      clear();
      const grad = cx.createLinearGradient(0, 0, COLS, 0);
      [0, 2, 4, 6, 8, 10].forEach((i, k) => grad.addColorStop(k / 5, WHEEL[i]));
      cx.fillStyle = grad;
      cx.font = `800 ${ROWS * 1.02}px "Big Shoulders Display", Impact, sans-serif`;
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText("FLIP", COLS / 2, ROWS / 2 + 1);
      return read();
    },
  },
  {
    name: "Spectrum",
    draw() {
      // Columns of the full circle, darkest to lightest down the board.
      const out = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) out.push(Math.floor((x / COLS) * 12 + y * 0.35) % 12);
      return out;
    },
  },
];

/* ---------- Board ---------- */

const board = document.getElementById("board");
const now = document.getElementById("now");
const flaps = [];
for (let i = 0; i < COLS * ROWS; i++) {
  const f = new Flap();
  flaps.push(f);
  board.appendChild(f.el);
}

let current = -1;
function show(n, origin) {
  current = (n + PICTURES.length) % PICTURES.length;
  const pic = PICTURES[current];
  const tiles = pic.draw();
  now.textContent = pic.name;
  // A ripple from the origin tile (or from the left edge) across the board.
  const [ox, oy] = origin || [-4, ROWS / 2];
  flaps.forEach((f, i) => {
    const x = i % COLS, y = Math.floor(i / COLS);
    const d = Math.hypot(x - ox, (y - oy) * 1.2);
    f.flipTo(tiles[i], reduceMotion ? 0 : d * 38 + ((x * 7 + y * 13) % 5) * 12);
  });
}

document.getElementById("next").addEventListener("click", () => show(current + 1));
board.addEventListener("click", (e) => {
  const r = board.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * COLS;
  const y = ((e.clientY - r.top) / r.height) * ROWS;
  show(current + 1, [x, y]);
});

// Start once the display font is in, since one picture is drawn with it.
document.fonts.load('800 20px "Big Shoulders Display"').finally(() => setTimeout(() => show(0), 400));
