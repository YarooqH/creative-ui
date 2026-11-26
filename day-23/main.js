// Day 23 · Glass Cabinet
// A museum vitrine in Three.js. The case is five panes of physical glass
// (transmission, a little thickness, a faint green edge), so whatever sits
// behind a pane is refracted through it. The ewer and its label card are
// solid, and as you drag the case round, the card slides and bends behind
// whichever pane you are looking through. Reflections come from a small studio
// of soft boxes baked into an environment map. Dust sits on the outside of
// the glass, and the front pane carries a thumbprint in its roughness.

import * as THREE from "three";

const canvas = document.getElementById("scene");
const lampBtn = document.getElementById("lamp");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#3b1719");
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

let seed = 23;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- Reflections: a small studio baked into an environment map ---------- */
{
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#2a1012"), side: THREE.BackSide })));
  const soft = (w, h, color, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    studio.add(m);
  };
  soft(3, 2, "#fff1dc", 6, [0, 3.9, 0.5], [Math.PI / 2, 0, 0]); // the gallery's ceiling light
  soft(0.6, 4, "#dfe9ff", 3, [-5.9, 1, 0], [0, Math.PI / 2, 0]); // a tall window on the left
  soft(1.6, 0.4, "#ffe0c0", 4, [3, 2, 5.9], [0, Math.PI, 0]); // a strip light behind the visitor
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;
  scene.environmentIntensity = 0.9;
}

/* ---------- The room ---------- */

const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: "#5e2a2c", roughness: 0.95 }));
wall.position.set(0, 3, -2.2);
wall.receiveShadow = true;
scene.add(wall);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: "#2a1213", roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const hemi = new THREE.HemisphereLight("#7a5550", "#1a0909", 0.7);
scene.add(hemi);
const spot = new THREE.SpotLight("#ffe3c2", 55, 9, 0.36, 0.65, 2);
spot.position.set(0.7, 3.6, 1.6);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);
// A soft wash on the wall behind, so the case stands in a pool of light.
const wash = new THREE.SpotLight("#ffd8b8", 18, 10, 0.55, 1, 1.6);
wash.position.set(0.5, 4.2, 0.2);
wash.target.position.set(0.5, 1.6, -2.2);
scene.add(wash, wash.target);
const rim = new THREE.PointLight("#c9dcff", 1.2, 6, 2);
rim.position.set(-1.6, 2.2, -0.8);
scene.add(rim);

/* ---------- Vitrine: plinth, deck, glass ---------- */

const vitrine = new THREE.Group();
scene.add(vitrine);
const aim = new THREE.Object3D();
aim.position.y = 1.25;
vitrine.add(aim);
spot.target = aim;

const plinthMat = new THREE.MeshStandardMaterial({ color: "#d8cfc2", roughness: 0.85 });
const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.86), plinthMat);
plinth.position.y = 0.5;
plinth.castShadow = plinth.receiveShadow = true;
vitrine.add(plinth);
const deck = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.02, 0.78), new THREE.MeshStandardMaterial({ color: "#e6d9c4", roughness: 1 }));
deck.position.y = 1.01;
deck.receiveShadow = true;
vitrine.add(deck);

const CW = 0.78, CH = 0.86, T = 0.012, BASE = 1.02;

// A thumbprint and a smear in the front pane's roughness.
function smudgeMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "rgb(8 8 8)";
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgb(120 120 120 / 0.55)";
  g.lineWidth = 2;
  for (let i = 1; i < 16; i++) {
    g.beginPath();
    g.ellipse(352, 318, i * 2.6, i * 3.4, 0.4, 0.3 + i * 0.05, Math.PI * 2 - 0.2);
    g.stroke();
  }
  const gr = g.createRadialGradient(150, 230, 4, 150, 230, 90);
  gr.addColorStop(0, "rgb(70 70 70 / 0.6)");
  gr.addColorStop(1, "rgb(8 8 8 / 0)");
  g.fillStyle = gr;
  g.save(); g.translate(150, 230); g.rotate(-0.5); g.scale(1.8, 0.5); g.translate(-150, -230);
  g.fillRect(0, 0, 512, 512);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  return t;
}
const glassBase = {
  transmission: 1, thickness: 0.4, ior: 1.52, roughness: 0.035, metalness: 0,
  attenuationColor: new THREE.Color("#cfeadd"), attenuationDistance: 1.6, specularIntensity: 1,
  color: "#ffffff",
};
const glass = new THREE.MeshPhysicalMaterial(glassBase);
const frontGlass = new THREE.MeshPhysicalMaterial({ ...glassBase, roughness: 1, roughnessMap: smudgeMap() });
const panes = [
  [CW, CH, T, 0, CH / 2, CW / 2, frontGlass],
  [CW, CH, T, 0, CH / 2, -CW / 2, glass],
  [T, CH, CW, CW / 2, CH / 2, 0, glass],
  [T, CH, CW, -CW / 2, CH / 2, 0, glass],
  [CW + T, T, CW + T, 0, CH, 0, glass],
];
const dustPos = [];
for (const [w, h, d, x, y, z, mat] of panes) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  p.position.set(x, BASE + y, z);
  vitrine.add(p);
  // Dust on the outside face (or on top of the lid).
  const n = w === T || d === T ? 160 : 260;
  for (let i = 0; i < n; i++) {
    const u = rand() - 0.5, v = rand() - 0.5;
    if (d === T) dustPos.push(x + u * w, BASE + y + v * h, z + Math.sign(z) * (T / 2 + 0.001));
    else if (w === T) dustPos.push(x + Math.sign(x) * (T / 2 + 0.001), BASE + y + v * h, z + u * d);
    else dustPos.push(x + u * w, BASE + y + T / 2 + 0.001, z + v * d);
  }
}
// The bonded edges of the panes catch the light as thin pale-green lines.
const edgeMat = new THREE.MeshStandardMaterial({ color: "#cfe6da", roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false });
const E = 0.006;
for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
  const v = new THREE.Mesh(new THREE.BoxGeometry(E, CH, E), edgeMat);
  v.position.set((sx * CW) / 2, BASE + CH / 2, (sz * CW) / 2);
  vitrine.add(v);
}
for (const [w, d, x, z] of [[CW, E, 0, CW / 2], [CW, E, 0, -CW / 2], [E, CW, CW / 2, 0], [E, CW, -CW / 2, 0]]) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, E, d), edgeMat);
  t.position.set(x, BASE + CH + T / 2, z);
  vitrine.add(t);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#fff6e8", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.38, depthWrite: false }));
vitrine.add(dust);

/* ---------- The ewer ---------- */

function crackle() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = "#a9c7ad";
  g.fillRect(0, 0, 1024, 1024);
  // Pooling: the glaze runs a little darker in bands.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgb(80 120 95 / ${rand() * 0.08})`;
    g.fillRect(0, rand() * 1024, 1024, 10 + rand() * 60);
  }
  // Crackle: short wandering cracks that branch.
  g.lineCap = "round";
  const crack = (x, y, a, len, w) => {
    g.lineWidth = w;
    g.strokeStyle = `rgb(78 100 84 / ${0.35 + rand() * 0.35})`;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      a += (rand() - 0.5) * 0.9;
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      g.lineTo(x, y);
      if (rand() < 0.08 && w > 0.8) { g.stroke(); crack(x, y, a + (rand() < 0.5 ? 1.3 : -1.3), len * 0.5, w * 0.7); g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  };
  for (let i = 0; i < 220; i++) crack(rand() * 1024, rand() * 1024, rand() * 6.3, 6 + rand() * 14, 1.2 + rand() * 1.2);
  // A few iron spots.
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgb(110 70 40 / ${0.3 + rand() * 0.4})`;
    g.beginPath(); g.arc(rand() * 1024, rand() * 1024, 1 + rand() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const glaze = new THREE.MeshPhysicalMaterial({ map: crackle(), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0 });

const ewer = new THREE.Group();
const profile = [
  [0, 0], [0.068, 0], [0.072, 0.012], [0.062, 0.022], [0.088, 0.06], [0.118, 0.13], [0.128, 0.18], [0.122, 0.22],
  [0.104, 0.27], [0.072, 0.315], [0.048, 0.35], [0.042, 0.385], [0.05, 0.415], [0.058, 0.428], [0.05, 0.43],
  [0.04, 0.4], [0.034, 0.35], [0, 0.33],
].map(([r, y]) => new THREE.Vector2(r, y));
const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), glaze);
body.geometry.computeVertexNormals();
const spout = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.1, 0.2, 0), new THREE.Vector3(0.15, 0.25, 0), new THREE.Vector3(0.19, 0.31, 0), new THREE.Vector3(0.215, 0.35, 0),
]), 24, 0.015, 12), glaze);
const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.045, 0.37, 0), new THREE.Vector3(-0.13, 0.375, 0), new THREE.Vector3(-0.17, 0.3, 0), new THREE.Vector3(-0.15, 0.22, 0), new THREE.Vector3(-0.115, 0.17, 0),
]), 32, 0.012, 12), glaze);
for (const m of [body, spout, handle]) { m.castShadow = true; ewer.add(m); }
const riser = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: "#efe4d2", roughness: 0.9 }));
riser.position.y = BASE + 0.025;
riser.castShadow = riser.receiveShadow = true;
vitrine.add(riser);
ewer.position.set(0.04, BASE + 0.05, -0.04);
ewer.rotation.y = -0.5;
vitrine.add(ewer);

/* ---------- The label card ---------- */

async function labelTexture() {
  await Promise.all([
    document.fonts.load('600 60px "Bodoni Moda"'), document.fonts.load('italic 400 40px "Bodoni Moda"'),
    document.fonts.load('400 30px "Red Hat Display"'),
  ]).catch(() => {});
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 600;
  const g = c.getContext("2d");
  g.fillStyle = "#f5eddf";
  g.fillRect(0, 0, 1024, 600);
  g.fillStyle = "#2a1a17";
  g.font = '600 64px "Bodoni Moda", Georgia, serif';
  g.fillText("Ewer with crackled glaze", 64, 118);
  g.font = 'italic 400 42px "Bodoni Moda", Georgia, serif';
  g.fillText("Halden kilns, about 1180", 64, 182);
  g.font = '400 31px "Red Hat Display", Arial, sans-serif';
  const words = "Stoneware with a celadon glaze. The fine crackle formed as the glaze cooled faster than the clay beneath it.".split(" ");
  let line = "", y = 270;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > 880) { g.fillText(line, 64, y); y += 46; line = w; } else line = t;
  }
  g.fillText(line, 64, y);
  g.fillStyle = "#7a5f55";
  g.font = '400 26px "Red Hat Display", Arial, sans-serif';
  g.fillText("Gift of the Marrow family, 1931", 64, 536);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.175, 0.004), new THREE.MeshStandardMaterial({ color: "#f5eddf", roughness: 0.9 }));
const cardStand = new THREE.Group();
cardStand.add(card);
card.rotation.x = -0.9; // tilted back like a lectern label
card.position.y = 0.05;
cardStand.position.set(-0.19, BASE, 0.21);
cardStand.rotation.y = 0.32;
card.castShadow = true;
vitrine.add(cardStand);
labelTexture().then((t) => {
  card.material = [card.material, card.material, card.material, card.material, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), card.material];
});

/* ---------- Sizing and the view ---------- */

function resize() {
  const W = innerWidth, H = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const wide = W / H > 1.15;
  camera.fov = wide ? 28 : 40;
  camera.position.set(0, 1.6, wide ? 3.25 : 3.9);
  camera.lookAt(0, 1.32, 0);
  camera.updateProjectionMatrix();
  vitrine.position.x = wide ? 0.36 : 0;
  vitrine.position.y = wide ? 0 : 0.12;
}
addEventListener("resize", resize);
resize();

/* ---------- Turning the case ---------- */

let angle = -0.35, vel = 0, dragging = false, lastX = 0, lastInput = -10, clock = 0;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true; lastX = e.clientX; vel = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  angle += dx * 0.006;
  vel = dx * 0.006 * 60;
  lastInput = clock;
});
const release = () => { dragging = false; lastInput = clock; };
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

let dim = false;
lampBtn.addEventListener("click", () => {
  dim = !dim;
  lampBtn.textContent = dim ? "Light" : "Dim";
});
let lampK = 1;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  clock += dt;
  if (!dragging) {
    angle += vel * dt;
    vel *= Math.exp(-dt * 2.5);
    // Left alone for a while, the case turns slowly by itself.
    if (!reduceMotion && clock - lastInput > 3) angle += dt * 0.12 * Math.min(1, (clock - lastInput - 3) / 2);
  }
  vitrine.rotation.y = angle;
  lampK += ((dim ? 0.12 : 1) - lampK) * Math.min(1, dt * 4);
  spot.intensity = 55 * lampK;
  hemi.intensity = 0.25 + 0.45 * lampK;
  scene.environmentIntensity = 0.9 + (1 - lampK) * 0.6; // in the dark, the reflections take over
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
