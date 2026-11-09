"use client";

import { useMemo, useState } from "react";
import { OpsBar } from "@/components/ops/OpsBar";
import s from "@/components/ops/ops.module.css";
import { fmtNo, fmtTime, useArtworks } from "@/components/ops/useArtworks";

export default function AdminPage() {
  const { items, stats, error, act } = useArtworks(6000);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.name.toLowerCase().includes(t) || i.email.includes(t) || String(i.number) === t.replace("#", ""));
  }, [items, q]);

  return (
    <div className={s.page}>
      <OpsBar title="Admin" />
      <div className={s.wrap}>
        {stats && (
          <div className={s.stats}>
            <Stat value={stats.submitted} label="Karya di wall" />
            <Stat value={stats.today} label="Hari ini" />
            <Stat value={stats.printed} label="Sudah dicetak A4" />
            <Stat value={stats.labeled} label="Label dicetak" />
            <Stat value={stats.emailed} label="Email terkirim" />
            <Stat value={stats.optIn} label="Opt-in marketing" />
            <Stat value={stats.drafts} label="Belum selesai" />
            <Stat value={stats.generations.total} label="Total generate AI" />
            <Stat value={stats.generations.fallback} label="Fallback (AI gagal)" />
            <Stat value={`${(stats.generations.avgMs / 1000).toFixed(1)}s`} label="Rata-rata AI" />
          </div>
        )}

        <div className={s.toolbar}>
          <input className={s.search} placeholder="Cari nama, email, atau nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a className={`${s.btn} ${s.btnGold}`} href="/api/admin/artworks?format=csv">
            Unduh CSV peserta
          </a>
          {error && <span className={s.muted}>{error}</span>}
        </div>

        {list.length === 0 ? (
          <div className={s.empty}>Belum ada karya.</div>
        ) : (
          <div className={s.grid}>
            {list.map((a) => (
              <div key={a.id} className={s.card} data-hidden={a.hidden}>
                {a.thumb && <img src={a.thumb} alt={a.name} loading="lazy" />}
                <div className={s.cardBody}>
                  <div className={s.cardTitle}>
                    <span>{a.name}</span>
                    <b>{fmtNo(a.number)}</b>
                  </div>
                  <div className={s.muted} title={a.email || undefined}>
                    {a.email || "tanpa email"}
                  </div>
                  <div className={s.muted}>
                    {fmtTime(a.submittedAt)} · kiosk {a.kioskId ?? "—"}
                  </div>
                  <div className={s.tags}>
                    {a.hidden && <span className={`${s.tag} ${s.tagWarn}`}>tersembunyi</span>}
                    {a.printCount > 0 && <span className={`${s.tag} ${s.tagOk}`}>A4 ×{a.printCount}</span>}
                    {a.labelCount > 0 && <span className={`${s.tag} ${s.tagOk}`}>label ×{a.labelCount}</span>}
                    {a.emailedAt ? (
                      <span className={`${s.tag} ${s.tagOk}`}>email ✓</span>
                    ) : a.emailError ? (
                      <span className={`${s.tag} ${s.tagWarn}`} title={a.emailError}>
                        email gagal
                      </span>
                    ) : a.email ? (
                      <span className={s.tag}>email —</span>
                    ) : null}
                    {a.marketingOptIn && <span className={s.tag}>opt-in</span>}
                  </div>
                  <div className={s.actions}>
                    <button className={s.btn} onClick={() => act(a.id, a.hidden ? "unhide" : "hide")}>
                      {a.hidden ? "Tampilkan" : "Sembunyikan"}
                    </button>
                    <a className={s.btn} href={`/print/${a.id}`} target="_blank">
                      Cetak A4
                    </a>
                    <a className={s.btn} href={`/print/${a.id}/label`} target="_blank">
                      Cetak label
                    </a>
                    {a.email && (
                      <button className={s.btn} onClick={() => act(a.id, "email")}>
                        Kirim email
                      </button>
                    )}
                    <a className={s.btn} href={`/a/${a.id}`} target="_blank">
                      Buka
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={s.stat}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
