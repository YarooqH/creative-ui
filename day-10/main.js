// Day 10 · Field Notes
// Specimen cards held to a strict UI system (four sizes, three greys), with a
// naturalist's notes on top. Hover, focus or tap a card and the notes write
// themselves on at pen speed: each stroke is timed by its length, each word by
// its letters, with a short lift of the pen in between.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PEN = 300;      // stroke speed, in plate units per second
const HAND = 15;      // letters per second
const LIFT = 140;     // ms between strokes

/* ---------- Small drawing helpers (plate is 300 x 220) ---------- */

const mirror = (inner) => `<g transform="matrix(-1 0 0 1 300 0)">${inner}</g>`;
const P = (d, cls = "") => `<path ${cls ? `class="${cls}" ` : ""}d="${d}"/>`;
const f = (n) => n.toFixed(1);

// A slim leaf from (x, y) in direction a (radians), length L, half-width w.
function leaf(x, y, a, L, w) {
  const cx = Math.cos(a), cy = Math.sin(a), nx = -cy, ny = cx;
  const tx = x + cx * L, ty = y + cy * L;
  const mx = x + cx * L * 0.45, my = y + cy * L * 0.45;
  return `M${f(x)} ${f(y)} Q${f(mx + nx * w * 2)} ${f(my + ny * w * 2)} ${f(tx)} ${f(ty)} Q${f(mx - nx * w * 2)} ${f(my - ny * w * 2)} ${f(x)} ${f(y)}`;
}

// A hand-drawn loop around (x, y): slightly more than one turn, a little uneven.
function loop(x, y, rx, ry, start = -2.4) {
  let d = "";
  for (let k = 0; k <= 44; k++) {
    const t = start + (k / 40) * Math.PI * 2;
    const wob = 1 + Math.sin(t * 3 + 1) * 0.06 + k * 0.002;
    d += `${k ? "L" : "M"}${f(x + Math.cos(t) * rx * wob)} ${f(y + Math.sin(t) * ry * wob)} `;
  }
  return d;
}

// An arrow: a curve with a two-stroke head at its end.
function arrow(x0, y0, cx, cy, x1, y1) {
  const a = Math.atan2(y1 - cy, x1 - cx);
  const h = 7;
  return [
    `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`,
    `M${f(x1 - Math.cos(a - 0.5) * h)} ${f(y1 - Math.sin(a - 0.5) * h)} L${x1} ${y1} L${f(x1 - Math.cos(a + 0.5) * h)} ${f(y1 - Math.sin(a + 0.5) * h)}`,
  ];
}

/* ---------- The six specimens ---------- */

function moth() {
  const half = [
    P("M146 82 C120 62 92 44 74 48 C66 66 78 96 96 106 C112 112 132 106 146 100"),
    P("M146 104 C126 108 106 118 104 134 C106 150 118 160 124 176 C126 186 130 194 134 192 C138 176 140 140 147 116"),
    P("M108 82 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0"),
    P("M108 82 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0", "fill"),
    P("M122 136 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0"),
    P("M146 82 C130 74 104 66 82 58", "soft"),
    P("M146 104 C128 112 116 126 112 140", "soft"),
    P("M148 74 C142 60 136 50 130 40"),
    P("M146 66 l-6 -2 M143 58 l-6 -2 M140 51 l-6 -1 M136 45 l-5 -1", "soft"),
  ].join("");
  return `${half}${mirror(half)}${P("M150 72 C156 72 156 130 150 134 C144 130 144 72 150 72", "tint")}${P("M150 72 C156 72 156 130 150 134 C144 130 144 72 150 72")}`;
}

function fern() {
  let s = P("M150 210 C146 160 160 110 152 60 C150 44 156 30 162 22");
  const rach = (t) => {
    // Rough point on the rachis for t in 0..1 (base to tip).
    const y = 205 - t * 180;
    const x = 150 + Math.sin(t * 3.2) * 5 + t * 8;
    return [x, y];
  };
  for (let k = 0; k < 13; k++) {
    const t = 0.1 + k * 0.068;
    const [x, y] = rach(t);
    const L = 58 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 8;
    for (const side of [-1, 1]) {
      const a = side < 0 ? Math.PI + 0.55 - t * 0.2 : -0.55 + t * 0.2;
      s += P(leaf(x, y, a - side * 0.0, L, 3.4));
      // Pinnules: tiny nicks along each pinna.
      for (let j = 1; j < L / 8; j++) {
        const px = x + Math.cos(a) * j * 8, py = y + Math.sin(a) * j * 8;
        s += P(`M${f(px)} ${f(py)} l${f(Math.cos(a - side * 1.1) * 4)} ${f(Math.sin(a - side * 1.1) * 4)}`, "soft");
      }
    }
  }
  return s;
}

function beetle() {
  const half = [
    P("M150 104 L144 104 L150 116"),
    P("M128 100 C120 120 120 152 132 170 C140 178 146 180 150 180"),
    P("M130 72 C124 80 122 92 124 99 L150 99"),
    P("M124 112 C112 110 104 104 98 94 M98 94 L92 80"),
    P("M124 132 C110 136 100 142 94 152 M94 152 L84 158"),
    P("M128 154 C118 164 112 174 110 186 M110 186 L104 198"),
    P("M142 56 C138 46 132 40 124 36"),
    P("M124 36 m-3 0 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0", "fill"),
    P("M136 128 q4 -6 8 -2 M132 146 q5 -4 9 1 M138 162 q3 -5 7 -1", "soft"),
  ].join("");
  const body = "M150 99 L124 99 C120 120 120 152 132 170 C140 178 146 180 150 180 C154 180 160 178 168 170 C180 152 180 120 176 99 Z";
  return `${P(body, "tint")}${half}${mirror(half)}${P("M150 116 L150 180")}${P("M138 56 C144 50 156 50 162 56 L170 72 L130 72 Z")}`;
}

function feather() {
  let s = "";
  // Rachis from the quill at bottom left to the tip at top right.
  const pt = (t) => [60 + t * 178 + Math.sin(t * 3) * 6, 204 - t * 178 - Math.sin(t * 3) * 10];
  s += P(`M${pt(0).map(f).join(" ")} ` + Array.from({ length: 21 }, (_, k) => "L" + pt(k / 20).map(f).join(" ")).join(" "));
  for (let k = 3; k <= 46; k++) {
    const t = k / 48;
    const [x, y] = pt(t);
    const [x2, y2] = pt(Math.min(1, t + 0.02));
    const a = Math.atan2(y2 - y, x2 - x);
    const width = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
    for (const side of [-1, 1]) {
      const L = (side < 0 ? 46 : 30) * width + 3;
      const b = a + side * 1.0;
      const ex = x + Math.cos(b) * L, ey = y + Math.sin(b) * L;
      // Bars: bands of dark barbs on the wide vane, towards the tip.
      const barred = side < 0 && t > 0.5 && Math.floor(k / 3) % 2 === 0;
      s += P(`M${f(x)} ${f(y)} Q${f(x + Math.cos(b - side * 0.3) * L * 0.6)} ${f(y + Math.sin(b - side * 0.3) * L * 0.6)} ${f(ex)} ${f(ey)}`, barred ? "" : "soft");
    }
  }
  return s;
}

function agaric() {
  let s = P("M78 104 C78 40 222 40 222 104 C196 114 104 114 78 104 Z", "tint");
  s += P("M78 104 C78 40 222 40 222 104 C196 114 104 114 78 104 Z");
  for (let x = 86; x <= 214; x += 6) {
    const y = 104 + Math.sin(((x - 78) / 144) * Math.PI) * 7;
    s += P(`M${x} ${f(y)} l0 5`, "soft");
  }
  const warts = [[110, 64], [132, 52], [158, 50], [184, 58], [204, 76], [96, 84], [122, 78], [150, 70], [176, 80], [196, 92], [140, 92], [112, 98]];
  for (const [x, y] of warts) s += P(`M${x} ${y} m-3.2 0 a3.2 2.6 0 1 0 6.4 0 a3.2 2.6 0 1 0 -6.4 0`);
  s += P("M138 113 C136 140 134 168 132 186 M162 113 C164 140 166 168 168 186");
  s += P("M136 124 C140 134 160 134 164 124 C166 132 168 138 170 140 C156 146 144 146 130 140 C132 138 134 132 136 124");
  s += P("M130 186 C120 188 122 202 150 202 C178 202 180 188 170 186 M128 190 l4 4 M172 190 l-4 4", "");
  return s;
}

function scallop() {
  let s = "";
  const hx = 150, hy = 176;
  const R = 112;
  // Fan edge: scalloped arc from left to right.
  let edge = "";
  const ribs = 15;
  for (let k = 0; k <= ribs; k++) {
    const a = Math.PI + 0.42 + (k / ribs) * (Math.PI - 0.84);
    const x = hx + Math.cos(a) * R, y = hy + Math.sin(a) * R * 0.95;
    if (k === 0) edge += `M${f(x)} ${f(y)} `;
    else {
      const am = a - (Math.PI - 0.84) / ribs / 2;
      edge += `Q${f(hx + Math.cos(am) * (R + 7))} ${f(hy + Math.sin(am) * (R + 7) * 0.95)} ${f(x)} ${f(y)} `;
    }
    s += P(`M${hx} ${hy} L${f(x)} ${f(y)}`, k % 2 ? "" : "soft");
  }
  s = P(`M${hx} ${hy} ${edge.replace("M", "L")} Z`, "tint") + s + P(edge);
  // Growth rings.
  for (const r of [0.38, 0.58, 0.78]) {
    const a0 = Math.PI + 0.46, a1 = 2 * Math.PI - 0.46;
    s += P(`M${f(hx + Math.cos(a0) * R * r)} ${f(hy + Math.sin(a0) * R * r * 0.95)} A${f(R * r)} ${f(R * r * 0.95)} 0 0 1 ${f(hx + Math.cos(a1) * R * r)} ${f(hy + Math.sin(a1) * R * r * 0.95)}`, "soft");
  }
  // Ears at the hinge.
  s += P(`M${hx - 30} ${hy - 8} L${hx - 26} ${hy + 14} L${hx + 26} ${hy + 14} L${hx + 30} ${hy - 8}`);
  return s;
}

/* Notes: a list of strokes and words in the order they are written. */
const SPECIMENS = [
  {
    name: "Luna moth", latin: "Actias luna", no: "No. 014", where: "Wicken Fen", when: "12 Oct",
    draw: moth,
    notes: [
      { d: loop(108, 82, 15, 13) },
      { w: "eyespot, startles birds", x: 10, y: 22, r: -3 },
      { d: arrow(56, 34, 70, 66, 92, 76) },
      { w: "tails spin, bats miss", x: 168, y: 196, r: -2 },
      { d: arrow(166, 198, 150, 204, 138, 192) },
    ],
  },
  {
    name: "Lady fern", latin: "Athyrium filix-femina", no: "No. 021", where: "Borrowdale", when: "19 Oct",
    draw: fern,
    notes: [
      { d: "M270 22 L270 206 M264 22 L276 22 M264 206 L276 206" },
      { w: "31 cm", x: 224, y: 112, r: -4 },
      { w: "once a fiddlehead", x: 10, y: 20, r: -2 },
      { d: arrow(108, 30, 132, 40, 150, 32) },
    ],
  },
  {
    name: "Rose chafer", latin: "Cetonia aurata", no: "No. 027", where: "Kew", when: "23 Oct",
    draw: beetle,
    notes: [
      { d: loop(150, 140, 34, 46, -1.2) },
      { w: "flies with cases shut!", x: 168, y: 22, r: -3 },
      { d: arrow(230, 36, 226, 92, 186, 118) },
      { w: "green, but no pigment", x: 10, y: 198, r: -2 },
      { d: "M12 210 C50 214 100 212 146 208" },
    ],
  },
  {
    name: "Jay covert", latin: "Garrulus glandarius", no: "No. 031", where: "Savernake", when: "28 Oct",
    draw: feather,
    notes: [
      { w: "blue from structure", x: 12, y: 24, r: -3 },
      { d: arrow(138, 30, 166, 30, 184, 52) },
      { d: "M206 36 C214 52 222 78 222 98" },
      { w: "9 bars", x: 230, y: 70, r: -4 },
      { w: "found under the oak", x: 150, y: 196, r: -2 },
    ],
  },
  {
    name: "Fly agaric", latin: "Amanita muscaria", no: "No. 036", where: "Abernethy", when: "2 Nov",
    draw: agaric,
    notes: [
      { w: "do not eat", x: 12, y: 22, r: -3 },
      { d: "M12 38 C40 41 70 40 94 36 M16 44 C40 46 66 46 90 42" },
      { d: arrow(222, 150, 196, 158, 172, 140) },
      { w: "the skirt", x: 224, y: 140, r: -4 },
      { d: loop(204, 76, 10, 9) },
    ],
  },
  {
    name: "Great scallop", latin: "Pecten maximus", no: "No. 042", where: "Holkham", when: "6 Nov",
    draw: scallop,
    notes: [
      { w: "15 ribs", x: 236, y: 30, r: -4 },
      { d: arrow(244, 46, 236, 60, 228, 76) },
      { d: "M64 132 C80 140 100 146 116 146" },
      { w: "a ring a year?", x: 12, y: 196, r: -2 },
      { d: arrow(58, 192, 80, 176, 98, 150) },
    ],
  },
];

/* ---------- Build the cards ---------- */

const list = document.getElementById("cards");
const cards = [];

SPECIMENS.forEach((sp) => {
  const li = document.createElement("li");
  li.className = "card";
  li.tabIndex = 0;
  li.setAttribute("aria-label", `${sp.name}, ${sp.latin}. Notes: ${sp.notes.filter((n) => n.w).map((n) => n.w).join("; ")}`);
  const strokes = sp.notes.filter((n) => n.d).flatMap((n) => (Array.isArray(n.d) ? n.d : [n.d]));
  li.innerHTML = `
    <div class="plate" aria-hidden="true">
      <svg viewBox="0 0 300 220"><g class="specimen">${sp.draw()}</g><g class="ink">${strokes.map((d) => `<path d="${d}"/>`).join("")}</g></svg>
      ${sp.notes.filter((n) => n.w).map((n) => `<span class="word" style="left:${(n.x / 300) * 100}%;top:${(n.y / 220) * 100}%;rotate:${n.r}deg">${n.w}</span>`).join("")}
    </div>
    <div class="name">${sp.name}</div>
    <div class="latin">${sp.latin}</div>
    <div class="meta"><span>${sp.no}</span><span>${sp.where}</span><span>${sp.when}</span></div>`;
  list.append(li);

  // Pair each note with its element, in writing order.
  const paths = [...li.querySelectorAll(".ink path")];
  const words = [...li.querySelectorAll(".word")];
  const seq = [];
  for (const n of sp.notes) {
    if (n.w) seq.push({ el: words.shift(), word: n.w });
    else for (let k = 0; k < (Array.isArray(n.d) ? n.d.length : 1); k++) seq.push({ el: paths.shift() });
  }
  for (const s of seq) {
    if (s.word) continue;
    // A gap longer than the dash, and an offset past it, so a hidden stroke's
    // round caps never show as a dot.
    s.len = s.el.getTotalLength();
    s.el.style.strokeDasharray = `${s.len.toFixed(1)} ${(s.len + 8).toFixed(1)}`;
    s.el.style.strokeDashoffset = (s.len + 4).toFixed(1);
  }
  cards.push({ li, seq, anims: [], on: false });
});

/* ---------- Writing and wiping ---------- */

function write(card, delay = 0) {
  if (card.on) return;
  card.on = true;
  card.li.classList.add("on");
  for (const a of card.anims) a.cancel();
  card.anims = [];
  let t = delay;
  for (const s of card.seq) {
    s.el.style.opacity = 1;
    if (s.word) {
      const dur = reduceMotion ? 1 : Math.max(380, (s.word.replace(/\s/g, "").length / HAND) * 1000);
      card.anims.push(s.el.animate(
        [{ clipPath: "inset(-20% 100% -30% -4%)" }, { clipPath: "inset(-20% -4% -30% -4%)" }],
        { duration: dur, delay: t, easing: "linear", fill: "both" }
      ));
      t += dur + LIFT;
    } else {
      const dur = reduceMotion ? 1 : Math.max(160, (s.len / PEN) * 1000);
      card.anims.push(s.el.animate(
        [{ strokeDashoffset: s.len + 4 }, { strokeDashoffset: 0 }],
        { duration: dur, delay: t, easing: "cubic-bezier(.35,.05,.6,1)", fill: "both" }
      ));
      t += dur + LIFT * 0.6;
    }
  }
}

function wipe(card) {
  if (!card.on) return;
  card.on = false;
  card.li.classList.remove("on");
  const els = card.seq.map((s) => s.el);
  const fade = els.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduceMotion ? 1 : 260, fill: "forwards" }));
  const anims = card.anims;
  card.anims = fade;
  fade[0].finished.then(() => {
    if (card.on) return;
    for (const a of anims) a.cancel();
    for (const a of fade) a.cancel();
    for (const el of els) el.style.opacity = 0;
  }).catch(() => {});
}

/* ---------- Input ---------- */

const allBtn = document.getElementById("all");
let all = false;

for (const card of cards) {
  for (const s of card.seq) s.el.style.opacity = 0;
  card.li.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") write(card); });
  card.li.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch" && !all) wipe(card); });
  card.li.addEventListener("focus", () => write(card));
  card.li.addEventListener("blur", () => { if (!all) wipe(card); });
  card.li.addEventListener("click", (e) => {
    // Tap to toggle on touch screens; a mouse already wrote on hover.
    if (e.pointerType === "touch" || e.pointerType === "") card.on && !all ? wipe(card) : write(card);
  });
}

allBtn.addEventListener("click", () => {
  all = !all;
  allBtn.setAttribute("aria-pressed", all);
  allBtn.textContent = all ? "Hide notes" : "Show notes";
  cards.forEach((c, i) => (all ? write(c, i * 260) : wipe(c)));
});
