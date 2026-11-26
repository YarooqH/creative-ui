// Day 25 · Spellbook Palette
// A command palette dressed as a spellbook. Ctrl/Cmd + K opens it, typing
// filters spells by a loose letters-in-order match, arrow keys move a dark
// highlight that glides between results, and Enter casts. Each spell is a
// small effect on the page: frost on a canvas, vines, rain and lightning,
// sparks, or CSS on the title and the candle.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const veil = $("veil"), q = $("q"), list = $("list"), glider = $("glider"), none = $("none");
const title = $("title"), canvas = $("fx"), g = canvas.getContext("2d");

const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$("keys").textContent = mac ? "⌘ K" : "Ctrl K";

// Title letters, so spells can move them one by one.
title.innerHTML = [...title.textContent].map((c, i) => `<span class="l" aria-hidden="true" style="--i:${i};--r:${((i * 37) % 11) - 5}">${c}</span>`).join("");
const letters = [...title.querySelectorAll(".l")];

/* ---------- The spells ---------- */

const R = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const SPELLS = [
  { group: "Fire and frost", name: "Kindle", desc: "Coax the candle into a full blaze.", rune: "M12 3V21M7 9L12 4L17 9M9 15H15", cast: kindle },
  { group: "Fire and frost", name: "Rime", desc: "Frost creeps in from the edges.", rune: "M12 3V21M4.5 7.5L19.5 16.5M19.5 7.5L4.5 16.5M10 5L12 7L14 5", cast: rime },
  { group: "Fire and frost", name: "Ember", desc: "Loose a swarm of sparks.", rune: "M12 21C7 16 9 11 12 7C12.5 11 16.5 12.5 15.5 17M12 3V4.5", cast: ember },
  { group: "Weather and growth", name: "Verdance", desc: "Green things climb out of the dark.", rune: "M12 21V10M12 10L6 4M12 10L18 4M12 15L16.5 12", cast: verdance },
  { group: "Weather and growth", name: "Tempest", desc: "Rain, and a crack of lightning.", rune: "M14 3L8 12H15L10 21", cast: tempest },
  { group: "Bindings", name: "Levitate", desc: "Unfasten the letters from the page.", rune: "M6 20L12 4L18 20M8.5 14H15.5", cast: levitate },
  { group: "Bindings", name: "Scatter", desc: "Fling every letter, then call them home.", rune: "M12 5L17 12L12 19L7 12ZM3 12H6M18 12H21", cast: scatter },
  { group: "Bindings", name: "Hush", desc: "Draw the colour out of the room.", rune: "M18.5 12A6.5 6.5 0 1 1 5.5 12A6.5 6.5 0 1 1 18.5 12M5 19L19 5", cast: hush },
];

/* ---------- Matching ---------- */

// Letters of the query in order inside the name (or failing that the description).
// Tighter, earlier matches score higher; returns the matched name positions to mark.
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

/* ---------- Open, close, cast ---------- */

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
  setTimeout(() => close(() => r.s.cast()), reduce ? 0 : 220);
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

/* ---------- Effects ---------- */

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
addEventListener("resize", resize);
resize();

const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
let parts = [];   // particles: { x, y, vx, vy, life, max, draw }
let strokes = []; // growing lines: { x, y, a, len, grown, w, color, born, kids, leaf }
let flash = 0, fade = 1, bolt = null;

function bodyFor(cls, ms) {
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), reduce ? Math.min(ms, 1200) : ms);
}

function kindle() {
  bodyFor("kindle", 3400);
  const cx = W / 2, cy = H - H * 0.11 - 30;
  for (let i = 0; i < 70; i++) parts.push({ x: cx + rand(-14, 14), y: cy + rand(-10, 10), vx: rand(-30, 30), vy: rand(-160, -60), life: 0, max: rand(1, 2.4), kind: "spark", delay: rand(0, 1.6) });
}
function ember() {
  for (let i = 0; i < 140; i++) parts.push({ x: rand(W), y: H + rand(0, 80), vx: rand(-20, 20), vy: rand(-110, -40), life: 0, max: rand(2.4, 4), kind: "firefly", ph: rand(6.3), delay: rand(0, 1.2) });
}
function rime() {
  bodyFor("frost", 3800);
  // Crystals grow inward from the edges in hexagonal branches.
  const seeds = 26;
  for (let i = 0; i < seeds; i++) {
    const side = i % 4;
    const t = rand(0.05, 0.95);
    const [x, y, a] = side === 0 ? [t * W, 0, Math.PI / 2] : side === 1 ? [W, t * H, Math.PI] : side === 2 ? [t * W, H, -Math.PI / 2] : [0, t * H, 0];
    grow(x, y, a + rand(-0.4, 0.4), rand(80, 190), 1.6, "rgb(225 244 255 / A)", 4, "frost", rand(0, 0.5));
  }
  fade = 1;
}
function verdance() {
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (W / 9) + rand(-30, 30);
    grow(x, H, -Math.PI / 2 + rand(-0.25, 0.25), rand(H * 0.22, H * 0.38), 3.2, "rgb(118 170 92 / A)", 5, "vine", rand(0, 0.6));
  }
  fade = 1;
}
function grow(x, y, a, len, w, color, depth, kind, delay = 0) {
  strokes.push({ x, y, a, len, w, color, depth, kind, delay, grown: 0, kidsDone: false, curl: kind === "vine" ? (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 2.6) : 0 });
}
function tempest() {
  for (let i = 0; i < 380; i++) parts.push({ x: rand(-100, W), y: rand(-H, 0), vx: 260, vy: rand(900, 1300), life: 0, max: 3, kind: "rain", delay: rand(0, 1.2) });
  const strike = (at) => setTimeout(() => {
    flash = 1;
    const pts = [[rand(W * 0.25, W * 0.75), 0]];
    while (pts.at(-1)[1] < H * rand(0.55, 0.8)) { const [px, py] = pts.at(-1); pts.push([px + rand(-50, 50), py + rand(30, 70)]); }
    bolt = { pts, life: 0 };
  }, at);
  strike(reduce ? 0 : 700);
  if (!reduce) strike(1900);
}
function levitate() { bodyFor("levitate", 3500); }
function scatter() {
  letters.forEach((l) => { l.style.transform = `translate(${rand(-40, 40)}vw, ${rand(-40, 40)}vh) rotate(${rand(-200, 200)}deg)`; l.style.opacity = 0.7; });
  setTimeout(() => letters.forEach((l, i) => setTimeout(() => { l.style.transform = ""; l.style.opacity = ""; }, i * 70)), reduce ? 300 : 1300);
}
function hush() { bodyFor("hush", 2800); }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  // Growing strokes: each extends, and once full length sprouts children.
  if (strokes.length) {
    let allDone = true;
    for (const s of strokes) {
      if (s.delay > 0) { s.delay -= dt; allDone = false; continue; }
      if (s.grown < 1) { s.grown = Math.min(1, s.grown + dt * (s.kind === "frost" ? 2.4 : 1.1)); allDone = false; }
      if (s.grown >= 1 && !s.kidsDone) {
        s.kidsDone = true;
        if (s.depth > 0) {
          const [ex, ey] = tip(s, 1);
          if (s.kind === "frost") {
            grow(ex, ey, s.a + rand(-0.15, 0.15), s.len * 0.72, s.w * 0.8, s.color, s.depth - 1, "frost");
            for (const side of [-1, 1]) if (Math.random() < 0.85) grow(ex, ey, s.a + side * Math.PI / 3, s.len * 0.45, s.w * 0.7, s.color, s.depth - 2, "frost");
          } else {
            grow(ex, ey, s.a + s.curl * 0.25 + rand(-0.2, 0.2), s.len * 0.7, s.w * 0.8, s.color, s.depth - 1, "vine");
            if (Math.random() < 0.7) grow(ex, ey, s.a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1), s.len * 0.5, s.w * 0.7, s.color, s.depth - 2, "vine");
          }
        }
      }
    }
    if (allDone) { fade -= dt * 0.55; if (fade <= 0) { strokes = []; fade = 1; } }
    for (const s of strokes) if (s.delay <= 0) drawStroke(s);
  }

  // Particles
  for (const p of parts) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.life += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = 1 - p.life / p.max;
    if (k <= 0) continue;
    if (p.kind === "spark") {
      p.vy += 40 * dt;
      g.fillStyle = `rgb(255 ${170 + 60 * k | 0} 80 / ${k})`;
      g.beginPath(); g.arc(p.x, p.y, 1.2 + 1.6 * k, 0, 7); g.fill();
    } else if (p.kind === "firefly") {
      p.vx += Math.sin(p.life * 3 + p.ph) * 60 * dt;
      const a = Math.min(1, p.life * 2) * k * (0.6 + 0.4 * Math.sin(p.life * 9 + p.ph));
      g.fillStyle = `rgb(255 214 110 / ${a * 0.25})`;
      g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill();
      g.fillStyle = `rgb(255 236 170 / ${a})`;
      g.beginPath(); g.arc(p.x, p.y, 1.8, 0, 7); g.fill();
    } else if (p.kind === "rain") {
      g.strokeStyle = `rgb(190 210 230 / ${0.35 * Math.min(1, k * 3)})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); g.stroke();
    }
  }
  parts = parts.filter((p) => p.delay > 0 || p.life < p.max);

  if (bolt) {
    bolt.life += dt;
    const a = Math.max(0, 1 - bolt.life / 0.5);
    g.strokeStyle = `rgb(245 248 255 / ${a})`;
    g.lineWidth = 2.5;
    g.shadowColor = "rgb(180 200 255)";
    g.shadowBlur = 18;
    g.beginPath();
    bolt.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.shadowBlur = 0;
    if (a <= 0) bolt = null;
  }
  if (flash > 0) {
    g.fillStyle = `rgb(235 240 255 / ${flash * 0.55})`;
    g.fillRect(0, 0, W, H);
    flash = Math.max(0, flash - dt * 3.5);
  }
  requestAnimationFrame(frame);
}
function tip(s, t) {
  // Vines curl as they grow; frost runs straight.
  const a = s.a + s.curl * t * 0.5;
  return [s.x + Math.cos((s.a + a) / 2) * s.len * t, s.y + Math.sin((s.a + a) / 2) * s.len * t];
}
function drawStroke(s) {
  const t = s.grown;
  const [ex, ey] = tip(s, t);
  g.strokeStyle = s.color.replace("A", String(fade * (s.kind === "frost" ? 0.85 : 0.95)));
  g.lineWidth = Math.max(0.6, s.w);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(s.x, s.y);
  if (s.kind === "vine") {
    const [mx, my] = tip(s, t * 0.5);
    g.quadraticCurveTo(mx + Math.cos(s.a + 1.57) * s.curl * s.len * 0.12, my + Math.sin(s.a + 1.57) * s.curl * s.len * 0.12, ex, ey);
  } else g.lineTo(ex, ey);
  g.stroke();
  if (s.kind === "vine" && t >= 1 && s.depth <= 3) {
    // A leaf at the tip.
    g.fillStyle = `rgb(${s.depth % 2 ? "92 150 78" : "140 190 100"} / ${fade * 0.9})`;
    g.save(); g.translate(ex, ey); g.rotate(s.a + s.curl);
    g.beginPath(); g.ellipse(7, 0, 8, 3.6, 0, 0, 7); g.fill();
    g.restore();
  }
}
requestAnimationFrame(frame);
window.__spell = (name) => SPELLS.find((s) => s.name === name)?.cast();
