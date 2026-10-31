#!/usr/bin/env node
// Records one day's piece to MP4, GIF and a poster image.
//
//   node scripts/record.js day-01            # uses day-01/record.json
//   node scripts/record.js day-01 --mode realtime
//
// Two modes:
//   frames   (default) Deterministic. Fakes the page clock (Date, timers, rAF,
//            performance.now), steps every CSS / Web Animation by hand, and takes a
//            screenshot per frame. Heavy WebGL renders as slowly as it needs to and
//            still plays back smoothly.
//   realtime Plays the page live and keeps Playwright's screen recording. A fallback
//            for pieces that depend on something frames mode cannot fake (audio, video).
//
// Writes <day>/media/<day>.mp4, <day>.gif and poster.jpg.

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, execFileSync } = require("child_process");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is missing. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");

/* ---------- Config ---------- */

const args = process.argv.slice(2);
const day = args.find((a) => !a.startsWith("--"));
if (!day) {
  console.error("Usage: node scripts/record.js <day-folder> [--mode frames|realtime] [--duration s] [--fps n]");
  process.exit(1);
}
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const dayDir = path.join(ROOT, day);
if (!fs.existsSync(path.join(dayDir, "index.html"))) {
  console.error(`No ${day}/index.html`);
  process.exit(1);
}
const cfgPath = path.join(dayDir, "record.json");
const cfg = {
  width: 1600,
  height: 1000,
  duration: 10,
  fps: 60,
  substeps: 4, // clock steps per frame, so chained animations do not drift
  mode: "frames",
  time: "2026-01-01T09:39:30",
  cursor: true,
  poster: 3,
  gif: { width: 720, fps: 25 },
  actions: [],
  ...(fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {}),
};
if (flag("mode")) cfg.mode = flag("mode");
if (flag("duration")) cfg.duration = Number(flag("duration"));
if (flag("fps")) cfg.fps = Number(flag("fps"));

const outDir = path.join(dayDir, "media");
fs.mkdirSync(outDir, { recursive: true });
const mp4 = path.join(outDir, `${day}.mp4`);
const gif = path.join(outDir, `${day}.gif`);
const poster = path.join(outDir, "poster.jpg");

/* ---------- Static server ---------- */

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".glsl": "text/plain",
  ".glb": "model/gltf-binary", ".hdr": "application/octet-stream",
};
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end("not found");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

/* ---------- Page helpers injected before load ---------- */

// Marks the page as recording, draws a visible cursor, and exposes __cuStep(ms),
// which advances every document-timeline animation by `ms` of virtual time.
const INIT = (showCursor) => {
  const mark = () => document.documentElement.setAttribute("data-recording", "");
  if (document.documentElement) mark();
  else addEventListener("DOMContentLoaded", mark);
  let vnow = 0;
  const born = new WeakMap();
  window.__cuStep = (dt) => {
    vnow += dt;
    for (const a of document.getAnimations()) {
      if (a.timeline && a.timeline !== document.timeline) continue; // scroll-driven: leave alone
      if (a.playState === "finished" || a.playState === "idle") continue;
      if (!born.has(a)) born.set(a, vnow - dt);
      const t = (vnow - born.get(a)) * (a.playbackRate || 1);
      const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
      if (Number.isFinite(end) && t >= end) {
        a.finish(); // fires finish / animationend / transitionend
      } else {
        a.pause();
        a.currentTime = t;
      }
    }
  };
  if (!showCursor) return;
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText =
      "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
      "background:rgba(255,255,255,.35);border:1.5px solid rgba(0,0,0,.75);box-shadow:0 0 0 1px rgba(255,255,255,.6);" +
      "pointer-events:none;z-index:2147483647;opacity:0;transition:none;";
    document.body.append(c);
    addEventListener("mousemove", (e) => {
      c.style.opacity = 1;
      c.style.translate = `${e.clientX}px ${e.clientY}px`;
    }, true);
    addEventListener("mousedown", () => (c.style.scale = 0.7), true);
    addEventListener("mouseup", () => (c.style.scale = 1), true);
  });
};

/* ---------- Actions ---------- */

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function resolvePoint(page, target) {
  if (Array.isArray(target)) return { x: target[0], y: target[1] };
  const sel = typeof target === "string" ? { selector: target, nth: 0 } : target;
  // Read the box in-page: Playwright's locator helpers can wait on rAF, which the fake clock holds.
  const box = await page.evaluate(({ selector, nth }) => {
    const el = document.querySelectorAll(selector)[nth];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, { selector: sel.selector, nth: sel.nth || 0 });
  if (!box) throw new Error(`Nothing visible for ${sel.selector}`);
  return { x: box.x + box.width * (sel.dx ?? 0.5), y: box.y + box.height * (sel.dy ?? 0.5) };
}

// Turns the action list into something that can be sampled at any time t (seconds).
function makeTimeline(page, actions) {
  const pending = actions.slice().sort((a, b) => a.at - b.at);
  const moves = [];
  const scrolls = [];
  let mouse = null;
  let scrollY = 0;

  return async function at(t) {
    while (pending.length && pending[0].at <= t) {
      const a = pending.shift();
      if (a.move !== undefined) {
        const to = await resolvePoint(page, a.move);
        moves.push({ from: mouse || to, to, t0: a.at, t1: a.at + (a.over ?? 0.6) });
      }
      if (a.scroll !== undefined) scrolls.push({ from: scrollY, to: a.scroll, t0: a.at, t1: a.at + (a.over ?? 1) });
      if (a.click) {
        if (a.click !== true) {
          mouse = await resolvePoint(page, a.click);
          await page.mouse.move(mouse.x, mouse.y);
        }
        await page.mouse.down();
        await page.mouse.up();
      }
      if (a.key) await page.keyboard.press(a.key);
      if (a.type) await page.keyboard.type(a.type);
      if (a.eval) await page.evaluate(a.eval);
    }
    const m = moves.find((m) => t >= m.t0 && t <= m.t1 + 0.05);
    if (m) {
      const k = ease(Math.min(1, (t - m.t0) / (m.t1 - m.t0 || 1)));
      mouse = { x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k };
      await page.mouse.move(mouse.x, mouse.y);
    }
    const s = scrolls.find((s) => t >= s.t0 && t <= s.t1 + 0.05);
    if (s) {
      const k = ease(Math.min(1, (t - s.t0) / (s.t1 - s.t0 || 1)));
      scrollY = s.from + (s.to - s.from) * k;
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    }
  };
}

/* ---------- Encoders ---------- */

function encoder(fps) {
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", mp4,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg exited ${c}`)) : res())));
  return {
    write: (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once("drain", r))),
    end: () => (ff.stdin.end(), done),
  };
}

function finishMedia() {
  const g = cfg.gif;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", mp4,
    "-vf", `fps=${g.fps},scale=${g.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${g.colors || 128}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    gif,
  ]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(cfg.poster), "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
}

/* ---------- Run ---------- */

(async () => {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/${day}/`;
  const browser = await chromium.launch({
    // Default headless GL is already SwiftShader. Forcing --use-angle=swiftshader makes
    // CSS compositing ~20x slower, so leave it out.
    args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
  });
  const started = Date.now();
  const frames = Math.round(cfg.duration * cfg.fps);
  console.log(`Recording ${day} · ${cfg.mode} · ${cfg.width}×${cfg.height} · ${cfg.duration}s @ ${cfg.fps}fps`);

  try {
    if (cfg.mode === "realtime") {
      const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "cu-rec-"));
      const context = await browser.newContext({
        viewport: { width: cfg.width, height: cfg.height },
        recordVideo: { dir: tmp, size: { width: cfg.width, height: cfg.height } },
      });
      const page = await context.newPage();
      await page.addInitScript(INIT, cfg.cursor);
      await page.goto(url, { waitUntil: "load" });
      const at = makeTimeline(page, cfg.actions);
      const t0 = Date.now();
      while ((Date.now() - t0) / 1000 < cfg.duration) {
        await at((Date.now() - t0) / 1000);
        await page.waitForTimeout(1000 / 60);
      }
      const video = page.video();
      await context.close();
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-i", await video.path(), "-t", String(cfg.duration),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(cfg.fps),
        "-movflags", "+faststart", mp4,
      ]);
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      const context = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height } });
      const page = await context.newPage();
      page.on("pageerror", (e) => console.error("page error:", e.message));
      // install() alone lets fake time keep flowing with the wall clock; pause it so
      // only runFor() moves time forward.
      const t0 = new Date(cfg.time).getTime();
      await page.clock.install({ time: t0 - 1000 });
      await page.clock.pauseAt(t0);
      await page.addInitScript(INIT, cfg.cursor);
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const at = makeTimeline(page, cfg.actions);
      const enc = encoder(cfg.fps);
      const dt = 1000 / cfg.fps / cfg.substeps;
      for (let f = 0; f < frames; f++) {
        for (let s = 0; s < cfg.substeps; s++) {
          const ms = (f * cfg.substeps + s) * dt;
          await at(ms / 1000);
          await page.clock.runFor(dt);
          await page.evaluate((d) => window.__cuStep(d), dt);
        }
        await enc.write(await page.screenshot({ type: "png" }));
        if (f % 10 === 0) process.stdout.write(`\r  frame ${f}/${frames}`);
      }
      process.stdout.write(`\r  frame ${frames}/${frames}\n`);
      await enc.end();
      await context.close();
    }
    finishMedia();
    const size = (p) => `${(fs.statSync(p).size / 1e6).toFixed(1)} MB`;
    console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
    console.log(`  ${path.relative(ROOT, mp4)}  ${size(mp4)}`);
    console.log(`  ${path.relative(ROOT, gif)}  ${size(gif)}`);
    console.log(`  ${path.relative(ROOT, poster)}  ${size(poster)}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
