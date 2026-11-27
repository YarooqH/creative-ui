// Day 28 · Spell Sky
// The spellbook palette, floating over the eclipse clock. Ctrl/Cmd + K opens it,
// typing filters spells (letters in order), arrows move the glider, Enter casts.
// Every spell changes the sky behind: the disk's colours, the clock's pace, the tilt.

import * as THREE from "three";
import { frag } from "./shader.js";

const $ = (id) => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Sky ---------- */

const canvas = $("sky");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uRes: { value: new THREE.Vector2(1, 1) },
  uTime: { value: 0 },
  uIncl: { value: 0.42 },
  uMin: { value: 0 }, uHour: { value: 0 }, uSec: { value: 0 },
  uShift: { value: 0.2 }, uZoom: { value: 1 },
  uGain: { value: 1 }, uChaos: { value: 0 }, uMarks: { value: 1 },
  uDeep: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() },
  uHot: { value: new THREE.Vector3() }, uStar: { value: new THREE.Vector3() },
};
scene.add(new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: frag,
    depthTest: false,
  }),
));

// Disk colours (deep, mid, hot) and the hour star, as plain RGB the shader reads directly.
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const INKS = {
  rose:    { deep: "#3b0d2a", mid: "#ff9fc4", hot: "#fff2f5", star: "#c9b8ff" },
  kindle:  { deep: "#3d1204", mid: "#ffa646", hot: "#fff6dc", star: "#ff6a3d" },
  rime:    { deep: "#06203f", mid: "#8fc8ff", hot: "#f4fbff", star: "#e6f3ff" },
  verdure: { deep: "#08301a", mid: "#8de39a", hot: "#f6ffe9", star: "#ffd36a" },
};
const ink = { deep: hex(INKS.rose.deep), mid: hex(INKS.rose.mid), hot: hex(INKS.rose.hot), star: hex(INKS.rose.star) };
let inkTo = INKS.rose;

// The sky renders below screen resolution and scales up; it drops further if frames run long.
let scale = 0.55;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * scale);
  renderer.setSize(w, h, false);
  renderer.getDrawingBufferSize(uniforms.uRes.value);
  const portrait = h > w;
  uniforms.uShift.value = portrait ? 0 : Math.min(0.34, (w / h - 1) * 0.44);
  uniforms.uZoom.value = portrait ? 0.7 : 1;
}
addEventListener("resize", resize);
resize();

/* ---------- State the spells steer ---------- */

const state = {
  rate: 1, rateTo: 1,           // clock speed
  spin: 1, spinTo: 1,           // disk rotation
  incl: 0.42, inclTo: 0.42,     // tilt
  gain: 1, gainTo: 1,           // brightness
  chaos: 0, chaosTo: 0,         // turbulence
  marks: 1, marksTo: 1,         // hour marks
};
const timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, reduce ? Math.min(ms, 800) : ms));
const clearLater = () => { while (timers.length) clearTimeout(timers.pop()); };

const castEl = $("cast");
function say(text) {
  castEl.textContent = text;
  castEl.classList.add("on");
  later(2600, () => castEl.classList.remove("on"));
}

/* ---------- The spells ---------- */

const R = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const SPELLS = [
  { group: "The disk", name: "Kindle", desc: "Stoke the disk until it burns amber.", rune: "M12 21C7 16 9 11 12 7C12.5 11 16.5 12.5 15.5 17M12 3V4.5",
    cast: () => { inkTo = INKS.kindle; state.gainTo = 1.25; say("Kindled"); } },
  { group: "The disk", name: "Rime", desc: "Frost the light to a cold blue.", rune: "M12 3V21M4.5 7.5L19.5 16.5M19.5 7.5L4.5 16.5",
    cast: () => { inkTo = INKS.rime; state.gainTo = 1; say("Rimed"); } },
  { group: "The disk", name: "Verdance", desc: "Turn the glow the green of new leaves.", rune: "M12 21V10M12 10L6 4M12 10L18 4M12 15L16.5 12",
    cast: () => { inkTo = INKS.verdure; state.gainTo = 1; say("Greened"); } },
  { group: "The disk", name: "Unweave", desc: "Return the disk to rose.", rune: "M6 12A6 6 0 1 0 12 6H8M8 6L11 3M8 6L11 9",
    cast: () => { inkTo = INKS.rose; Object.assign(state, { gainTo: 1, chaosTo: 0, spinTo: 1, rateTo: 1, inclTo: 0.42, marksTo: 1 }); say("Unwoven"); } },
  { group: "The clock", name: "Hasten", desc: "Run the hours by in seconds.", rune: "M5 6L11 12L5 18M12 6L18 12L12 18",
    cast: () => { state.rateTo = 900; state.spinTo = 4; say("Hastened"); later(7000, () => { state.rateTo = 1; state.spinTo = 1; }); } },
  { group: "The clock", name: "Stay", desc: "Hold the disk still for a breath.", rune: "M8 5V19M16 5V19",
    cast: () => { state.spinTo = 0; say("Stayed"); later(6000, () => { state.spinTo = 1; }); } },
  { group: "The sky", name: "Levitate", desc: "Lift the eye above the disk.", rune: "M6 20L12 4L18 20M8.5 14H15.5",
    cast: () => { state.inclTo = 1.2; say("Lifted"); } },
  { group: "The sky", name: "Eclipse", desc: "Sink to the plane of the disk.", rune: "M3 12H21M12 7A5 5 0 1 0 12 17",
    cast: () => { state.inclTo = 0.09; say("Eclipsed"); } },
  { group: "The sky", name: "Tempest", desc: "Stir the disk into a storm.", rune: "M14 3L8 12H15L10 21",
    cast: () => { state.chaosTo = 1; state.gainTo = 1.35; say("Stirred"); later(5000, () => { state.chaosTo = 0; state.gainTo = 1; }); } },
  { group: "The sky", name: "Hush", desc: "Let the light fall almost silent.", rune: "M18.5 12A6.5 6.5 0 1 1 5.5 12A6.5 6.5 0 1 1 18.5 12M5 19L19 5",
    cast: () => { state.gainTo = 0.22; state.marksTo = 0; say("Hushed"); later(5000, () => { state.gainTo = 1; state.marksTo = 1; }); } },
];

/* ---------- Palette ---------- */

const veil = $("veil"), q = $("q"), list = $("list"), glider = $("glider"), none = $("none");
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$("keys").textContent = mac ? "⌘ K" : "Ctrl K";

function match(spell, query) {
  if (!query) return { score: 0, marks: [] };
  const name = spell.name.toLowerCase();
  let i = 0, marks = [], score = 0, last = -1;
  for (const ch of query) {
    const at = name.indexOf(ch, i);
    if (at < 0) { marks = null; break; }
    score += at === last + 1 ? 3 : 1;
    if (at === 0) score += 2;
    marks.push(at);
    last = at; i = at + 1;
  }
  if (marks) return { score, marks };
  return spell.desc.toLowerCase().includes(query) ? { score: 0.5, marks: [] } : null;
}

let shown = [], active = 0;
function render() {
  const query = q.value.trim().toLowerCase();
  shown = SPELLS.map((s) => ({ s, m: match(s, query) })).filter((r) => r.m);
  if (query) shown.sort((a, b) => b.m.score - a.m.score);
  list.innerHTML = "";
  let group = "";
  shown.forEach(({ s, m }, k) => {
    if (!query && s.group !== group) {
      group = s.group;
      const h = document.createElement("p");
      h.className = "group";
      h.textContent = group;
      h.setAttribute("role", "presentation");
      list.appendChild(h);
    }
    const name = [...s.name].map((c, i) => (m.marks.includes(i) ? `<mark>${c}</mark>` : c)).join("");
    const row = document.createElement("div");
    row.className = "opt";
    row.id = `opt-${k}`;
    row.setAttribute("role", "option");
    row.innerHTML = `${R(s.rune)}<span><span class="name">${name}</span><span class="desc">${s.desc}</span></span><span class="cast">Cast</span>`;
    row.addEventListener("pointermove", () => { if (active !== k) setActive(k); });
    row.addEventListener("click", () => cast(k));
    list.appendChild(row);
  });
  none.hidden = shown.length > 0;
  setActive(0, true);
}

function setActive(k, jump = false) {
  active = shown.length ? (k + shown.length) % shown.length : -1;
  const rows = [...list.querySelectorAll(".opt")];
  rows.forEach((r, i) => r.setAttribute("aria-selected", String(i === active)));
  const row = rows[active];
  if (!row) { glider.style.opacity = 0; q.removeAttribute("aria-activedescendant"); return; }
  q.setAttribute("aria-activedescendant", row.id);
  if (jump) glider.style.transition = "none";
  glider.style.opacity = 1;
  glider.style.transform = `translateY(${row.offsetTop}px)`;
  glider.style.height = `${row.offsetHeight}px`;
  if (jump) { glider.offsetHeight; glider.style.transition = ""; }
  row.scrollIntoView({ block: "nearest" });
}

let isOpen = false;
function open() {
  if (isOpen) return;
  isOpen = true;
  veil.hidden = false;
  veil.classList.remove("out");
  q.value = "";
  render();
  q.focus();
}
function close(then) {
  if (!isOpen) return;
  isOpen = false;
  veil.classList.add("out");
  setTimeout(() => { veil.hidden = true; veil.classList.remove("out"); then?.(); }, reduce ? 0 : 340);
}
function cast(k) {
  const r = shown[k];
  if (!r) return;
  list.querySelectorAll(".opt")[k]?.classList.add("flash");
  setTimeout(() => close(() => { clearLater(); r.s.cast(); }), reduce ? 0 : 200);
}

addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    isOpen ? close() : open();
    return;
  }
  if (!isOpen) return;
  if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
  else if (e.key === "Enter") { e.preventDefault(); cast(active); }
  else if (e.key === "Escape") { e.preventDefault(); close(); }
});
q.addEventListener("input", render);
veil.addEventListener("pointerdown", (e) => { if (e.target === veil) close(); });
$("open").addEventListener("click", open);

/* ---------- Loop ---------- */

const timeEl = $("time");
const TAU = Math.PI * 2;
const turn = (cur, to, k) => cur + (((to - cur + Math.PI) % TAU + TAU) % TAU - Math.PI) * k;
const hands = { s: 0, m: 0, h: 0 };
let virtual = Date.now(), last = performance.now(), slow = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const k = Math.min(1, dt * 2.2);
  for (const key of ["rate", "spin", "incl", "gain", "chaos", "marks"]) state[key] += (state[key + "To"] - state[key]) * (key === "rate" ? Math.min(1, dt * 3) : k);
  for (const part of ["deep", "mid", "hot", "star"]) {
    const to = hex(inkTo[part]);
    for (let i = 0; i < 3; i++) ink[part][i] += (to[i] - ink[part][i]) * Math.min(1, dt * 1.8);
  }

  virtual += dt * 1000 * state.rate;
  if (state.rateTo === 1 && state.rate < 2) virtual += (Date.now() - virtual) * Math.min(1, dt * 3);
  const d = new Date(virtual);
  const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  const kh = Math.min(1, dt * 8);
  hands.s = turn(hands.s, (s / 60) * TAU, state.rate > 30 ? 1 : kh);
  hands.m = turn(hands.m, (m / 60) * TAU, kh);
  hands.h = turn(hands.h, (h / 12) * TAU, kh);

  const u = uniforms;
  u.uSec.value = hands.s; u.uMin.value = hands.m; u.uHour.value = hands.h;
  u.uTime.value += dt * state.spin * (1 + Math.min(state.rate, 60) * 0.04);
  u.uIncl.value = state.incl; u.uGain.value = state.gain; u.uChaos.value = state.chaos; u.uMarks.value = state.marks;
  u.uDeep.value.fromArray(ink.deep); u.uMid.value.fromArray(ink.mid); u.uHot.value.fromArray(ink.hot); u.uStar.value.fromArray(ink.star);

  const txt = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (timeEl.textContent !== txt) timeEl.textContent = txt;

  // Keep it smooth: if frames keep running long, render the sky at a lower resolution.
  slow = dt > 0.024 ? slow + 1 : Math.max(0, slow - 1);
  if (slow > 40 && scale > 0.35 && !document.documentElement.hasAttribute("data-recording")) { scale -= 0.08; slow = 0; resize(); }

  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
