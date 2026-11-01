import { loadDays, pad, esc, reducedMotion, formatDate } from "./data.js";
import { Moon } from "./moon.js";

const $ = (id) => document.getElementById(id);
const reduce = reducedMotion();

// loadDays only returns finished pieces, newest last.
const pieces = await loadDays("./");
const latest = pieces.at(-1) ?? null;

/* ---------- Moon ---------- */
// A dithered moon that drifts slowly through its phases.
const moon = new Moon($("moon"), { res: 168 });
moon.setPhase(0.32, true);
if (reduce) moon.draw();
else {
  moon.drift = 1 / 48;
  // Only animate while the hero is on screen.
  new IntersectionObserver(([e]) => (e.isIntersecting ? moon.start() : moon.stop())).observe($("orbit"));
}

/* ---------- Hero readout: the newest piece ---------- */
if (latest) {
  $("readout").href = latest.href;
  $("ro-meta").textContent = `Latest · ${formatDate(latest.date)}`;
  $("ro-title").textContent = latest.title;
  $("readout").hidden = false;
}

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
