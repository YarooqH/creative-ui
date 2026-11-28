// Day 29 · Index Board
// Every finished piece as a row on a split-flap board, read live from days.json.
// Hovering or focusing a row flutters its name and develops a preview beside it.

import { loadDays, pad } from "../site/data.js";

const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&-.'";
const COLS = 20;
const STEP_MS = 64, LAST_MS = 240;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- One split-flap tile ---------- */

class Flap {
  constructor() {
    this.char = " ";
    this.target = " ";   // where the tile will come to rest
    this.queue = [];
    this.running = false;
    this.el = document.createElement("span");
    this.el.className = "flap";
    this.el.innerHTML =
      '<span class="half top"><span></span></span><span class="half bottom"><span></span><i class="shade"></i></span>' +
      '<span class="leaf top"><span></span><i class="shade"></i></span><span class="leaf bottom"><span></span><i class="shade"></i></span>';
    const q = (s) => this.el.querySelector(s);
    this.topHalf = q(".half.top span");
    this.botHalf = q(".half.bottom span");
    this.botShade = q(".half.bottom .shade");
    this.topLeaf = q(".leaf.top");
    this.botLeaf = q(".leaf.bottom");
    this.topShade = q(".leaf.top .shade");
    this.botLeafShade = q(".leaf.bottom .shade");
  }
  paint(c) { for (const s of this.el.querySelectorAll(".half > span, .leaf > span")) s.textContent = c; }
  path(target, max) {
    let i = Math.max(0, CHARSET.indexOf(this.char));
    const j = Math.max(0, CHARSET.indexOf(target));
    let dist = (j - i + CHARSET.length) % CHARSET.length;
    if (dist > max) { i = (j - max + CHARSET.length) % CHARSET.length; dist = max; }
    const out = [];
    for (let k = 1; k <= dist; k++) out.push(CHARSET[(i + k) % CHARSET.length]);
    return out;
  }
  to(target, max = 7, delay = 0) {
    this.target = target;
    if (reduce) { this.char = target; this.paint(target); return; }
    const p = this.path(target, max);
    if (p.length) this.play(p, delay);
  }
  flutter(delay) {
    if (reduce || this.target === " ") return;
    const extra = [...CHARSET.slice(1, 27)].sort(() => Math.random() - 0.5).slice(0, 2);
    this.play([...extra, this.target], delay);
  }
  async play(chars, delay = 0) {
    this.queue = chars.slice();
    if (this.running) return;
    this.running = true;
    if (delay) await wait(delay);
    while (this.queue.length) await this.step(this.queue.shift(), this.queue.length === 0);
    this.running = false;
  }
  async step(next, last) {
    const cur = this.char;
    const half = (last ? LAST_MS : STEP_MS) / 2;
    this.topHalf.textContent = next;
    this.botHalf.textContent = cur;
    this.topLeaf.firstElementChild.textContent = cur;
    this.botLeaf.firstElementChild.textContent = next;
    const fall = this.topLeaf.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }],
      { duration: half, easing: "cubic-bezier(.55,0,1,.6)", fill: "forwards" });
    this.topShade.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: half, fill: "forwards" });
    this.botShade.animate([{ opacity: 0 }, { opacity: 0.3 }], { duration: half, fill: "forwards" });
    await fall.finished;
    const frames = last
      ? [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)", offset: 0.55 }, { transform: "rotateX(12deg)", offset: 0.78 }, { transform: "rotateX(0deg)" }]
      : [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }];
    const rise = this.botLeaf.animate(frames, { duration: last ? half * 2.2 : half, easing: last ? "ease-out" : "cubic-bezier(0,.4,.45,1)", fill: "forwards" });
    this.botLeafShade.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: half, fill: "forwards" });
    await rise.finished;
    this.char = next;
    this.paint(next);
    for (const a of this.el.getAnimations({ subtree: true })) a.cancel();
  }
}

/* ---------- Board ---------- */

const board = document.getElementById("board");
const shot = document.getElementById("shot"), still = document.getElementById("still"), clip = document.getElementById("clip");
const nameEl = document.getElementById("name"), lineEl = document.getElementById("line"), go = document.getElementById("go");

const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9&\-.' ]/g, " ").slice(0, COLS);
const rows = [];
let current = -1;

function describe(d) {
  return d.twist ? `${d.spark} × ${d.twist.charAt(0).toLowerCase()}${d.twist.slice(1)}` : d.spark;
}

function select(i, { flutter = true } = {}) {
  if (i === current || !rows[i]) return;
  const prev = rows[current];
  if (prev) prev.el.classList.remove("on");
  current = i;
  const r = rows[i];
  r.el.classList.add("on");
  if (flutter) r.title.forEach((f, k) => f.flutter(k * 18));

  // The preview: the still develops first, then the running piece fades in over it.
  const d = r.day;
  nameEl.textContent = d.title;
  lineEl.textContent = describe(d);
  go.href = d.href;
  clip.classList.remove("live");
  clip.pause();
  shot.classList.remove("develop");
  void shot.offsetWidth;
  still.src = d.posterUrl || "";
  still.alt = `${d.title}, a still`;
  shot.classList.add("develop");
  if (d.videoUrl && !reduce) {
    clip.src = d.videoUrl;
    clip.currentTime = 0;
    const token = i;
    clip.onplaying = () => { if (current === token) clip.classList.add("live"); };
    setTimeout(() => { if (current === token) clip.play().catch(() => {}); }, 450);
  }
}

// Moving the pointer down the board quickly shouldn't start a dozen previews.
let hoverTimer = 0;
const touch = matchMedia("(hover: none)").matches;
if (touch) document.querySelector(".lede").textContent = "Tap a row to preview it, then Open.";

function build(days) {
  board.innerHTML = "";
  days.forEach((d, i) => {
    const a = document.createElement("a");
    a.className = "row";
    a.href = d.href;
    a.setAttribute("aria-label", d.title);
    const num = document.createElement("span");
    num.className = "num";
    num.setAttribute("aria-hidden", "true");
    const title = document.createElement("span");
    title.className = "title";
    title.setAttribute("aria-hidden", "true");
    const n = [new Flap(), new Flap()];
    const t = Array.from({ length: COLS }, () => new Flap());
    n.forEach((f) => num.append(f.el));
    t.forEach((f) => title.append(f.el));
    a.append(num, title);
    board.append(a);
    const row = { el: a, day: d, num: n, title: t };
    rows.push(row);

    // Flip every row in, top to bottom.
    const label = pad(d.day);
    const text = clean(d.title).padEnd(COLS, " ");
    n.forEach((f, k) => f.to(label[k], 9, i * 70 + k * 30));
    t.forEach((f, k) => { if (text[k] !== " ") f.to(text[k], 6, i * 70 + 120 + k * 22); });

    a.addEventListener("pointerenter", () => {
      if (touch) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => select(i), 90);
    });
    a.addEventListener("focus", () => select(i));
    a.addEventListener("click", (e) => {
      // On touch screens the first tap previews; the second (or Open) goes.
      if (touch && current !== i) { e.preventDefault(); select(i); }
    });
    a.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        rows[(i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length].el.focus();
      }
    });
  });
  select(0, { flutter: false });
}

loadDays("../")
  .then((days) => build(days.filter((d) => d.day !== 29)))
  .catch(() => { board.textContent = "The index could not be loaded."; });
