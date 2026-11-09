"use client";

import gsap from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { playSfx, unlockSfx, watchSfx, type SfxHandle, type SfxName } from "@/lib/sfx";
import { renderReplay, type Drawing } from "@/lib/strokes";
import { Ornament } from "@/components/Ornament";
import { EVENT } from "@/lib/config";
import s from "./wall.module.css";

gsap.ticker.lagSmoothing(0);

const POLL_MS = 3000;
const RECONCILE_MS = 30_000;
const SPOTLIGHT_IDLE_MS = 45_000;
const ROW_SPEEDS = [26, -20, 32]; // vh-relative px/s, alternating direction
const WALL_SFX: SfxName[] = ["success", "sketch"];

const fmt = (n: number) => `#${String(n).padStart(3, "0")}`;
const tilt = (n: number) => `${((n * 47) % 9) / 3 - 1.5}deg`;

type Hero = { item: PublicArtwork; kind: "new" | "spotlight"; rush?: boolean };

/**
 * Hero timings (seconds). A freshly submitted artwork stays up for a full
 * minute with a slow build to the final art; idle spotlights stay brief.
 * `rush`: another new artwork is already waiting, so the final hold is cut.
 */
const HERO_TIMING = {
  new: { rise: 3, infoAt: 1.2, info: 1.6, replayAt: 2.6, replay: 16, replayEase: "none", halftoneAt: 19, halftone: 8, sigAt: 26, sig: 3.5, total: 60, exit: 2, rushHold: 8 },
  spotlight: { rise: 1.3, infoAt: 0.5, info: 1, replayAt: 0.9, replay: 2.8, replayEase: "power1.inOut", halftoneAt: 3.7, halftone: 1.7, sigAt: 5.1, sig: 1.1, total: 11.3, exit: 0.9, rushHold: 4.2 },
} as const;

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

export default function WallApp() {
  const [items, setItems] = useState<PublicArtwork[]>([]);
  const [total, setTotal] = useState(0);
  const [shownTotal, setShownTotal] = useState(0);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [hero, setHero] = useState<Hero | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [burst, setBurst] = useState(0);

  const maxNumber = useRef(0);
  const queue = useRef<Hero[]>([]);
  const heroBusy = useRef(false);
  const lastHeroAt = useRef(0);
  const itemsRef = useRef<PublicArtwork[]>([]);
  const speed = useRef(1);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    lastHeroAt.current = Date.now();
  }, []);

  // ─── Sound: locked until a click / key press unless Chrome runs with
  // --autoplay-policy=no-user-gesture-required (the wall TV) ──────────
  useEffect(() => {
    unlockSfx(WALL_SFX);
    const stop = watchSfx(setSoundOn);
    const unlock = () => unlockSfx(WALL_SFX);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      stop();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ─── Data: initial load, polling, reconcile ──────────────────────
  const load = useCallback(async () => {
    const res = await fetch("/api/wall?limit=180", { cache: "no-store" });
    // A failed response (e.g. a database hiccup) must not reach the state
    // updater below — throwing there would crash the whole wall.
    if (!res.ok) throw new Error(`wall ${res.status}`);
    const data = (await res.json()) as { items?: PublicArtwork[]; total?: number; hidden?: number[] };
    const items = data.items ?? [];
    const hidden = new Set(data.hidden ?? []);
    setItems((prev) => {
      const map = new Map(prev.map((p) => [p.number, p]));
      for (const it of items) map.set(it.number, it);
      return [...map.values()].filter((p) => !hidden.has(p.number)).sort((a, b) => a.number - b.number);
    });
    setTotal(data.total ?? 0);
    for (const it of items) maxNumber.current = Math.max(maxNumber.current, it.number);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, then poll
    load().catch(() => {});
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/wall?after=${maxNumber.current}`, { cache: "no-store" });
        const data = (await res.json()) as { items: PublicArtwork[] };
        if (!data.items?.length) return;
        for (const it of data.items) {
          maxNumber.current = Math.max(maxNumber.current, it.number);
          queue.current.push({ item: it, kind: "new" });
        }
        setTotal((t) => t + data.items.length);
      } catch {
        // offline: keep animating what we have
      }
    }, POLL_MS);
    const reconcile = setInterval(() => load().catch(() => {}), RECONCILE_MS);
    return () => {
      clearInterval(poll);
      clearInterval(reconcile);
    };
  }, [load]);

  // Counter rolls up whenever the total changes.
  useEffect(() => {
    const o = { v: shownTotal };
    const tw = gsap.to(o, { v: total, duration: 1.4, ease: "expo.out", onUpdate: () => setShownTotal(Math.round(o.v)) });
    return () => void tw.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ─── Hero queue: new artworks first, idle spotlight otherwise ────
  useEffect(() => {
    const id = setInterval(() => {
      if (heroBusy.current) return;
      let next = queue.current.shift();
      if (!next && Date.now() - lastHeroAt.current > SPOTLIGHT_IDLE_MS && itemsRef.current.length >= 4) {
        const pool = itemsRef.current;
        next = { item: pool[Math.floor(Math.random() * pool.length)], kind: "spotlight" };
      }
      if (!next) return;
      next = { ...next, rush: queue.current.length > 0 };
      heroBusy.current = true;
      preload(next.item.art).then(() => {
        // A new artwork sends a wave through the ornament as its card rises.
        if (next!.kind === "new") setBurst((b) => b + 1);
        setHero(next!);
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const finishHero = useCallback((h: Hero) => {
    if (h.kind === "new") {
      setItems((prev) => (prev.some((p) => p.number === h.item.number) ? prev : [...prev, h.item]));
      setFresh((f) => new Set(f).add(h.item.number));
      setTimeout(() => setFresh((f) => {
        const n = new Set(f);
        n.delete(h.item.number);
        return n;
      }), 20_000);
    }
    lastHeroAt.current = Date.now();
    heroBusy.current = false;
    setHero(null);
  }, []);

  // ─── Rows ─────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const r: PublicArtwork[][] = [[], [], []];
    // Newest first so fresh work enters the visible part of the loop soonest.
    [...items].reverse().forEach((it, i) => r[i % 3].push(it));
    return r;
  }, [items]);

  const empty = items.length === 0 && !hero;

  return (
    <div className={s.root}>
      <Ornament preset="wall" className={s.canvas} burst={burst} />
      <div className={s.vignette} />

      <header className={s.header}>
        <div className={s.brand}>
          <div className={s.lockup}>
            <img className={s.logoAg} src="/brand/astragraphia-wordmark-white.svg" alt="Astragraphia" />
            <i />
            <img className={s.logo70} src="/brand/astra70-logo-white.png" alt="70 Tahun Astra" />
            <i />
            <img className={s.logoAgit} src="/brand/agit-logo-white.png" alt="agit" />
          </div>
          {!empty && (
            <>
              <div className={s.headline}>
                print <em>your</em> mark
              </div>
              <div className={s.cta}>
                <b>Gambar di tablet, tampil di sini</b> · Draw on the tablet, see it here →
              </div>
            </>
          )}
        </div>
        <div className={s.counter}>
          <div className={s.count}>{shownTotal}</div>
          <div className={s.countLabel}>karya · artworks</div>
        </div>
      </header>

      {empty ? (
        <div className={s.empty}>
          <h2>
            print
            <em>your</em>
            mark
          </h2>
          <p>Mulai gambar di tablet — karyamu tampil di sini. · Start drawing on the tablet.</p>
        </div>
      ) : (
        <div className={s.rows}>
          {rows.map((row, i) => (
            <MarqueeRow key={i} items={row} speed={ROW_SPEEDS[i]} speedRef={speed} fresh={fresh} />
          ))}
        </div>
      )}

      {hero && <HeroMoment hero={hero} speedRef={speed} onDone={finishHero} />}

      {!soundOn && (
        <button className={s.soundPill} onClick={() => unlockSfx(WALL_SFX)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M17 9l4 6M21 9l-4 6" />
          </svg>
          Klik untuk menyalakan suara · Click to enable sound
        </button>
      )}
    </div>
  );
}

function MarqueeRow({
  items,
  speed,
  speedRef,
  fresh,
}: {
  items: PublicArtwork[];
  speed: number;
  speedRef: React.RefObject<number>;
  fresh: Set<number>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const x = useRef(0);

  // Repeat the row until one half is wider than the screen → seamless loop.
  const base = useMemo(() => {
    if (!items.length) return [];
    const minCount = 12;
    const out: PublicArtwork[] = [];
    while (out.length < Math.max(minCount, items.length)) out.push(...items);
    return out;
  }, [items]);

  useEffect(() => {
    const tick = (_t: number, dt: number) => {
      const half = halfRef.current?.offsetWidth ?? 0;
      if (!half || !trackRef.current) return;
      const pxPerVh = window.innerHeight / 100;
      x.current -= ((speed * pxPerVh) / 10) * (dt / 1000) * (speedRef.current ?? 1);
      if (x.current <= -half) x.current += half;
      if (x.current > 0) x.current -= half;
      trackRef.current.style.transform = `translate3d(${x.current}px,0,0)`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [speed, speedRef]);

  if (!base.length) return <div className={s.row} />;
  const half = (key: string, ref?: React.Ref<HTMLDivElement>) => (
    <div className={s.half} ref={ref} key={key}>
      {base.map((it, i) => (
        <figure key={`${key}-${it.number}-${i}`} className={`${s.card} ${fresh.has(it.number) ? s.fresh : ""}`} style={{ ["--r" as string]: tilt(it.number + i) }}>
          <img src={it.thumb || it.art} alt={it.name} loading="lazy" decoding="async" />
          <figcaption className={s.caption}>
            <b>{fmt(it.number)}</b>
            <span className="signature">{it.name}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
  return (
    <div className={s.row}>
      <div className={s.track} ref={trackRef}>
        {half("a", halfRef)}
        {half("b")}
      </div>
    </div>
  );
}

/**
 * New artwork moment: card rises → the visitor's strokes replay on paper →
 * the AI print dissolves in through a halftone screen → signature writes on
 * → number lands → card flies back into the wall. Pacing per HERO_TIMING.
 * New artworks only: a success chime as the card rises, sketching sound
 * while the strokes replay.
 */
function HeroMoment({ hero, speedRef, onDone }: { hero: Hero; speedRef: React.RefObject<number>; onDone: (h: Hero) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bloom, setBloom] = useState(0);
  const { item, kind } = hero;

  useEffect(() => {
    let cancelled = false;
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    const q = gsap.utils.selector(root);
    const replay = { p: 0 };
    let drawing: Drawing | null = null;
    const tl = gsap.timeline({ paused: true, onComplete: () => !cancelled && onDone(hero) });
    const T = HERO_TIMING[kind];
    const finalAt = T.sigAt + T.sig;
    const hold = hero.rush ? T.rushHold : Math.max(T.rushHold, T.total - T.exit - finalAt);

    tl.set(root, { visibility: "visible" })
      .call(() => setBloom((b) => b + 1), [], 0.1) // ornament frame blooms out from the card
      .to(speedRef, { current: 0.12, duration: T.rise, ease: "power2.out" }, 0)
      .fromTo(q("[data-backdrop]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: T.rise * 0.6, ease: "power2.out" }, 0)
      .fromTo(q("[data-card]"), { y: "70vh", rotate: -9, scale: 0.72 }, { y: 0, rotate: -2, scale: 1, duration: T.rise, ease: "expo.out" }, 0.15)
      .fromTo(q("[data-info] > *"), { x: 60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: T.info, stagger: T.info * 0.15, ease: "expo.out" }, T.infoAt)
      .to(replay, {
        p: 1,
        duration: T.replay,
        ease: T.replayEase, // linear for new work: strokes start drawing as soon as the card lands
        onUpdate: () => drawing && renderReplay(ctx, drawing, size, replay.p),
      }, T.replayAt)
      .fromTo(q("[data-halftone]"), { "--dot": "0px" }, { "--dot": "17px", duration: T.halftone, ease: "power2.inOut" }, T.halftoneAt)
      // Clip reaches past the box so signature tails (g, y, p…) are not cut.
      .fromTo(q("[data-sig]"), { clipPath: "inset(-50% 100% -50% -10%)" }, { clipPath: "inset(-50% -10% -50% -10%)", duration: T.sig, ease: "power2.inOut" }, T.sigAt)
      .to({}, { duration: hold }, finalAt)
      .to(q("[data-card]"), { y: "-12vh", scale: 0.28, rotate: 6, autoAlpha: 0, duration: T.exit, ease: "power3.in" })
      .to(q("[data-info]"), { autoAlpha: 0, duration: T.exit * 0.55 }, "<")
      .to(q("[data-backdrop]"), { autoAlpha: 0, duration: T.exit * 0.8 }, "<0.3")
      .to(speedRef, { current: 1, duration: T.exit * 1.6, ease: "power2.inOut" }, "<");

    let sketching: SfxHandle | null = null;
    if (kind === "new") {
      tl.call(() => void playSfx("success", { volume: 0.9 }), [], 0.15)
        .call(() => {
          if (drawing) sketching = playSfx("sketch", { loop: true, loopEnd: 3.2, volume: 0.55, fadeIn: 0.4 });
        }, [], T.replayAt)
        .call(() => sketching?.stop(0.8), [], T.replayAt + T.replay);
    }

    // Never let a slow strokes request stall the hero queue.
    const withTimeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    withTimeout(fetch(`/api/art/${item.id}/strokes`).then((r) => (r.ok ? r.json() : null)))
      .then((d: Drawing | null) => {
        drawing = d?.strokes?.length ? d : null;
        if (!drawing && item.sketch) {
          // Fallback (no strokes or request failed): show the sketch image instead of the replay.
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, size, size);
          img.src = item.sketch;
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && tl.play());

    return () => {
      cancelled = true;
      tl.kill();
      sketching?.stop(0.3);
      speedRef.current = 1;
    };
  }, [hero, item, kind, onDone, speedRef]);

  return (
    <div ref={rootRef} className={s.hero}>
      <div className={s.heroBackdrop} data-backdrop />
      <div className={s.heroOrnament} data-backdrop>
        <Ornament preset="hero" className={s.canvas} burst={bloom} />
      </div>
      <div className={s.heroCard} data-card>
        <div className={s.heroArt}>
          <canvas ref={canvasRef} />
          <div className={`${s.heroImg} halftone`} data-halftone style={{ ["--cell" as string]: "22px" }}>
            <img src={item.art} alt={item.name} />
            <span className={`${s.heroSig} signature`} data-sig>
              {item.name}
            </span>
          </div>
        </div>
        <div className={s.heroCaption}>
          <b>{fmt(item.number)}</b>
          <span>print your mark · {EVENT.short}</span>
        </div>
      </div>
      <div className={s.heroInfo} data-info>
        <div className={s.heroLabel}>{kind === "new" ? "Karya baru · New artwork" : "Dari dinding · From the wall"}</div>
        <div className={s.heroNumber}>{fmt(item.number)}</div>
        <div className={s.heroName}>{item.name}</div>
        <div className={s.heroHint}>
          Sketsa tangan, dilukis ulang oleh AI.
          <br />A hand sketch, reimagined by AI.
        </div>
      </div>
    </div>
  );
}
