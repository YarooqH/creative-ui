// Constellation Mark: one set of stars, five shapes. Scrolling springs the stars from shape to
// shape along gentle arcs, while the old lines rub out and the new ones draw themselves in.

const NS = 'http://www.w3.org/2000/svg';
const N = 10; // every shape is padded to the same number of stars
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Positions sit in a ±100 box, y down. m is the star's radius.
const SHAPES = [
  {
    name: 'Lodestar', note: 'Scroll the sky',
    stars: [[0, 0, 4.6], [0, -104, 2.6], [19, -19, 1.5], [80, 0, 2.3], [19, 19, 1.5], [0, 104, 2.6], [-19, 19, 1.5], [-80, 0, 2.3], [-19, -19, 1.5]],
    edges: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 1], [0, 2, 1], [0, 4, 1], [0, 6, 1], [0, 8, 1]],
    poly: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    name: 'Cassiopeia', note: 'RA 1h  ·  Dec +60°  ·  5 stars',
    stars: [[-98, -22, 3.0], [-50, 34, 3.4], [-4, -6, 3.8], [44, 30, 3.0], [96, -36, 3.2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: 'Cygnus', note: 'RA 20h 37m  ·  Dec +42°  ·  8 stars',
    stars: [[0, -98, 4.2], [0, -22, 3.4], [2, 34, 2.2], [4, 96, 3.0], [-48, -6, 2.8], [-90, 22, 2.0], [48, -42, 2.8], [86, -66, 2.0]],
    edges: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [1, 6], [6, 7]],
  },
  {
    name: 'Orion', note: 'RA 5h 35m  ·  Dec +5°  ·  9 stars',
    stars: [[-46, -72, 4.2], [42, -62, 3.2], [-2, -100, 2.0], [-20, 2, 3.0], [0, -4, 3.0], [20, -10, 3.0], [-40, 80, 3.0], [52, 84, 4.4], [2, 36, 1.8]],
    edges: [[2, 0], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7], [4, 8, 1]],
  },
  {
    name: 'The Plough', note: 'RA 11h 18m  ·  Dec +55°  ·  7 stars',
    stars: [[-100, -34, 3.4], [-62, -14, 3.4], [-30, -4, 3.6], [6, 2, 2.4], [14, 44, 3.2], [84, 38, 3.4], [80, -14, 3.8]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: 'Lodestar', note: 'Every mark has a north',
    copyOf: 0,
  },
];

// ---- Pad each shape to N stars. A padding star has no size and hides on a line midpoint,
// so it can quietly appear or vanish in place.
for (const s of SHAPES) {
  if (s.copyOf !== undefined) continue;
  s.stars = s.stars.map(([x, y, m]) => ({ x, y, m }));
  let e = 0;
  while (s.stars.length < N) {
    const [a, b] = s.edges[e++ % s.edges.length];
    const A = s.stars[a], B = s.stars[b];
    s.stars.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, m: 0 });
  }
}

// ---- Match each shape's stars to the previous shape's, so every star takes the shortest
// overall route (Hungarian algorithm) and nothing crosses over or twists.
function hungarian(cost) {
  const n = cost.length, INF = 1e18;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const rowToCol = new Array(n);
  for (let j = 1; j <= n; j++) rowToCol[p[j] - 1] = j - 1;
  return rowToCol;
}
for (let k = 1; k < SHAPES.length; k++) {
  const s = SHAPES[k];
  if (s.copyOf !== undefined) {
    // the closing logo matches the Plough too, so its stars come home by the shortest way
    const src = SHAPES[s.copyOf];
    s.stars = src.stars.map((t) => ({ ...t }));
    s.edges = src.edges.map((e) => [...e]);
    s.poly = src.poly ? [...src.poly] : null;
  }
  const prev = SHAPES[k - 1].stars;
  const cost = prev.map((a) => s.stars.map((b) => {
    const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    return d + (a.m === 0) * 900 + (b.m === 0) * 900; // prefer real stars to travel to real stars
  }));
  const order = hungarian(cost); // prev star i -> new star order[i]
  const newIndex = new Array(N);
  order.forEach((col, i) => { newIndex[col] = i; });
  s.stars = order.map((col) => s.stars[col]);
  s.edges = s.edges.map(([a, b, thin]) => [newIndex[a], newIndex[b], thin]);
  if (s.poly) s.poly = s.poly.map((i) => newIndex[i]);
}

// ---- Build the SVG
const svg = document.getElementById('chart');
const gStars = document.getElementById('stars');
const gLines = document.getElementById('lines');
const gDust = document.getElementById('dust');
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
};

// Faint background stars, spread well past the chart so they fill the screen.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20);
for (let i = 0; i < 220; i++) {
  const r = 30 + Math.sqrt(rnd()) * 420, a = rnd() * Math.PI * 2;
  el('circle', { cx: (Math.cos(a) * r).toFixed(1), cy: (Math.sin(a) * r * 0.7).toFixed(1), r: (0.25 + rnd() ** 3 * 0.9).toFixed(2), opacity: (0.18 + rnd() * 0.3).toFixed(2) }, gDust);
}

const poly = el('path', { 'fill-opacity': 0, stroke: 'none' }, gLines);
poly.style.fill = '#d2a440';
const lineSets = SHAPES.map((s) => s.edges.map(([a, b, thin]) => ({ a, b, node: el('line', { class: thin ? 'thin' : '' }, gLines) })));
const stars = Array.from({ length: N }, (_, i) => ({
  halo: el('circle', { class: 'halo', r: 0 }, gStars),
  dot: el('circle', { r: 0 }, gStars),
  x: 0, y: 0, px: 0, py: 0, phase: i * 1.7,
}));

// ---- Caption: letters drop out and the next name rises in.
const nameEl = document.getElementById('name');
const noteEl = document.getElementById('coord');
let shown = -1, swapTimer = 0;
function setName(k) {
  if (k === shown) return;
  const first = shown === -1;
  shown = k;
  clearTimeout(swapTimer);
  const old = [...nameEl.children];
  old.forEach((c, i) => { c.style.transitionDelay = `${i * 14}ms`; c.classList.add('out'); });
  swapTimer = setTimeout(() => {
    const text = SHAPES[k].name;
    nameEl.textContent = '';
    nameEl.setAttribute('aria-label', text);
    const chars = [...text].map((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch out';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.transitionDelay = `${i * 28}ms`;
      nameEl.appendChild(s);
      return s;
    });
    noteEl.textContent = SHAPES[k].note;
    requestAnimationFrame(() => requestAnimationFrame(() => chars.forEach((c) => c.classList.remove('out'))));
  }, first ? 0 : 220 + old.length * 14);
}

// ---- Pointer: stars lean away from the cursor a little.
const ptr = { x: 1e4, y: 1e4 };
addEventListener('pointermove', (e) => {
  const m = svg.getScreenCTM();
  if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  ptr.x = p.x; ptr.y = p.y;
});
addEventListener('pointerleave', () => { ptr.x = ptr.y = 1e4; });

// ---- Motion
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sky = document.getElementById('sky');
const last = SHAPES.length - 1;
let U = 0, V = 0, then = performance.now();

function frame(now) {
  const dt = clamp((now - then) / 1000, 0, 0.05);
  then = now;
  const t = now / 1000;
  const box = sky.getBoundingClientRect();
  const target = clamp(-box.top / (box.height - innerHeight)) * last;
  if (reduce) { U = target; V = 0; } else {
    // a soft spring, so each shape settles with a small overshoot
    V += (target - U) * 70 * dt;
    V *= Math.exp(-dt * 12);
    U += V * dt;
  }
  const uu = clamp(U, 0, last);
  const k = Math.min(last - 1, Math.floor(uu));
  const f = uu - k;
  const m = smooth(0.2, 0.8, f);
  const e = ease(m);
  const A = SHAPES[k].stars, B = SHAPES[k + 1].stars;

  for (let i = 0; i < N; i++) {
    const a = A[i], b = B[i], s = stars[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const arc = Math.sin(Math.PI * e) * 0.16;
    let x = a.x + dx * e - dy * arc;
    let y = a.y + dy * e + dx * arc;
    // drift: the mark breathes a little even at rest
    x += Math.sin(t * 0.8 + s.phase) * 0.9;
    y += Math.cos(t * 0.7 + s.phase * 1.3) * 0.9;
    const qx = x - ptr.x, qy = y - ptr.y, q = Math.hypot(qx, qy);
    const push = q < 48 ? (1 - q / 48) ** 2 * 10 : 0;
    s.px += ((q ? (qx / q) * push : 0) - s.px) * clamp(dt * 8);
    s.py += ((q ? (qy / q) * push : 0) - s.py) * clamp(dt * 8);
    s.x = x + s.px; s.y = y + s.py;
    const mag = a.m + (b.m - a.m) * e;
    const r = mag * (1 + 0.07 * Math.sin(t * 2.3 + s.phase * 2));
    s.dot.setAttribute('cx', s.x.toFixed(2));
    s.dot.setAttribute('cy', s.y.toFixed(2));
    s.dot.setAttribute('r', Math.max(0, r).toFixed(2));
    const halo = smooth(3.3, 4.3, mag);
    s.halo.setAttribute('cx', s.x.toFixed(2));
    s.halo.setAttribute('cy', s.y.toFixed(2));
    s.halo.setAttribute('r', (r + 3.2 + Math.sin(t * 1.6 + s.phase) * 0.5).toFixed(2));
    s.halo.setAttribute('opacity', (halo * 0.7).toFixed(2));
  }

  // Lines: the old set rubs out as the stars leave, the new set draws in once they land.
  lineSets.forEach((set, j) => {
    const frac = j === k ? 1 - smooth(0, 0.3, f) : j === k + 1 ? smooth(0.7, 0.98, f) : 0;
    for (const L of set) {
      if (frac <= 0.001) { L.node.style.display = 'none'; continue; }
      L.node.style.display = '';
      const sa = stars[L.a], sb = stars[L.b];
      // stop the line short of each star so dots read clearly
      const dx = sb.x - sa.x, dy = sb.y - sa.y, len = Math.hypot(dx, dy) || 1;
      const ra = Math.max(SHAPES[j].stars[L.a].m, 1) + 3, rb = Math.max(SHAPES[j].stars[L.b].m, 1) + 3;
      const x1 = sa.x + (dx / len) * ra, y1 = sa.y + (dy / len) * ra;
      const x2 = sb.x - (dx / len) * rb, y2 = sb.y - (dy / len) * rb;
      const l = Math.max(0, len - ra - rb);
      L.node.setAttribute('x1', x1.toFixed(2)); L.node.setAttribute('y1', y1.toFixed(2));
      L.node.setAttribute('x2', x2.toFixed(2)); L.node.setAttribute('y2', y2.toFixed(2));
      L.node.setAttribute('stroke-dasharray', `${l.toFixed(2)} ${(l + 1).toFixed(2)}`);
      L.node.setAttribute('stroke-dashoffset', (l * (1 - frac)).toFixed(2));
    }
  });

  // The logo's body: a pale ink fill that only exists while the stars are in mark formation.
  const logoK = SHAPES[k].poly ? k : SHAPES[k + 1].poly ? k + 1 : -1;
  if (logoK >= 0) {
    const fill = logoK === k ? 1 - smooth(0, 0.25, f) : smooth(0.8, 1, f);
    poly.setAttribute('d', 'M' + SHAPES[logoK].poly.map((i) => `${stars[i].x.toFixed(2)},${stars[i].y.toFixed(2)}`).join('L') + 'Z');
    poly.setAttribute('fill-opacity', (fill * 0.42).toFixed(3));
  } else poly.setAttribute('fill-opacity', 0);

  gDust.setAttribute('transform', `rotate(${(uu * 7).toFixed(2)})`);
  setName(Math.round(uu));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
