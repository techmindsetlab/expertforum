"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { EVENT, SHARE_PATH } from "@/lib/config";

/** Same-app file URLs (local dev storage) go under SHARE_PATH so they also load when the page is proxied. */
const underShare = (url: string) => (url.startsWith("/") ? `${SHARE_PATH}${url}` : url);
import { renderReplay, type Drawing } from "@/lib/strokes";
import { Ornament } from "@/components/Ornament";
import s from "./share.module.css";

/** Mobile page behind the QR: the sketch replays, then the AI print develops. */
/** `link`: the page's public address (the Nada Kreatif Pro URL in production), copied and shared. */
export function ShareView({ art, link }: { art: PublicArtwork; link: string }) {
  const en = art.locale === "en";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [showSketch, setShowSketch] = useState(false);
  const [copied, setCopied] = useState(false);
  const no = `#${String(art.number).padStart(3, "0")}`;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const size = 900;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    const replay = { p: 0 };
    let drawing: Drawing | null = null;
    let tl: gsap.core.Timeline | undefined;
    // Entrance runs immediately; the replay → print sequence starts once the
    // strokes arrive (or after 2.5 s without them, straight to the print).
    const ctxG = gsap.context((self) => {
      gsap.fromTo("[data-in]", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.9, ease: "expo.out" });
      gsap.set("[data-halftone]", { "--dot": "0px" });
      // Clip reaches past the box so signature tails (g, y, p…) are not cut.
      gsap.set("[data-sig]", { clipPath: "inset(-50% 100% -50% -10%)" });
      self.add("play", () => {
        tl = gsap
          .timeline()
          .to(replay, { p: 1, duration: 2.4, ease: "power1.inOut", onUpdate: () => drawing && renderReplay(ctx, drawing, size, replay.p) })
          .to("[data-halftone]", { "--dot": "14px", duration: 1.6, ease: "power2.inOut" }, ">-0.1")
          .to("[data-sig]", { clipPath: "inset(-50% -10% -50% -10%)", duration: 1, ease: "power2.inOut" }, ">-0.3")
          .add(() => rootRef.current?.querySelector("[data-halftone]")?.setAttribute("data-done", "true"));
      });
    }, rootRef);
    let alive = true;
    Promise.race([
      fetch(`${SHARE_PATH}/api/art/${art.id}/strokes`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (drawing = d)),
      new Promise((r) => setTimeout(r, 2500)),
    ])
      .catch(() => {})
      .finally(() => alive && (ctxG as unknown as { play: () => void }).play());
    return () => {
      alive = false;
      tl?.kill();
      ctxG.revert();
    };
  }, [art.id]);

  /** Copies the link (always), then opens the phone's share sheet where there is one. */
  const share = async () => {
    const url = link;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
    if (!navigator.share) return;
    try {
      const blob = await fetch(`${SHARE_PATH}/api/art/${art.id}/card`).then((r) => r.blob());
      const file = new File([blob], `print-your-mark-${art.number}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "print your mark", text: `${art.name} ${no} · ${EVENT.short}`, url });
        return;
      }
      await navigator.share?.({ title: "print your mark", url });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <main className={s.page} ref={rootRef}>
      <div className={s.ornament} aria-hidden>
        <Ornament preset="band" className={s.ornamentCanvas} />
      </div>
      <header className={s.head} data-in>
        <img className={s.logoAg} src={`${SHARE_PATH}/brand/astragraphia-wordmark-white.svg`} alt="Astragraphia" />
        <i />
        <img className={s.logo70} src={`${SHARE_PATH}/brand/astra70-logo-white.png`} alt="70 Tahun Astra" />
        <i />
        <img className={s.logoAgit} src={`${SHARE_PATH}/brand/agit-logo-white.png`} alt="agit" />
      </header>

      <div className={s.kicker} data-in>
        print <em>your</em> mark · {no}
      </div>

      <div className={s.card} data-in>
        <div className={s.art}>
          <canvas ref={canvasRef} />
          <div className={`${s.print} halftone`} data-halftone style={{ ["--cell" as string]: "14px", opacity: showSketch ? 0 : 1 }}>
            <img src={underShare(art.art)} alt={art.name} />
            <span className={`${s.sig} signature`} data-sig>
              {art.name}
            </span>
          </div>
          {showSketch && art.sketch && <img className={s.sketch} src={underShare(art.sketch)} alt="" />}
        </div>
        <div className={s.caption}>
          <b>{art.name}</b>
          <span>{en ? "A hand sketch, reimagined by AI" : "Sketsa tangan, dilukis ulang oleh AI"}</span>
        </div>
      </div>

      <div className={s.actions} data-in>
        <a className={s.primary} href={`${SHARE_PATH}/api/art/${art.id}/card?download`} download>
          {en ? "Download artwork" : "Unduh karya"}
        </a>
        <button className={s.secondary} onClick={share} data-copied={copied || undefined} aria-live="polite">
          {copied ? (en ? "Link copied ✓" : "Link disalin ✓") : en ? "Share" : "Bagikan"}
        </button>
        {art.sketch && (
          <button className={s.ghost} onClick={() => setShowSketch((v) => !v)}>
            {showSketch ? (en ? "Show AI artwork" : "Lihat karya AI") : en ? "Show original sketch" : "Lihat sketsa asli"}
          </button>
        )}
      </div>

      <footer className={s.foot} data-in>
        <strong>{EVENT.fullName}</strong>
        <br />
        {EVENT.dates[en ? "en" : "id"]} · {EVENT.venue}
      </footer>
    </main>
  );
}

/** Clipboard API where allowed (https), a hidden textarea + execCommand otherwise. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}
