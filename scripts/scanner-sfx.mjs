// Synthesises the kiosk's "AI is painting" sound: a multifunction printer's
// flatbed scan, as a loopable mono WAV (no third-party recording, no licence).
//
//   node scripts/scanner-sfx.mjs "src/assets/sounds/Printer Scan.wav"
//
// One loop = two scans. Each: lid/lamp clack, two short calibration whirrs,
// the slow scan pass (stepper-motor whine with chassis resonances, rail
// friction, a buffer pause), a stop clack, the fast carriage return and the
// clunk at home. A quiet fan runs underneath so the loop never drops to silence.

import { writeFileSync } from "node:fs";

const SR = 24000;
const LENGTH = 13.6; // seconds per loop
const N = Math.round(SR * LENGTH);
const file = process.argv[2] ?? "Printer Scan.mp3";

// Deterministic noise, so every render is the same file.
let seed = 20261111;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

function biquad(type, fc, q) {
  const w = (2 * Math.PI * fc) / SR;
  const a = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  let b0, b1, b2;
  if (type === "bp") [b0, b1, b2] = [a, 0, -a];
  else [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2]; // lowpass
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// ─── Score ──────────────────────────────────────────────────────────
// Motor moves: start, end (s), stepper pitch F (Hz), loudness, ramp up/down, rail noise.
const moves = [];
const clacks = []; // [time, size]
const move = (t0, t1, F, amp, ru, rd, rail = 1) => moves.push({ t0, t1, F, amp, ru, rd, rail });

function scan(at, { calibrate, pause, F }) {
  let t = at;
  clacks.push([t + 0.1, 0.55]);
  if (calibrate) {
    move(t + 0.2, t + 0.38, 700, 0.55, 0.05, 0.05);
    move(t + 0.5, t + 0.68, 700, 0.55, 0.05, 0.05);
    t += 0.85;
  }
  clacks.push([t + 0.1, 0.45]);
  if (pause) {
    move(t + 0.2, t + 2.45, F, 0.8, 0.3, 0.1);
    clacks.push([t + 2.47, 0.25]); // buffer full: the head halts for a beat
    move(t + 2.7, t + 4.75, F, 0.8, 0.15, 0.12);
    t += 4.75;
  } else {
    move(t + 0.2, t + 4.2, F, 0.8, 0.3, 0.12);
    t += 4.2;
  }
  clacks.push([t + 0.05, 0.6]);
  move(t + 0.35, t + 1.25, F * 2.4, 1, 0.2, 0.18, 1.4); // carriage returns, fast
  clacks.push([t + 1.28, 1]); // home
  return t + 1.28;
}

scan(0, { calibrate: true, pause: true, F: 440 });
scan(7.0, { calibrate: false, pause: false, F: 430 });

// ─── Render ─────────────────────────────────────────────────────────
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const peak = (f, centre, width) => Math.exp(-((Math.log2(f / centre) / width) ** 2) / 2);
// Plastic chassis + glass: the whine rings around 1.1 k, 2.5 k and 4.3 kHz.
const resonance = (f) => 0.35 + 2.2 * peak(f, 1150, 0.18) + 1.5 * peak(f, 2500, 0.2) + 0.8 * peak(f, 4300, 0.25);

const tone = new Float32Array(N);
const rail = new Float32Array(N);
const railBp = biquad("bp", 3200, 0.7);
const rumbleLp = biquad("lp", 180, 0.7);
const jitterLp = biquad("lp", 8, 0.7);
let phase = 0;

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const m = moves.find((v) => t >= v.t0 && t < v.t1);
  const jitter = jitterLp(noise());
  const railNoise = railBp(noise());
  const rumble = rumbleLp(noise());
  if (!m) {
    phase = 0;
    continue;
  }
  const u = t - m.t0;
  const left = m.t1 - t;
  let fMul = 1;
  let a = m.amp;
  if (u < m.ru) {
    fMul = 0.3 + 0.7 * smooth(u / m.ru); // the stepper accelerates
    a *= smooth(u / (m.ru * 0.7));
  }
  if (left < m.rd) {
    fMul *= 0.4 + 0.6 * (left / m.rd);
    a *= (left / m.rd) ** 1.5;
  }
  const f = m.F * fMul * (1 + 0.0035 * Math.sin(2 * Math.PI * 5.7 * t) + 0.08 * jitter);
  phase += (2 * Math.PI * f) / SR;
  let sum = 0;
  let norm = 0;
  for (let k = 1; k * f < 9000; k++) {
    const ak = k ** -0.85 * resonance(k * f);
    sum += ak * Math.sin(k * phase);
    norm += ak * ak;
  }
  // Gear mesh: a sub-harmonic roughness and a slow flutter.
  const gear = 1 + 0.18 * Math.sin(phase / 7) + 0.06 * Math.sin(2 * Math.PI * 13 * t);
  tone[i] = (sum / Math.sqrt(norm || 1)) * gear * a;
  rail[i] = (railNoise * 1.6 * m.rail + rumble * 6) * a;
}

// Clacks: a filtered noise snap, a bounce 18 ms later and a low thump.
const hits = new Float32Array(N);
for (const [at, size] of clacks) {
  const snap = biquad("bp", 1700, 1.5);
  const bounce = biquad("bp", 2300, 2);
  const start = Math.round(at * SR);
  for (let j = 0; j < SR * 0.25 && start + j < N; j++) {
    const u = j / SR;
    const s1 = snap(noise()) * Math.exp(-u / 0.012);
    const s2 = u > 0.018 ? bounce(noise()) * 0.45 * Math.exp(-(u - 0.018) / 0.008) : 0;
    const thump = Math.sin(2 * Math.PI * 95 * u) * Math.exp(-u / 0.05) * 0.5;
    hits[start + j] += (s1 * 2.4 + s2 * 2.4 + thump) * size;
  }
}

// Fan underneath, then mix, soft-limit and normalise.
const fanLp = biquad("lp", 600, 0.7);
const mix = new Float32Array(N);
let max = 0;
for (let i = 0; i < N; i++) {
  const fan = fanLp(noise()) * 0.05;
  const x = Math.tanh(tone[i] * 0.55 + rail[i] * 0.35 + hits[i] * 0.8 + fan);
  mix[i] = x;
  max = Math.max(max, Math.abs(x));
}

// 16-bit PCM WAV.
const gain = 0.85 / max;
const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767), 44 + i * 2);
writeFileSync(file, buf);

// Loudness outline (RMS per 0.4 s) to check the score by eye.
const bars = [];
for (let s = 0; s < N; s += SR * 0.4) {
  let e = 0;
  const n = Math.min(SR * 0.4, N - s);
  for (let j = 0; j < n; j++) e += (mix[s + j] * gain) ** 2;
  bars.push(Math.round(Math.sqrt(e / n) * 40));
}
console.log(`${file}: ${LENGTH}s, ${(buf.length / 1024).toFixed(0)} KB`);
console.log(bars.map((b) => "▁▂▃▄▅▆▇█"[Math.min(7, b)]).join(""));
