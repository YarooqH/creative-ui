// Day 14 · Flocking Recipe
// A remix of the sticky recipe and the murmuration. The bowl stays pinned
// while the steps scroll past, and every ingredient is a small flock of its
// own colour, swirling beside its step on the usual boid rules plus a pull
// towards the step. As a step crosses the middle of the screen its scroll
// progress peels birds off the flock one by one; each flies to its own place
// in the bowl and settles there. Scroll back up and they lift out and rejoin
// the flock. Everything is drawn on one fixed 2D canvas in a single rAF loop.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("air");
const g = canvas.getContext("2d");
const pin = document.getElementById("pin");
const steps = [...document.querySelectorAll(".step")];

let seed = 14;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------- Ingredients: colour, shape, and where they land ---------- */

const disk = (rMax = 0.92) => {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rMax;
  return [Math.cos(a) * r, Math.sin(a) * r];
};
const KINDS = {
  oats: { colour: "#e9d39a", n: 620, w: 8, h: 5, slot: () => disk(0.93) },
  honey: {
    colour: "#f2a628", n: 260, w: 4.4, h: 4.4, round: true,
    slot: (k, n) => {
      const t = k / n, a = t * Math.PI * 7, r = 0.08 + 0.78 * t;
      return [Math.cos(a) * r + (rand() - 0.5) * 0.03, Math.sin(a) * r + (rand() - 0.5) * 0.03];
    },
  },
  almonds: { colour: "#c4885a", n: 110, w: 12, h: 7, drop: true, slot: () => disk(0.8) },
  seeds: { colour: "#86b86d", n: 170, w: 9, h: 3.6, slot: () => disk(0.86) },
  berries: { colour: "#e0505f", n: 120, w: 5.6, h: 5.6, round: true, slot: () => disk(0.78) },
  coconut: { colour: "#fbf7ee", n: 200, w: 7, h: 2.8, slot: () => disk(0.88) },
};

const flocks = steps.map((el, s) => {
  const key = el.dataset.key, kind = KINDS[key];
  el.style.setProperty("--c", kind.colour);
  const n = kind.n;
  const f = {
    el, kind, n, s,
    num: el.querySelector(".n"),
    to: Number(el.querySelector(".n").dataset.to),
    x: new Float32Array(n), y: new Float32Array(n),
    vx: new Float32Array(n), vy: new Float32Array(n),
    sx: new Float32Array(n), sy: new Float32Array(n), // slot in the bowl, -1..1
    rot: new Float32Array(n), th: new Float32Array(n), shade: new Float32Array(n),
    landed: new Uint8Array(n),
    ax: 0, ay: 0, p: 0,
  };
  for (let i = 0; i < n; i++) {
    const [a, b] = kind.slot(i, n);
    f.sx[i] = a; f.sy[i] = b;
    // The order birds peel off in: honey follows its spiral, the rest at random.
    f.th[i] = key === "honey" ? i / n : rand();
    f.rot[i] = rand() * Math.PI * 2;
    f.shade[i] = 0.82 + rand() * 0.3;
    const ang = rand() * Math.PI * 2;
    f.vx[i] = Math.cos(ang) * 60; f.vy[i] = Math.sin(ang) * 60;
  }
  return f;
});

/* ---------- Canvas and layout ---------- */

let W = 0, H = 0, dpr = 1, mobile = false;
function size() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  mobile = W <= 760;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
size();
addEventListener("resize", size);

function anchorOf(f) {
  const r = f.el.getBoundingClientRect();
  if (mobile) return [W * 0.62, Math.max(r.top + 90, pin.getBoundingClientRect().bottom + 60)];
  const col = f.el.parentElement.getBoundingClientRect();
  return [col.right - 130, r.top + r.height * 0.5];
}

// Start each flock around its step.
for (const f of flocks) {
  const [ax, ay] = anchorOf(f);
  for (let i = 0; i < f.n; i++) {
    const [a, b] = disk(1);
    f.x[i] = ax + a * 70; f.y[i] = ay + b * 50;
  }
}

/* ---------- The bowl ---------- */

function bowlGeom() {
  const r = pin.getBoundingClientRect();
  const R = Math.min(r.width * 0.44, r.height * 0.4);
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R, well: R * 0.8 };
}

function drawBowl(b) {
  const { cx, cy, R, well } = b;
  g.save();
  g.translate(cx, cy);
  // Shadow, terracotta rim, darker glazed well.
  g.fillStyle = "rgb(0 0 0 / 0.28)";
  g.beginPath(); g.ellipse(R * 0.05, R * 0.08, R * 1.02, R * 1.02, 0, 0, Math.PI * 2); g.fill();
  let gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
  gr.addColorStop(0, "#d4703f"); gr.addColorStop(0.75, "#b0532c"); gr.addColorStop(1, "#8f4123");
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  gr = g.createRadialGradient(R * 0.15, R * 0.2, R * 0.05, 0, 0, well);
  gr.addColorStop(0, "#5a2a17"); gr.addColorStop(1, "#3c1b0e");
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, well, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgb(255 210 170 / 0.25)";
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, well + 1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  g.restore();
}

function drawBird(f, i, x, y, scale, rot) {
  const k = f.kind;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  if (k.round) g.arc(0, 0, k.w * 0.5 * scale, 0, Math.PI * 2);
  else if (k.drop) {
    const w = k.w * 0.5 * scale, h = k.h * 0.5 * scale;
    g.moveTo(w, 0);
    g.quadraticCurveTo(0, h * 1.3, -w, 0);
    g.quadraticCurveTo(0, -h * 1.3, w, 0);
  } else g.ellipse(0, 0, k.w * 0.5 * scale, k.h * 0.5 * scale, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/* ---------- Simulation ---------- */

function stepFlock(f, dt, b) {
  const [ax, ay] = anchorOf(f);
  // Scroll moves the page under the flock: carry the flying birds along.
  const dyScroll = f.ay === 0 ? 0 : ay - f.ay;
  f.ax = ax; f.ay = ay;
  const r = f.el.getBoundingClientRect();
  const p = clamp((H * 0.72 - r.top) / (r.height * 0.75));
  f.p = p;
  f.el.classList.toggle("on", p > 0.02 && r.bottom > H * 0.25);
  const visible = r.bottom > -H && r.top < H * 2;

  const { n, x, y, vx, vy } = f;
  const R2 = 20 * 20, RS2 = 9 * 9;
  let landedCount = 0;
  for (let i = 0; i < n; i++) {
    const toBowl = p > 0.12 + f.th[i] * 0.72;
    if (!toBowl) f.landed[i] = 0;
    if (f.landed[i]) { landedCount++; continue; }
    if (!toBowl) y[i] += dyScroll;
    if (!visible && !toBowl) continue;

    let fx = 0, fy = 0;
    if (toBowl) {
      const tx = b.cx + f.sx[i] * b.well, ty = b.cy + f.sy[i] * b.well;
      const dx = tx - x[i], dy = ty - y[i], d = Math.hypot(dx, dy);
      if (d < 1.5 || reduceMotion) { f.landed[i] = 1; landedCount++; continue; }
      // Arrive: fast across the gap, then ease into place.
      let dvx = dx * 4.2, dvy = dy * 4.2;
      const m = Math.hypot(dvx, dvy);
      if (m > 900) { dvx *= 900 / m; dvy *= 900 / m; }
      fx = (dvx - vx[i]) * 9; fy = (dvy - vy[i]) * 9;
    } else {
      let c = 0, sx = 0, sy = 0, svx = 0, svy = 0, ex = 0, ey = 0;
      for (let j = 0; j < n; j++) {
        if (j === i || f.th[j] < 0) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        c++; sx += x[j]; sy += y[j]; svx += vx[j]; svy += vy[j];
        if (d2 < RS2 && d2 > 0.01) { ex -= dx / d2; ey -= dy / d2; }
      }
      if (c) {
        fx += (svx / c - vx[i]) * 1.4 + (sx / c - x[i]) * 1.2 + ex * 420;
        fy += (svy / c - vy[i]) * 1.4 + (sy / c - y[i]) * 1.2 + ey * 420;
      }
      // Tethered to its step, wider than tall, like a small murmuration.
      fx += (ax - x[i]) * 2.2;
      fy += (ay - y[i]) * 4;
    }
    let nvx = vx[i] + fx * dt, nvy = vy[i] + fy * dt;
    const sp = Math.hypot(nvx, nvy);
    const maxS = toBowl ? 900 : 140, minS = toBowl ? 0 : 60;
    if (sp > maxS) { nvx *= maxS / sp; nvy *= maxS / sp; }
    else if (sp < minS && sp > 0.01) { nvx *= minS / sp; nvy *= minS / sp; }
    vx[i] = nvx; vy[i] = nvy;
    x[i] += nvx * dt; y[i] += nvy * dt;
    if (sp > 20) f.rot[i] = Math.atan2(nvy, nvx);
  }
  // The quantity counts up with what has actually landed.
  const v = Math.round((landedCount / n) * f.to);
  if (f.num.textContent !== String(v)) f.num.textContent = v;
}

/* ---------- Loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  const b = bowlGeom();
  for (const f of flocks) stepFlock(f, Math.max(dt, 1 / 240), b);

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (b.cy + b.R > -40 && b.cy - b.R < H + 40) drawBowl(b);
  const sc = b.R / 230;
  // Landed first (in recipe order, so later ingredients sit on top), then flying.
  for (const f of flocks) {
    g.fillStyle = f.kind.colour;
    for (let i = 0; i < f.n; i++) {
      if (!f.landed[i]) continue;
      g.globalAlpha = f.shade[i] > 1 ? 1 : f.shade[i];
      drawBird(f, i, b.cx + f.sx[i] * b.well, b.cy + f.sy[i] * b.well, sc, f.rot[i]);
    }
  }
  for (const f of flocks) {
    g.fillStyle = f.kind.colour;
    for (let i = 0; i < f.n; i++) {
      if (f.landed[i]) continue;
      if (f.y[i] < -20 || f.y[i] > H + 20) continue;
      g.globalAlpha = 1;
      drawBird(f, i, f.x[i], f.y[i], 0.8, f.rot[i]);
    }
  }
  g.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
