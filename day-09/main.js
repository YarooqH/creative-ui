// Day 09 · Instant Film
// A table of instant prints. Opening one is a same-document View Transition: the
// small print lifts and grows into the page, landing with a little shake. The
// picture then develops like instant film: a milky, cold grey first, shadows next,
// colour last. The six photos are painted on canvas, so nothing is downloaded.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const S = 600;

/* ---------- Painting the photographs ---------- */

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  return [c, c.getContext("2d")];
}
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const lin = (g, x0, y0, x1, y1, stops) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const rad = (g, x, y, r0, r1, stops) => {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};

// Film finish shared by every photo: soft vignette and a fine grain.
function finish(g) {
  g.fillStyle = rad(g, S / 2, S / 2, S * 0.3, S * 0.75, [[0, "rgba(0,0,0,0)"], [1, "rgba(20,10,0,0.32)"]]);
  g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

const SCENES = {
  pool(g) {
    g.fillStyle = lin(g, 0, 0, S, S, [[0, "#3fc3c9"], [1, "#0b7f99"]]);
    g.fillRect(0, 0, S, S);
    // Caustics: bright wavy threads.
    g.lineWidth = 3;
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(230,255,250,${0.18 + rand() * 0.3})`;
      g.beginPath();
      const y0 = k * 26 - 20;
      for (let x = -10; x <= S + 10; x += 10) {
        const y = y0 + Math.sin(x * 0.03 + k) * 9 + Math.sin(x * 0.011 + k * 2) * 14 + x * 0.25;
        x === -10 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    // Shadow of a lane rope and the ladder.
    g.fillStyle = "rgba(4,50,70,0.35)";
    g.beginPath(); g.moveTo(0, 410); g.lineTo(S, 250); g.lineTo(S, 290); g.lineTo(0, 450); g.fill();
    g.strokeStyle = "#e8eef0"; g.lineWidth = 12; g.lineCap = "round";
    g.beginPath(); g.moveTo(440, -20); g.lineTo(440, 230); g.arc(470, 230, 30, Math.PI, 0, true); g.stroke();
    g.beginPath(); g.moveTo(530, -20); g.lineTo(530, 200); g.stroke();
    g.lineWidth = 9; for (const y of [70, 150]) { g.beginPath(); g.moveTo(440, y); g.lineTo(530, y); g.stroke(); }
  },
  dunes(g) {
    g.fillStyle = lin(g, 0, 0, 0, 300, [[0, "#7fb2d8"], [1, "#f5d9b6"]]);
    g.fillRect(0, 0, S, S);
    g.fillStyle = "rgba(255,248,230,0.9)";
    g.beginPath(); g.arc(450, 120, 34, 0, 7); g.fill();
    const ridge = (y, amp, ph, lit, dark) => {
      g.fillStyle = dark;
      g.beginPath(); g.moveTo(0, S);
      for (let x = 0; x <= S; x += 6) g.lineTo(x, y + Math.sin(x * 0.009 + ph) * amp + Math.sin(x * 0.023 + ph) * amp * 0.3);
      g.lineTo(S, S); g.fill();
      g.fillStyle = lit;
      g.beginPath(); g.moveTo(0, S);
      for (let x = 0; x <= S; x += 6) g.lineTo(x, y + Math.sin(x * 0.009 + ph) * amp + Math.sin(x * 0.023 + ph) * amp * 0.3 + Math.max(0, Math.cos(x * 0.009 + ph)) * amp * 0.9);
      g.lineTo(S, S); g.fill();
    };
    ridge(300, 40, 1.0, "#e7b07a", "#b56f43");
    ridge(380, 50, 2.6, "#efbd86", "#a95f38");
    ridge(470, 60, 4.0, "#f3c792", "#9c5531");
  },
  lemons(g) {
    g.fillStyle = lin(g, 0, 0, S, S, [[0, "#2c4fae"], [1, "#16307a"]]);
    g.fillRect(0, 0, S, S);
    // Cloth folds.
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.05})`;
      g.beginPath(); g.ellipse(rand() * S, rand() * S, 260, 40, -0.5 + rand() * 0.3, 0, 7); g.fill();
    }
    const lemons = [[190, 230, 92, -0.4], [360, 200, 80, 0.5], [290, 380, 100, 0.2], [460, 400, 70, -0.8], [130, 420, 62, 0.9]];
    for (const [x, y, r, a] of lemons) {
      g.fillStyle = "rgba(5,15,50,0.45)";
      g.beginPath(); g.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.7, a, 0, 7); g.fill();
    }
    for (const [x, y, r, a] of lemons) {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = rad(g, -r * 0.3, -r * 0.35, r * 0.1, r * 1.2, [[0, "#fff7a8"], [0.45, "#f7d21a"], [1, "#c98f00"]]);
      g.beginPath(); g.ellipse(0, 0, r, r * 0.72, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(r * 0.98, 0, r * 0.14, r * 0.1, 0, 0, 7); g.fill();
      g.restore();
    }
  },
  window(g) {
    g.fillStyle = lin(g, 0, 0, S, S, [[0, "#d9a27c"], [1, "#b97752"]]);
    g.fillRect(0, 0, S, S);
    // A slanted square of sun with a window cross through it.
    g.save();
    g.beginPath(); g.moveTo(150, 60); g.lineTo(520, 120); g.lineTo(470, 560); g.lineTo(80, 470); g.closePath(); g.clip();
    g.fillStyle = "#ffd9a8"; g.fillRect(0, 0, S, S);
    g.fillStyle = "rgba(150,80,50,0.7)";
    g.beginPath(); g.moveTo(320, 80); g.lineTo(340, 84); g.lineTo(290, 530); g.lineTo(268, 525); g.fill();
    g.beginPath(); g.moveTo(110, 268); g.lineTo(500, 330); g.lineTo(497, 350); g.lineTo(106, 288); g.fill();
    // Leaf shadows from a plant outside.
    for (let k = 0; k < 16; k++) {
      g.save(); g.translate(380 + rand() * 140, 380 + rand() * 180); g.rotate(rand() * 3);
      g.fillStyle = "rgba(150,80,50,0.55)";
      g.beginPath(); g.ellipse(0, 0, 46, 13, 0, 0, 7); g.fill();
      g.restore();
    }
    g.restore();
  },
  coast(g) {
    g.fillStyle = lin(g, 0, 0, 0, 330, [[0, "#f39a8a"], [0.7, "#ffc785"], [1, "#ffe0a3"]]);
    g.fillRect(0, 0, S, 330);
    g.fillStyle = "#fff1c9";
    g.beginPath(); g.arc(300, 300, 46, 0, 7); g.fill();
    g.fillStyle = lin(g, 0, 330, 0, S, [[0, "#3e5d8a"], [1, "#1b2c4f"]]);
    g.fillRect(0, 330, S, S);
    // The sun's road on the water.
    for (let k = 0; k < 40; k++) {
      const y = 340 + k * 6.5 + rand() * 3;
      const w = 30 + k * 4 + rand() * 30;
      g.fillStyle = `rgba(255,214,150,${0.75 - k * 0.015})`;
      g.fillRect(300 - w / 2 + (rand() - 0.5) * 30, y, w * (0.3 + rand() * 0.5), 2.5);
    }
  },
  bus(g) {
    g.fillStyle = lin(g, 0, 0, 0, S, [[0, "#141a3a"], [1, "#0a0d1f"]]);
    g.fillRect(0, 0, S, S);
    // Out-of-focus street lights.
    for (let k = 0; k < 14; k++) {
      const x = rand() * S, y = rand() * 260, r = 20 + rand() * 40;
      g.fillStyle = rad(g, x, y, 0, r, [[0, `rgba(255,${170 + rand() * 60 | 0},90,0.55)`], [1, "rgba(255,170,90,0)"]]);
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // The bus: a dark body and a row of lit windows.
    g.fillStyle = "#1c2448"; g.fillRect(-10, 300, S + 20, 220);
    for (let k = 0; k < 5; k++) {
      g.fillStyle = lin(g, 0, 320, 0, 420, [[0, "#ffd27a"], [1, "#f08a3c"]]);
      g.fillRect(20 + k * 118, 322, 100, 96);
      g.fillStyle = "rgba(30,20,40,0.55)";
      if (k % 2) { g.beginPath(); g.ellipse(70 + k * 118, 400, 22, 30, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(70 + k * 118, 362, 13, 0, 7); g.fill(); }
    }
    g.fillStyle = "#ff5a3c"; g.fillRect(560, 450, 30, 16);
  },
};

const PHOTOS = [
  { id: "pool", cap: "pool, 4pm", title: "Pool, 4pm", meta: "Lisbon · July", note: "Nobody in the water yet. The light did all the swimming.", r: -3 },
  { id: "dunes", cap: "the dunes", title: "The dunes", meta: "Merzouga · June", note: "Taken walking back. Every ridge had one bright side and one in shadow.", r: 2.5 },
  { id: "lemons", cap: "lemons", title: "Lemons", meta: "Amalfi · August", note: "Bought five, shot them on the tablecloth, ate two.", r: -1.5 },
  { id: "window", cap: "morning", title: "Morning", meta: "Home · September", note: "The sun comes in sideways for about twenty minutes. This was minute twelve.", r: 3 },
  { id: "coast", cap: "last swim", title: "Last swim", meta: "Kas · August", note: "The sea went dark before the sky did.", r: -2.5 },
  { id: "bus", cap: "night bus", title: "Night bus", meta: "Istanbul · July", note: "Shot from the curb as it pulled away. Only the windows came out.", r: 1.5 },
];

for (const p of PHOTOS) {
  const [c, g] = canvas();
  SCENES[p.id](g);
  finish(g);
  p.src = c.toDataURL("image/jpeg", 0.88);
}

/* ---------- The contact sheet ---------- */

const list = document.getElementById("prints");
const sheet = document.getElementById("sheet");
const detail = document.getElementById("detail");
const big = document.getElementById("big");
const bigImg = document.getElementById("big-img");
const milk = big.querySelector(".milk");

PHOTOS.forEach((p, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<button type="button" style="--r:${p.r}deg" aria-label="Open ${p.title}">
    <span class="print"><span class="photo"><img alt="" src="${p.src}"></span><span class="cap">${p.cap}</span></span>
  </button>`;
  const btn = li.firstElementChild;
  btn.addEventListener("click", () => open(i, btn));
  list.append(li);
  p.btn = btn;
});

/* ---------- Opening and closing ---------- */

let current = -1;
let develop = [];

function transition(update) {
  if (!document.startViewTransition || reduceMotion) { update(); return Promise.resolve(); }
  return document.startViewTransition(update).finished;
}

function fill(p) {
  bigImg.src = p.src;
  big.querySelector("figcaption").textContent = p.cap;
  document.getElementById("detail-title").textContent = p.title;
  document.getElementById("detail-meta").textContent = p.meta;
  document.getElementById("detail-note").textContent = p.note;
}

// Undeveloped: milky, cold and flat. Shadows come up first, colour last.
const RAW = "saturate(0) contrast(0.3) brightness(1.3) sepia(0.35) hue-rotate(120deg)";
const MID = "saturate(0.2) contrast(0.75) brightness(1.1) sepia(0.25) hue-rotate(50deg)";
const DONE = "saturate(1) contrast(1) brightness(1) sepia(0) hue-rotate(0deg)";

async function open(i, btn) {
  const p = PHOTOS[i];
  current = i;
  for (const a of develop) a.cancel();
  fill(p);
  bigImg.style.filter = reduceMotion ? "" : RAW;
  milk.style.opacity = reduceMotion ? 0 : 0.8;
  btn.querySelector(".print").style.viewTransitionName = "shot";
  await transition(() => {
    btn.querySelector(".print").style.viewTransitionName = "";
    big.style.viewTransitionName = "shot";
    sheet.hidden = true;
    detail.hidden = false;
    scrollTo(0, 0);
  });
  big.style.viewTransitionName = "";
  document.getElementById("back").focus({ preventScroll: true });
  if (reduceMotion) return;

  // A small shake as it lands, like a print waved in the hand.
  develop = [
    big.animate(
      [
        { rotate: "-1.2deg", translate: "0 0" },
        { rotate: "1.8deg", translate: "6px -4px" },
        { rotate: "-2.6deg", translate: "-7px 2px" },
        { rotate: "1deg", translate: "4px -2px" },
        { rotate: "-1.2deg", translate: "0 0" },
      ],
      { duration: 620, easing: "ease-out" }
    ),
    bigImg.animate(
      [{ filter: RAW }, { filter: MID, offset: 0.45 }, { filter: DONE }],
      { duration: 5200, easing: "cubic-bezier(.3,0,.4,1)", fill: "forwards" }
    ),
    milk.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 3800, easing: "ease-out", fill: "forwards" }),
  ];
}

async function close() {
  if (current < 0) return;
  const p = PHOTOS[current];
  current = -1;
  big.style.viewTransitionName = "shot";
  await transition(() => {
    big.style.viewTransitionName = "";
    p.btn.querySelector(".print").style.viewTransitionName = "shot";
    detail.hidden = true;
    sheet.hidden = false;
  });
  p.btn.querySelector(".print").style.viewTransitionName = "";
  for (const a of develop) a.cancel();
  develop = [];
  p.btn.focus({ preventScroll: true });
}

document.getElementById("back").addEventListener("click", close);
addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
