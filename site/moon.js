// A small ordered-dither moon drawn on a 2D canvas. One canvas pixel is one
// printed dot; the canvas is scaled up with `image-rendering: pixelated`.
//
//   const moon = new Moon(canvas, { res: 180 });
//   moon.setPhase(0.25);   // 0 = new, 0.5 = full, 1 = new again (eases there)
//   moon.start();

export const BAYER = (() => {
  // 8x8 Bayer matrix, values normalised to 0..1.
  let m = [[0]];
  while (m.length < 8) {
    const n = m.length;
    const next = Array.from({ length: n * 2 }, () => new Array(n * 2));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    m = next;
  }
  return Float32Array.from(m.flat(), (v) => (v + 0.5) / 64);
})();

// Seeded value noise for the surface map, so the moon looks the same on every load.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function surfaceMap(w, h) {
  const rand = rng(30);
  const grid = (gw, gh) => {
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (u, v) => {
      // Bilinear value noise that wraps horizontally.
      const x = u * gw, y = Math.min(v * (gh - 1), gh - 1.001);
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (xx, yy) => g[((xx % gw) + gw) % gw + yy * gw];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const octaves = [grid(6, 4), grid(12, 7), grid(24, 13), grid(48, 25)];
  const map = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let n = 0, amp = 0.55;
      for (const o of octaves) { n += o(u, v) * amp; amp *= 0.5; }
      // Darker "seas" where the low octave dips, brighter highlands elsewhere.
      const sea = Math.max(0, 0.52 - octaves[0](u, v)) * 1.6;
      map[x + y * w] = Math.min(1, Math.max(0.35, 0.62 + (n - 0.5) * 0.7 - sea));
    }
  // A few bright craters with rays of a sort.
  for (let i = 0; i < 26; i++) {
    const cx = rand() * w, cy = h * (0.15 + rand() * 0.7), r = 1.5 + rand() ** 2 * 7;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        if (y < 0 || y >= h) continue;
        const d = Math.hypot(x - cx, y - cy) / r;
        const xi = ((x % w) + w) % w;
        if (d < 0.75) map[xi + y * w] *= 0.82;
        else if (d < 1.15) map[xi + y * w] = Math.min(1, map[xi + y * w] + 0.22);
      }
  }
  return { map, w, h };
}

export class Moon {
  constructor(canvas, { res = 180, ink = [238, 235, 227], accent = [242, 64, 31] } = {}) {
    this.canvas = canvas;
    this.res = res;
    canvas.width = canvas.height = res;
    this.ctx = canvas.getContext("2d");
    this.img = this.ctx.createImageData(res, res);
    this.ink = ink;
    this.accent = accent;
    this.surface = surfaceMap(256, 128);
    this.phase = 0;
    this.target = 0;
    this.spin = 0;
    this.speed = 0.018; // radians of longitude per second
    this.drift = 0;     // phases per second the target keeps moving (0 = hold)
    this.last = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  setPhase(p, immediate = false) {
    this.target = p;
    if (immediate) this.phase = p;
    if (!this.running) this.draw();
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
    this.spin += dt * this.speed;
    this.target += dt * this.drift;
    // Critically damped ease toward the target phase.
    this.phase += (this.target - this.phase) * (1 - Math.exp(-dt * 6));
    this.draw();
    requestAnimationFrame(this.frame);
  }

  draw() {
    const { res, img, surface } = this;
    const data = img.data;
    const theta = this.phase * Math.PI * 2;
    // Light swings from behind the moon (new) round to the viewer (full).
    const lx = Math.sin(theta), ly = -0.12, lz = -Math.cos(theta);
    const ll = Math.hypot(lx, ly, lz);
    const Lx = lx / ll, Ly = ly / ll, Lz = lz / ll;
    const [ir, ig, ib] = this.ink;
    const [ar, ag, ab] = this.accent;
    const half = res / 2;
    const r = half - 1;

    for (let py = 0; py < res; py++) {
      const y = (py + 0.5 - half) / r;
      for (let px = 0; px < res; px++) {
        const i = (px + py * res) * 4;
        const x = (px + 0.5 - half) / r;
        const r2 = x * x + y * y;
        if (r2 > 1) { data[i + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2);
        // Surface lookup in longitude / latitude, turning slowly.
        let lon = Math.atan2(x, z) / (Math.PI * 2) + 0.5 + this.spin / (Math.PI * 2);
        lon -= Math.floor(lon);
        const lat = Math.asin(-y) / Math.PI + 0.5;
        const albedo = surface.map[Math.floor(lon * surface.w) + Math.min(surface.h - 1, Math.floor((1 - lat) * surface.h)) * surface.w];

        const ndl = x * Lx - y * Ly + z * Lz;
        const lit = ndl <= 0 ? 0 : Math.pow(ndl, 0.6);
        // Earthshine keeps the dark side faintly visible; the limb gets a thin rim.
        const shine = 0.035 * albedo + (r2 > 0.955 ? 0.1 : 0);
        const lum = albedo * lit * 1.15 + shine;

        const t = BAYER[(px & 7) + (py & 7) * 8];
        if (lum > t) {
          // Dots right on the terminator print in the accent colour.
          const edge = ndl > -0.02 && ndl < 0.07 && lit > 0;
          data[i] = edge ? ar : ir;
          data[i + 1] = edge ? ag : ig;
          data[i + 2] = edge ? ab : ib;
          // Earthshine dots on the night side print faintly.
          data[i + 3] = lit > 0.02 ? 255 : 120;
        } else {
          data[i + 3] = 0;
        }
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }
}
