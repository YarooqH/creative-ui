// Day 03 · Tide Footer
// The footer is a tide. As you scroll into it the water rises, slowly and with a lag,
// until most of the wordmark is under the surface and only its tops stay dry.
// The waterline is one SVG wave path rebuilt every frame. It clips three copies of
// the wordmark: the dry ink above it, the submerged copy below it (shifted and
// wobbling), and a thin band just under the surface shifted further, which reads as
// the refraction kink you see where something enters water.
// All motion runs on requestAnimationFrame and performance.now, so the recorder can
// step it frame by frame.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const footer = document.getElementById("tide");
const svg = document.getElementById("sea");
const $ = (id) => document.getElementById(id);
const marks = [$("markDry"), $("markWet"), $("markBand")];
const pDry = $("pDry"), pWet = $("pWet"), pBand = $("pBand");
const water = $("water"), surface = $("surface"), glint = $("glint");
const turb = $("turb");
const disp = $("disp");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Layout ---------- */

let W = 0, H = 0, size = 0, baseline = 0, capTop = 0;
let low = 0, high = 0, amp = 8, step = 8;

function layout() {
  W = footer.clientWidth;
  H = footer.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Fit the wordmark to the width, but never taller than about half the footer.
  marks.forEach((m) => m.setAttribute("font-size", 100));
  const len = marks[0].getComputedTextLength() || 300;
  size = Math.min((100 * W * 0.9) / len, H * 0.74);
  const narrow = W < 600;
  baseline = H - size * 0.24 - H * (narrow ? 0.12 : 0.07);
  capTop = baseline - size * 0.72;
  marks.forEach((m) => {
    m.setAttribute("font-size", size.toFixed(2));
    m.setAttribute("x", W / 2);
    m.setAttribute("y", baseline);
    m.setAttribute("text-anchor", "middle");
  });

  // Refraction: below the surface the word sits a little lower and to the right,
  // and in the thin band right under the surface it is pushed further still.
  marks[1].setAttribute("transform", `translate(${(size * 0.012).toFixed(1)} ${(size * 0.028).toFixed(1)})`);
  marks[2].setAttribute("transform", `translate(${(size * 0.03).toFixed(1)} ${(size * 0.06).toFixed(1)})`);

  low = H * 1.02;
  // High water leaves the top half of the word dry, so the refraction line crosses them.
  high = baseline - size * 0.34;
  disp.setAttribute("scale", clamp(size * 0.024, 3, 12).toFixed(1));
  amp = clamp(H * 0.011, 6, 12);
  step = W < 600 ? 6 : 8;

}

/* ---------- Water ---------- */

const ripples = [];
let t = 0;
let level = 0;

function waveY(x, time) {
  const s = Math.min(1, W / 1200) || 1;
  let y =
    0.55 * Math.sin((x / (560 * s)) * Math.PI * 2 + time * 1.05) +
    0.3 * Math.sin((x / (270 * s)) * Math.PI * 2 - time * 1.6 + 1.3) +
    0.15 * Math.sin((x / (130 * s)) * Math.PI * 2 + time * 2.7 + 0.4);
  y *= amp;
  for (const r of ripples) {
    const age = time - r.t0;
    const front = Math.abs(x - r.x) - 230 * age;
    y += r.s * Math.exp(-age * 1.3) * Math.exp(-(front * front) / 14000) * Math.sin(front / 13);
  }
  return level + y;
}

function render(time) {
  const pts = [];
  for (let x = -12; x <= W + 12; x += step) pts.push([x, waveY(x, time)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const back = (dy) => pts.slice().reverse().map(([x, y]) => `L${x.toFixed(1)} ${(y + dy).toFixed(1)}`).join("");
  const bottom = `L${W + 12} ${H + 12}L-12 ${H + 12}Z`;
  const band = clamp(size * 0.035, 5, 12);

  water.setAttribute("d", line + bottom);
  pWet.setAttribute("d", line + bottom);
  pDry.setAttribute("d", `M-12 -12L${W + 12} -12` + back(0) + "Z");
  pBand.setAttribute("d", line + back(band) + "Z");
  surface.setAttribute("d", line);
  glint.setAttribute("d", pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${(y + 5).toFixed(1)}`).join(""));

  // The submerged word shimmers: drift the noise frequency a touch every frame.
  if (!reduceMotion) {
    turb.setAttribute(
      "baseFrequency",
      `${(0.004 + 0.001 * Math.sin(time * 0.9)).toFixed(5)} ${(0.016 + 0.004 * Math.sin(time * 1.4)).toFixed(5)}`
    );
  }
}

/* ---------- Input ---------- */

let lastX = null, lastRipple = -1;
footer.addEventListener("pointermove", (e) => {
  if (reduceMotion) return;
  const r = footer.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const near = Math.abs(y - waveY(x, t)) < 90;
  if (near && lastX !== null && t - lastRipple > 0.12) {
    const speed = Math.abs(x - lastX);
    if (speed > 2) {
      ripples.push({ x, t0: t, s: clamp(speed * 0.5, 4, 12) });
      lastRipple = t;
    }
  }
  lastX = x;
});
footer.addEventListener("pointerleave", () => (lastX = null));
footer.addEventListener("pointerdown", (e) => {
  if (reduceMotion) return;
  // A tap on the water drops a stone: one strong ring of ripples.
  const r = footer.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (y > waveY(x, t) - 40) ripples.push({ x, t0: t, s: 14 });
});

/* ---------- Loop ---------- */

function targetLevel() {
  // 0 when the footer's top edge reaches the bottom of the screen, 1 once it is all in view.
  const top = footer.getBoundingClientRect().top;
  const p = clamp((innerHeight - top) / Math.min(H, innerHeight), 0, 1);
  return lerp(low, high, smooth(p));
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (!reduceMotion) t += dt;

  const goal = targetLevel();
  // Tides lag: the water keeps creeping up after you stop scrolling.
  level = reduceMotion ? goal : lerp(level, goal, 1 - Math.exp(-dt * 2.2));

  for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > 3.5) ripples.splice(i, 1);

  if (footer.getBoundingClientRect().top < innerHeight + 40) render(t);
  requestAnimationFrame(frame);
}

async function start() {
  try { await document.fonts.load(`800 100px "Bricolage Grotesque"`); } catch {}
  await document.fonts.ready;
  layout();
  level = targetLevel();
  render(t);
  addEventListener("resize", () => { layout(); render(t); });
  requestAnimationFrame((n) => { prev = n; frame(n); });
}
start();
