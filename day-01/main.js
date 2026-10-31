// Day 01 · Departure Poster
// A Swiss grid poster whose headline is a split-flap departure board.
// Every motion runs on the Web Animations API, so the recorder can step it frame by frame.

const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-";
const COLS = 8;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const DEPARTURES = [
  { time: "09:40", lines: ["NEW", "FORMS", "DEPART"], plat: "04" },
  { time: "10:15", lines: ["TYPE", "IN", "TRANSIT"], plat: "04" },
  { time: "11:05", lines: ["GRID", "ARRIVES", "ON TIME"], plat: "07" },
  { time: "12:30", lines: ["MIND", "THE", "GUTTER"], plat: "02" },
];

const STEP_MS = 74;   // one ordinary flap: half falls, half rises
const LAST_MS = 300;  // the final flap lands slower, with a bounce

const rand = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class Flap {
  constructor(char = " ") {
    this.char = char;
    this.queue = [];
    this.running = false;
    this.el = document.createElement("div");
    this.el.className = "flap";
    this.el.innerHTML = `
      <div class="half top"><span></span></div>
      <div class="half bottom"><span></span><i class="shade"></i></div>
      <div class="leaf top"><span></span><i class="shade"></i></div>
      <div class="leaf bottom"><span></span><i class="shade"></i></div>`;
    const q = (s) => this.el.querySelector(s);
    this.topHalf = q(".half.top span");
    this.botHalf = q(".half.bottom span");
    this.botShade = q(".half.bottom .shade");
    this.topLeaf = q(".leaf.top");
    this.botLeaf = q(".leaf.bottom");
    this.topLeafShade = q(".leaf.top .shade");
    this.botLeafShade = q(".leaf.bottom .shade");
    this.paint(char);
  }

  paint(c) {
    for (const s of this.el.querySelectorAll("span")) s.textContent = c;
  }

  // Characters a real board would pass through on its way to `target`.
  pathTo(target, maxSteps) {
    let i = CHARSET.indexOf(this.char);
    const j = Math.max(0, CHARSET.indexOf(target));
    if (i < 0) i = 0;
    let dist = (j - i + CHARSET.length) % CHARSET.length;
    const path = [];
    if (dist > maxSteps) {
      i = (j - maxSteps + CHARSET.length) % CHARSET.length;
      dist = maxSteps;
    }
    for (let k = 1; k <= dist; k++) path.push(CHARSET[(i + k) % CHARSET.length]);
    return path;
  }

  flipTo(target, { maxSteps = 9, delay = 0 } = {}) {
    if (reduceMotion) return this.play([target], delay);
    const path = this.pathTo(target, maxSteps);
    return path.length ? this.play(path, delay) : Promise.resolve();
  }

  flutter() {
    if (this.running || reduceMotion) return;
    const back = this.char;
    const others = [...CHARSET.slice(1)].sort(() => Math.random() - 0.5).slice(0, 3);
    this.play([...others, back]);
  }

  async play(chars, delay = 0) {
    this.queue = chars.slice();
    if (this.running) return;
    this.running = true;
    if (delay) await wait(delay);
    while (this.queue.length) {
      const next = this.queue.shift();
      await this.step(next, this.queue.length === 0);
    }
    this.running = false;
  }

  async step(next, last) {
    const cur = this.char;
    const half = (last ? LAST_MS : STEP_MS) / 2;
    this.topHalf.textContent = next;
    this.botHalf.textContent = cur;
    this.topLeaf.firstElementChild.textContent = cur;
    this.botLeaf.firstElementChild.textContent = next;

    // The upper leaf falls toward the viewer and darkens as it turns away from the light.
    const fall = this.topLeaf.animate(
      [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }],
      { duration: half * (last ? 0.8 : 1), easing: "cubic-bezier(.55,0,1,.6)", fill: "forwards" }
    );
    this.topLeafShade.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: half, fill: "forwards" });
    this.botShade.animate([{ opacity: 0 }, { opacity: 0.3 }], { duration: half, fill: "forwards" });
    await fall.finished;

    // The lower leaf swings down onto the stop. The last one bounces off it.
    const frames = last
      ? [
          { transform: "rotateX(90deg)", offset: 0 },
          { transform: "rotateX(0deg)", offset: 0.48, easing: "cubic-bezier(.3,0,.6,1)" },
          { transform: "rotateX(16deg)", offset: 0.68, easing: "cubic-bezier(.4,0,.6,1)" },
          { transform: "rotateX(0deg)", offset: 0.84 },
          { transform: "rotateX(4deg)", offset: 0.93 },
          { transform: "rotateX(0deg)", offset: 1 },
        ]
      : [{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }];
    const dur = last ? half * 2.4 : half;
    const rise = this.botLeaf.animate(frames, {
      duration: dur,
      easing: last ? "linear" : "cubic-bezier(0,.4,.45,1)",
      fill: "forwards",
    });
    this.botLeafShade.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: dur * 0.5, fill: "forwards" });
    await rise.finished;

    // Settle: everything shows `next`, leaves reset out of sight.
    this.char = next;
    this.paint(next);
    for (const a of this.el.getAnimations({ subtree: true })) a.cancel();
  }
}

/* ---------- Build the board ---------- */

const board = document.getElementById("board");
const rows = [];
for (let r = 0; r < 3; r++) {
  const row = document.createElement("div");
  row.className = "board-row";
  row.setAttribute("aria-hidden", "true");
  const tiles = [];
  for (let c = 0; c < COLS; c++) {
    const f = new Flap(" ");
    f.el.addEventListener("pointerenter", () => f.flutter());
    row.append(f.el);
    tiles.push(f);
  }
  board.append(row);
  rows.push(tiles);
}
const boardLabel = document.createElement("span");
boardLabel.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)";
board.append(boardLabel);

const timeEl = document.getElementById("time");
const timeTiles = [..."00:00"].map((ch) => {
  const f = new Flap(" ");
  if (ch === ":") {
    f.el.classList.add("sep");
    f.paint(":");
    f.char = ":";
  }
  timeEl.append(f.el);
  return f;
});

/* ---------- Departures table ---------- */

const list = document.getElementById("rows");
const STATUS_LEN = 8;
const rowEls = DEPARTURES.map((d, i) => {
  const li = document.createElement("li");
  li.innerHTML = `
    <button class="row" type="button">
      <span class="t">${d.time}</span>
      <span class="d">${d.lines.map((l) => l[0] + l.slice(1).toLowerCase()).join(" ")}</span>
      <span class="p">${d.plat}</span>
      <span class="status" aria-label=""></span>
    </button>`;
  const btn = li.firstElementChild;
  const statusEl = btn.querySelector(".status");
  const flaps = Array.from({ length: STATUS_LEN }, () => new Flap(" "));
  flaps.forEach((f) => statusEl.append(f.el));
  btn.addEventListener("click", () => show(i, true));
  list.append(li);
  return { btn, statusEl, flaps };
});

function setStatus(i, text, cls, baseDelay) {
  const r = rowEls[i];
  r.statusEl.className = `status ${cls}`;
  r.statusEl.setAttribute("aria-label", text.trim());
  text.padEnd(STATUS_LEN).split("").forEach((ch, k) => {
    r.flaps[k].flipTo(ch, { maxSteps: 6, delay: baseDelay + k * 35 });
  });
}

/* ---------- Showing a departure ---------- */

let current = -1;
let autoTimer = 0;

function show(i, byUser = false) {
  if (i === current) return;
  current = i;
  const d = DEPARTURES[i];
  boardLabel.textContent = d.lines.join(" ");

  rows.forEach((tiles, r) => {
    const text = (d.lines[r] || "").padEnd(COLS);
    tiles.forEach((f, c) => {
      // Stagger left to right and top to bottom, with a little jitter so it feels mechanical.
      const delay = c * 55 + r * 130 + rand(0, 45);
      f.flipTo(text[c], { maxSteps: Math.round(rand(5, 12)), delay });
    });
  });

  [...d.time].forEach((ch, k) => {
    if (ch !== ":") timeTiles[k].flipTo(ch, { maxSteps: 10, delay: 300 + k * 90 });
  });

  rowEls.forEach((r, k) => {
    r.btn.setAttribute("aria-current", String(k === i));
    const [text, cls] = k < i ? ["DEPARTED", "is-departed"] : k === i ? ["BOARDING", "is-boarding"] : ["ON TIME", ""];
    setStatus(k, text, cls, 200 + k * 60);
  });

  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => show((current + 1) % DEPARTURES.length), byUser ? 14000 : 8000);
}

addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowRight") show((current + 1) % DEPARTURES.length, true);
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") show((current + DEPARTURES.length - 1) % DEPARTURES.length, true);
});

/* ---------- Station clock ---------- */

const clockEl = document.getElementById("clock");
const handH = document.querySelector(".hand-h");
const handM = document.querySelector(".hand-m");
const handS = document.querySelector(".hand-s");
const pad = (n) => String(n).padStart(2, "0");

function tick() {
  const now = new Date();
  const ms = now.getMilliseconds();
  const s = now.getSeconds() + ms / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  // Swiss railway style: the second hand sweeps the dial in 58.5s, then waits at 12.
  const sweep = Math.min(s / 58.5, 1) * 360;
  handS.style.transform = `rotate(${sweep}deg)`;
  // The minute hand jumps once a minute, like the real thing.
  handM.style.transform = `rotate(${Math.floor(m) * 6}deg)`;
  handH.style.transform = `rotate(${h * 30}deg)`;
  clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  requestAnimationFrame(tick);
}

/* ---------- Start ---------- */

document.fonts.ready.then(() => {
  tick();
  setTimeout(() => show(0), 350);
});
