// The Long Oak: a cross-section that grows one ring per year as the stats scroll by.
// All sizes in the model are centimetres; the canvas maps them to pixels each frame.

const START = 1811;
const END = 2024;
const N = END - START + 1; // 214 rings
const A = 200; // samples around each ring
const TAU = Math.PI * 2;

const canvas = document.getElementById('wood');
const ctx = canvas.getContext('2d');
const story = document.getElementById('story');
const items = [...document.querySelectorAll('#stats li')];
const yearEl = document.getElementById('year');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const COS = new Float32Array(A);
const SIN = new Float32Array(A);
for (let j = 0; j < A; j++) {
  COS[j] = Math.cos((j / A) * TAU);
  SIN[j] = Math.sin((j / A) * TAU);
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1811);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const idx = (year) => year - START;

// ---- Ring widths: fast early growth to 38 cm across by 1850, then slow, with dry years.
const width = new Float32Array(N);
const DRY = { 1826: 0.5, 1868: 0.45, 1893: 0.5, 1921: 0.4, 1934: 0.55, 1947: 0.45, 1959: 0.5, 1990: 0.55, 1995: 0.5, 2003: 0.5, 2018: 0.5, 2022: 0.45 };
const WET = { 1860: 1.4, 1879: 1.3, 1912: 1.45, 1927: 1.3, 1954: 1.35, 1968: 1.3, 2000: 1.35, 2012: 1.3 };
for (let i = 0; i < N; i++) {
  const y = START + i;
  const base = y <= 1850 ? 0.9 + 0.6 * Math.sin(i * 0.31) * 0.3 + 0.35 * rnd() : (1 - 0.35 * (i / N)) * (0.65 + 0.7 * rnd());
  width[i] = base * (DRY[y] ?? WET[y] ?? 1);
}
width[0] = 0.1; // the acorn's first ring: about a millimetre
const normalise = (from, to, total) => {
  let s = 0;
  for (let i = from; i <= to; i++) s += width[i];
  for (let i = from; i <= to; i++) width[i] *= total / s;
};
normalise(1, idx(1850), 19 - width[0]); // radius 19 cm in 1850
width[idx(1976)] = 0;
normalise(idx(1851), N - 1, 26 - 0.04);
width[idx(1976)] = 0.04; // 0.4 mm

// Tone per ring, so every year reads as its own band.
const tone = new Float32Array(N);
for (let i = 0; i < N; i++) tone[i] = 0.9 + 0.2 * rnd();

// ---- Ring shape: smooth wobble that drifts slowly from ring to ring, a lean, and the storm scar.
const K = 8;
const amp = [], ph = [], drift = [];
for (let k = 1; k <= K; k++) {
  amp.push(0.085 / Math.pow(k, 1.15));
  ph.push(rnd() * TAU);
  drift.push((rnd() - 0.5) * 0.06);
}
const LEAN = 2.4; // the tree leans away from the prevailing wind: wider rings on this side
const SCAR = -Math.PI / 2; // north
const SCAR_I = idx(1903);

const R = new Float32Array(N * A);
for (let j = 0; j < A; j++) {
  const th = (j / A) * TAU;
  let r = 0;
  for (let i = 0; i < N; i++) {
    let shape = 1 + 0.22 * smooth(0, 120, i) * Math.cos(th - LEAN);
    for (let k = 0; k < K; k++) shape += amp[k] * Math.sin((k + 1) * th + ph[k] + i * drift[k]);
    shape = Math.max(0.3, shape);
    if (i >= SCAR_I) {
      const d = angDiff(th, SCAR);
      const heal = Math.pow(clamp(1 - (i - SCAR_I) / 24), 0.8);
      const hole = Math.exp(-Math.pow(d / 0.2, 2));
      const lips = Math.exp(-Math.pow((Math.abs(d) - 0.28) / 0.1, 2)); // woundwood rolls in from both sides
      shape *= Math.max(0.02, 1 - 0.98 * hole * heal) + 0.9 * lips * heal;
    }
    r += width[i] * shape;
    R[i * A + j] = r;
  }
}
let RMAX = 0;
for (let j = 0; j < A; j++) RMAX = Math.max(RMAX, R[(N - 1) * A + j]);

// Bark roughness, oak rays, and a grain texture.
const rough = new Float32Array(A);
{
  const raw = Array.from({ length: A }, () => rnd());
  for (let j = 0; j < A; j++) {
    const v = (raw[j] * 2 + raw[(j + 1) % A] + raw[(j + A - 1) % A]) / 4;
    rough[j] = 0.6 + 0.9 * v + (rnd() < 0.12 ? -0.35 : 0); // fissures
  }
}
const rays = Array.from({ length: 90 }, () => ({ j: rnd() * A, from: 0.04 + 0.7 * rnd() ** 1.5, w: 0.5 + rnd() }));
const grain = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = 110 + rnd() * 90;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
})();

// ---- Colours
const C = {
  sapEarly: [232, 199, 150],
  sapLate: [170, 120, 74],
  heartEarly: [192, 134, 82],
  heartLate: [96, 54, 28],
  bark: '#3a2518',
  barkInner: '#8d5a34',
  cambium: '#e3b27a',
  scar: '#24150c',
  crack: '#1b120d',
  mark: '#a9c76f',
};
const rgb = (a, b, t, k) => `rgb(${(a[0] + (b[0] - a[0]) * t) * k | 0},${(a[1] + (b[1] - a[1]) * t) * k | 0},${(a[2] + (b[2] - a[2]) * t) * k | 0})`;

// ---- Stats: what each one counts, where the tree stands, and what it marks.
const STATS = [
  { from: 1811, to: 1811, year: 1811.0, mark: 'pith' },
  { from: 0, to: 38, year: 1850.999, mark: 'diam', label: '1850' },
  { from: 1850, to: 1903, year: 1903.999, mark: 'scar', label: '1903' },
  { from: 4, to: 0.4, dp: 1, year: 1976.999, mark: 'ring', ring: 1976, label: '1976' },
  { from: 0, to: 214, year: 2024.999, mark: 'count' },
  { from: 0, to: 6100, sep: true, year: 2024.999, mark: 'none' },
];
const nums = items.map((li) => li.querySelector('.num span'));
const fmt = (s, v) => {
  if (s.dp) return v.toFixed(s.dp);
  const n = Math.round(v);
  return s.sep ? n.toLocaleString('en-GB') : String(n);
};

// ---- Canvas sizing
let S = 0, dpr = 1, cx = 0, cy = 0;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  S = Math.round(box.width * dpr);
  canvas.width = canvas.height = S;
  cx = cy = S / 2;
  dirty = true;
}

// Current outer edge (partial ring included) in cm.
const cur = new Float32Array(A);
function ringPath(arr, off, s, grow = 0) {
  ctx.beginPath();
  for (let j = 0; j < A; j++) {
    const r = (arr[off + j] + grow) * s;
    const x = cx + COS[j] * r, y = cy + SIN[j] * r;
    j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function lerpPath(i, t, s) {
  // the boundary between earlywood and latewood inside ring i
  ctx.beginPath();
  const o = i * A, p = (i - 1) * A;
  for (let j = 0; j < A; j++) {
    const inner = i > 0 ? R[p + j] : 0;
    const r = (inner + (R[o + j] - inner) * t) * s;
    const x = cx + COS[j] * r, y = cy + SIN[j] * r;
    j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
const at = (arr, off, j, s) => {
  const jj = ((Math.round(j) % A) + A) % A;
  const r = arr[off + jj] * s;
  return [cx + COS[jj] * r, cy + SIN[jj] * r, r];
};
const jOf = (th) => ((th / TAU) * A + A) % A;

function draw(t, s, k, markA) {
  ctx.clearRect(0, 0, S, S);
  if (t <= 0) return;
  const full = Math.min(N, Math.floor(t));
  const frac = t - full;
  const top = full < N && frac > 0 ? full : full - 1; // outermost ring index drawn
  for (let j = 0; j < A; j++) {
    if (top === full) cur[j] = (full > 0 ? R[(full - 1) * A + j] : 0) + (R[full * A + j] - (full > 0 ? R[(full - 1) * A + j] : 0)) * frac;
    else cur[j] = R[top * A + j];
  }

  // Bark, inner bark, then the cambium line.
  const barkT = Math.min(2.6, 0.2 + 0.016 * t);
  ctx.beginPath();
  for (let j = 0; j < A; j++) {
    const r = (cur[j] + barkT * (1 + (rough[j] - 1) * smooth(2, 40, t))) * s;
    const x = cx + COS[j] * r, y = cy + SIN[j] * r;
    j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = C.bark;
  ctx.fill();
  ringPath(cur, 0, s, barkT * 0.32);
  ctx.fillStyle = C.barkInner;
  ctx.fill();
  ringPath(cur, 0, s, Math.max(0.05, barkT * 0.06));
  ctx.fillStyle = C.cambium;
  ctx.fill();

  // Rings, outside in: latewood band, then the lighter earlywood inside it.
  for (let i = top; i >= 0; i--) {
    const age = t - i;
    const h = smooth(16, 24, age); // sapwood turns to heartwood
    const kk = tone[i] * (0.9 + 0.1 * smooth(0, 40, i)); // the core is a little darker
    if (i === top && top === full) {
      ringPath(cur, 0, s);
      ctx.fillStyle = rgb(C.sapEarly, C.heartEarly, h, kk);
      ctx.fill();
      continue;
    }
    ringPath(R, i * A, s);
    ctx.fillStyle = rgb(C.sapLate, C.heartLate, h, kk);
    ctx.fill();
    lerpPath(i, 0.6, s);
    ctx.fillStyle = rgb(C.sapEarly, C.heartEarly, h, kk);
    ctx.fill();
  }

  const px = RMAXpx(s, cur);
  ctx.save();
  ringPath(cur, 0, s);
  ctx.clip();
  // Rays: oak's silver flecks, running out from the centre.
  if (px > 60) {
    ctx.strokeStyle = `rgba(250,232,200,${0.16 * smooth(60, 160, px)})`;
    for (const ray of rays) {
      const j = Math.floor(ray.j);
      const r1 = cur[j] * s;
      ctx.lineWidth = ray.w * dpr;
      ctx.beginPath();
      ctx.moveTo(cx + COS[j] * r1 * ray.from, cy + SIN[j] * r1 * ray.from);
      ctx.lineTo(cx + COS[j] * r1, cy + SIN[j] * r1);
      ctx.stroke();
    }
  }
  // Grain
  ctx.globalAlpha = 0.5;
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // The storm scar: the dead face the 1903 wound left, buried under later rings.
  if (t > SCAR_I + 0.3) {
    const j0 = jOf(SCAR);
    ctx.strokeStyle = C.scar;
    ctx.lineWidth = 2.6 * dpr;
    ctx.beginPath();
    for (let d = -9; d <= 9; d++) {
      const [x, y] = at(R, (SCAR_I - 1) * A, j0 + d, s);
      d === -9 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // A drying crack, opening as the slice gets big.
  const crack = smooth(130, 200, t);
  if (crack > 0) {
    const jc = 26, th = (jc / A) * TAU;
    const r0 = (cur[jc] + barkT) * s, r1 = r0 * (1 - 0.42 * crack);
    const wob = (u) => Math.sin(u * 37) * 0.004 + Math.sin(u * 11) * 0.006;
    ctx.beginPath();
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const r = r0 + (r1 - r0) * u, a = th - 0.012 * (1 - u) * crack + wob(u);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      u ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let u = 1; u >= -0.0001; u -= 0.05) {
      const r = r0 + (r1 - r0) * u, a = th + 0.012 * (1 - u) * crack + wob(u);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.fillStyle = C.crack;
    ctx.fill();
  }
  ctx.restore();

  // Pith
  ctx.fillStyle = '#4a2c18';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5 * dpr, 0.06 * s), 0, TAU);
  ctx.fill();

  if (markA > 0.01) drawMark(STATS[k], s, markA, px);
}

function RMAXpx(s, arr) {
  let m = 0;
  for (let j = 0; j < A; j += 4) m = Math.max(m, arr[j]);
  return m * s;
}

function label(x0, y0, text, th, outR) {
  const ox = cx + Math.cos(th) * outR, oy = cy + Math.sin(th) * outR;
  const dir = Math.cos(th) >= 0 ? 1 : -1;
  const ex = ox + dir * 14 * dpr;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(ox, oy);
  ctx.lineTo(ex, oy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x0, y0, 3 * dpr, 0, TAU);
  ctx.fill();
  ctx.textAlign = dir > 0 ? 'left' : 'right';
  ctx.fillText(text, ex + dir * 6 * dpr, oy);
}

function drawMark(st, s, a, px) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = C.mark;
  ctx.fillStyle = C.mark;
  ctx.lineWidth = 1.5 * dpr;
  ctx.font = `600 ${17 * dpr}px "Barlow Condensed", sans-serif`;
  ctx.textBaseline = 'middle';
  const outR = px + 28 * dpr;
  const TH = -0.7;
  if (st.mark === 'pith') {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(8 * dpr, px + 8 * dpr), 0, TAU);
    ctx.stroke();
    label(cx + Math.cos(TH) * (px + 8 * dpr), cy + Math.sin(TH) * (px + 8 * dpr), '1811', TH, outR);
  } else if (st.mark === 'diam') {
    const i = idx(1850);
    ctx.lineWidth = 2 * dpr;
    ringPath(R, i * A, s);
    ctx.stroke();
    const [x1, y1] = at(R, i * A, A / 2, s), [x2, y2] = at(R, i * A, 0, s);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.moveTo(x, y - 7 * dpr); ctx.lineTo(x, y + 7 * dpr); }
    ctx.stroke();
    const j = jOf(TH);
    const [lx, ly] = at(R, i * A, j, s);
    label(lx, ly, st.label, TH, outR);
  } else if (st.mark === 'ring') {
    const i = idx(st.ring);
    ctx.lineWidth = 2 * dpr;
    ringPath(R, i * A, s);
    ctx.stroke();
    const [lx, ly] = at(R, i * A, jOf(TH), s);
    label(lx, ly, st.label, TH, outR);
  } else if (st.mark === 'scar') {
    const i = SCAR_I - 1, j0 = jOf(SCAR);
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let d = -14; d <= 14; d++) {
      const [x, y] = at(R, i * A, j0 + d, s);
      d === -14 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const [lx, ly] = at(R, i * A, j0 + 10, s);
    label(lx, ly, st.label, -0.95, outR);
  } else if (st.mark === 'count') {
    // A counting line from pith to bark, ticked every ten years.
    const th = 0.62 + Math.PI, j = jOf(th);
    const [ex, ey] = at(cur, 0, j, s);
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
    const nx = -SIN[Math.round(j) % A], ny = COS[Math.round(j) % A];
    for (let y = 1820; y <= END; y += 10) {
      const [x, yy] = at(R, idx(y) * A, j, s);
      const L = (y % 50 === 0 ? 7 : 4) * dpr;
      ctx.moveTo(x - nx * L, yy - ny * L); ctx.lineTo(x + nx * L, yy + ny * L);
    }
    ctx.stroke();
    label(ex, ey, '2024', th, outR);
  }
  ctx.restore();
}

// ---- Scroll → state, eased each frame.
let D = START - 1 + 0.4, Dt = D; // fractional year: rings grown = D - START + 1
let SC = 0, k = 0, markA = 0, dirty = true;
let last = performance.now();
const fitScale = (t) => {
  // px per cm: early on the seedling is magnified, later the whole stump fits
  let m = 0;
  const i = Math.max(0, Math.min(N - 1, Math.ceil(t) - 1));
  for (let j = 0; j < A; j += 4) m = Math.max(m, R[i * A + j]);
  m = Math.max(m * (t >= 1 ? 1 : clamp(t)), 0.1);
  return (0.42 * S) / Math.max(m + Math.min(2.6, 0.2 + 0.016 * t) * 1.4, 1.2);
};

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  const box = story.getBoundingClientRect();
  const p = clamp(-box.top / (box.height - innerHeight));
  const seg = p * STATS.length;
  const nk = Math.min(STATS.length - 1, Math.floor(seg));
  const lp = clamp(seg - nk);
  const st = STATS[nk];
  const prevYear = nk ? STATS[nk - 1].year : START - 1 + 0.4;
  const g = ease(clamp(lp / 0.6));
  Dt = prevYear + (st.year - prevYear) * g;
  if (nk !== k) { items[k]?.classList.remove('on'); k = nk; markA = 0; }
  items[k].classList.add('on');
  nums[k].textContent = fmt(st, st.from + (st.to - st.from) * g);

  const kf = reduce ? 1 : 1 - Math.exp(-dt * 7);
  const nD = D + (Dt - D) * kf;
  const tgtS = fitScale(nD - START + 1);
  const nS = tgtS; // follows the eased year, so the stump always fits
  const tgtA = clamp((lp - 0.5) / 0.15);
  const nA = markA + (tgtA - markA) * (reduce ? 1 : 1 - Math.exp(-dt * 10));
  if (dirty || Math.abs(nD - D) > 1e-4 || Math.abs(nS - SC) > 1e-4 || Math.abs(nA - markA) > 1e-3) {
    D = nD; SC = nS; markA = nA; dirty = false;
    draw(D - START + 1, SC, k, markA);
    yearEl.textContent = String(clamp(Math.floor(D), START, END));
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
document.fonts.load(`600 17px "Barlow Condensed"`).finally(() => { dirty = true; });
requestAnimationFrame(frame);
