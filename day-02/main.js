// Day 02 · Orbit Nav
// The nav links are moons on tilted elliptical orbits around the page's title.
// They ride a CSS offset-path; JS sets offset-distance each frame, so speed can change:
// orbits speed up as the cursor comes near and stop dead when you catch a label.
// Labels on the far side of an orbit shrink, dim, blur and pass behind the word.
// Every motion runs on requestAnimationFrame / performance.now or WAAPI, so the
// recorder can step it frame by frame.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG = "http://www.w3.org/2000/svg";

const PAGES = {
  Lumen: "A studio for type in motion",
  Work: "Selected projects, 2019 to now",
  Studio: "Nine people, one long table",
  Journal: "Notes on making things move",
  Shop: "Prints, type and small objects",
  Contact: "Say hello, we read everything",
  Archive: "Everything we kept",
};

// Two moons per orbit, half an orbit apart. `period` is seconds per lap at rest.
const ORBITS = [
  { period: 26, phase: 0.08, labels: ["Work", "Journal"] },
  { period: 38, phase: 0.31, labels: ["Studio", "Shop"] },
  { period: 54, phase: 0.62, labels: ["Contact", "Archive"] },
];

const system = document.getElementById("system");
const backSvg = document.getElementById("orbitsBack");
const frontSvg = document.getElementById("orbitsFront");
const moonsEl = document.getElementById("moons");
const wordEl = document.getElementById("word");
const subEl = document.getElementById("sub");
const hintEl = document.getElementById("hint");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const ramp = (t, a, b) => smooth(clamp((t - a) / (b - a), 0, 1));

/* ---------- Geometry ---------- */

let W = 0, H = 0, cx = 0, cy = 0;

function layout() {
  W = system.clientWidth;
  H = system.clientHeight;
  cx = W / 2;
  cy = H / 2;
  const portrait = W / H < 0.8;
  ORBITS.forEach((o, i) => {
    if (portrait) {
      // Narrow screens: rounder rings seen from higher up, so the labels fit.
      o.rx = W * [0.33, 0.37, 0.41][i];
      o.ry = o.rx * [0.5, 0.64, 0.78][i];
      o.tilt = [-14, 10, -4][i];
    } else {
      const base = Math.min(W, H * 1.7);
      o.rx = base * [0.31, 0.39, 0.47][i];
      o.ry = o.rx * [0.27, 0.27, 0.29][i];
      o.tilt = [-9, 6, -3][i];
    }
    o.rad = (o.tilt * Math.PI) / 180;
    o.cos = Math.cos(o.rad);
    o.sin = Math.sin(o.rad);
  });
  buildOrbits();
}

// A point on the tilted ellipse at parametric angle t.
function at(o, t) {
  const x = o.rx * Math.cos(t), y = o.ry * Math.sin(t);
  return [cx + x * o.cos - y * o.sin, cy + x * o.sin + y * o.cos];
}

// The same ellipse as path data: two arcs, starting at t = 0. Positive sweep runs
// right, then towards the viewer (down), then left, then away (up).
function pathData(o) {
  const [x0, y0] = at(o, 0), [x1, y1] = at(o, Math.PI);
  const f = (n) => n.toFixed(2);
  return `M ${f(x0)} ${f(y0)} A ${f(o.rx)} ${f(o.ry)} ${o.tilt} 1 1 ${f(x1)} ${f(y1)} A ${f(o.rx)} ${f(o.ry)} ${o.tilt} 1 1 ${f(x0)} ${f(y0)} Z`;
}

function el(tag, attrs, parent) {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.appendChild(n);
  return n;
}

// Each orbit is drawn twice: its far half under the word, its near half over it,
// so the rings cut across the title like a planet's.
function buildOrbits() {
  backSvg.replaceChildren();
  frontSvg.replaceChildren();
  ORBITS.forEach((o, i) => {
    for (const [svg, side] of [[backSvg, "back"], [frontSvg, "front"]]) {
      const defs = el("defs", {}, svg);
      const clip = el("clipPath", { id: `c-${side}-${i}`, clipPathUnits: "userSpaceOnUse" }, defs);
      const pad = 40;
      el("rect", {
        x: cx - o.rx - pad,
        y: side === "front" ? cy : cy - o.ry - pad,
        width: 2 * (o.rx + pad),
        height: o.ry + pad,
      }, clip);
      const g = el("g", { transform: `rotate(${o.tilt} ${cx} ${cy})` }, svg);
      const e = el("ellipse", {
        cx, cy, rx: o.rx, ry: o.ry, pathLength: 1,
        "clip-path": `url(#c-${side}-${i})`,
      }, g);
      if (side === "back") o.backLine = e; else o.frontLine = e;
    }
    // Hidden path used to read exact points along the offset-path.
    o.d = pathData(o);
    o.probe = el("path", { d: o.d, fill: "none", stroke: "none" }, backSvg);
    o.length = o.probe.getTotalLength();
    o.moons?.forEach((m) => (m.el.style.offsetPath = `path("${o.d}")`));
  });
  drawLines(drawn);
}

let drawn = reduceMotion ? 1 : 0;
function drawLines(p) {
  drawn = p;
  for (const o of ORBITS) {
    for (const line of [o.backLine, o.frontLine]) {
      if (!line) continue;
      line.style.strokeDasharray = "1 1";
      line.style.strokeDashoffset = String(1 - p);
    }
  }
}

/* ---------- Moons ---------- */

ORBITS.forEach((o, oi) => {
  o.speed = reduceMotion ? 0 : 6; // flung in fast, settles to 1
  o.progress = o.phase;
  o.moons = o.labels.map((label, k) => {
    const b = document.createElement("button");
    b.className = "moon";
    b.type = "button";
    b.textContent = label;
    moonsEl.appendChild(b);
    const m = { el: b, orbit: o, offset: k / o.labels.length, order: oi * 2 + k, x: 0, y: 0, held: false };
    b.addEventListener("pointerenter", () => (m.held = true));
    b.addEventListener("pointerleave", () => (m.held = false));
    b.addEventListener("focus", () => (m.held = true));
    b.addEventListener("blur", () => (m.held = false));
    b.addEventListener("click", () => land(m));
    return m;
  });
});
const allMoons = ORBITS.flatMap((o) => o.moons);

/* ---------- Title swap ---------- */

let current = "Lumen";

function setWord(text, animate) {
  wordEl.setAttribute("aria-label", text);
  const chars = [...text].map((c, i) => {
    const s = document.createElement("span");
    s.className = "ch";
    s.textContent = c;
    s.setAttribute("aria-hidden", "true");
    if (animate) {
      s.animate(
        [
          { transform: "translateY(55%) rotate(6deg)", opacity: 0, filter: "blur(8px)" },
          { transform: "translateY(-4%) rotate(0deg)", opacity: 1, filter: "blur(0px)", offset: 0.7 },
          { transform: "none", opacity: 1, filter: "blur(0px)" },
        ],
        { duration: 760, delay: 140 + i * 45, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" },
      );
    }
    return s;
  });
  wordEl.replaceChildren(...chars);
}

let landing = false;
async function land(m) {
  if (landing) return;
  const next = m.el.textContent;
  if (next === current) return;
  landing = true;
  const old = current;
  current = next;

  // The old title is pulled up and away, letter by letter.
  if (!reduceMotion) {
    const outs = [...wordEl.children].map((s, i) =>
      s.animate(
        [{ transform: "none", opacity: 1, filter: "blur(0px)" },
         { transform: "translateY(-45%) scale(.92)", opacity: 0, filter: "blur(10px)" }],
        { duration: 380, delay: i * 30, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
      ),
    );
    subEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    await Promise.all(outs.map((a) => a.finished));
  }

  setWord(next, !reduceMotion);
  subEl.textContent = PAGES[next];
  if (!reduceMotion) {
    subEl.getAnimations().forEach((a) => a.cancel());
    subEl.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 500, delay: 420, easing: "ease-out", fill: "backwards" });
  }

  // The old title becomes the moon that was clicked.
  m.el.textContent = old;
  if (!reduceMotion) {
    m.el.animate([{ scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1 }],
      { duration: 520, easing: "cubic-bezier(.3,1.4,.5,1)", composite: "add" });
  }
  landing = false;
}

/* ---------- Pointer ---------- */

let px = -1e4, py = -1e4;
addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { px = py = -1e4; });

/* ---------- Frame loop ---------- */

let start = null, last = null;

function frame(now) {
  if (start === null) start = last = now;
  const t = (now - start) / 1000;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!reduceMotion) {
    drawLines(ramp(t, 0.1, 1.6));
    hintEl.style.opacity = ramp(t, 2.2, 3.0);
  }

  const box = system.getBoundingClientRect();
  const lx = px - box.left, ly = py - box.top;

  for (const o of ORBITS) {
    // Gravity: the nearer the cursor is to one of this orbit's moons, the faster it runs.
    let pull = 0, held = false;
    for (const m of o.moons) {
      const d = Math.hypot(m.x - lx, m.y - ly);
      pull = Math.max(pull, Math.exp(-((d / 210) ** 2)));
      held ||= m.held;
    }
    const target = reduceMotion ? 0 : held ? 0 : 1 + 2.6 * pull;
    const rate = held ? 14 : t < 2.4 ? 1.6 : 3.2; // catch hard, release softly
    o.speed += (target - o.speed) * (1 - Math.exp(-dt * rate));
    o.progress = (o.progress + (o.speed * dt) / o.period) % 1;

    const hot = held || pull > 0.75;
    o.backLine?.classList.toggle("hot", hot);
    o.frontLine?.classList.toggle("hot", hot);

    for (const m of o.moons) {
      const p = (o.progress + m.offset) % 1;
      m.el.style.offsetDistance = `${(p * 100).toFixed(3)}%`;

      // Depth from where the moon sits on its tilted ellipse: +1 nearest, -1 farthest.
      const pt = o.probe.getPointAtLength(p * o.length);
      m.x = pt.x; m.y = pt.y;
      const localY = -(pt.x - cx) * o.sin + (pt.y - cy) * o.cos;
      const depth = clamp(localY / o.ry, -1, 1);
      const near = (depth + 1) / 2;

      const intro = reduceMotion ? 1 : ramp(t, 0.7 + m.order * 0.12, 1.5 + m.order * 0.12);
      const scale = 0.62 + 0.5 * near;
      const blur = Math.max(0, -depth) * 2.8;
      m.el.style.transform = `scale(${(scale * (0.6 + 0.4 * intro)).toFixed(3)})`;
      m.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
      m.el.style.opacity = ((0.38 + 0.62 * near) * intro).toFixed(3);
      m.el.classList.toggle("back", depth < 0);
      m.el.classList.toggle("hot", m.held);
    }
  }

  requestAnimationFrame(frame);
}

/* ---------- Start ---------- */

setWord(current, !reduceMotion);
subEl.textContent = PAGES[current];
if (!reduceMotion) {
  subEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 600, fill: "backwards" });
} else {
  hintEl.style.opacity = 1;
}
layout();
addEventListener("resize", layout);
document.fonts.ready.then(() => requestAnimationFrame(frame));
