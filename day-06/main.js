// Day 06 · Dithered Snow Globe
// A small Three.js scene rendered at half resolution, then pushed through a
// one-bit ordered (Bayer 8x8) dither: every pixel is either ink or paper.
// Drag to shake. The globe tilts and spins with the drag, the flakes get kicked
// by how fast you moved, and gravity is taken in the globe's own frame, so the
// snow falls "down" even while the globe is tipped. Water drag lets the snow keep
// swirling after you let go, then it settles on the ground and stays there.
// Everything is driven by requestAnimationFrame and performance.now.

import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("scene");
const shakeBtn = document.getElementById("shake");

const PIXEL = 2; // size of one dither cell in CSS pixels
// Raw sRGB values: the dither pass writes them straight to the screen,
// so they match the page's CSS colours exactly.
const hex = (h) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const INK = hex("#0e1a3a"); // night
const PAPER = hex("#e7eef4"); // snow

/* ---------- Renderer and dither pass ---------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const target = new THREE.WebGLRenderTarget(2, 2, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
});

const ditherMat = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: target.texture },
    uPixel: { value: PIXEL },
    uInk: { value: INK },
    uPaper: { value: PAPER },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform float uPixel;
    uniform vec3 uInk;
    uniform vec3 uPaper;
    varying vec2 vUv;
    float bayer(vec2 p) {
      // 8x8 Bayer matrix built from the recursive 2x2 pattern.
      vec2 a = mod(p, 2.0), b = mod(floor(p / 2.0), 2.0), c = mod(floor(p / 4.0), 2.0);
      float d2 = mod(a.x * 2.0 + a.y * 3.0, 4.0);
      float d4 = mod(b.x * 2.0 + b.y * 3.0, 4.0);
      float d8 = mod(c.x * 2.0 + c.y * 3.0, 4.0);
      return (d2 * 16.0 + d4 * 4.0 + d8 + 0.5) / 64.0;
    }
    void main() {
      vec3 col = texture2D(tScene, vUv).rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      l = pow(clamp(l, 0.0, 1.0), 0.9);
      float t = bayer(floor(gl_FragCoord.xy / uPixel));
      gl_FragColor = vec4(l > t ? uPaper : uInk, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ditherMat));

/* ---------- Scene ---------- */

const scene = new THREE.Scene();
// Night sky: dark, with a faint glow behind the globe that dithers into stars.
scene.background = new THREE.Color(0.0, 0.0, 0.0);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-3, 4, 3);
scene.add(sun);

const R = 1; // globe radius
const FLOOR = -0.52; // ground height inside the globe, in globe space

// The base stays put; the globe (glass + contents) tilts and spins on it.
const rig = new THREE.Group();
scene.add(rig);

const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.1 });
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.98, 0.5, 64), baseMat);
base.position.y = -R * 0.86 - 0.25;
rig.add(base);
const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 64), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4 }));
lip.position.y = -R * 0.86 + 0.02;
rig.add(lip);

const globe = new THREE.Group();
rig.add(globe);

// Ground: a snowy disc with a soft mound.
{
  const geo = new THREE.CircleGeometry(Math.sqrt(R * R - FLOOR * FLOOR) - 0.01, 64);
  geo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  ground.position.y = FLOOR;
  globe.add(ground);
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  );
  mound.scale.set(1.1, 0.28, 0.9);
  mound.position.set(0.1, FLOOR, -0.1);
  globe.add(mound);
}

// A cabin and three pines.
{
  const wood = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 1 });
  const cabin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.28), wood);
  body.position.y = 0.12;
  cabin.add(body);
  const roofGeo = new THREE.CylinderGeometry(0.01, 0.27, 0.2, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.scale.set(1.25, 1, 1.0);
  roof.position.y = 0.34;
  cabin.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  win.position.set(0.06, 0.13, 0.141);
  cabin.add(win);
  cabin.position.set(0.18, FLOOR + 0.08, 0.05);
  cabin.rotation.y = -0.5;
  globe.add(cabin);

  const pine = new THREE.MeshStandardMaterial({ color: 0xa4a4a4, roughness: 0.9 });
  [[-0.32, 0.05, 0.55], [-0.12, -0.28, 0.42], [0.46, -0.3, 0.36]].forEach(([x, z, h]) => {
    const t = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(h * (0.36 - k * 0.07), h * 0.45, 7), pine);
      c.position.y = h * (0.28 + k * 0.22);
      t.add(c);
    }
    t.position.set(x, FLOOR + 0.02, z);
    globe.add(t);
  });
}

// Glass: a fresnel shell with a sharp window highlight.
const glass = new THREE.Mesh(
  new THREE.SphereGeometry(R, 64, 48),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.6).normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
        float s = pow(max(dot(reflect(-uLight, vN), vV), 0.0), 60.0);
        // A pale rim where the glass turns away, and one bright window highlight.
        vec3 col = vec3(1.0);
        float a = clamp(f * 0.55 + s * 1.3, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
  })
);
glass.renderOrder = 2;
globe.add(glass);

// The water: the inside of the sphere, mid grey, so white snow reads against it.
const water = new THREE.Mesh(
  new THREE.SphereGeometry(R * 0.995, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.BackSide })
);
globe.add(water);

// Moonlight pooled on the ground around the base.
{
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -R * 0.86 - 0.5;
  scene.add(shadow);
}

/* ---------- Snow ---------- */

const N = 900;
const pos = new Float32Array(N * 3);
const vel = new Float32Array(N * 3);
const settled = new Uint8Array(N);
let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (let i = 0; i < N; i++) {
  // Start resting on the ground, spread over the disc.
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.8;
  pos[i * 3] = Math.cos(a) * r;
  pos[i * 3 + 1] = FLOOR + 0.01 + rnd() * 0.02;
  pos[i * 3 + 2] = Math.sin(a) * r;
  settled[i] = 1;
}
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
const snow = new THREE.Points(
  snowGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, sizeAttenuation: true })
);
snow.renderOrder = 1;
globe.add(snow);

// Kick every flake by a velocity (in globe space), with some randomness.
function kick(vx, vy, vz, spread) {
  for (let i = 0; i < N; i++) {
    const j = i * 3;
    settled[i] = 0;
    vel[j] += vx * (0.6 + rnd() * 0.8) + (rnd() - 0.5) * spread;
    vel[j + 1] += vy * (0.6 + rnd() * 0.8) + (rnd() - 0.3) * spread;
    vel[j + 2] += vz * (0.6 + rnd() * 0.8) + (rnd() - 0.5) * spread;
    // Cap the speed so repeated shakes swirl the snow instead of pinning it to the glass.
    const v = Math.hypot(vel[j], vel[j + 1], vel[j + 2]);
    if (v > 2.2) { vel[j] *= 2.2 / v; vel[j + 1] *= 2.2 / v; vel[j + 2] *= 2.2 / v; }
  }
}

const gWorld = new THREE.Vector3(0, -1, 0);
const gLocal = new THREE.Vector3();
const qInv = new THREE.Quaternion();

function stepSnow(dt, t) {
  qInv.copy(globe.getWorldQuaternion(new THREE.Quaternion())).invert();
  gLocal.copy(gWorld).applyQuaternion(qInv).multiplyScalar(0.55);
  const drag = Math.exp(-2.2 * dt);
  const lim = R * 0.94;
  // Water keeps turning slowly: a gentle swirl that fades as things calm down.
  for (let i = 0; i < N; i++) {
    if (settled[i]) continue;
    const j = i * 3;
    let x = pos[j], y = pos[j + 1], z = pos[j + 2];
    let vx = vel[j], vy = vel[j + 1], vz = vel[j + 2];
    // Flakes flutter: a little sideways drift unique to each one.
    const w = Math.sin(t * 2.1 + i * 1.7) * 0.06;
    vx = (vx + (gLocal.x + w) * dt) * drag;
    vy = (vy + gLocal.y * dt) * drag;
    vz = (vz + (gLocal.z + Math.cos(t * 1.7 + i) * 0.05) * dt) * drag;
    x += vx * dt; y += vy * dt; z += vz * dt;

    // Glass wall: push back inside and lose most of the normal speed.
    const d = Math.hypot(x, y, z);
    if (d > lim) {
      const nx = x / d, ny = y / d, nz = z / d;
      x = nx * lim; y = ny * lim; z = nz * lim;
      const vn = vx * nx + vy * ny + vz * nz;
      if (vn > 0) { vx -= 1.5 * vn * nx; vy -= 1.5 * vn * ny; vz -= 1.5 * vn * nz; }
    }
    // Ground: land and stay once slow enough.
    if (y < FLOOR + 0.012) {
      y = FLOOR + 0.006 + (i % 7) * 0.002;
      if (Math.hypot(vx, vy, vz) < 0.35) { settled[i] = 1; vx = vy = vz = 0; }
      else { vy = Math.abs(vy) * 0.2; vx *= 0.6; vz *= 0.6; }
    }
    pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
  }
  snowGeo.attributes.position.needsUpdate = true;
}

/* ---------- Shaking ---------- */

// Globe orientation: yaw follows the drag freely, tilt springs back upright.
let yaw = 0.35, yawV = 0, tilt = 0, tiltV = 0, roll = 0, rollV = 0;
let dragging = false, lastX = 0, lastY = 0, lastT = 0;

function onDown(e) {
  dragging = true;
  canvas.classList.add("dragging");
  lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
  canvas.setPointerCapture?.(e.pointerId);
}
function onMove(e) {
  if (!dragging) return;
  const now = performance.now();
  const dt = Math.max(8, now - lastT) / 1000;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY; lastT = now;
  const s = 1 / Math.min(innerWidth, innerHeight);
  yawV += dx * s * 9;
  tiltV += dy * s * 7;
  rollV -= dx * s * 4;
  // Kick the snow in globe space, opposite to the motion (the water lags behind).
  const speed = Math.hypot(dx, dy) / dt * s;
  if (speed > 0.2) kick(-dx * s * 3, dy * s * 3, 0, Math.min(1.2, speed * 0.15));
}
function onUp() {
  dragging = false;
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerdown", onDown);
addEventListener("pointermove", onMove);
addEventListener("pointerup", onUp);
addEventListener("pointercancel", onUp);

function autoShake() {
  yawV += 2.2; tiltV += 1.1; rollV -= 0.9;
  kick(0, 1.4, 0, 2.2);
}
shakeBtn.addEventListener("click", autoShake);
canvas.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); autoShake(); }
});

/* ---------- Layout ---------- */

let W = 0, H = 0;
function layout() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  target.setSize(Math.ceil(W / PIXEL), Math.ceil(H / PIXEL));
  camera.aspect = W / H;
  const narrow = W < 760;
  // Fit the globe: on wide screens it sits right of centre, on phones lower down.
  const fitH = narrow ? 4.3 : 3.7;
  const dist = fitH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, 0.35, Math.max(dist, narrow ? dist * (0.62 / camera.aspect) : dist));
  camera.lookAt(0, -0.3, 0);
  if (narrow) {
    camera.setViewOffset(W, H, 0, -H * 0.16, W, H);
  } else {
    camera.setViewOffset(W, H, -W * 0.16, 0, W, H);
  }
  camera.updateProjectionMatrix();
}
addEventListener("resize", layout);
layout();

/* ---------- Frame ---------- */

let last = performance.now();
const start = last;
let opened = false;
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  const t = (now - start) / 1000;

  // A first shake shortly after load, so the snow is falling when you arrive.
  if (!opened && t > 0.6) {
    opened = true;
    if (!reduceMotion) autoShake();
    else kick(0, 0.8, 0, 0.6);
  }

  // Springs: tilt and roll want to return upright, yaw just slows down.
  const k = 18, c = 4.2;
  tiltV += (-k * tilt - c * tiltV) * dt; tilt += tiltV * dt;
  rollV += (-k * roll - c * rollV) * dt; roll += rollV * dt;
  yawV *= Math.exp(-2.5 * dt); yaw += yawV * dt;
  if (!reduceMotion && !dragging) yaw += dt * 0.08;
  globe.rotation.set(tilt * 0.35, yaw, roll * 0.35);
  base.rotation.y = yaw;
  rig.rotation.set(tilt * 0.08, 0, roll * 0.08);

  stepSnow(dt, t);

  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
