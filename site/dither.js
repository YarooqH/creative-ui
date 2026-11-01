// Dithered type: text drawn as ordered-dither dots, lit like the moon.
//
// A light terminator sweeps across the words. Ahead of it the letters print
// as dense dots, behind it only faint "earthshine" dots remain, and the dots
// right on the terminator print in the accent colour. The terminator follows
// the pointer when it is over the element and drifts on its own otherwise.
//
//   const t = new DitherType(canvas, { lines: ["Hello", "world."], ink, accent });
//   t.start();

import { BAYER } from "./moon.js";

const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

export class DitherType {
  constructor(canvas, {
    lines,
    ink = [238, 235, 227],
    accent = [242, 64, 31],
    cell = 4,            // largest CSS px per dot cell (smaller on narrow boxes)
    weight = 800,
    family = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif',
    lineHeight = 0.98,
    tracking = -0.045,   // em
    accentWords = [],    // words printed fully in the accent colour
    drift = true,
    intro = true,
    hover = canvas,      // element whose pointer position steers the light
  } = {}) {
    Object.assign(this, { canvas, lines, ink, accent, weight, family, lineHeight, tracking, accentWords, drift });
    this.cellMax = cell;
    this.ctx = canvas.getContext("2d");
    this.mask = document.createElement("canvas");
    this.mctx = this.mask.getContext("2d", { willReadFrequently: true });
    this.amask = document.createElement("canvas");
    this.actx = this.amask.getContext("2d", { willReadFrequently: true });
    this.edge = intro ? -0.25 : 0.62;   // terminator position, 0..1 across
    this.target = 0.62;
    this.pointer = null;
    this.t0 = performance.now();
    this.running = false;
    this.frame = this.frame.bind(this);
    new ResizeObserver(() => this.layout()).observe(canvas.parentElement);
    hover.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer = (e.clientX - r.left) / r.width;
    });
    hover.addEventListener("pointerleave", () => { this.pointer = null; });
  }

  // Size the canvas to its box and rasterise the text mask at one pixel per dot.
  layout() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(box.width));
    // Dot size scales with the box so small screens keep legible letters.
    const cell = this.cellFixed ?? Math.max(2, Math.min(this.cellMax, Math.round(w / 300)));
    this.cell = cell;
    const cols = Math.floor(w / cell);
    // Font size so the longest line fills the width, measured on the same
    // context it is drawn with (letter-spacing included).
    const m = this.mctx;
    const fit = (size) => {
      m.font = `${this.weight} ${size}px ${this.family}`;
      m.letterSpacing = `${this.tracking * size}px`;
      return Math.max(...this.lines.map((l) => m.measureText(l).width));
    };
    let size = 100;
    for (let k = 0; k < 3; k++) size *= (cols * 0.97) / fit(size);
    const lh = size * this.lineHeight;
    const rows = Math.ceil(lh * (this.lines.length - 1) + size * 1.12);
    this.cols = cols;
    this.rows = rows;
    for (const c of [this.mask, this.amask]) { c.width = cols; c.height = rows; }
    for (const [ctx, onlyAccent] of [[this.mctx, false], [this.actx, true]]) {
      ctx.clearRect(0, 0, cols, rows);
      ctx.font = `${this.weight} ${size}px ${this.family}`;
      ctx.letterSpacing = `${this.tracking * size}px`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#000";
      this.lines.forEach((line, i) => {
        const y = size * 0.86 + i * lh;
        if (!onlyAccent) { ctx.fillText(line, 0, y); return; }
        // Accent words: draw only those words, at their offset in the line.
        let x = 0;
        for (const word of line.split(/(\s+)/)) {
          if (this.accentWords.includes(word.replace(/[.,]/g, ""))) ctx.fillText(word.replace(/[.,]/g, ""), x, y);
          x += ctx.measureText(word).width;
        }
      });
    }
    this.cover = this.mctx.getImageData(0, 0, cols, rows).data;
    this.acover = this.actx.getImageData(0, 0, cols, rows).data;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.round(cols * this.cell * dpr);
    this.canvas.height = Math.round(rows * this.cell * dpr);
    this.canvas.style.width = `${cols * this.cell}px`;
    this.canvas.style.height = `${rows * this.cell}px`;
    this.draw();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    if (this.pointer != null) this.target = this.pointer;
    else if (this.drift) this.target = 0.85 + 0.3 * Math.sin(t * 0.35);
    const before = this.edge;
    this.edge += (this.target - this.edge) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(this.edge - before) > 1e-4) this.draw();
    requestAnimationFrame(this.frame);
  }

  draw() {
    if (!this.cover) return;
    const { ctx, cols, rows, cell, dpr, cover, acover } = this;
    const s = cell * dpr;
    const dot = Math.max(1, Math.round(s * 0.78));
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const edgeX = this.edge * cols;
    const soft = cols * 0.16;       // width of the falloff behind the terminator
    const lit = [], red = [], faint = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (x + y * cols) * 4 + 3;
        const a = cover[i] / 255;
        if (a < 0.04) continue;
        // Light: full on the lit side, falling off across the terminator.
        const d = (edgeX - x) / soft;                 // >0 lit side
        const light = d >= 1 ? 1 : d <= 0 ? 0 : d * d * (3 - 2 * d);
        const th = BAYER[(x & 7) + (y & 7) * 8];
        const lum = a * (0.3 + light * 0.85);
        if (lum > th) {
          const onEdge = d > -0.05 && d < 0.22;
          (onEdge || acover[i] > 120 ? red : lit).push(x, y);
        } else if (a > 0.5 && th < 0.12) {
          faint.push(x, y);                           // earthshine on the dark side
        }
      }
    }
    const paint = (list, color, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      for (let k = 0; k < list.length; k += 2) ctx.fillRect(list[k] * s, list[k + 1] * s, dot, dot);
    };
    paint(faint, rgb(this.ink), 0.45);
    paint(lit, rgb(this.ink));
    paint(red, rgb(this.accent));
    ctx.globalAlpha = 1;
  }
}
