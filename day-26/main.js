import * as THREE from "three";

/* ---------- Song: a short generated loop in A minor ---------- */

const BPM = 96;
const STEP = 60 / BPM / 4;          // one 16th note
const BAR = STEP * 16;
const BARS = 12;                    // 2 intro, 8 main, 2 break
const LOOP = BAR * BARS;
const CHORDS = [                    // Am, F, C, G (midi)
  [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62],
];
const ROOTS = [33, 29, 36, 31];     // A1, F1, C2, G1
const KICKS = [0, 8, 11];
const BASS = [[0, 3], [3, 2], [6, 2], [8, 3], [11, 2], [14, 2]]; // [step, length]
const HATS = [2, 6, 10, 14];

const section = (bar) => (bar < 2 ? "intro" : bar < 10 ? "main" : "break");
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Every note the loop plays, in song seconds. Audio and the silent fallback read the same list.
const EVENTS = [];
for (let bar = 0; bar < BARS; bar++) {
  const sec = section(bar), ch = bar % 4, t0 = bar * BAR;
  EVENTS.push({ t: t0, type: "pad", notes: CHORDS[ch], dur: BAR });
  for (const s of HATS) EVENTS.push({ t: t0 + s * STEP, type: "hat", v: 1 });
  if (sec === "main") for (let s = 1; s < 16; s += 2) if (!HATS.includes(s)) EVENTS.push({ t: t0 + s * STEP, type: "hat", v: 0.45 });
  if (sec === "main") for (const s of KICKS) EVENTS.push({ t: t0 + s * STEP, type: "kick" });
  if (sec !== "intro") {
    for (const [s, len] of BASS) {
      const up = sec === "main" && bar % 2 === 1 && s === 14 ? 12 : 0;
      EVENTS.push({ t: t0 + s * STEP, type: "bass", note: ROOTS[ch] + up, dur: len * STEP * 0.92 });
    }
  }
}
EVENTS.sort((a, b) => a.t - b.t);

/* ---------- Web Audio ---------- */

let ac = null, analyser = null, master = null, noise = null;
let playing = false, songAt = 0, startedAt = 0, nextIdx = 0, loopBase = 0, timer = 0;

function setupAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  master = ac.createGain(); master.gain.value = 0.85;
  analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  analyser.minDecibels = -88; analyser.maxDecibels = -22;
  master.connect(comp); comp.connect(analyser); analyser.connect(ac.destination);
  const len = ac.sampleRate;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function voice(ev, when) {
  if (ev.type === "kick") {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.14);
    g.gain.setValueAtTime(1.0, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.5);
  } else if (ev.type === "bass") {
    const f = mtof(ev.note);
    const saw = ac.createOscillator(), sub = ac.createOscillator();
    saw.type = "sawtooth"; saw.frequency.value = f; sub.frequency.value = f;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6;
    lp.frequency.setValueAtTime(700, when);
    lp.frequency.exponentialRampToValueAtTime(160, when + ev.dur);
    const g = ac.createGain(), sg = ac.createGain();
    sg.gain.value = 0.7;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.42, when + 0.01);
    g.gain.setTargetAtTime(0.26, when + 0.02, 0.08);
    g.gain.setTargetAtTime(0, when + ev.dur, 0.03);
    saw.connect(lp); sub.connect(sg); sg.connect(g); lp.connect(g); g.connect(master);
    saw.start(when); sub.start(when); saw.stop(when + ev.dur + 0.2); sub.stop(when + ev.dur + 0.2);
  } else if (ev.type === "hat") {
    const src = ac.createBufferSource(); src.buffer = noise;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.11 * ev.v, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(when, Math.random() * 0.5); src.stop(when + 0.07);
  } else if (ev.type === "pad") {
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100; lp.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.055, when + 0.6);
    g.gain.setValueAtTime(0.055, when + ev.dur - 0.2);
    g.gain.linearRampToValueAtTime(0, when + ev.dur + 0.5);
    lp.connect(g); g.connect(master);
    for (const n of ev.notes) for (const det of [-7, 7]) {
      const o = ac.createOscillator(); o.type = "sawtooth";
      o.frequency.value = mtof(n); o.detune.value = det;
      o.connect(lp); o.start(when); o.stop(when + ev.dur + 0.6);
    }
  }
}

function schedule() {
  const ahead = ac.currentTime + 0.15;
  for (;;) {
    if (nextIdx >= EVENTS.length) { nextIdx = 0; loopBase += LOOP; }
    const ev = EVENTS[nextIdx];
    const when = startedAt + loopBase + ev.t;
    if (when > ahead) break;
    if (when >= ac.currentTime - 0.02) voice(ev, when);
    nextIdx++;
  }
}

/* ---------- Clock and levels ---------- */

// The recorder marks the page once the DOM is ready, which can be after this module runs.
let recording = document.documentElement.hasAttribute("data-recording");
addEventListener("DOMContentLoaded", () => { recording = document.documentElement.hasAttribute("data-recording"); });
let lastNow = performance.now(), songClock = 0;

// Song time. With live audio it follows the audio clock; while recording (fake page clock)
// it follows the page clock, so the picture stays in step frame by frame.
function songTime() {
  if (ac && !recording && playing) return ac.currentTime - startedAt;
  return songClock;
}

// The score read as a spectrum: used before the first sound and while recording.
function scoreSpectrum(t, out) {
  const tl = ((t % LOOP) + LOOP) % LOOP;
  let kick = 0, hat = 0, bass = 0, bassF = 0.06, pad = 0, chord = CHORDS[0];
  for (const ev of EVENTS) {
    if (ev.t > tl) break;
    const dt = tl - ev.t;
    if (ev.type === "kick") kick = Math.exp(-dt * 7);
    else if (ev.type === "hat") hat = ev.v * Math.exp(-dt * 26);
    else if (ev.type === "bass") {
      bass = dt < ev.dur ? 0.62 + 0.38 * Math.exp(-dt * 7) : 0.62 * Math.exp(-(dt - ev.dur) * 22);
      bassF = 0.03 + (ev.note - 29) * 0.0055;
    } else if (ev.type === "pad") {
      pad = Math.min(1, dt / 0.6) * (dt > ev.dur ? Math.exp(-(dt - ev.dur) * 4) : 1);
      chord = ev.notes;
    }
  }
  for (let i = 0; i < out.length; i++) {
    const f = i / (out.length - 1);
    let v = kick * Math.exp(-Math.pow((f - 0.015) / 0.07, 2));
    v += bass * 0.85 * Math.exp(-Math.pow((f - bassF) / 0.045, 2));
    for (const n of chord) {
      const fc = 0.28 + (n - 52) * 0.012;
      v += pad * 0.32 * Math.exp(-Math.pow((f - fc) / 0.03, 2));
    }
    v += hat * 0.42 * Math.max(0, (f - 0.62) / 0.38) * (0.7 + 0.3 * Math.sin(i * 12.9898 + t * 40));
    out[i] = Math.min(1, v);
  }
}

// Live audio read as the same 64 bands, log-spaced 30 Hz to 12 kHz.
let fft = null;
function liveSpectrum(out) {
  if (!fft) fft = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(fft);
  const hz = ac.sampleRate / analyser.fftSize;
  let sum = 0;
  for (let i = 0; i < out.length; i++) {
    const f0 = 30 * Math.pow(400, i / out.length), f1 = 30 * Math.pow(400, (i + 1) / out.length);
    const a = Math.max(1, Math.floor(f0 / hz)), b = Math.max(a + 1, Math.ceil(f1 / hz));
    let m = 0;
    for (let k = a; k < b && k < fft.length; k++) m = Math.max(m, fft[k]);
    const v = Math.pow(m / 255, 1.6) * (i < 10 ? 1.1 : 0.8);
    out[i] = Math.min(1, v);
    sum += v;
  }
  return sum;
}

/* ---------- Scene ---------- */

const canvas = document.getElementById("land");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

const BINS = 64, ROWS = 128;
const hist = new Uint8Array(BINS * ROWS);
const histTex = new THREE.DataTexture(hist, BINS, ROWS, THREE.RedFormat, THREE.UnsignedByteType);
histTex.magFilter = histTex.minFilter = THREE.LinearFilter;
histTex.wrapT = THREE.RepeatWrapping;
histTex.needsUpdate = true;
let head = 0;   // row holding the newest sound

const DEPTH = 19, WIDTH = 24;
const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, 220, 240);
geo.rotateX(-Math.PI / 2);
geo.translate(0, 0, -DEPTH / 2 + 4);

const uniforms = {
  uHist: { value: histTex },
  uHead: { value: 0 },
  uTime: { value: 0 },
  uDrift: { value: 0 },
  uAmp: { value: 0 },
  uDpr: { value: DPR },
  uPaper: { value: new THREE.Color("#f1ebdd") },
  uBlue: { value: new THREE.Color("#1f36b8") },
  uPink: { value: new THREE.Color("#ff4d88") },
  uNear: { value: 4 },
  uDepth: { value: DEPTH },
};
for (const k of ["uPaper", "uBlue", "uPink"]) uniforms[k].value.convertLinearToSRGB?.();

const mat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: /* glsl */`
    uniform sampler2D uHist;
    uniform float uHead, uTime, uDrift, uAmp, uNear, uDepth;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vSound;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
      return s;
    }
    float soundAt(vec3 p, float d, vec2 q) {
      float u = pow(clamp(abs(p.x) / 9.0 + (vnoise(q * 3.0) - 0.5) * 0.05, 0.0, 1.0), 1.7);
      float v = (uHead - d * float(${ROWS - 1}) + 0.5) / float(${ROWS});
      float s = texture2D(uHist, vec2((u * float(${BINS - 1}) + 0.5) / float(${BINS}), v)).r;
      float lump = 0.55 + 0.9 * fbm(q * 1.7 + 11.0);
      return s * lump * uAmp * (1.0 - 0.35 * d);
    }
    float heightAt(vec3 p, out float rise) {
      float d = clamp((uNear - p.z) / uDepth, 0.0, 1.0);          // 0 near, 1 far
      vec2 q = vec2(p.x * 0.28, p.z * 0.28 + uDrift);
      float ground = fbm(q) * 1.5 - 0.55;
      ground += 0.6 * smoothstep(0.35, 1.0, d) * fbm(q * 0.6 + 3.0);
      // Sound: bass along the middle, treble out at the sides; older sound further away.
      rise = soundAt(p, d, q);
      return ground + rise * 1.25;
    }
    void main() {
      vec3 p = position;
      float rise, r1, r2;
      p.y = heightAt(p, rise);
      float e = 0.09;
      float hx = heightAt(p + vec3(e, 0.0, 0.0), r1);
      float hz = heightAt(p + vec3(0.0, 0.0, e), r2);
      vNormal = normalize(vec3(p.y - hx, e, p.y - hz));
      vSound = rise;
      vPos = p;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uPaper, uBlue, uPink;
    uniform float uDpr, uNear, uDepth;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying float vSound;
    float bayer4(vec2 p) {
      p = mod(floor(p), 4.0);
      float i = p.x + p.y * 4.0;
      // 4x4 ordered dither table
      float t[16];
      t[0]=0.;t[1]=8.;t[2]=2.;t[3]=10.;t[4]=12.;t[5]=4.;t[6]=14.;t[7]=6.;
      t[8]=3.;t[9]=11.;t[10]=1.;t[11]=9.;t[12]=15.;t[13]=7.;t[14]=13.;t[15]=5.;
      for (int k = 0; k < 16; k++) if (float(k) == i) return (t[k] + 0.5) / 16.0;
      return 0.5;
    }
    void main() {
      vec3 n = normalize(vNormal);
      vec3 L = normalize(vec3(-0.65, 0.55, 0.35));
      float lit = clamp(dot(n, L), 0.0, 1.0);
      float d = clamp((uNear - vPos.z) / uDepth, 0.0, 1.0);
      float tone = 0.18 + lit * 0.95;                       // 0 dark .. 1 bright
      vec2 cell = gl_FragCoord.xy / (2.0 * uDpr);
      float th = bayer4(cell);
      float thP = bayer4(cell + vec2(1.0, 2.0));           // slight misregistration for the pink layer
      vec3 col = uPaper;
      float blueAmt = 1.0 - smoothstep(0.08, 0.6, tone);
      float pinkAmt = clamp(vSound * 1.6, 0.0, 0.9) * (1.0 - smoothstep(0.55, 1.05, tone)) + 0.32 * (1.0 - smoothstep(0.35, 0.8, tone));
      if (pinkAmt > thP) col = uPink;
      if (blueAmt > th) col = uBlue;
      // Contours: evenly spaced heights, so they slide whenever the ground moves.
      float h = vPos.y * 5.0;
      float w = fwidth(h);
      float c = abs(fract(h) - 0.5);
      float line = smoothstep(0.5 - w * 1.2, 0.5 - w * 0.2, c);
      float major = step(abs(mod(floor(h + 0.5), 5.0)), 0.5);
      line *= mix(0.85, 1.0, major);
      if (line > 0.5) col = uBlue;
      // Dithered haze into the paper toward the horizon.
      float fog = smoothstep(0.45, 1.0, d);
      if (fog > bayer4(cell + vec2(2.0, 1.0))) col = uPaper;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const land = new THREE.Mesh(geo, mat);
scene.add(land);
scene.background = new THREE.Color("#f1ebdd");

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const portrait = h > w;
  camera.fov = portrait ? 58 : 38;
  camera.position.set(0, portrait ? 3.6 : 3.0, 5.2);
  camera.lookAt(0, portrait ? 0.6 : 1.5, -6);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

/* ---------- UI ---------- */

const btn = document.getElementById("play");
const clockEl = document.getElementById("clock");

async function toggle() {
  if (!playing) {
    if (!ac) {
      setupAudio();
      startedAt = ac.currentTime + 0.08 - songClock;
      nextIdx = 0; loopBase = 0;
      while (nextIdx < EVENTS.length && EVENTS[nextIdx].t < songClock) nextIdx++;
    } else {
      await ac.resume();
      startedAt = ac.currentTime - songClock;
    }
    playing = true;
    schedule();
    timer = setInterval(schedule, 30);
  } else {
    playing = false;
    clearInterval(timer);
    songClock = songTime();
    await ac.suspend();
  }
  btn.textContent = playing ? "Pause" : "Play";
  btn.setAttribute("aria-pressed", String(playing));
}
btn.addEventListener("click", () => {
  if (ac && playing) songClock = ac.currentTime - startedAt;
  toggle();
});
addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) { e.preventDefault(); btn.click(); }
});

/* ---------- Loop ---------- */

const row = new Float32Array(BINS);
const smooth = new Float32Array(BINS);
const ROW_RATE = 30;                  // rows of sound per second
let rowAcc = 0, amp = 0, drift = 0, quietFrames = 0;

function pushRow() {
  head = (head + 1) % ROWS;
  for (let i = 0; i < BINS; i++) hist[head * BINS + i] = Math.round(smooth[i] * 255);
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (playing && (recording || !ac)) songClock += dt;
  const t = songTime();

  if (playing) {
    let used = false;
    if (ac && !recording && ac.state === "running") {
      const sum = liveSpectrum(row);
      quietFrames = sum > 0.5 ? 0 : quietFrames + 1;
      used = quietFrames < 90;          // no signal for a while: fall back to the score
    }
    if (!used) scoreSpectrum(t, row);
  } else {
    row.fill(0);
  }
  for (let i = 0; i < BINS; i++) smooth[i] += (row[i] - smooth[i]) * (row[i] > smooth[i] ? 0.6 : 0.25);

  rowAcc += dt * ROW_RATE;
  while (rowAcc >= 1) { pushRow(); rowAcc -= 1; }
  histTex.needsUpdate = true;

  amp += ((playing ? 1 : 0.0) - amp) * Math.min(1, dt * 1.5);
  drift += dt * (0.05 + amp * 0.12);
  // Sub-row offset keeps the sound gliding back smoothly between rows.
  uniforms.uHead.value = head - 1 + rowAcc;
  uniforms.uAmp.value = amp;
  uniforms.uDrift.value = drift;
  uniforms.uTime.value = now / 1000;

  const s = Math.max(0, Math.floor(t));
  clockEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
