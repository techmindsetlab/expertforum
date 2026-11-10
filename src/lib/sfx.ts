/**
 * Booth sound effects for the kiosk and the wall (files in src/assets/sounds),
 * played through Web Audio: decoded once, started instantly, faded out.
 * Browsers keep audio locked until the first tap / click / key press, so call
 * unlockSfx() from a gesture. The wall TV can skip that by launching Chrome
 * with --autoplay-policy=no-user-gesture-required.
 */
const FILES = {
  /** Kiosk: last 10 s of the drawing time — ten ticks, final hit at 10.0 s. */
  countdown: new URL("../assets/sounds/Mountain Audio - Countdown 1.mp3", import.meta.url).href,
  /** Kiosk: artwork sent to the wall. */
  points: new URL("../assets/sounds/Points Achieved.mp3", import.meta.url).href,
  /** Wall: stroke replay of a new artwork (continuous scribble, 3.4 s). */
  sketch: new URL("../assets/sounds/Sketching 1.wav", import.meta.url).href,
  /** Kiosk: pen on the canvas (continuous scribble, 1.4 s). */
  pen: new URL("../assets/sounds/Sketching 4.wav", import.meta.url).href,
  /** Kiosk: while the AI paints — a printer's flatbed scan, two passes per
   *  13.6 s loop (synthesised by scripts/scanner-sfx.mjs). */
  scan: new URL("../assets/sounds/Printer Scan.wav", import.meta.url).href,
  /** Wall: a new artwork arrives. */
  success: new URL("../assets/sounds/Success.wav", import.meta.url).href,
};

export type SfxName = keyof typeof FILES;
export type SfxHandle = { stop: (fade?: number) => void };
type PlayOptions = { volume?: number; offset?: number; fadeIn?: number; loop?: boolean; loopStart?: number; loopEnd?: number };

let ctx: AudioContext | null = null;
const buffers = new Map<SfxName, Promise<AudioBuffer | null>>();

function context() {
  if (!ctx && typeof window !== "undefined") {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function load(name: SfxName) {
  let p = buffers.get(name);
  if (!p) {
    p = fetch(FILES[name])
      .then((r) => r.arrayBuffer())
      .then((b) => context()!.decodeAudioData(b))
      .catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

/** From a user gesture: resume audio and start decoding the given sounds. */
export function unlockSfx(names: SfxName[]) {
  const c = context();
  if (!c) return;
  if (c.state !== "running") void c.resume().catch(() => {});
  for (const n of names) void load(n);
}

/** Calls back with true / false whenever audio becomes playable or locked. */
export function watchSfx(cb: (running: boolean) => void) {
  const c = context();
  if (!c) return () => {};
  const fire = () => cb(c.state === "running");
  c.addEventListener("statechange", fire);
  fire();
  return () => c.removeEventListener("statechange", fire);
}

/**
 * Kiosk: one bell strike when 30 s of drawing time are left. Synthesised with
 * Web Audio (inharmonic sine partials, each with its own decay), so there is
 * no file to load. Does nothing while audio is still locked.
 */
export function playBell(volume = 0.7) {
  const c = context();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.01;
  const out = c.createGain();
  out.gain.value = volume;
  out.connect(c.destination);
  const base = 1046.5; // C6
  const partials: [ratio: number, amp: number, decay: number][] = [
    [1, 1, 2.8],
    [2, 0.55, 1.9],
    [2.76, 0.4, 1.4],
    [5.4, 0.22, 0.8],
    [8.93, 0.1, 0.45],
  ];
  for (const [ratio, amp, decay] of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * 0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

/** Plays a sound; silently does nothing while audio is still locked. */
export function playSfx(name: SfxName, o: PlayOptions = {}): SfxHandle {
  const c = context();
  const volume = o.volume ?? 1;
  let stopped = false;
  let node: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  if (c && c.state === "running") {
    void load(name).then((buf) => {
      if (!buf || stopped) return;
      const gain = c.createGain();
      const src = c.createBufferSource();
      const t = c.currentTime;
      gain.gain.setValueAtTime(o.fadeIn ? 0 : volume, t);
      if (o.fadeIn) gain.gain.linearRampToValueAtTime(volume, t + o.fadeIn);
      src.buffer = buf;
      if (o.loop) {
        src.loop = true;
        src.loopStart = o.loopStart ?? 0;
        src.loopEnd = Math.min(o.loopEnd ?? buf.duration, buf.duration);
      }
      src.connect(gain).connect(c.destination);
      const offset = o.offset ?? 0;
      src.start(t, o.loop ? offset % src.loopEnd || 0 : Math.min(offset, buf.duration));
      node = { src, gain };
    });
  }
  return {
    stop(fade = 0.15) {
      stopped = true;
      if (!node || !c) return;
      const t = c.currentTime;
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(node.gain.gain.value, t);
      node.gain.gain.linearRampToValueAtTime(0, t + fade);
      try {
        node.src.stop(t + fade + 0.02);
      } catch {}
      node = null;
    },
  };
}
