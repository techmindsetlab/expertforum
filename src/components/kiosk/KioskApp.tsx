"use client";

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_ATTEMPTS, NAME_MAX } from "@/lib/config";
import { EMAIL_RE, isNameAllowed, maskEmail } from "@/lib/names";
import { playSfx, unlockSfx, type SfxHandle, type SfxName } from "@/lib/sfx";
import { BRUSHES, compactDrawing, PALETTE, type Stroke } from "@/lib/strokes";
import { DEFAULT_STYLE, STYLE_IDS, STYLE_THUMBS, type StyleId } from "@/lib/styles";
import { DrawCanvas, exportDrawing } from "./DrawCanvas";
import { DICT, type Locale } from "./i18n";
import { Keyboard } from "./Keyboard";
import { Ornament } from "@/components/Ornament";
import s from "./kiosk.module.css";

gsap.registerPlugin(SplitText);
// On a slow 2016 tablet a dropped frame must not stretch a transition:
// finish on wall-clock time instead of GSAP's default lag smoothing.
gsap.ticker.lagSmoothing(0);

type Step = "attract" | "data" | "draw" | "style" | "generating" | "review" | "success";
type Gen = { id: string; status: "ok" | "fallback"; image: string; attemptsLeft: number };
type ApiError = Error & { status?: number; code?: string };

const IDLE_MS = 60_000;
const IDLE_COUNTDOWN = 10;
const SUCCESS_RESET_S = 20;
const DRAW_LIMIT_MS = 180_000; // 3 minutes per drawing; submitting stays possible afterwards
const COUNTDOWN_SFX_S = 10; // countdown sound: ten ticks, final hit at 10.0 s
const KIOSK_SFX: SfxName[] = ["pen", "countdown", "marker", "points"];

const fmt = (n: number) => `#${String(n).padStart(3, "0")}`;
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function readStored(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

export default function KioskApp() {
  const [locale, setLocale] = useState<Locale>("id");
  const t = DICT[locale];
  const [step, setStep] = useState<Step>("attract");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [field, setField] = useState<"name" | "email">("name");
  const [touched, setTouched] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [brush, setBrush] = useState(1);
  const [idea, setIdea] = useState(0);
  /** Drawing deadline (epoch ms) and the time left, ticking while on the draw step. */
  const [deadline, setDeadline] = useState<number | null>(null);
  const [left, setLeft] = useState(DRAW_LIMIT_MS);
  const penSfx = useRef<SfxHandle | null>(null);

  const [sketch, setSketch] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleId>(DEFAULT_STYLE);
  const [gen, setGen] = useState<Gen | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [number, setNumber] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const [idle, setIdle] = useState<number | null>(null);
  const [wall, setWall] = useState<{ total: number; thumbs: string[] }>({ total: 0, thumbs: [] });

  const artworkRef = useRef<string | null>(null);
  const dirtyRef = useRef(true);
  /** Drawing waiting for a style pick (null when re-generating the same sketch). */
  const pendingRef = useRef<{ png: string; drawing: ReturnType<typeof compactDrawing>; redraw: boolean } | null>(null);
  const styleBackRef = useRef<Step>("draw");
  const busy = useRef(false);
  const keyRef = useRef("");
  const kioskRef = useRef("");

  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sheetA = useRef<HTMLDivElement>(null);
  const sheetB = useRef<HTMLDivElement>(null);

  // ─── Tablet registration (?key=…&kiosk=…) ────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    try {
      if (p.get("key")) localStorage.setItem("ag_kiosk_key", p.get("key")!);
      if (p.get("kiosk")) localStorage.setItem("ag_kiosk_id", p.get("kiosk")!);
    } catch {}
    keyRef.current = p.get("key") || readStored("ag_kiosk_key");
    kioskRef.current = p.get("kiosk") || readStored("ag_kiosk_id") || "1";
  }, []);

  const api = useCallback(async (path: string, body?: unknown, timeout = 110_000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-kiosk-key": keyRef.current },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, code: data.code }) as ApiError;
      return data;
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // ─── Paper-feed transition between steps ─────────────────────────
  useLayoutEffect(() => {
    gsap.set([sheetA.current, sheetB.current], { yPercent: 105, y: 0 });
  }, []);

  const go = useCallback((next: Step) => {
    if (busy.current) return Promise.resolve();
    busy.current = true;
    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
          resolve();
        },
      });
      tl.set([sheetA.current, sheetB.current], { yPercent: 105, y: 0 })
        .to(sheetA.current, { yPercent: 0, duration: 0.42, ease: "power3.in" })
        .to(sheetB.current, { yPercent: 0, duration: 0.42, ease: "power3.in" }, 0.07)
        .add(() => setStep(next))
        .to(sheetB.current, { yPercent: -105, duration: 0.6, ease: "power3.out" }, "+=0.08")
        .to(sheetA.current, { yPercent: -105, duration: 0.6, ease: "power3.out" }, "<0.06");
    });
  }, []);

  const reset = useCallback(() => {
    setIdle(null);
    setError(null);
    go("attract").then(() => {
      setName("");
      setEmail("");
      setOptIn(false);
      setField("name");
      setTouched(false);
      setStrokes([]);
      setColor(PALETTE[0]);
      setBrush(1);
      setIdea(0);
      setDeadline(null);
      setLeft(DRAW_LIMIT_MS);
      setSketch(null);
      setStyle(DEFAULT_STYLE);
      pendingRef.current = null;
      setGen(null);
      setAttemptsLeft(MAX_ATTEMPTS);
      setNumber(null);
      setNotice(null);
      artworkRef.current = null;
      dirtyRef.current = true;
    });
  }, [go]);

  // Entrance animation for every step.
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll("[data-anim]"),
        { y: 34, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.055, delay: 0.18 },
      );
    }, el);
    return () => ctx.revert();
  }, [step]);

  // ─── Attract: kinetic lockup + live wall strip ───────────────────
  useLayoutEffect(() => {
    if (step !== "attract") return;
    const ctx = gsap.context(() => {
      const split = new SplitText("[data-split]", { type: "chars" });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 5 });
      tl.fromTo(split.chars, { yPercent: 115 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.045 })
        // Clip reaches past the box: the "y" tail hangs below the tight line height.
        .fromTo("[data-hand]", { clipPath: "inset(-60% 100% -60% -10%)" }, { clipPath: "inset(-60% -10% -60% -10%)", duration: 1.1, ease: "power2.inOut" }, 0.45)
        .to(split.chars, { yPercent: -115, duration: 0.7, ease: "expo.in", stagger: 0.025 }, "+=6")
        .to("[data-hand]", { clipPath: "inset(-60% -10% -60% 100%)", duration: 0.6, ease: "power2.in" }, "<0.1");
    }, rootRef);
    return () => ctx.revert();
  }, [step, locale]);

  useEffect(() => {
    if (step !== "attract") return;
    fetch("/api/wall?limit=14")
      .then((r) => r.json())
      .then((d) => setWall({ total: d.total ?? 0, thumbs: (d.items ?? []).map((i: { thumb: string }) => i.thumb).filter(Boolean) }))
      .catch(() => {});
  }, [step]);

  // ─── Drawing time: 3 minutes, countdown sound over the last 10 s ──
  const startDrawing = useCallback(() => {
    setDeadline(Date.now() + DRAW_LIMIT_MS);
    setLeft(DRAW_LIMIT_MS);
    return go("draw");
  }, [go]);

  useEffect(() => {
    if (step !== "draw" || deadline == null) return;
    let ticks: SfxHandle | null = null;
    const id = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      setLeft(ms);
      if (!ticks && ms > 0 && ms <= COUNTDOWN_SFX_S * 1000) ticks = playSfx("countdown", { offset: COUNTDOWN_SFX_S - ms / 1000 });
      if (ms === 0) clearInterval(id);
    }, 250);
    return () => {
      clearInterval(id);
      ticks?.stop(0.2);
    };
  }, [step, deadline]);
  const timeUp = deadline != null && left <= 0;

  // Marker strokes while the AI paints; a chime when the art reaches the wall.
  useEffect(() => {
    if (step !== "generating") return;
    const marker = playSfx("marker", { loop: true, volume: 0.35, fadeIn: 0.8 });
    return () => marker.stop(0.8);
  }, [step]);

  useEffect(() => {
    if (step === "success") playSfx("points");
  }, [step]);

  // ─── Idle reset ─────────────────────────────────────────────────
  useEffect(() => {
    if (!["data", "draw", "review"].includes(step)) return;
    let timer = setTimeout(() => setIdle(IDLE_COUNTDOWN), IDLE_MS);
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(IDLE_COUNTDOWN), IDLE_MS);
    };
    window.addEventListener("pointerdown", bump);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
    };
  }, [step]);

  useEffect(() => {
    if (idle == null) return;
    if (idle <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown reached zero: reset the kiosk
      reset();
      return;
    }
    const id = setTimeout(() => setIdle((v) => (v == null ? v : v - 1)), 1000);
    return () => clearTimeout(id);
  }, [idle, reset]);

  // ─── Generation flow ────────────────────────────────────────────
  type GenCall = () => Promise<{ id: string; status: string; image?: string; attemptsLeft: number }>;
  const runGenerateRef = useRef<(call: GenCall) => Promise<void>>(async () => {});
  const runGenerate = useCallback(
    async (call: () => Promise<{ id: string; status: string; image?: string; attemptsLeft: number }>) => {
      try {
        const r = await call();
        dirtyRef.current = false;
        setAttemptsLeft(r.attemptsLeft);
        if (r.status === "blocked") {
          setNotice(t.blocked);
          await startDrawing();
          return;
        }
        await preload(r.image!);
        setGen(r as Gen);
        await go("review");
      } catch (e) {
        const err = e as ApiError;
        if (err.code === "no_attempts") {
          setAttemptsLeft(0);
          await go(gen ? "review" : "draw");
          return;
        }
        if (err.code === "kiosk_key") {
          setError({ message: t.kioskKey });
          return;
        }
        setError({
          message: t.error,
          retry: () => {
            setError(null);
            runGenerateRef.current(call);
          },
        });
      }
    },
    [go, gen, t, startDrawing],
  );

  useEffect(() => {
    runGenerateRef.current = runGenerate;
  }, [runGenerate]);

  // Drawing done → pick a style → generate.
  const submitDrawing = async () => {
    if (!strokes.length || busy.current) return;
    const png = exportDrawing(strokes);
    setSketch(png);
    setNotice(null);
    pendingRef.current = { png, drawing: compactDrawing({ v: 1, strokes }), redraw: dirtyRef.current };
    styleBackRef.current = "draw";
    await go("style");
  };

  // Same sketch, new AI attempt → pick a style again (may switch styles).
  const regenerate = async () => {
    if (!artworkRef.current || attemptsLeft <= 0) return;
    pendingRef.current = null;
    styleBackRef.current = "review";
    await go("style");
  };

  const pickStyle = async (next: StyleId) => {
    if (busy.current) return;
    setStyle(next);
    const pending = pendingRef.current;
    await go("generating");
    runGenerate(async () => {
      if (!artworkRef.current && pending) {
        const r = await api("/api/artworks", {
          name: name.trim(),
          email: email.trim(),
          marketingOptIn: optIn && email.trim().length > 0,
          locale,
          kioskId: kioskRef.current,
          sketch: pending.png,
          strokes: pending.drawing,
        });
        artworkRef.current = r.id;
        return api(`/api/artworks/${r.id}/generate`, { style: next });
      }
      const redraw = pending?.redraw ? { sketch: pending.png, strokes: pending.drawing } : {};
      return api(`/api/artworks/${artworkRef.current}/generate`, { ...redraw, style: next });
    });
  };

  const submitWall = async () => {
    if (!gen || !artworkRef.current) return;
    try {
      const r = await api(`/api/artworks/${artworkRef.current}/submit`, { generationId: gen.id }, 30_000);
      setNumber(r.number);
      await go("success");
    } catch {
      setError({ message: t.error, retry: () => (setError(null), submitWall()) });
    }
  };

  // ─── Review: halftone print reveal ──────────────────────────────
  useLayoutEffect(() => {
    if (step !== "review") return;
    const el = mainRef.current?.querySelector<HTMLElement>("[data-halftone]");
    if (!el) return;
    el.dataset.done = "false";
    const tw = gsap.fromTo(
      el,
      { "--dot": "0px" },
      { "--dot": "13.5px", duration: 1.8, ease: "power2.inOut", delay: 0.55, onComplete: () => void (el.dataset.done = "true") },
    );
    return () => void tw.kill();
  }, [step, gen?.id]);

  // ─── Success: number count-up + auto reset ──────────────────────
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (step !== "success" || number == null) return;
    const o = { v: Math.max(0, number - 40) };
    const tw = gsap.to(o, { v: number, duration: 1.6, ease: "expo.out", delay: 0.4, onUpdate: () => setShown(Math.round(o.v)) });
    const timer = setTimeout(reset, SUCCESS_RESET_S * 1000);
    return () => {
      tw.kill();
      clearTimeout(timer);
    };
  }, [step, number, reset]);

  // ─── Validation ─────────────────────────────────────────────────
  const nameOk = name.trim().length > 0 && isNameAllowed(name);
  // Email is optional: empty is fine, anything typed must be a valid address.
  const emailOk = email.trim() === "" || EMAIL_RE.test(email.trim());
  const nameErr = touched && name.trim().length > 0 && !isNameAllowed(name);
  const emailErr = touched && email.length > 3 && !emailOk && field !== "email";

  const step3 = { data: 1, draw: 2, style: 2, generating: 2, review: 3 } as Record<Step, number | undefined>;

  return (
    <div
      ref={rootRef}
      className={s.root}
      onPointerDown={() => {
        unlockSfx(KIOSK_SFX);
        if (idle != null) setIdle(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Expert Forum ornament: frozen while drawing (the pen needs the tablet's CPU), quicker waves while the AI paints. */}
      <Ornament preset="kiosk" className={s.shapes} paused={step === "draw"} tempo={step === "generating" ? 2.4 : 1} />
      <div className={s.grain} />

      <div className={s.frame}>
        <header className={s.header}>
          <div className={s.lockup}>
            <img className={s.logoAg} src="/brand/astragraphia-wordmark-white.svg" alt="Astragraphia" />
            <i />
            <img className={s.logo70} src="/brand/astra70-logo-white.png" alt="70 Tahun Astra" />
            <i />
            <img className={s.logoAgit} src="/brand/agit-logo-white.png" alt="agit" />
          </div>
          <div className={s.lang} role="group" aria-label="Language">
            {(["id", "en"] as const).map((l) => (
              <button key={l} aria-pressed={locale === l} onClick={() => setLocale(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <main ref={mainRef} className={s.main} key={step}>
          {step3[step] && step !== "generating" && (
            <div className={s.stepLabel} data-anim>
              {t.step(step3[step]!)}
            </div>
          )}

          {step === "attract" && (
            <div className={s.attract} onClick={() => go("data")}>
              <h1 className={s.mark} aria-label="print your mark">
                <span className={s.markLine}>
                  <span data-split>print</span>
                </span>
                <span className={s.markHand} data-hand>
                  your
                </span>
                <span className={s.markLine}>
                  <span data-split>mark</span>
                </span>
              </h1>
              <p className={s.attractSub} data-anim>
                {t.attractSub}
              </p>
              <button className={s.cta} data-anim>
                {t.tapToStart}
                <Arrow />
              </button>
              {wall.thumbs.length > 3 && (
                <div className={s.wallStrip} data-anim>
                  <div className={s.wallStripLabel}>{t.onWall(wall.total)}</div>
                  <div className={s.wallTrack}>
                    {[...wall.thumbs, ...wall.thumbs].map((src, i) => (
                      <img key={i} src={src} alt="" style={{ ["--r" as string]: `${((i * 37) % 7) - 3}deg` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "data" && (
            <>
              <h2 className={s.title} data-anim>
                {t.dataTitle}
              </h2>
              <p className={s.sub} data-anim>
                {t.dataSub}
              </p>
              <div className={s.fields}>
                <Field
                  label={t.nameLabel}
                  value={name}
                  placeholder={t.namePlaceholder}
                  active={field === "name"}
                  invalid={nameErr}
                  error={nameErr ? t.nameInvalid : undefined}
                  onClick={() => setField("name")}
                />
                <Field
                  label={t.emailLabel}
                  value={email}
                  placeholder={t.emailPlaceholder}
                  active={field === "email"}
                  invalid={emailErr}
                  error={emailErr ? t.emailInvalid : field === "email" ? t.emailHelp : undefined}
                  onClick={() => {
                    setTouched(true);
                    setField("email");
                  }}
                />
              </div>
              <div className={s.sigRow} data-anim>
                <div className={s.sigCard}>
                  <small>{t.signaturePreview}</small>
                  <span className="signature">{name.trim() || "…"}</span>
                </div>
                <button className={s.optIn} onClick={() => setOptIn((v) => !v)}>
                  <span className={s.check} data-on={optIn}>
                    {optIn && <Check size={14} />}
                  </span>
                  {t.optIn}
                </button>
              </div>
              <Keyboard
                mode={field}
                value={field === "name" ? name : email}
                maxLength={field === "name" ? NAME_MAX : 60}
                onChange={(v) => (field === "name" ? setName(v) : setEmail(v.toLowerCase()))}
                labels={{ clear: t.clear, space: t.space }}
              />
              <p className={s.consent} data-anim>
                {t.consent}
              </p>
              <div className={s.actions} data-anim>
                <button className={s.btnGhost} onClick={reset}>
                  ← {t.back}
                </button>
                <button
                  className={s.btnPrimary}
                  disabled={!nameOk || (field === "email" && !emailOk)}
                  onClick={() => {
                    setTouched(true);
                    if (!nameOk) return setField("name");
                    if (!emailOk) return setField("email");
                    startDrawing();
                  }}
                >
                  {t.next}
                  <Arrow />
                </button>
              </div>
            </>
          )}

          {step === "draw" && (
            <>
              <div className={s.timer} data-low={left <= COUNTDOWN_SFX_S * 1000 || undefined} role="timer" aria-label={t.timeLeft}>
                <ClockIcon />
                {clock(left)}
              </div>
              <h2 className={`${s.title} ${s.ideaTitle}`} data-anim>
                <span className={s.ideaLabel}>{t.idea}:</span> {t.ideas[idea]}
                <button className={s.shuffle} onClick={() => setIdea((i) => (i + 1) % t.ideas.length)} aria-label={t.otherIdea}>
                  <ShuffleIcon />
                </button>
              </h2>
              <p className={s.sub} data-anim>
                {t.drawSub}
              </p>
              {(timeUp || notice) && (
                <div className={s.notice} data-time-up={timeUp || undefined}>
                  {timeUp ? (strokes.length ? t.timeUp : t.timeUpEmpty) : notice}
                </div>
              )}
              <div className={s.board} data-anim>
                <DrawCanvas
                  strokes={strokes}
                  onChange={(next) => {
                    dirtyRef.current = true;
                    setNotice(null);
                    setStrokes(next);
                  }}
                  color={color}
                  size={BRUSHES[brush]}
                  placeholder={t.drawHere}
                  disabled={timeUp}
                  onStrokeStart={() => {
                    penSfx.current?.stop(0.04);
                    penSfx.current = playSfx("pen", { loop: true, loopEnd: 1.15, volume: 0.5, offset: Math.random() * 1.1, fadeIn: 0.03 });
                  }}
                  onStrokeEnd={() => {
                    penSfx.current?.stop(0.12);
                    penSfx.current = null;
                  }}
                />
              </div>
              <div className={s.toolbar} data-anim>
                <div className={s.colors}>
                  {PALETTE.map((c) => (
                    <button key={c} className={s.color} style={{ background: c }} aria-pressed={c === color} aria-label={c} onClick={() => setColor(c)} />
                  ))}
                </div>
                <div className={s.brushes}>
                  {BRUSHES.map((b, i) => (
                    <button key={b} className={s.brush} aria-pressed={i === brush} aria-label={`brush ${i + 1}`} onClick={() => setBrush(i)}>
                      <i style={{ width: `${0.45 + i * 0.45}rem`, height: `${0.45 + i * 0.45}rem` }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.actions} data-anim>
                <button className={s.btnGhost} onClick={() => go(gen ? "review" : "data")}>
                  ← {t.back}
                </button>
                <button className={s.btn} disabled={!strokes.length || timeUp} onClick={() => setStrokes((v) => v.slice(0, -1))} aria-label={t.undo}>
                  <UndoIcon />
                </button>
                <button className={s.btn} disabled={!strokes.length || timeUp} onClick={() => setStrokes([])}>
                  {t.clearCanvas}
                </button>
                {attemptsLeft > 0 && (strokes.length > 0 || !timeUp) ? (
                  <button className={s.btnPrimary} data-pulse={timeUp || undefined} disabled={!strokes.length} onClick={submitDrawing}>
                    {t.submitDrawing}
                    <Arrow />
                  </button>
                ) : (
                  <button className={s.btnPrimary} onClick={reset}>
                    {t.startOver}
                  </button>
                )}
              </div>
            </>
          )}

          {step === "style" && (
            <>
              <h2 className={s.title} data-anim>
                {t.styleTitle}
              </h2>
              <p className={s.sub} data-anim>
                {t.styleSub}
              </p>
              <div className={s.styles} data-anim>
                {STYLE_IDS.map((id) => (
                  <button key={id} className={s.styleCard} aria-pressed={id === style} onClick={() => pickStyle(id)}>
                    <img src={STYLE_THUMBS[id]} alt="" />
                    <span className={s.styleName}>{t.styles[id].name}</span>
                    <span className={s.styleDesc}>{t.styles[id].desc}</span>
                  </button>
                ))}
              </div>
              <div className={s.actions} data-anim>
                <button className={s.btnGhost} onClick={() => go(styleBackRef.current)}>
                  ← {t.back}
                </button>
              </div>
            </>
          )}

          {step === "generating" && <Generating t={t} sketch={sketch} />}

          {step === "review" && gen && (
            <>
              <h2 className={s.title} data-anim>
                {t.reviewTitle}
              </h2>
              <p className={s.sub} data-anim>
                {attemptsLeft > 0 ? t.reviewSub : t.reviewSubLast}
              </p>
              <div className={s.artCard} data-anim>
                {sketch && <img className={s.artSketch} src={sketch} alt="" />}
                <div className={`${s.artImg} halftone`} data-halftone style={{ ["--cell" as string]: "18px" }}>
                  <img className={s.artImg} src={gen.image} alt={t.reviewTitle} />
                  <span className={`${s.artSig} signature`}>{name.trim()}</span>
                </div>
              </div>
              <div className={s.attemptLine} data-anim>
                {t.attempt(attemptsLeft)}
              </div>
              {gen.status === "fallback" && (
                <div className={s.fallback} data-anim>
                  {t.fallbackNote}
                </div>
              )}
              <div className={s.actions} data-anim>
                {attemptsLeft > 0 && (
                  <>
                    <button className={s.btn} onClick={startDrawing}>
                      <UndoIcon /> {t.redraw}
                    </button>
                    <button className={s.btn} onClick={regenerate}>
                      <SparkIcon /> {t.regenerate}
                    </button>
                  </>
                )}
                <button className={`${s.btnPrimary} ${s.gold}`} onClick={submitWall}>
                  <Check size={20} /> {t.submitWall}
                </button>
              </div>
            </>
          )}

          {step === "success" && gen && number != null && (
            <div className={s.success}>
              <div className={s.okBadge} data-anim>
                <Check size={40} />
              </div>
              <h2 className={s.successTitle} data-anim>
                {t.successTitle}
              </h2>
              <div className={s.thumbCircle} data-anim>
                <img src={gen.image} alt="" />
              </div>
              <div className={s.findNumber} data-anim>
                {t.findNumber}
              </div>
              <div className={s.bigNumber} data-anim>
                {fmt(shown || number)}
              </div>
              <div className={s.successNotes} data-anim>
                {email.trim() && <span>{t.emailSent(maskEmail(email.trim()))}</span>}
                <span>{t.printNote}</span>
              </div>
              <button className={`${s.btnPrimary} ${s.doneBtn}`} style={{ marginLeft: 0, paddingRight: "4.4rem" }} onClick={reset} data-anim>
                {t.done}
                <svg className={s.ring} viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeDasharray="94.25"
                    strokeLinecap="round"
                    style={{ animation: `agRing ${SUCCESS_RESET_S}s linear forwards` }}
                  />
                </svg>
              </button>
              <style>{`@keyframes agRing{from{stroke-dashoffset:0}to{stroke-dashoffset:94.25}}`}</style>
            </div>
          )}
        </main>
      </div>

      <div ref={sheetA} className={`${s.sheet} ${s.sheetA}`} />
      <div ref={sheetB} className={`${s.sheet} ${s.sheetB}`}>
        <img src="/brand/astra70-logo-white.png" alt="" />
      </div>

      {idle != null && (
        <div className={s.overlay} onPointerDown={() => setIdle(null)}>
          <h2>{t.idleTitle}</h2>
          <p>{t.idleSub}</p>
          <div className={s.countdown}>{idle}</div>
        </div>
      )}

      {error && (
        <div className={s.overlay}>
          <h2>!</h2>
          <p>{error.message}</p>
          <div className={s.actions} style={{ marginTop: "2rem" }}>
            {error.retry && (
              <button className={s.btnPrimary} style={{ marginLeft: 0 }} onClick={error.retry}>
                {t.retry}
              </button>
            )}
            <button className={s.btn} onClick={reset}>
              {t.startOver}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  invalid?: boolean;
  error?: string;
  onClick: () => void;
}) {
  return (
    <button className={s.field} data-active={props.active} data-invalid={props.invalid} onClick={props.onClick} data-anim>
      <span className={s.fieldLabel}>
        {props.label}
        {props.error && <em>{props.error}</em>}
      </span>
      <span className={s.fieldValue} data-empty={!props.value && !props.active}>
        {props.value || (!props.active ? props.placeholder : "")}
        {props.active && <i className={s.caret} />}
      </span>
    </button>
  );
}

function Generating({ t, sketch }: { t: (typeof DICT)["id"]; sketch: string | null }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState(t.genStatus[0]);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, t.genStatus.length - 1)), 4500);
    const clock = setInterval(() => setSecs((v) => v + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(clock);
    };
  }, [t.genStatus.length]);

  // Text scramble (Locomotive-style) on each status change.
  useEffect(() => {
    const target = t.genStatus[i];
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=<>/";
    let frame = 0;
    const total = 18;
    const id = setInterval(() => {
      frame++;
      const p = frame / total;
      setText(
        target
          .split("")
          .map((c, k) => (c === " " || k / target.length < p ? c : glyphs[(Math.random() * glyphs.length) | 0]))
          .join(""),
      );
      if (frame >= total) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [i, t.genStatus]);

  return (
    <div className={s.gen}>
      <svg className={s.sparkle} viewBox="0 0 48 48" data-anim aria-hidden>
        <path d="M24 2c1.8 11.5 10.5 20.2 22 22-11.5 1.8-20.2 10.5-22 22-1.8-11.5-10.5-20.2-22-22C13.5 22.2 22.2 13.5 24 2z" fill="currentColor" />
      </svg>
      <div className={s.scanCard} data-anim>
        {sketch && <img src={sketch} alt="" />}
        <div className={s.scanLine} />
      </div>
      <h2 className={s.genTitle} data-anim>
        {t.genTitle}
      </h2>
      <p className={s.genSub} data-anim>
        {t.genSub}
      </p>
      <div className={s.genStatus} data-anim>
        {text}
      </div>
      <div className={s.genTimer}>{secs}s</div>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Check({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0014.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c.9 5.2 4.8 9.1 10 10-5.2.9-9.1 4.8-10 10-.9-5.2-4.8-9.1-10-10 5.2-.9 9.1-4.8 10-10z" />
    </svg>
  );
}
