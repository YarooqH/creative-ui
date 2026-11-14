// Day 15 · Film Strip
// A pinned editing bench. Scroll runs a reel of 35mm film sideways under a
// red playhead; whichever frame sits under it is shown in the viewer above,
// stepping frame by frame like a real gate, with a running 24 fps timecode.
// Every frame is painted in code (three shots of one night crossing), once
// into a long strip canvas and again, full size, in the viewer. The viewer
// adds what the projector would: grain that changes each frame, a little
// gate weave and flicker, and a vignette. Plain sticky + rAF, no libraries.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const reel = document.getElementById("reel");
const gate = document.getElementById("gate");
const film = document.getElementById("film");
const strip = document.getElementById("strip");
const shotEl = document.getElementById("shot");
const tcEl = document.getElementById("tc");
const hint = document.getElementById("hint");
const vg = gate.getContext("2d");
const fg = film.getContext("2d");

const PER = 32;
const SHOTS = [
  { name: "Harbour", paint: harbour },
  { name: "Lighthouse", paint: lighthouse },
  { name: "Moonrise", paint: moonrise },
];
const NF = PER * SHOTS.length;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

let seed = 15;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const STARS = Array.from({ length: 140 }, () => [rand(), rand() * 0.6, 0.4 + rand() * 1.2, rand()]);

/* ---------- The three shots, painted at any size ---------- */

function sky(g, w, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}
function stars(g, w, h, horizon, k, twinkle) {
  for (const [x, y, r, p] of STARS) {
    if (y * h > horizon - 4) continue;
    g.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(p * 40 + twinkle))) * k;
    g.fillStyle = "#fff6e0";
    g.fillRect(x * w, y * h, r * (w / 900), r * (w / 900));
  }
  g.globalAlpha = 1;
}
function waves(g, w, h, horizon, colour, u, n = 18) {
  g.strokeStyle = colour;
  g.lineWidth = Math.max(1, w / 700);
  for (let i = 0; i < n; i++) {
    const t = i / n, y = horizon + (h - horizon) * t * t + 3;
    const len = w * (0.03 + t * 0.09);
    for (let k = 0; k < 6; k++) {
      const x = ((k * 0.21 + ((Math.sin(i * 12.9898 + k * 4.1) * 43758.5453) % 1 + 1) % 1 * 0.2 + u * (0.3 + t)) % 1.3 - 0.15) * w;
      g.globalAlpha = 0.25 + t * 0.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

function harbour(g, w, h, u) {
  const horizon = h * 0.62;
  sky(g, w, horizon, [[0, "#20314a"], [0.55, "#7c5a6e"], [1, "#f0a26a"]]);
  // A low sun, half gone.
  g.fillStyle = "#ffd59a";
  g.beginPath(); g.arc(w * 0.72, horizon + h * 0.01, h * 0.07, Math.PI, 0); g.fill();
  g.fillStyle = "#1a2433";
  g.fillRect(0, horizon, w, h - horizon);
  // Sun on the water.
  for (let i = 0; i < 10; i++) {
    g.fillStyle = `rgb(255 200 140 / ${0.5 - i * 0.04})`;
    const y = horizon + 4 + i * i * h * 0.004;
    const ww = w * (0.05 + i * 0.01) * (0.8 + 0.2 * Math.sin(u * 30 + i));
    g.fillRect(w * 0.72 - ww / 2, y, ww, Math.max(1, h * 0.006));
  }
  waves(g, w, h, horizon, "#41536b", u);
  // Harbour wall and a lamp on the left.
  g.fillStyle = "#0d1219";
  g.fillRect(0, horizon - h * 0.05, w * 0.16, h * 0.05 + 2);
  g.fillRect(w * 0.12, horizon - h * 0.2, w * 0.006, h * 0.15);
  g.fillStyle = "#ffe2a0";
  g.beginPath(); g.arc(w * 0.123, horizon - h * 0.2, h * 0.012, 0, Math.PI * 2); g.fill();
  // The ferry crosses.
  const x = lerp(-0.25, 1.05, u) * w, s = h / 270, y = horizon + h * 0.02;
  g.save();
  g.translate(x, y);
  g.fillStyle = "#0b0f15";
  g.beginPath();
  g.moveTo(0, -18 * s); g.lineTo(150 * s, -18 * s); g.lineTo(140 * s, 0); g.lineTo(12 * s, 0); g.closePath(); g.fill();
  g.fillRect(28 * s, -34 * s, 90 * s, 16 * s);
  g.fillRect(48 * s, -46 * s, 46 * s, 12 * s);
  g.fillRect(100 * s, -62 * s, 10 * s, 28 * s);
  g.fillStyle = "#ffcf7a";
  for (let k = 0; k < 8; k++) g.fillRect((34 + k * 10.5) * s, -29 * s, 5 * s, 5 * s);
  for (let k = 0; k < 3; k++) g.fillRect((54 + k * 13) * s, -42 * s, 6 * s, 4 * s);
  // Smoke drifting back.
  g.fillStyle = "rgb(200 190 200 / 0.18)";
  for (let k = 0; k < 6; k++) {
    g.beginPath(); g.arc((96 - k * 16) * s, (-70 - k * 6) * s, (6 + k * 3) * s, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // Wake.
  g.strokeStyle = "rgb(220 230 240 / 0.35)";
  g.lineWidth = Math.max(1, s);
  g.beginPath(); g.moveTo(x + 6 * s, y + 3 * s); g.lineTo(x - 90 * s, y + 9 * s); g.stroke();
}

function lighthouse(g, w, h, u) {
  const horizon = h * 0.66;
  sky(g, w, horizon, [[0, "#070b18"], [1, "#1b2540"]]);
  stars(g, w, h, horizon, 1, u * 6);
  g.fillStyle = "#0b111f";
  g.fillRect(0, horizon, w, h - horizon);
  waves(g, w, h, horizon, "#2a3756", u * 0.6);
  // Headland and tower.
  const tx = w * 0.7, top = h * 0.3;
  g.fillStyle = "#04060c";
  g.beginPath();
  g.moveTo(w * 0.5, h); g.quadraticCurveTo(w * 0.62, horizon - h * 0.12, w * 0.8, horizon - h * 0.1);
  g.lineTo(w, horizon - h * 0.06); g.lineTo(w, h); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(tx - w * 0.022, horizon - h * 0.1); g.lineTo(tx - w * 0.014, top); g.lineTo(tx + w * 0.014, top); g.lineTo(tx + w * 0.022, horizon - h * 0.1); g.closePath(); g.fill();
  g.fillRect(tx - w * 0.02, top - h * 0.05, w * 0.04, h * 0.05);
  // The beam: sweeps right to left and back toward us.
  const a = lerp(-0.25, Math.PI + 0.6, u);
  const facing = Math.cos(a); // > 0 pointing right, < 0 pointing left
  const len = w * 1.2, spread = 0.07;
  const lx = tx, ly = top - h * 0.025;
  const gr = g.createRadialGradient(lx, ly, 0, lx, ly, len);
  gr.addColorStop(0, "rgb(255 240 190 / 0.75)");
  gr.addColorStop(1, "rgb(255 240 190 / 0)");
  g.fillStyle = gr;
  const dir = Math.atan2(Math.sin(a) * 0.12, facing);
  g.beginPath();
  g.moveTo(lx, ly);
  g.lineTo(lx + Math.cos(dir - spread) * len, ly + Math.sin(dir - spread) * len);
  g.lineTo(lx + Math.cos(dir + spread) * len, ly + Math.sin(dir + spread) * len);
  g.closePath(); g.fill();
  // The lamp flares when it points at us.
  const flare = Math.max(0, Math.sin(a)) ** 6;
  g.fillStyle = `rgb(255 244 210 / ${0.6 + flare * 0.4})`;
  g.beginPath(); g.arc(lx, ly, h * (0.012 + flare * 0.05), 0, Math.PI * 2); g.fill();
  if (flare > 0.05) {
    const fg2 = g.createRadialGradient(lx, ly, 0, lx, ly, h * 0.5 * flare);
    fg2.addColorStop(0, `rgb(255 240 200 / ${0.5 * flare})`);
    fg2.addColorStop(1, "rgb(255 240 200 / 0)");
    g.fillStyle = fg2;
    g.fillRect(0, 0, w, h);
  }
}

function moonrise(g, w, h, u) {
  const horizon = h * 0.6;
  sky(g, w, horizon, [[0, "#0a1020"], [0.7, "#1d2a44"], [1, "#3a4a68"]]);
  stars(g, w, h, horizon, 1 - u * 0.6, u * 4);
  const mx = w * 0.42, r = h * 0.11;
  const my = lerp(horizon + r * 1.1, horizon - h * 0.36, u);
  // Halo, then the moon, cut off by the sea.
  g.save();
  g.beginPath(); g.rect(0, 0, w, horizon); g.clip();
  const halo = g.createRadialGradient(mx, my, r, mx, my, r * 4);
  halo.addColorStop(0, "rgb(255 236 200 / 0.28)");
  halo.addColorStop(1, "rgb(255 236 200 / 0)");
  g.fillStyle = halo; g.fillRect(0, 0, w, horizon);
  g.fillStyle = "#fbecc9";
  g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgb(200 180 150 / 0.35)";
  g.beginPath(); g.arc(mx - r * 0.3, my - r * 0.2, r * 0.22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(mx + r * 0.25, my + r * 0.3, r * 0.15, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = "#0c1424";
  g.fillRect(0, horizon, w, h - horizon);
  // The moon's road on the water, broken by the swell.
  const k = clamp((horizon - my) / (h * 0.2));
  for (let i = 0; i < 26; i++) {
    const t = i / 26, y = horizon + 2 + (h - horizon) * t * t;
    const ww = w * (0.02 + t * 0.12) * (0.6 + 0.4 * Math.sin(i * 2.3 + u * 20));
    g.fillStyle = `rgb(255 236 200 / ${(0.55 - t * 0.35) * k})`;
    g.fillRect(mx - ww / 2 + Math.sin(i * 1.7 + u * 9) * w * 0.01, y, ww, Math.max(1, h * 0.005));
  }
  waves(g, w, h, horizon, "#2a3a58", u * 0.4, 14);
}

function paintFrame(g, w, h, f) {
  const s = Math.min(SHOTS.length - 1, Math.floor(f / PER));
  const u = (f - s * PER) / (PER - 1);
  SHOTS[s].paint(g, w, h, u);
}

/* ---------- The strip ---------- */

const src = document.createElement("canvas");
let stripDpr = 1;
const FW = 142, FH = 80, BAND = 16, GAP = 8, PITCH = FW + GAP, SH = FH + BAND * 2;
let lead = 0, mobileScale = 1;

function buildStrip() {
  mobileScale = innerWidth < 700 ? 0.8 : 1;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  lead = 3; // a little blank leader at each end
  const total = (NF + lead * 2) * PITCH;
  src.width = Math.round(total * dpr);
  src.height = Math.round(SH * dpr);
  stripDpr = dpr;
  // The visible window onto the strip: as wide as the table.
  const tw = strip.parentElement.clientWidth;
  film.width = Math.round(tw * dpr);
  film.height = Math.round(SH * mobileScale * dpr);
  film.style.width = tw + "px";
  film.style.height = SH * mobileScale + "px";
  const g = src.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Film base: a warm, slightly translucent amber-brown.
  g.fillStyle = "#3a2516";
  g.fillRect(0, 0, total, SH);
  g.fillStyle = "rgb(255 170 90 / 0.08)";
  g.fillRect(0, 0, total, SH);
  // Sprocket holes, four per frame, top and bottom.
  g.fillStyle = "#1a120c";
  for (let x = 6; x < total; x += PITCH / 4) {
    for (const y of [4, SH - 12]) {
      g.beginPath(); g.roundRect(x, y, 9, 8, 1.6); g.fill();
    }
  }
  g.font = "700 8px 'Courier Prime', monospace";
  g.textBaseline = "middle";
  for (let i = 0; i < NF + lead * 2; i++) {
    const x = i * PITCH + GAP / 2, f = i - lead;
    g.save();
    g.beginPath(); g.roundRect(x, BAND, FW, FH, 3); g.clip();
    if (f < 0 || f >= NF) {
      g.fillStyle = "#120c08"; g.fillRect(x, BAND, FW, FH);
    } else {
      g.translate(x, BAND);
      paintFrame(g, FW, FH, f);
    }
    g.restore();
    // Edge numbers, printed into the margin every eight frames.
    if (f >= 0 && f < NF && f % 8 === 0) {
      g.fillStyle = "rgb(255 190 120 / 0.75)";
      g.fillText(`▸ ${String(f).padStart(3, "0")}`, x + 4, SH - BAND / 2 + 0.5);
    }
    // A splice between shots: a strip of tape across the join.
    if (f > 0 && f < NF && f % PER === 0) {
      g.fillStyle = "rgb(240 230 210 / 0.22)";
      g.fillRect(x - GAP / 2 - 6, 0, 12, SH);
    }
  }
}

/* ---------- The viewer ---------- */

const grain = [];
function buildGrain() {
  for (let k = 0; k < 6; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    const im = g.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = rand() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    grain.push(c);
  }
}
buildGrain();

function sizeGate() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = gate.getBoundingClientRect();
  gate.width = Math.round(r.width * dpr);
  gate.height = Math.round(r.height * dpr);
  document.documentElement.style.setProperty("--vw", r.width + "px");
}

function drawGate(f) {
  const w = gate.width, h = gate.height;
  vg.setTransform(1, 0, 0, 1, 0, 0);
  vg.fillStyle = "#000";
  vg.fillRect(0, 0, w, h);
  // Gate weave: the frame never sits quite still.
  const wx = reduceMotion ? 0 : Math.sin(f * 2.1) * w * 0.0012;
  const wy = reduceMotion ? 0 : Math.cos(f * 1.3) * h * 0.002;
  vg.save();
  vg.translate(wx, wy);
  paintFrame(vg, w, h, f);
  vg.restore();
  // Flicker, grain, vignette.
  const flick = reduceMotion ? 0 : 0.04 + 0.04 * Math.sin(f * 12.9898);
  vg.fillStyle = `rgb(0 0 0 / ${flick})`;
  vg.fillRect(0, 0, w, h);
  vg.globalCompositeOperation = "overlay";
  vg.globalAlpha = 0.16;
  vg.fillStyle = vg.createPattern(grain[f % grain.length], "repeat");
  vg.fillRect(0, 0, w, h);
  vg.globalAlpha = 1;
  vg.globalCompositeOperation = "source-over";
  const vig = vg.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  vig.addColorStop(0, "rgb(0 0 0 / 0)");
  vig.addColorStop(1, "rgb(0 0 0 / 0.55)");
  vg.fillStyle = vig;
  vg.fillRect(0, 0, w, h);
}

function timecode(f) {
  const ff = f % 24, s = Math.floor(f / 24);
  const p = (n) => String(n).padStart(2, "0");
  return `00:00:${p(s)}:${p(ff)}`;
}

/* ---------- Scroll ---------- */

function layout() { buildStrip(); sizeGate(); last = -1; lastX = null; }
let last = -1, lastX = null;
document.fonts.ready.then(layout);
layout();
addEventListener("resize", layout);

function frame() {
  const r = reel.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  // Continuous position along the strip, in frames; the gate shows whole ones.
  const pos = p * (NF - 0.001);
  const f = Math.min(NF - 1, Math.floor(pos));
  // Copy the stretch of strip under the table, centred on the playhead.
  const centre = lead * PITCH + pos * PITCH;
  if (centre !== lastX) {
    lastX = centre;
    const half = film.width / 2 / mobileScale;
    const sx = centre * stripDpr - half;
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, film.width, film.height);
    fg.drawImage(src, sx, 0, film.width / mobileScale, src.height, 0, 0, film.width, film.height);
  }
  if (f !== last) {
    last = f;
    drawGate(f);
    tcEl.textContent = timecode(f);
    shotEl.textContent = SHOTS[Math.floor(f / PER)].name;
  }
  hint.style.opacity = p > 0.02 ? 0 : 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
