// Day 17 · Zoomable Diary
// A year of diary entries laid out on one plane, drawn on a canvas with a
// zoom you can drive by wheel, pinch, drag, double-click or keys. Nothing
// switches pages: what changes is how much each part of the plane says at
// its current size. From far away a day is one heatmap square; closer, it
// earns its date, then a one-word headline, then hour rows, then the notes
// written in each hour, then where they were written. Every label has a
// minimum size it needs and fades in across a range, so it only appears once
// it fits and labels at different levels never sit on top of each other.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("diary");
const g = canvas.getContext("2d");
const crumbs = document.getElementById("crumbs");
const yearBtn = document.getElementById("year");
const hint = document.getElementById("hint");

const SERIF = '"Newsreader", Georgia, serif';
const SANS = '"Sora", "Helvetica Neue", Arial, sans-serif';
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const fade = (v, from, to) => smooth((v - from) / (to - from));

/* ---------- A year of entries ---------- */

let seed = 17;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];

const NOTES = [
  "Coffee on the step before anyone else was up", "Rain all morning, the good kind", "Finished the chapter with the lighthouse",
  "Long call with Mum about the garden", "Bike chain came off on the hill again", "First tomatoes, small and very sour",
  "Wrote three pages, kept one", "The fox was back by the bins", "Bread didn't rise. Ate it anyway", "Swam to the buoy and back",
  "Train late, read the whole way", "Sorted the box of old letters", "New notebook, same handwriting", "Cut my hair myself. Mistake",
  "Watched the storm from the window", "Lunch outside for the first time this year", "Walked home the long way",
  "Paid the bills, felt like an adult", "Couldn't sleep, made tea, wrote this", "Market had the first strawberries",
  "Fixed the dripping tap at last", "Saw the swifts leave", "Sat with the cat for an hour", "Painted the door blue",
  "Lost an umbrella, found a better one", "Planted garlic in the dark",
  "Ran the river loop without stopping", "Wrote a letter I won't send", "Too tired to write much",
  "Picnic in the park with everyone", "Heard the band through the wall", "Bought flowers for no reason",
];
const PLACES = ["kitchen", "back step", "train", "desk", "garden", "café", "bed", "park bench", "library", "allotment"];
const WORDS = ["quiet", "rain", "garden", "letters", "swim", "tired", "bright", "stuck", "slow", "good", "windy", "busy", "home", "away", "fog", "sun"];

const year = 2026;
const days = [];
for (let m = 0; m < 12; m++) {
  const n = new Date(year, m + 1, 0).getDate();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  for (let d = 1; d <= n; d++) {
    const season = 0.5 + 0.35 * Math.sin(((m * 30 + d) / 365) * Math.PI * 2 - 1.4);
    const mood = clamp(season * 0.6 + rand() * 0.5);
    const count = rand() < 0.12 ? 0 : Math.min(5, Math.floor(mood * 4.5 + rand() * 1.5));
    const hours = [];
    while (hours.length < count) {
      const h = 7 + Math.floor(rand() * 17);
      if (!hours.includes(h)) hours.push(h);
    }
    hours.sort((a, b) => a - b);
    const notes = {};
    for (const h of hours) notes[h] = { text: pick(NOTES), place: pick(PLACES), temp: Math.round(4 + season * 18 + rand() * 4) };
    const pos = offset + d - 1;
    days.push({
      m, d, dow: (offset + d - 1) % 7, col: pos % 7, row: Math.floor(pos / 7),
      heat: count === 0 ? 0 : clamp(count / 5 * 0.75 + mood * 0.25), notes, count,
      word: count ? pick(WORDS) : "",
    });
  }
}

/* ---------- Layout of the plane (world units: one day = 1) ---------- */

const P = 1.1, CELLGAP = 0.1, HEAD = 1.3, MGAP = 1.5;
const MW = 7 * P - CELLGAP, MH = HEAD + 6 * P - CELLGAP;
// Four months across on a wide screen, two on a phone.
let COLS = 4, YW = 0, YH = 0;
const monthPos = (m) => [(m % COLS) * (MW + MGAP), Math.floor(m / COLS) * (MH + MGAP)];
function layoutYear() {
  COLS = innerWidth < 700 ? 2 : 4;
  const rows = 12 / COLS;
  YW = COLS * MW + (COLS - 1) * MGAP;
  YH = rows * MH + (rows - 1) * MGAP;
  for (const day of days) {
    const [mx, my] = monthPos(day.m);
    day.x = mx + day.col * P;
    day.y = my + HEAD + day.row * P;
  }
}
layoutYear();
const H0 = 7, H1 = 24, ROWS = H1 - H0;
const HOURTOP = 0.13, HOURH = (0.97 - HOURTOP) / ROWS;
const hourLabel = (h) => (h === 12 ? "12 pm" : h > 12 ? `${h - 12} pm` : `${h} am`);

/* ---------- Colour ---------- */

const STOPS = [[0, [33, 39, 72]], [0.3, [64, 58, 150]], [0.55, [126, 86, 222]], [0.78, [226, 116, 156]], [1, [255, 207, 90]]];
function heatRGB(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const k = (t - a) / (b - a);
      return ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
for (const day of days) {
  day.rgb = heatRGB(day.heat);
  const [r, gg, b] = day.rgb;
  day.light = (0.299 * r + 0.587 * gg + 0.114 * b) / 255 > 0.6;
}

/* ---------- View ---------- */

let W = 0, H = 0, dpr = 1;
const view = { cx: 0, cy: 0, k: 40 };
let kFit = 40;
function fitYear() {
  const top = 90, pad = 40;
  kFit = Math.min((W - pad * 2) / YW, (H - top - pad) / YH);
  return { cx: YW / 2, cy: YH / 2 - (top - pad) / 2 / kFit, k: kFit };
}
function resize() {
  const cols = COLS;
  layoutYear();
  if (cols !== COLS) anim = null, view.k = 0;
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (!anim && view.k <= kFit * 1.01 + 1e-9) Object.assign(view, fitYear()); else fitYear();
  dirty = true;
}
let dirty = true, anim = null;
resize();
addEventListener("resize", resize);

const toScreen = (x, y) => [(x - view.cx) * view.k + W / 2, (y - view.cy) * view.k + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2) / view.k + view.cx, (sy - H / 2) / view.k + view.cy];
const KMAX = 9000;

function zoomAround(sx, sy, factor) {
  const [wx, wy] = toWorld(sx, sy);
  const k = clamp(view.k * factor, kFit * 0.7, KMAX);
  view.cx = wx - (sx - W / 2) / k;
  view.cy = wy - (sy - H / 2) / k;
  view.k = k;
  anim = null;
  dirty = true;
  seen();
}

// Animated moves interpolate the zoom in log space, so a deep dive feels even.
function flyTo(target, dur = 1.0) {
  if (reduceMotion) { Object.assign(view, target); dirty = true; return; }
  anim = { from: { ...view }, to: target, t: 0, dur };
}
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; }
function stepAnim(dt) {
  if (!anim) return;
  anim.t = Math.min(1, anim.t + dt / anim.dur);
  const e = ease(anim.t);
  const { from: a, to: b } = anim;
  const la = Math.log(a.k), lb = Math.log(b.k);
  const k = Math.exp(la + (lb - la) * e);
  // Keep the path's centre moving in step with the zoom, not ahead of it.
  const s = Math.abs(lb - la) > 1e-6 ? (1 / a.k - 1 / k) / (1 / a.k - 1 / b.k) : e;
  view.k = k;
  view.cx = a.cx + (b.cx - a.cx) * s;
  view.cy = a.cy + (b.cy - a.cy) * s;
  dirty = true;
  if (anim.t >= 1) anim = null;
}

/* ---------- Finding what's under a point ---------- */

function monthAt(x, y) {
  for (let m = 0; m < 12; m++) {
    const [mx, my] = monthPos(m);
    if (x >= mx - MGAP / 2 && x <= mx + MW + MGAP / 2 && y >= my - MGAP / 2 && y <= my + MH + MGAP / 2) return m;
  }
  return -1;
}
function dayAt(x, y) {
  return days.find((d) => x >= d.x && x <= d.x + 1 && y >= d.y && y <= d.y + 1);
}

function dive(sx, sy) {
  const [x, y] = toWorld(sx, sy);
  const usable = H - 90;
  if (view.k < 70) {
    const m = monthAt(x, y);
    if (m < 0) return;
    const [mx, my] = monthPos(m);
    const k = Math.min((W - 80) / MW, (usable - 40) / MH);
    flyTo({ cx: mx + MW / 2, cy: my + MH / 2 - 45 / k, k });
  } else if (view.k < 300) {
    const d = dayAt(x, y);
    if (!d) return;
    const k = Math.min(W - 80, usable - 40);
    flyTo({ cx: d.x + 0.5, cy: d.y + 0.5 - 45 / k, k });
  } else {
    const d = dayAt(x, y);
    if (!d) return;
    const h = clamp(Math.floor((y - d.y - HOURTOP) / HOURH), 0, ROWS - 1);
    // Close enough to read: rows tall, the day's left edge kept in view.
    const k = Math.min(KMAX, 92 / HOURH);
    flyTo({ cx: d.x + (W / 2 - 48) / k, cy: d.y + HOURTOP + (h + 0.5) * HOURH, k });
  }
  seen();
}
window.__diaryDive = dive;
window.__diaryZoom = (sx, sy, f) => zoomAround(sx, sy, f);

/* ---------- Input ---------- */

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomAround(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
}, { passive: false });

const pointers = new Map();
let pinch = null;
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  anim = null;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 1) {
    view.cx -= (e.clientX - prev[0]) / view.k;
    view.cy -= (e.clientY - prev[1]) / view.k;
    dirty = true;
  } else if (pinch) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAround((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d);
    pinch.d = d;
  }
});
const lift = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
canvas.addEventListener("pointerup", lift);
canvas.addEventListener("pointercancel", lift);
canvas.addEventListener("dblclick", (e) => dive(e.clientX, e.clientY));
addEventListener("keydown", (e) => {
  if (e.key === "Escape") flyTo(fitYear(), 1.1);
  else if (e.key === "+" || e.key === "=") zoomAround(W / 2, H / 2, 1.6);
  else if (e.key === "-") zoomAround(W / 2, H / 2, 1 / 1.6);
  else if (e.key === "Enter" && document.activeElement === canvas) dive(W / 2, H / 2);
});
yearBtn.addEventListener("click", () => flyTo(fitYear(), 1.2));
function seen() { hint.style.opacity = 0; }

/* ---------- Drawing ---------- */

function rrect(x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}
function fitText(text, max) {
  if (g.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (g.measureText(text.slice(0, mid) + "…").width <= max) lo = mid; else hi = mid - 1;
  }
  return lo > 3 ? text.slice(0, lo).trimEnd() + "…" : "";
}

function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#0f1222";
  g.fillRect(0, 0, W, H);
  const k = view.k;
  const rowPx = HOURH * k;
  const inner = fade(k, 230, 360); // the day opens into hours
  g.textBaseline = "alphabetic";

  for (let m = 0; m < 12; m++) {
    const [mx, my] = monthPos(m);
    const [sx, sy] = toScreen(mx, my);
    if (sx > W || sy > H || sx + MW * k < 0 || sy + MH * k < 0) continue;
    // Month name, sized to the month and never larger than it can hold.
    const fs = clamp(k * 0.62, 12, 34);
    const ma = 1 - fade(k, 500, 800);
    if (ma > 0) {
      g.globalAlpha = ma;
      g.fillStyle = "#f3eedf";
      g.font = `500 ${fs}px ${SERIF}`;
      g.fillText(MONTHS[m], sx, sy + HEAD * k - Math.max(6, k * 0.32));
      // Weekday initials above the columns, once there is room.
      const wa = fade(k, 46, 70) * ma;
      if (wa > 0) {
        g.globalAlpha = wa;
        g.fillStyle = "#8f93ad";
        g.font = `400 ${clamp(k * 0.13, 9, 13)}px ${SANS}`;
        for (let c = 0; c < 7; c++) g.fillText(DOW[c], sx + c * P * k + 2, sy + HEAD * k - 4 - k * 0.04);
      }
      g.globalAlpha = 1;
    }
  }

  for (const day of days) {
    const [sx, sy] = toScreen(day.x, day.y);
    const s = k;
    if (sx > W || sy > H || sx + s < 0 || sy + s < 0) continue;
    const [r, gg, b] = day.rgb;
    // The square: pure heat from afar, an open page once you are close.
    rrect(sx, sy, s, s, clamp(s * 0.12, 2, 18));
    g.fillStyle = `rgb(${r} ${gg} ${b})`;
    g.fill();
    if (inner > 0) {
      g.fillStyle = `rgb(22 26 48 / ${inner * 0.94})`;
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = `rgb(${r} ${gg} ${b})`;
      g.fillRect(sx, sy, s, s * 0.012 + 3);
      g.restore();
    }
    const ink = inner > 0.5 ? "#f3eedf" : day.light ? "#1a1630" : "#f3eedf";
    const pad = clamp(s * 0.06, 3, 22);

    // Date, then a weekday and the day's word once they fit beside it.
    const da = fade(s, 22, 34);
    if (da > 0) {
      const fs = clamp(s * 0.2, 9, 30);
      g.globalAlpha = da;
      g.fillStyle = ink;
      g.font = `600 ${fs}px ${SANS}`;
      g.fillText(String(day.d), sx + pad, sy + pad + fs * 0.85);
      const numW = g.measureText(String(day.d)).width;
      const wa = fade(s, 110, 160);
      if (wa > 0) {
        const fs2 = clamp(s * 0.1, 11, 20);
        g.font = `400 ${fs2}px ${SANS}`;
        g.globalAlpha = wa * 0.75;
        const dow = DOW[day.dow];
        g.fillText(dow, sx + pad + numW + fs2 * 0.6, sy + pad + fs * 0.85);
        const dowW = g.measureText(dow).width;
        if (day.word) {
          g.font = `italic 400 ${fs2 * 1.2}px ${SERIF}`;
          const room = s - pad * 2 - numW - dowW - fs2 * 1.6;
          const w = g.measureText(day.word).width;
          if (w <= room) {
            g.globalAlpha = wa;
            g.fillText(day.word, sx + s - pad - w, sy + pad + fs * 0.85);
          }
        }
      }
      g.globalAlpha = 1;
    }
    // At month scale, a dot per note under the date.
    const dots = fade(s, 60, 90) * (1 - inner);
    if (dots > 0 && day.count) {
      g.globalAlpha = dots * 0.8;
      g.fillStyle = ink;
      const rr = clamp(s * 0.025, 1.5, 4);
      for (let i = 0; i < day.count; i++) {
        g.beginPath(); g.arc(sx + pad + rr + i * rr * 3, sy + s - pad - rr, rr, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }

    if (inner <= 0 || s < 200) continue;
    // Hours: a row each, the hour and its note when there is room.
    const la = fade(rowPx, 12, 18) * inner;
    const na = fade(rowPx, 17, 26) * inner;
    const pa = fade(rowPx, 60, 90) * inner;
    for (let i = 0; i < ROWS; i++) {
      const h = H0 + i;
      const ry = sy + (HOURTOP + i * HOURH) * s;
      if (ry > H || ry + rowPx < 0) continue;
      const note = day.notes[h];
      const lfs = clamp(rowPx * 0.32, 8, 15);
      const labelW = Math.max(lfs * 3.4, 34);
      if (note) {
        g.globalAlpha = inner;
        g.fillStyle = `rgb(${r} ${gg} ${b})`;
        rrect(sx + pad + labelW, ry + rowPx * 0.18, Math.max(3, rowPx * 0.08), rowPx * 0.64, 2);
        g.fill();
      }
      if (la > 0) {
        g.globalAlpha = la * (note ? 0.9 : 0.4);
        g.fillStyle = "#8f93ad";
        g.font = `400 ${lfs}px ${SANS}`;
        g.fillText(hourLabel(h), sx + pad, ry + rowPx * 0.5 + lfs * 0.35);
      }
      if (note && na > 0) {
        const nfs = clamp(rowPx * 0.42, 9, 30);
        const x0 = sx + pad + labelW + Math.max(3, rowPx * 0.08) + nfs * 0.6;
        const room = sx + s - pad - x0;
        g.globalAlpha = na;
        g.fillStyle = "#f3eedf";
        g.font = `400 ${nfs}px ${SERIF}`;
        const yBase = pa > 0 ? ry + rowPx * 0.48 : ry + rowPx * 0.5 + nfs * 0.33;
        g.fillText(fitText(note.text, room), x0, yBase);
        if (pa > 0) {
          const pfs = clamp(rowPx * 0.16, 9, 15);
          g.globalAlpha = pa * 0.8;
          g.fillStyle = "#8f93ad";
          g.font = `400 ${pfs}px ${SANS}`;
          g.fillText(fitText(`${note.place} · ${note.temp}°`, room), x0, yBase + pfs * 1.9);
        }
      }
    }
    g.globalAlpha = 1;
  }
}

/* ---------- Breadcrumb ---------- */

let crumbKey = "";
function updateCrumbs() {
  const [x, y] = toWorld(W / 2, H / 2 + 45);
  const parts = ["2026"];
  const m = view.k > kFit * 1.6 ? monthAt(x, y) : -1;
  if (m >= 0) {
    parts.push(MONTHS[m]);
    const d = view.k > 200 ? dayAt(x, y) : null;
    if (d) {
      parts.push(`${DOW[d.dow]} ${d.d}`);
      if (HOURH * view.k > 40) {
        const h = Math.floor((y - d.y - HOURTOP) / HOURH);
        if (h >= 0 && h < ROWS) parts.push(hourLabel(H0 + h));
      }
    }
  }
  const key = parts.join("|");
  if (key === crumbKey) return;
  const old = crumbKey.split("|");
  crumbKey = key;
  // Keep the spans that did not change, so only the new level animates in.
  const spans = [...crumbs.children];
  parts.forEach((p, i) => {
    if (spans[i] && old[i] === p) return;
    const el = document.createElement("span");
    el.textContent = p;
    if (spans[i]) spans[i].replaceWith(el); else crumbs.appendChild(el);
    spans[i] = el;
  });
  while (crumbs.children.length > parts.length) crumbs.lastChild.remove();
}

/* ---------- Loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepAnim(dt);
  if (dirty) { draw(); updateCrumbs(); dirty = false; }
  requestAnimationFrame(frame);
}
document.fonts.ready.then(() => { dirty = true; });
requestAnimationFrame(frame);
