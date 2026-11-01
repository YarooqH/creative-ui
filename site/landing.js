import { loadDays, reducedMotion } from "./data.js";
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

/* ---------- "Latest" opens the newest piece ---------- */
if (latest) $("latest-link").href = latest.href;
