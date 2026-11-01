import { loadDays, tracksOf, pad, esc, reducedMotion, formatDate } from "./data.js";

const $ = (id) => document.getElementById(id);
const reduce = reducedMotion();

const days = await loadDays("../");
const built = days.filter((d) => d.built);
const tracks = tracksOf(days);

$("count-built").textContent = pad(built.length);
$("count-unit").textContent = built.length === 1 ? "piece" : "pieces";

/* ---------- State (kept in the query string so a filtered view can be shared) ---------- */
const params = new URLSearchParams(location.search);
const state = {
  track: tracks.includes(params.get("track")) ? params.get("track") : "All",
  desc: params.get("sort") === "desc",
};

function syncUrl() {
  const p = new URLSearchParams();
  if (state.track !== "All") p.set("track", state.track);
  if (state.desc) p.set("sort", "desc");
  const q = p.toString();
  history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
}

/* ---------- Toolbar ---------- */
const chipList = ["All", ...tracks];
$("chips").innerHTML = chipList
  .map((t) => {
    const n = t === "All" ? days.length : days.filter((d) => d.track === t).length;
    return `<button class="chip" data-track="${esc(t)}" aria-pressed="false">${esc(t)}<sup>${n}</sup></button>`;
  })
  .join("");
$("chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  state.track = b.dataset.track;
  update();
});
$("sort").addEventListener("click", () => { state.desc = !state.desc; update(); });

/* ---------- Grid ---------- */
const pair = (d) => (d.twist ? `${esc(d.spark)} <i>×</i> ${esc(d.twist)}` : esc(d.spark));

function cardHtml(d) {
  const info = `
    <div class="info">
      <h2>${esc(d.title)}</h2><span class="trk">${esc(d.track)}</span>
      <p>${pair(d)}</p>
    </div>`;
  const vt = `--vt: card-${d.day}`;
  return `<li class="built" style="${vt}" id="day-${pad(d.day)}">
    <button class="card" data-day="${d.day}" aria-label="Day ${pad(d.day)}, ${esc(d.title)}. Open details.">
      <div class="frame">
        ${d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="" loading="lazy">` : ""}
        ${d.videoUrl && !reduce ? `<video data-src="${esc(d.videoUrl)}" muted loop playsinline preload="none"></video>` : ""}
      </div>
      ${info}
    </button>
  </li>`;
}

function visible() {
  let list = days.filter((d) => state.track === "All" || d.track === state.track);
  if (state.desc) list = [...list].reverse();
  return list;
}

function render() {
  const list = visible();
  $("grid").innerHTML = list.map(cardHtml).join("");
  $("empty").hidden = list.length > 0;
  for (const card of $("grid").querySelectorAll(".card")) {
    const v = card.querySelector("video");
    if (!v) continue;
    const on = () => {
      if (!v.src) v.src = v.dataset.src;
      v.currentTime = 0;
      v.play().catch(() => {});
    };
    const off = () => v.pause();
    card.addEventListener("pointerenter", on);
    card.addEventListener("focus", on);
    card.addEventListener("pointerleave", off);
    card.addEventListener("blur", off);
  }
}

function update(first = false) {
  for (const c of document.querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c.dataset.track === state.track));
  $("sort").textContent = state.desc ? "Newest first" : "Oldest first";
  $("sort").setAttribute("aria-label", `Sort order: ${state.desc ? "newest" : "oldest"} first`);
  if (!first) syncUrl();
  if (!first && !reduce && document.startViewTransition) document.startViewTransition(render);
  else render();
}
update(true);

$("grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) open(+card.dataset.day);
});

/* ---------- Viewer ---------- */
const viewer = $("viewer");
let current = null;

function neighbours(d) {
  // Step through what is visible in the grid, falling back to all days.
  const list = visible().length ? visible() : days;
  const i = list.indexOf(d);
  return [list[(i - 1 + list.length) % list.length], list[(i + 1) % list.length]];
}

function fill(d) {
  current = d;
  $("v-kicker").textContent = `${d.track} · ${formatDate(d.date)}`;
  $("v-num").textContent = pad(d.day);
  $("v-title").textContent = d.title;
  $("v-pair").innerHTML = pair(d);

  const rows = [
    ["Build", d.build],
    ["Made with", d.technique],
    ["The detail", d.detail],
  ].filter(([, v]) => v);
  $("v-brief").innerHTML = rows.map(([k, v]) => `<div><dt class="mono">${k}</dt><dd>${esc(v)}</dd></div>`).join("");

  $("v-media").innerHTML = d.videoUrl && !reduce
    ? `<video src="${esc(d.videoUrl)}" ${d.posterUrl ? `poster="${esc(d.posterUrl)}"` : ""} autoplay muted loop playsinline></video>`
    : d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="Still from ${esc(d.title)}">` : "";
  $("v-actions").innerHTML = `
    <a class="btn solid on-light" href="${esc(d.href)}">Open</a>
    <a class="btn ghost" href="${esc(d.source)}">Code</a>
    ${d.gifUrl ? `<a class="btn ghost" href="${esc(d.gifUrl)}" download>GIF</a>` : ""}`;

  const [prev, nxt] = neighbours(d);
  // With a single piece there is nowhere to step to.
  document.querySelector(".v-nav").hidden = prev === d;
  $("v-prev-l").textContent = `${pad(prev.day)} ${prev.title}`;
  $("v-next-l").textContent = `${pad(nxt.day)} ${nxt.title}`;
}

function open(day, { push = true } = {}) {
  const d = days.find((x) => x.day === day);
  if (!d) return;
  fill(d);
  if (!viewer.open) { viewer.showModal(); viewer.focus(); }
  if (push) history.replaceState(null, "", `${location.pathname}${location.search}#day-${pad(d.day)}`);
}

function close() {
  if (viewer.open) viewer.close();
}
viewer.addEventListener("close", () => {
  $("v-media").innerHTML = "";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  if (current) document.querySelector(`.card[data-day="${current.day}"]`)?.focus({ preventScroll: false });
});
$("v-close").addEventListener("click", close);
viewer.addEventListener("click", (e) => { if (e.target === viewer) close(); });
$("v-prev").addEventListener("click", () => open(neighbours(current)[0].day));
$("v-next").addEventListener("click", () => open(neighbours(current)[1].day));
viewer.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { e.preventDefault(); $("v-prev").click(); }
  if (e.key === "ArrowRight") { e.preventDefault(); $("v-next").click(); }
});

// Deep links: gallery/#day-04 opens that day.
function fromHash() {
  const m = location.hash.match(/^#day-(\d+)$/);
  if (m) open(+m[1], { push: false });
}
fromHash();
addEventListener("hashchange", fromHash);
