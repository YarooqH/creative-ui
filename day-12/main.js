// Day 12 · Radio Dial Nav
// The site's pages are stations on an old radio dial. Turn the knob (drag,
// scroll, or the arrow keys) and the needle slides across the band. Off
// station, the page breaks up: its title and text scramble into static, more
// the further you are from a frequency, and a faint grain fizzes over it.
// Near a station the letters settle one by one and the lamp locks on.
// Clicking a station name tunes there, passing through the others on the way.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIN = 88, MAX = 108;

const STATIONS = [
  { f: 89.3, name: "Home", title: "Good evening.", body: "A small studio making quiet, careful websites. You are tuned to the front page." },
  { f: 93.7, name: "Work", title: "Selected work", body: "Twelve sites since spring: a bakery, a ferry timetable, two record labels, and a very long museum." },
  { f: 98.5, name: "Journal", title: "From the shed", body: "Notes on type, tools and slow software, written whenever the kettle is on." },
  { f: 102.9, name: "About", title: "Who is on air", body: "Two people, one cat, and an old valve radio that still picks up the shipping forecast." },
  { f: 106.1, name: "Contact", title: "Say hello", body: "Drop us a line about anything at all. We answer every letter, usually by the next morning." },
];

const glass = document.querySelector(".glass");
const scale = document.getElementById("scale");
const needle = document.getElementById("needle");
const list = document.getElementById("stations");
const knob = document.getElementById("knob");
const freqEl = document.getElementById("freq");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const lamp = document.getElementById("lamp");
const lampText = document.getElementById("lamp-text");
const cv = document.getElementById("static");
const cx = cv.getContext("2d");

const pos = (f) => ((f - MIN) / (MAX - MIN)) * 100;

/* ---------- Dial face ---------- */

for (let f = MIN; f <= MAX + 0.001; f += 0.5) {
  const i = document.createElement("i");
  const major = Math.abs(f % 2) < 0.01;
  if (major) i.className = "major";
  i.style.left = `${pos(f)}%`;
  scale.append(i);
  if (major) {
    const b = document.createElement("b");
    b.textContent = f;
    b.style.left = `${pos(f)}%`;
    scale.append(b);
  }
}
const buttons = STATIONS.map((s) => {
  const li = document.createElement("li");
  li.style.left = `${pos(s.f)}%`;
  li.innerHTML = `<button type="button">${s.name}</button>`;
  list.append(li);
  const b = li.firstElementChild;
  b.addEventListener("click", () => tuneTo(s.f));
  return b;
});

/* ---------- Tuning state ---------- */

let freq = STATIONS[0].f;
let target = null;      // a frequency we are gliding to
let glideFrom = 0, glideT0 = 0, glideDur = 0;

function nearest(f) {
  let best = STATIONS[0], d = Infinity;
  for (const s of STATIONS) if (Math.abs(s.f - f) < d) { d = Math.abs(s.f - f); best = s; }
  return [best, d];
}

function tuneTo(f) {
  target = f;
  glideFrom = freq;
  glideT0 = performance.now();
  glideDur = reduceMotion ? 1 : 500 + Math.abs(f - freq) * 140;
}

// Let go near a station and it pulls you in, like a good tuning capacitor.
function settle() {
  const [s, d] = nearest(freq);
  if (d < 1.2) tuneTo(s.f);
}

/* ---------- Knob input ---------- */

const DEG_PER_MHZ = 36; // one full turn of the knob covers 10 MHz
let drag = null;
knob.addEventListener("pointerdown", (e) => {
  knob.setPointerCapture(e.pointerId);
  const r = knob.getBoundingClientRect();
  drag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  drag.a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
  target = null;
});
knob.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
  let da = a - drag.a;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  drag.a = a;
  freq = Math.min(MAX, Math.max(MIN, freq + (da * 180 / Math.PI) / DEG_PER_MHZ));
});
const release = () => { if (drag) { drag = null; settle(); } };
knob.addEventListener("pointerup", release);
knob.addEventListener("pointercancel", release);

let wheelTimer = 0;
knob.addEventListener("wheel", (e) => {
  e.preventDefault();
  target = null;
  freq = Math.min(MAX, Math.max(MIN, freq + e.deltaY * 0.01));
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(settle, 220);
}, { passive: false });

knob.addEventListener("keydown", (e) => {
  const [s] = nearest(freq);
  const i = STATIONS.indexOf(s);
  if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); tuneTo(STATIONS[Math.min(STATIONS.length - 1, freq < s.f - 0.05 ? i : i + 1)].f); }
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); tuneTo(STATIONS[Math.max(0, freq > s.f + 0.05 ? i : i - 1)].f); }
  if (e.key === "Home") { e.preventDefault(); tuneTo(STATIONS[0].f); }
  if (e.key === "End") { e.preventDefault(); tuneTo(STATIONS[STATIONS.length - 1].f); }
});

/* ---------- Scrambling ---------- */

const NOISE = "#%*+=/\\|~^?!:;abcdefghkmnpqrstuvwxyz0123456789";
const GRAIN = NOISE + "░▒▓";
let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// A fixed order for each letter to come in, so locking feels like a settle.
const order = (k) => ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;

function scramble(text, clarity, set = NOISE) {
  let out = "";
  let run = "";
  const flush = () => { if (run) { out += `<span class="scr">${run}</span>`; run = ""; } };
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if (ch === " " || order(k) < clarity) { flush(); out += ch === "&" ? "&amp;" : ch; }
    else run += set[(rand() * set.length) | 0];
  }
  flush();
  return out;
}

/* ---------- Static grain ---------- */

let grain = null;
function sizeStatic() {
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(1, Math.round(r.width / 3));
  cv.height = Math.max(1, Math.round(r.height / 3));
  grain = cx.createImageData(cv.width, cv.height);
}
sizeStatic();
addEventListener("resize", sizeStatic);

function drawStatic(amount) {
  cv.style.opacity = (amount * 0.42).toFixed(3);
  if (amount < 0.02) return;
  const d = grain.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = rand() < 0.5 ? 0 : 160 + rand() * 95;
    d[i] = v; d[i + 1] = v * 0.86; d[i + 2] = v * 0.66; d[i + 3] = 255;
  }
  cx.putImageData(grain, 0, 0);
}

/* ---------- Frame loop ---------- */

let shown = null, lastFlip = 0, lastFreq = -1, lastClarity = -1;
function frame(now) {
  if (target !== null) {
    const k = Math.min(1, (now - glideT0) / glideDur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    freq = glideFrom + (target - glideFrom) * e;
    if (k >= 1) { freq = target; target = null; }
  }

  const [s, d] = nearest(freq);
  // 1 when dead on, 0 a little over a megahertz away.
  const clarity = Math.max(0, Math.min(1, 1 - (d - 0.08) / 1.1));
  const locked = clarity > 0.97;

  if (freq !== lastFreq) {
    needle.style.setProperty("--p", (pos(freq) / 100).toFixed(4));
    glass.style.setProperty("--glow", `${pos(freq)}%`);
    knob.style.setProperty("--turn", `${((freq - MIN) * DEG_PER_MHZ).toFixed(1)}deg`);
    freqEl.textContent = freq.toFixed(1);
    knob.setAttribute("aria-valuenow", freq.toFixed(1));
    knob.setAttribute("aria-valuetext", `${freq.toFixed(1)} megahertz${locked ? `, ${s.name}` : ""}`);
    lastFreq = freq;
  }

  // Static changes about 20 times a second; locked text stays still.
  if (s !== shown || clarity !== lastClarity || (!locked && now - lastFlip > 50)) {
    lastFlip = now;
    lastClarity = clarity;
    shown = s;
    titleEl.innerHTML = locked ? s.title : scramble(s.title, clarity);
    bodyEl.innerHTML = locked ? s.body : scramble(s.body, clarity * 0.9, GRAIN);
    lamp.classList.toggle("on", locked);
    lampText.textContent = locked ? `Locked · ${s.name}` : "Searching";
    buttons.forEach((b, i) => (STATIONS[i] === s && locked ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    drawStatic(reduceMotion ? 0 : 1 - clarity);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
