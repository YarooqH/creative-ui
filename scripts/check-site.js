// Checks days.json before the site deploys: every built day must have its
// folder, its page and the media files it points to. Run: node scripts/check-site.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const errors = [];
let days;
try {
  ({ days } = JSON.parse(fs.readFileSync(path.join(root, "days.json"), "utf8")));
} catch (e) {
  console.error(`days.json does not parse: ${e.message}`);
  process.exit(1);
}

const seen = new Set();
for (const d of days) {
  const tag = `day ${d.day}`;
  for (const k of ["day", "folder", "title", "track", "spark", "status"]) if (d[k] == null || d[k] === "") errors.push(`${tag}: missing "${k}"`);
  if (seen.has(d.day)) errors.push(`${tag}: duplicate day number`);
  seen.add(d.day);
  if (!["built", "planned"].includes(d.status)) errors.push(`${tag}: status must be "built" or "planned"`);
  if (d.status !== "built") continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "")) errors.push(`${tag}: built days need a YYYY-MM-DD "date"`);
  if (!fs.existsSync(path.join(root, d.folder, "index.html"))) errors.push(`${tag}: ${d.folder}/index.html not found`);
  for (const k of ["poster", "video", "gif"]) {
    if (!d[k]) errors.push(`${tag}: built days need "${k}"`);
    else if (!fs.existsSync(path.join(root, d[k]))) errors.push(`${tag}: ${k} file ${d[k]} not found`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`days.json ok: ${days.filter((d) => d.status === "built").length} built, ${days.length} total`);
