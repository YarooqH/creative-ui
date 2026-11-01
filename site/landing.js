import { loadDays, tracksOf, pad, esc, reducedMotion, formatDate } from "./data.js";
import { Moon } from "./moon.js";

const $ = (id) => document.getElementById(id);
const reduce = reducedMotion();
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

const days = await loadDays("./");
const total = days.length;
const built = days.filter((d) => d.built);
const latest = built.at(-1) ?? null;
const next = days.find((d) => !d.built) ?? null;
const tracks = tracksOf(days);

/* ---------- Stats + bar ---------- */
$("stat-built").textContent = pad(built.length);
$("stat-left").textContent = pad(total - built.length);
$("stat-tracks").textContent = pad(tracks.length);
$("bar-status").textContent = `Cycle 01 · ${pad(built.length)} / ${total}`;
$("tt-title").textContent = `${WORDS[tracks.length] ?? tracks.length} tracks, ${total === 30 ? "thirty" : total} stops.`;
if (latest) $("latest-label").textContent = `Latest: ${latest.title}`;

/* ---------- Moon + ring ---------- */
const progress = built.length / total;
// Day d of the cycle. Squeezed a little so day 1 is a visible crescent, not a new moon.
const phaseOf = (day) => 0.06 + 0.88 * (day / total);
const homePhase = phaseOf(built.length);
const moon = new Moon($("moon"), { res: 168 });
moon.setPhase(homePhase, true);
if (reduce) moon.draw();
else {
  // Only animate while the hero is on screen.
  new IntersectionObserver(([e]) => (e.isIntersecting ? moon.start() : moon.stop())).observe($("orbit"));
}

requestAnimationFrame(() => {
  $("arc-fill").style.strokeDasharray = `${progress * 100} 100`;
});

const ring = $("ring");
ring.innerHTML = days
  .map((d, i) => {
    const state = d.built ? "built" : d === next ? "next" : "planned";
    const href = d.built ? d.href : `gallery/#day-${pad(d.day)}`;
    const label = `Day ${pad(d.day)}, ${d.title}, ${d.track}, ${d.built ? "built" : state === "next" ? "up next" : "planned"}`;
    return `<li style="--a:${(i / total) * 360}deg"><a class="m ${state}" style="--i:${i}" href="${esc(href)}" data-day="${d.day}" aria-label="${esc(label)}">${pad(d.day)}</a></li>`;
  })
  .join("");

const fallback = latest ?? next ?? days[0];
function readout(d) {
  const state = d.built ? `Built ${formatDate(d.date)}` : d === next ? "Up next" : "Planned";
  $("ro-day").textContent = `Day ${pad(d.day)}`;
  $("ro-state").textContent = state;
  $("ro-title").textContent = d.title;
  $("ro-track").textContent = d.twist ? `${d.track} · ${d.spark} × ${d.twist}` : d.track;
}
readout(fallback);

let resetTimer = 0;
function preview(d) {
  clearTimeout(resetTimer);
  for (const m of ring.querySelectorAll(".m.active")) m.classList.remove("active");
  ring.querySelector(`[data-day="${d.day}"]`)?.classList.add("active");
  readout(d);
  moon.setPhase(phaseOf(d.day), reduce);
}
function reset() {
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    for (const m of ring.querySelectorAll(".m.active")) m.classList.remove("active");
    readout(fallback);
    moon.setPhase(homePhase, reduce);
  }, 220);
}
for (const m of ring.querySelectorAll(".m")) {
  const d = days.find((x) => x.day === +m.dataset.day);
  m.addEventListener("pointerenter", () => preview(d));
  m.addEventListener("focus", () => preview(d));
  m.addEventListener("pointerleave", reset);
  m.addEventListener("blur", reset);
}

/* ---------- Spark × Twist reels ---------- */
const pairs = days.filter((d) => d.spark && d.twist);
const slots = [$("slot-spark"), $("slot-twist"), $("slot-piece")];
const fields = [(d) => d.spark, (d) => d.twist, (d) => d.title];
let idx = Math.max(0, pairs.indexOf(latest ?? next));
let playing = !reduce;
let timer = 0;

function show(dir = 1, instant = false) {
  const d = pairs[idx];
  $("reel-day").textContent = `Day ${pad(d.day)} / ${total} · ${d.track}${d.built ? " · built" : ""}`;
  slots.forEach((slot, i) => {
    const old = slot.firstElementChild;
    const span = document.createElement("span");
    span.textContent = fields[i](d);
    slot.append(span);
    if (instant || reduce || !old) { old?.remove(); return; }
    const opts = { duration: 700, delay: i * 90, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" };
    old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-dir * 105}%)`, opacity: 0 }], opts).finished.then(() => old.remove());
    span.animate([{ transform: `translateY(${dir * 105}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opts);
  });
}
function step(dir) {
  idx = (idx + dir + pairs.length) % pairs.length;
  show(dir);
}
function schedule() {
  clearInterval(timer);
  if (playing) timer = setInterval(() => step(1), 3200);
}
function setPlaying(on) {
  playing = on;
  $("reel-play").textContent = on ? "❙❙" : "▶";
  $("reel-play").setAttribute("aria-label", on ? "Pause" : "Play");
  schedule();
}
show(1, true);
setPlaying(playing);
$("reel-prev").addEventListener("click", () => { step(-1); schedule(); });
$("reel-next").addEventListener("click", () => { step(1); schedule(); });
$("reel-play").addEventListener("click", () => setPlaying(!playing));
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) clearInterval(timer);
  else schedule();
}).observe($("reels"));

/* ---------- Latest ---------- */
if (latest) {
  const d = latest;
  $("latest-link").href = "#latest";
  $("latest-grid").innerHTML = `
    <a class="latest-media" href="${esc(d.href)}" aria-label="Open ${esc(d.title)}">
      ${d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="" loading="lazy">` : ""}
      ${d.videoUrl && !reduce ? `<video src="${esc(d.videoUrl)}" muted loop playsinline autoplay preload="metadata" ${d.posterUrl ? `poster="${esc(d.posterUrl)}"` : ""}></video>` : ""}
      <span class="tag mono">Day ${pad(d.day)} · ${esc(d.track)}</span>
    </a>
    <div class="latest-meta">
      <p class="big">${pad(d.day)}</p>
      <h3>${esc(d.title)}</h3>
      <dl>
        <div><dt class="mono">Spark</dt><dd>${esc(d.spark)}</dd></div>
        <div><dt class="mono">Twist</dt><dd>${esc(d.twist)}</dd></div>
        <div><dt class="mono">Build</dt><dd>${esc(d.build)}</dd></div>
        <div><dt class="mono">Made with</dt><dd>${esc(d.technique)}</dd></div>
        <div><dt class="mono">Built</dt><dd>${esc(formatDate(d.date))}</dd></div>
      </dl>
      <div class="actions-row">
        <a class="btn solid on-light" href="${esc(d.href)}"><span>Live demo</span><span class="arr" aria-hidden="true">→</span></a>
        <a class="btn ghost" href="${esc(d.source)}"><span>Source</span><span class="arr" aria-hidden="true">↗</span></a>
      </div>
    </div>`;
} else {
  $("latest-grid").innerHTML = `<p class="empty-note">Day 01 is on its way.</p>`;
}

/* ---------- Timetable ---------- */
const cell = (d, track) => {
  const on = d.track === track;
  if (!on) return `<i></i>`;
  const cls = `on${d.built ? " built" : d === next ? " next" : ""}`;
  const href = d.built ? d.href : `gallery/#day-${pad(d.day)}`;
  return `<a href="${esc(href)}" title="Day ${pad(d.day)} · ${esc(d.title)}"><i class="${cls}"></i></a>`;
};
$("tt").innerHTML =
  tracks
    .map((t) => {
      const list = days.filter((d) => d.track === t);
      const done = list.filter((d) => d.built).length;
      return `<div class="tt-row" role="row">
        <span class="tt-name" role="rowheader">${esc(t)}</span>
        <span class="tt-count mono" role="cell">${done}/${list.length}</span>
        <div class="tt-strip" role="cell">${days.map((d) => cell(d, t)).join("")}</div>
      </div>`;
    })
    .join("") +
  `<div class="tt-row tt-axis" aria-hidden="true"><span></span><span></span><div class="tt-strip">${days.map((d) => `<span>${pad(d.day)}</span>`).join("")}</div></div>`;
