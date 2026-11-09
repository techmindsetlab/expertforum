"use client";

import { useEffect, useRef, useState } from "react";
import { OpsBar } from "@/components/ops/OpsBar";
import s from "@/components/ops/ops.module.css";
import { PRINT, printInFrame, type PrintFormat } from "@/components/ops/print";
import { fmtNo, fmtTime, useArtworks, type OpsArtwork } from "@/components/ops/useArtworks";

const FORMATS = ["a4", "label"] as const;
const AUTO_KEY: Record<PrintFormat, string> = { a4: "ag_autoprint", label: "ag_autoprint_label" };

type Job = { art: OpsArtwork; format: PrintFormat };

/**
 * Print desk: newest artworks first, one-tap print through a hidden iframe —
 * A4 poster (Apeos) or 95 × 110 mm label (label printer). Auto-print sends
 * every new artwork to the printer — launch Chrome with --kiosk-printing so it
 * prints silently to that profile's printer; one Chrome profile per printer.
 */
export default function PrintStation() {
  const { items, act } = useArtworks(4000, 60);
  const [auto, setAuto] = useState<Record<PrintFormat, boolean>>({ a4: false, label: false });
  const [printing, setPrinting] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<Job[]>([]);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted toggles on mount
      setAuto({ a4: localStorage.getItem(AUTO_KEY.a4) === "1", label: localStorage.getItem(AUTO_KEY.label) === "1" });
    } catch {}
  }, []);

  const print = async ({ art, format }: Job) => {
    setPrinting(`${format}:${art.id}`);
    await printInFrame(frameRef.current!, art.id, format);
    act(art.id, PRINT[format].action);
    setPrinting(null);
  };

  // Queue newly submitted artworks for auto-print (never the backlog on first load).
  useEffect(() => {
    const visible = items.filter((i) => !i.hidden);
    if (!seen.current) {
      seen.current = new Set(visible.map((i) => i.id));
      return;
    }
    for (const a of [...visible].reverse()) {
      if (!seen.current.has(a.id)) {
        seen.current.add(a.id);
        for (const format of FORMATS) if (auto[format]) queue.current.push({ art: a, format });
      }
    }
  }, [items, auto]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (printing || !queue.current.length) return;
      await print(queue.current.shift()!);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printing]);

  const toggle = (format: PrintFormat, on: boolean) => {
    setAuto((v) => ({ ...v, [format]: on }));
    try {
      localStorage.setItem(AUTO_KEY[format], on ? "1" : "0");
    } catch {}
  };

  return (
    <div className={s.page}>
      <OpsBar title="Print station · A4 + Label" />
      <div className={s.wrap}>
        <div className={s.toolbar}>
          <label className={s.toggle}>
            <input type="checkbox" checked={auto.a4} onChange={(e) => toggle("a4", e.target.checked)} />
            Auto-print A4
          </label>
          <label className={s.toggle}>
            <input type="checkbox" checked={auto.label} onChange={(e) => toggle("label", e.target.checked)} />
            Auto-print labels
          </label>
          <span className={s.muted}>
            Chrome --kiosk-printing, one profile per printer · A4 / label 95 × 110 mm, margins none, scale 100%
          </span>
        </div>

        {items.length === 0 ? (
          <div className={s.empty}>No artworks to print yet.</div>
        ) : (
          <div className={s.grid}>
            {items
              .filter((a) => !a.hidden)
              .map((a) => (
                <div key={a.id} className={s.card}>
                  {a.thumb && <img src={a.thumb} alt={a.name} loading="lazy" />}
                  <div className={s.cardBody}>
                    <div className={s.cardTitle}>
                      <span>{a.name}</span>
                      <b>{fmtNo(a.number)}</b>
                    </div>
                    <div className={s.muted}>{fmtTime(a.submittedAt)}</div>
                    <div className={s.tags}>
                      {a.printCount > 0 ? <span className={`${s.tag} ${s.tagOk}`}>A4 ×{a.printCount}</span> : <span className={`${s.tag} ${s.tagWarn}`}>A4 not printed</span>}
                      {a.labelCount > 0 ? <span className={`${s.tag} ${s.tagOk}`}>label ×{a.labelCount}</span> : <span className={`${s.tag} ${s.tagWarn}`}>label not printed</span>}
                    </div>
                    <div className={s.actions}>
                      {FORMATS.map((format) => (
                        <button key={format} className={`${s.btn} ${s.btnGold}`} disabled={printing === `${format}:${a.id}`} onClick={() => print({ art: a, format })}>
                          {printing === `${format}:${a.id}` ? "Preparing…" : PRINT[format].label}
                        </button>
                      ))}
                    </div>
                    <div className={`${s.muted} ${s.links}`}>
                      Preview{" "}
                      <a href={PRINT.a4.path(a.id)} target="_blank">
                        A4
                      </a>{" "}
                      ·{" "}
                      <a href={PRINT.label.path(a.id)} target="_blank">
                        label
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <iframe ref={frameRef} title="print" style={{ position: "fixed", width: 0, height: 0, border: 0, right: 0, bottom: 0 }} />
    </div>
  );
}
