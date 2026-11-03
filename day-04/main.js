// Day 04 · Itten Star
// Johannes Itten's twelve-part colour circle: three primaries in the middle,
// three secondaries folded out from their edges, twelve hues around the rim.
// Pick a hue and the star turns it to the top; its complement lights up across
// from it, and the study on the right puts one grey on both. "Reveal" joins the
// two grey chips with a strip of the same grey, so you can see they never differed.
// Motion is CSS transitions and element.animate(), so the recorder can step it.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);

const HUES = [
  ["Yellow", "#f4cf00"],
  ["Yellow-orange", "#f6a300"],
  ["Orange", "#ee7a00"],
  ["Red-orange", "#e2521c"],
  ["Red", "#d0251f"],
  ["Red-violet", "#a3215e"],
  ["Violet", "#6b2d84"],
  ["Blue-violet", "#3c3b91"],
  ["Blue", "#1f5aa6"],
  ["Blue-green", "#00857a"],
  ["Green", "#3c9a3a"],
  ["Yellow-green", "#9cc12b"],
];

const R_IN = 338, R_OUT = 476, R_CORE = 300, GAP = 1.1;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (deg, r) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r];
const angleOf = (i) => -90 + i * 30; // yellow at the top, clockwise

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
const poly = (pts) => "M" + pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join("L") + "Z";

/* ---------- Build the star ---------- */

const star = $("star"), spin = $("spin"), ring = $("ring"), core = $("core");
const segs = HUES.map(([name, color], i) => {
  const a0 = angleOf(i) - 15 + GAP / 2, a1 = angleOf(i) + 15 - GAP / 2;
  const [x0, y0] = pt(a0, R_OUT), [x1, y1] = pt(a1, R_OUT);
  const [x2, y2] = pt(a1, R_IN), [x3, y3] = pt(a0, R_IN);
  const g = el("g", { class: "seg", tabindex: "0", role: "button", "aria-label": name }, ring);
  el("path", {
    d: `M${x0},${y0}A${R_OUT},${R_OUT} 0 0 1 ${x1},${y1}L${x2},${y2}A${R_IN},${R_IN} 0 0 0 ${x3},${y3}Z`,
    fill: color,
  }, g);
  const [px, py] = pt(angleOf(i), 26);
  g.style.setProperty("--push", `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`);
  g.addEventListener("click", () => pick(i));
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); }
  });
  return g;
});

// Core: the primary triangle split into three, and a secondary triangle on each edge.
const V = (i) => pt(angleOf(i), R_CORE);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const Y = V(0), Rd = V(4), B = V(8);
const corePieces = [
  // secondaries first, so the primaries sit on top of their shared edges
  { pts: [Y, V(2), Rd], color: HUES[2][1], hinge: mid(Y, Rd) },
  { pts: [Rd, V(6), B], color: HUES[6][1], hinge: mid(Rd, B) },
  { pts: [B, V(10), Y], color: HUES[10][1], hinge: mid(B, Y) },
  { pts: [[0, 0], mid(Y, B), Y, mid(Y, Rd)], color: HUES[0][1] },
  { pts: [[0, 0], mid(Y, Rd), Rd, mid(Rd, B)], color: HUES[4][1] },
  { pts: [[0, 0], mid(Rd, B), B, mid(B, Y)], color: HUES[8][1] },
].map((p) => {
  const path = el("path", { d: poly(p.pts), fill: p.color }, core);
  path.classList.add("core");
  return { ...p, path };
});

/* ---------- Entrance ---------- */

function entrance() {
  if (reduceMotion) return;
  const E = "cubic-bezier(.2,.8,.2,1)";
  // Primaries grow out of the centre.
  corePieces.slice(3).forEach((p, k) => {
    p.path.style.transformOrigin = "0px 0px";
    p.path.animate(
      [{ transform: "scale(0)" }, { transform: "scale(1)" }],
      { duration: 700, delay: 150 + k * 90, easing: E, fill: "backwards" }
    );
  });
  // Secondaries fold open about the primary triangle's edges.
  corePieces.slice(0, 3).forEach((p, k) => {
    const [hx, hy] = p.hinge;
    p.path.style.transformOrigin = `${hx}px ${hy}px`;
    p.path.animate(
      [{ transform: "scale(0.0, 0.0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 700, delay: 520 + k * 110, easing: E, fill: "backwards" }
    );
  });
  // The rim sweeps in clockwise from yellow.
  segs.forEach((g, i) => {
    g.firstChild.animate(
      [{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 650, delay: 820 + i * 45, easing: E, fill: "backwards" }
    );
  });
}

/* ---------- Picking ---------- */

const fields = $("fields"), lede = $("lede");
const revealBtn = $("reveal"), nextBtn = $("next");
let current = -1;
let rotation = 0;

function pick(i, focus = false) {
  if (i === current) return;
  const pair = (i + 6) % 12;
  // Turn the shortest way so the picked hue ends at the top.
  const want = -i * 30;
  let d = (((want - rotation) % 360) + 540) % 360 - 180;
  rotation += d;
  spin.style.transform = `rotate(${rotation}deg)`;

  segs.forEach((g, k) => {
    g.classList.toggle("on", k === i);
    g.classList.toggle("pair", k === pair);
    g.setAttribute("aria-pressed", String(k === i));
  });
  star.classList.add("picked");

  const root = document.documentElement.style;
  root.setProperty("--a", HUES[i][1]);
  root.setProperty("--b", HUES[pair][1]);
  lede.textContent = `${HUES[i][0]} and ${HUES[pair][0].toLowerCase()}. The same grey sits on both, and each colour pushes it toward the other.`;
  current = i;
  if (focus) segs[i].focus({ preventScroll: true });
}

star.addEventListener("keydown", (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  pick((Math.max(current, 0) + step + 12) % 12, true);
});

nextBtn.addEventListener("click", () => pick((Math.max(current, 0) + 1) % 12));
revealBtn.addEventListener("click", () => {
  const on = !fields.classList.contains("joined");
  fields.classList.toggle("joined", on);
  revealBtn.setAttribute("aria-pressed", String(on));
  revealBtn.textContent = on ? "Hide" : "Reveal";
});

entrance();
// Start on yellow, but let the entrance finish before anything lights up.
setTimeout(() => pick(0), reduceMotion ? 0 : 1900);
