import { loadDays, pad, esc, reducedMotion, formatDate } from "./data.js";
import { Moon } from "./moon.js";
import { DitherType } from "./dither.js";

const $ = (id) => document.getElementById(id);
const reduce = reducedMotion();

// loadDays only returns finished pieces, newest last.
const pieces = await loadDays("./");
const latest = pieces.at(-1) ?? null;

/* ---------- Moon ---------- */
// A dithered moon that drifts slowly through its phases.
const moon = new Moon($("moon"), { res: 200 });
moon.setPhase(0.32, true);
if (reduce) moon.draw();
else {
  moon.drift = 1 / 48;
  new IntersectionObserver(([e]) => (e.isIntersecting ? moon.start() : moon.stop())).observe($("moon"));
}

/* ---------- Dithered type ---------- */
// Every big line of type is printed in dots and lit by a moving terminator.
await document.fonts.load('800 100px "Bricolage Grotesque"').catch(() => {});
const INK = [20, 20, 20], PAPER = [238, 235, 227];
const types = [
  new DitherType($("hero-type"), {
    lines: ["Experiments in motion,", "type and light."],
    ink: PAPER, accentWords: ["light"], cell: 4, hover: document.querySelector(".hero"),
  }),
  new DitherType($("latest-type"), { lines: ["Fresh off the press."], ink: INK, cell: 3, intro: true }),
  new DitherType($("cta-type"), { lines: ["Open the gallery"], ink: INK, cell: 4, drift: false, hover: $("cta") }),
];
for (const t of types) {
  t.layout();
  if (reduce) { t.edge = 1.2; t.draw(); continue; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? t.start() : t.stop())).observe(t.canvas);
}
// The gallery link sits dark until you reach for it: the light follows the pointer.
types[2].edge = types[2].target = -0.3;
$("cta").addEventListener("pointerleave", () => { types[2].target = -0.3; });
$("cta").addEventListener("focus", () => { types[2].target = 1.3; });
$("cta").addEventListener("blur", () => { types[2].target = -0.3; });

/* ---------- Sections dissolve in ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.15 });

/* ---------- Latest ---------- */
if (latest) {
  const d = latest;
  $("latest-grid").innerHTML = `
    <a class="latest-media" href="${esc(d.href)}" aria-label="Open ${esc(d.title)}">
      ${d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="" loading="lazy">` : ""}
      ${d.videoUrl && !reduce ? `<video src="${esc(d.videoUrl)}" muted loop playsinline autoplay preload="metadata" ${d.posterUrl ? `poster="${esc(d.posterUrl)}"` : ""}></video>` : ""}
    </a>
    <div class="latest-meta">
      <p class="big">${pad(pieces.length)}</p>
      <h3>${esc(d.title)}</h3>
      <dl>
        <div><dt class="mono">Spark</dt><dd>${esc(d.spark)}</dd></div>
        <div><dt class="mono">Twist</dt><dd>${esc(d.twist)}</dd></div>
        <div><dt class="mono">Build</dt><dd>${esc(d.build)}</dd></div>
        <div><dt class="mono">Made with</dt><dd>${esc(d.technique)}</dd></div>
        <div><dt class="mono">Made</dt><dd>${esc(formatDate(d.date))}</dd></div>
      </dl>
      <div class="actions-row">
        <a class="btn solid on-light" href="${esc(d.href)}">Open</a>
        <a class="btn ghost" href="${esc(d.source)}">Code</a>
      </div>
    </div>`;
} else {
  $("latest-grid").innerHTML = `<p class="empty-note">The first piece is on its way.</p>`;
}
for (const el of $("latest-grid").children) { el.classList.add("dz-reveal"); io.observe(el); }
