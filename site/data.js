// Loads days.json (the manifest every page reads) and a few helpers.
// `root` is the path from the current page back to the repo root, e.g. "../".

export const pad = (n) => String(n).padStart(2, "0");

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const REPO = "https://github.com/YarooqH/creative-ui";

export async function loadDays(root = "./") {
  const res = await fetch(`${root}days.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`days.json: ${res.status}`);
  const { days } = await res.json();
  // Resolve every media path against the page so nested pages work too.
  const url = (p) => (p ? root + p : null);
  return days
    .map((d) => ({
      ...d,
      built: d.status === "built",
      href: `${root}${d.folder}/`,
      source: `${REPO}/tree/main/${d.folder}`,
      posterUrl: url(d.poster),
      videoUrl: url(d.video),
      gifUrl: url(d.gif),
    }))
    .sort((a, b) => a.day - b.day);
}

// Tracks in the order they first appear in the plan.
export function tracksOf(days) {
  const out = [];
  for (const d of days) if (!out.includes(d.track)) out.push(d.track);
  return out;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
