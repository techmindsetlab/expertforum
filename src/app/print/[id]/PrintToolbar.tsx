"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PRINT, printInFrame, type PrintFormat } from "@/components/ops/print";
import s from "./print.module.css";

const HINT: Record<PrintFormat, string> = {
  a4: "A4 portrait · margins none · scale 100%",
  label: "Label 95 × 110 mm · margins none · scale 100%",
};

/** Preview toolbar: switch between A4 and label, print either one. */
export function PrintToolbar({ id, format }: { id: string; format: PrintFormat }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState<PrintFormat | null>(null);
  const other: PrintFormat = format === "a4" ? "label" : "a4";

  const print = async (f: PrintFormat) => {
    setBusy(f);
    await printInFrame(frameRef.current!, id, f);
    await fetch(`/api/admin/artworks/${id}`, { method: "POST", body: JSON.stringify({ action: PRINT[f].action }) });
    setBusy(null);
  };

  return (
    <div className={s.toolbar}>
      <Link href="/print">← Print queue</Link>
      <span>{HINT[format]}</span>
      <div className={s.toolbarActions}>
        <Link className={s.toolbarLink} href={PRINT[other].path(id)}>
          {other === "a4" ? "A4 preview" : "Label preview"}
        </Link>
        {(["a4", "label"] as const).map((f) => (
          <button key={f} data-current={f === format} disabled={busy !== null} onClick={() => print(f)}>
            {busy === f ? "Preparing…" : PRINT[f].label}
          </button>
        ))}
      </div>
      <iframe ref={frameRef} title="print" className={s.frame} />
    </div>
  );
}
