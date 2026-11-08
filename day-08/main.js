// Day 08 · Ember Pricing
// Three plans in one vermilion. The chosen plan heats like a coal: its surface
// runs from soot to a white-hot core, sparks lift off its top edge, and the plan
// you leave cools slowly. All of the colour lives in CSS (OKLCH + color-mix on a
// registered --heat property); this script only picks plans, rolls the prices,
// drives the hover haze and draws the sparks.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const plans = [...document.querySelectorAll(".plan")];
const goName = document.getElementById("go-name");

/* ---------- Choosing a plan ---------- */

function choose(plan, focus) {
  for (const p of plans) {
    const on = p === plan;
    p.setAttribute("aria-checked", on);
    p.tabIndex = on ? 0 : -1;
  }
  goName.textContent = plan.querySelector(".name").textContent;
  if (focus) plan.focus();
}
choose(plans.find((p) => p.getAttribute("aria-checked") === "true") || plans[1]);

for (const p of plans) {
  p.addEventListener("click", () => choose(p));
  p.addEventListener("keydown", (e) => {
    const i = plans.indexOf(p);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); choose(plans[(i + 1) % plans.length], true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); choose(plans[(i + plans.length - 1) % plans.length], true); }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); choose(p); }
  });
}

/* ---------- Billing period: prices roll to the new number ---------- */

const rolls = new Map();
function roll(el, to) {
  const from = Number(el.textContent);
  if (from === to) return;
  rolls.set(el, { from, to, t0: performance.now(), dur: reduceMotion ? 1 : 520 });
}
for (const b of document.querySelectorAll(".period button")) {
  b.addEventListener("click", () => {
    for (const o of document.querySelectorAll(".period button")) o.setAttribute("aria-pressed", o === b);
    const year = b.dataset.period === "year";
    for (const p of plans) {
      roll(p.querySelector(".num"), Number(year ? p.dataset.year : p.dataset.month));
      p.querySelector(".per").textContent = year ? "/mo, yearly" : "/mo";
    }
  });
}

/* ---------- Hover haze ---------- */

const noise = document.getElementById("haze-noise");
const map = document.getElementById("haze-map");
let hovered = null;
let haze = 0;
let hazeEl = null;
for (const p of plans) {
  p.addEventListener("pointerenter", () => { hovered = p; });
  p.addEventListener("pointerleave", () => { if (hovered === p) hovered = null; });
}

/* ---------- Sparks ---------- */

const cv = document.getElementById("sparks");
const cx = cv.getContext("2d");
let dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
}
resize();
addEventListener("resize", resize);

const sparks = [];
// A small seeded generator so recordings come out the same every time.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function spawn(rect, heat) {
  const x = rect.left + 18 + rand() * (rect.width - 36);
  sparks.push({
    x,
    y: rect.top + 6 + rand() * 10,
    vx: (rand() - 0.5) * 18,
    vy: -(26 + rand() * 46) * (0.6 + heat * 0.4),
    life: 0,
    max: 1.4 + rand() * 1.8,
    r: 0.8 + rand() * 1.5,
    wob: rand() * 6.28,
  });
}

/* ---------- Frame loop ---------- */

let last = performance.now();
const carry = new Map(plans.map((p) => [p, 0]));
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // Price rolls: ease out, whole numbers only.
  for (const [el, r] of rolls) {
    const k = Math.min(1, (now - r.t0) / r.dur);
    const e = 1 - (1 - k) ** 3;
    el.textContent = Math.round(r.from + (r.to - r.from) * e);
    if (k >= 1) rolls.delete(el);
  }

  // Haze strength follows the hover in and out; it is stronger on a hot plan.
  const hHeat = hovered ? Number(getComputedStyle(hovered).getPropertyValue("--heat")) : 0;
  const target = hovered && !reduceMotion ? 6 + hHeat * 10 : 0;
  haze += (target - haze) * Math.min(1, dt * 6);
  // The filter stays on the last hovered plan until its shimmer has faded out.
  if (hovered) hazeEl = hovered;
  else if (haze < 0.3) hazeEl = null;
  for (const p of plans) p.classList.toggle("haze", p === hazeEl);
  const t = now / 1000;
  noise.setAttribute("baseFrequency", `${(0.011 + Math.sin(t * 1.3) * 0.002).toFixed(4)} ${(0.045 + Math.sin(t * 2.1 + 1) * 0.012).toFixed(4)}`);
  map.setAttribute("scale", haze.toFixed(2));

  // Sparks rise from every plan in proportion to its heat.
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, innerWidth, innerHeight);
  if (!reduceMotion) {
    for (const p of plans) {
      const heat = Number(getComputedStyle(p).getPropertyValue("--heat"));
      if (heat < 0.2) continue;
      const rate = (heat - 0.2) * 34; // sparks per second
      let c = carry.get(p) + rate * dt;
      const rect = p.getBoundingClientRect();
      while (c >= 1) { spawn(rect, heat); c -= 1; }
      carry.set(p, c);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life += dt;
    if (s.life > s.max) { sparks.splice(i, 1); continue; }
    s.wob += dt * 3;
    s.vx += Math.sin(s.wob) * 22 * dt;
    s.vy *= 1 - dt * 0.35;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const k = s.life / s.max;
    // Hot and yellow at birth, deep red as it dies.
    const L = 0.88 - k * 0.32, C = 0.14 + k * 0.08, H = 70 - k * 38;
    cx.fillStyle = `oklch(${L} ${C} ${H} / ${(1 - k) ** 1.4})`;
    cx.beginPath();
    cx.arc(s.x, s.y, s.r * (1 - k * 0.5), 0, Math.PI * 2);
    cx.fill();
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
