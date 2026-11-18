// Day 05 · Sticky Recipe
// The bowl is pinned (position: sticky) while the steps scroll past. Each step's
// scroll progress is scrubbed into its ingredient: flour falls in grain by grain,
// sugar scatters, eggs drop, milk spreads, butter lands, and the whisk turns it all
// into batter. The monospace quantity on each step counts up with the same progress.
// Everything runs off requestAnimationFrame, so the recorder can step it.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NS = "http://www.w3.org/2000/svg";
const contents = document.getElementById("contents");
const steps = [...document.querySelectorAll(".step")];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function el(tag, attrs, parent = contents) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent.appendChild(n);
  return n;
}

// Seeded random, so the heap looks the same every visit (and in the recording).
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

/* ---------- Ingredients ---------- */

const layers = {};

// Flour: a heap of soft grains that fall in one after another.
{
  const g = el("g", {});
  // A soft base under the grains so the heap reads as one mound.
  const base = el("ellipse", { cx: -38, cy: 30, rx: 0, ry: 0, fill: "#efe6d3" }, g);
  const grains = [];
  for (let i = 0; i < 280; i++) {
    const a = rnd() * Math.PI * 2, r = Math.abs(gauss()) * 128;
    const x = -38 + Math.cos(a) * r * 1.1, y = 24 + Math.sin(a) * r * 0.9;
    const near = 1 - r / 150;
    const c = el("circle", {
      r: (3 + rnd() * 4 + near * near * 14).toFixed(1),
      fill: near > 0.45 ? "#fbf6ec" : rnd() > 0.5 ? "#f4ecdc" : "#ebe0cb",
    }, g);
    grains.push({ c, x, y, d: (1 - near) * 0.35 + rnd() * 0.4 });
  }
  // Grains nearest the centre land last, on top.
  grains.sort((p, q) => q.d - p.d).forEach((o) => g.appendChild(o.c));
  layers.flour = (p) => {
    const b = easeOut(clamp((p - 0.2) / 0.6));
    base.setAttribute("rx", (b * 112).toFixed(1));
    base.setAttribute("ry", (b * 92).toFixed(1));
    for (const o of grains) {
      const t = clamp((p - o.d) / 0.25);
      const e = easeOut(t);
      o.c.setAttribute("cx", o.x.toFixed(1));
      o.c.setAttribute("cy", (o.y - (1 - e) * 340).toFixed(1));
      o.c.setAttribute("opacity", t > 0 ? Math.min(1, t * 3).toFixed(2) : 0);
    }
  };
}

// Sugar: fine crystals scattered from the top right.
{
  const g = el("g", {});
  const xs = [];
  for (let i = 0; i < 120; i++) {
    const x = 60 + gauss() * 70, y = -40 + gauss() * 60;
    const c = el("rect", {
      width: 4.5, height: 4.5, rx: 1,
      fill: "#ffffff", stroke: "#b9c4d6", "stroke-width": 0.8,
    }, g);
    xs.push({ c, x, y, d: rnd() * 0.65, spin: rnd() * 90 });
  }
  layers.sugar = (p) => {
    for (const o of xs) {
      const t = clamp((p - o.d) / 0.3);
      const e = easeOut(t);
      const x = o.x + (1 - e) * 120, y = o.y - (1 - e) * 220;
      o.c.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(o.spin + e * 140).toFixed(0)})`);
      o.c.setAttribute("opacity", t > 0 ? 1 : 0);
    }
  };
}

// Milk: a pool that spreads out from where it is poured, under the eggs.
{
  const pool = el("circle", { cx: 14, cy: -6, r: 0, fill: "#fdfbf7", opacity: 0.86 });
  const sheen = el("circle", { cx: -20, cy: -40, r: 0, fill: "#ffffff", opacity: 0.5 });
  layers.milk = (p) => {
    const e = easeIO(clamp(p));
    pool.setAttribute("r", (e * 205).toFixed(1));
    sheen.setAttribute("r", (e * 60).toFixed(1));
  };
}

// Eggs: two dropped into a well.
{
  const eggs = [
    { x: 18, y: 36, d: 0 },
    { x: -52, y: -32, d: 0.35 },
  ].map((o) => {
    const g = el("g", {});
    el("path", { d: "M-46,4C-48,-28,-14,-46,12,-40C40,-34,50,-8,42,16C34,40,4,48,-18,40C-36,34,-45,22,-46,4Z", fill: "#fffaf0", opacity: 0.96 }, g);
    el("circle", { r: 22, fill: "#f3a313" }, g);
    el("circle", { r: 22, fill: "none", stroke: "#de8a05", "stroke-width": 2, opacity: 0.6 }, g);
    el("ellipse", { cx: -7, cy: -8, rx: 7, ry: 4.5, fill: "#ffd479", opacity: 0.9 }, g);
    return { ...o, g };
  });
  layers.eggs = (p) => {
    for (const o of eggs) {
      const t = clamp((p - o.d) / 0.5);
      // A small drop with a squash as it lands.
      const fall = t < 0.7 ? easeOut(t / 0.7) : 1;
      const sq = t < 0.7 ? 1 : 1 + Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.06;
      const s = lerp(1.5, 1, fall);
      o.g.setAttribute(
        "transform",
        `translate(${o.x} ${(o.y - (1 - fall) * 90).toFixed(1)}) scale(${(s * sq).toFixed(3)} ${(s / sq).toFixed(3)})`
      );
      o.g.setAttribute("opacity", Math.min(1, t * 4).toFixed(2));
    }
  };
}

// Butter: three cubes that land and slump as they melt.
{
  const cubes = [
    { x: 92, y: 62, a: 18, d: 0 },
    { x: 118, y: 18, a: -12, d: 0.15 },
    { x: 72, y: 104, a: 40, d: 0.3 },
  ].map((o) => {
    const g = el("g", {});
    const base = el("rect", { x: -18, y: -18, width: 36, height: 36, rx: 6, fill: "#f2cf55" }, g);
    const top = el("rect", { x: -13, y: -15, width: 24, height: 16, rx: 4, fill: "#fbe58e" }, g);
    return { ...o, g, base, top };
  });
  layers.butter = (p) => {
    for (const o of cubes) {
      const t = clamp((p - o.d) / 0.45);
      const fall = easeOut(clamp(t / 0.6));
      const melt = easeIO(clamp((t - 0.55) / 0.45));
      const s = lerp(1.35, 1, fall);
      o.g.setAttribute(
        "transform",
        `translate(${o.x} ${(o.y - (1 - fall) * 160).toFixed(1)}) rotate(${(o.a + (1 - fall) * 70).toFixed(1)}) scale(${(s * (1 + melt * 0.35)).toFixed(3)} ${(s * (1 + melt * 0.2)).toFixed(3)})`
      );
      o.base.setAttribute("rx", (6 + melt * 12).toFixed(1));
      o.top.setAttribute("opacity", (1 - melt * 0.8).toFixed(2));
      o.g.setAttribute("opacity", t > 0 ? Math.min(1, t * 5).toFixed(2) : 0);
    }
  };
}

// Whisk: batter floods over everything, with a swirl turned by the scroll.
{
  const batter = el("circle", { r: 0, fill: "url(#gBatter)" });
  const swirl = el("g", {});
  let d = "";
  for (let i = 0; i <= 220; i++) {
    const a = i * 0.11, r = 6 + i * 0.82;
    d += (i ? "L" : "M") + (Math.cos(a) * r).toFixed(1) + "," + (Math.sin(a) * r).toFixed(1);
  }
  const s1 = el("path", { d, fill: "none", stroke: "#f8e7bb", "stroke-width": 7, "stroke-linecap": "round", opacity: 0.85 }, swirl);
  const s2 = el("path", { d, fill: "none", stroke: "#d3a656", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.35, transform: "rotate(160)" }, swirl);
  const len = s1.getTotalLength();
  [s1, s2].forEach((s) => s.setAttribute("stroke-dasharray", `${len} ${len}`));
  // Bubbles left on top once it rests.
  const bubbles = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 20 + rnd() * 150;
    bubbles.push(el("circle", { cx: (Math.cos(a) * r).toFixed(1), cy: (Math.sin(a) * r).toFixed(1), r: (1.5 + rnd() * 3).toFixed(1), fill: "none", stroke: "#c99a49", "stroke-width": 1.2, opacity: 0 }));
  }
  layers.whisk = (p, t) => {
    const cover = easeIO(clamp(p / 0.55));
    batter.setAttribute("r", (cover * 210).toFixed(1));
    const turn = p * 720 + (reduceMotion ? 0 : t * 0.02 * (p > 0 && p < 1 ? 1 : 0.2));
    swirl.setAttribute("transform", `rotate(${turn.toFixed(1)})`);
    const draw = easeOut(clamp(p / 0.6));
    const fade = 1 - easeIO(clamp((p - 0.7) / 0.3)) * 0.75;
    s1.setAttribute("stroke-dashoffset", ((1 - draw) * len).toFixed(1));
    s2.setAttribute("stroke-dashoffset", ((1 - draw) * len).toFixed(1));
    swirl.setAttribute("opacity", (draw > 0 ? fade : 0).toFixed(2));
    const rest = clamp((p - 0.75) / 0.25);
    bubbles.forEach((b, i) => b.setAttribute("opacity", (rest * (0.4 + (i % 3) * 0.2)).toFixed(2)));
  };
}

/* ---------- Scroll scrub ---------- */

const state = steps.map((s) => ({
  key: s.dataset.key,
  num: s.querySelector(".n"),
  to: +s.querySelector(".n").dataset.to,
  p: 0,
}));

function targetProgress(stepEl) {
  const r = stepEl.getBoundingClientRect();
  const vh = innerHeight;
  // Starts when the step's top crosses 80% of the screen, done by about 30%.
  // On phones the pinned bowl covers the top half, so the window sits lower.
  const narrow = innerWidth < 760;
  return clamp((vh * (narrow ? 0.98 : 0.8) - r.top) / (vh * (narrow ? 0.4 : 0.5)));
}

let first = true;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const k = first || reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
  first = false;

  let active = -1;
  state.forEach((s, i) => {
    const want = targetProgress(steps[i]);
    s.p = Math.abs(want - s.p) < 0.0005 ? want : lerp(s.p, want, k);
    layers[s.key](s.p, now);
    const shown = s.p > 0.995 ? s.to : Math.round(s.to * easeOut(s.p));
    if (s.num.textContent !== String(shown)) s.num.textContent = shown;
    if (s.p > 0.12) active = i;
  });
  steps.forEach((s, i) => s.classList.toggle("on", i === active));

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
