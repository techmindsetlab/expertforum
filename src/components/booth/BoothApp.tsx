"use client";

import { useEffect, useRef, useState } from "react";
import { BoothStage, VIEWS, type ViewName } from "./BoothStage";
import s from "./booth.module.css";

const SPECS = [
  ["Booth", "Island 4 × 3,8 m · masuk depan & kanan · tanpa flooring"],
  ["Backdrop", "4 × 2,4 m · muka depan 1 print sesuai FA (header, logo, band ribbon 1,07 m, logo g) · storage 1 m (belakang & atas terbuka) · pintu kanan"],
  ["Tengah", 'Logo astragraphia (print) · TV 55" tertanam (sejajar TV kiri) · logo g print ±1,07 m'],
  ["Kiri", 'Header ApeosPrint C5570 (print) · TV 55" slideshow · ApeosPrint C5570 · 3 hambalan 18 mm × 27 cm, jarak 34 cm (QuickLabel QL-E100 + kemasan)'],
  ["Kanan", "Pojok Kreasi (print) · kolase 14 karya siswa SMK, art & frame A3 (29,7 × 42 cm, list 1 cm), baris 4-3-4-3 menimpa kotak & band · 2 spotlight"],
  ["Depan", "Meja putih 50 × 50 × 100 cm + tablet holder · 2 m dari TV · rak A2"],
];

export default function BoothApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<BoothStage | null>(null);
  const [loading, setLoading] = useState("Menyiapkan 3D");
  const [view, setView] = useState<ViewName>("perspektif");
  const [dims, setDims] = useState(true);
  const [labels, setLabels] = useState(true);
  const [people, setPeople] = useState(true);
  const [spin, setSpin] = useState(false);
  const [panel, setPanel] = useState(true);

  useEffect(() => {
    // Specs panel starts collapsed on phones (after mount, so SSR markup matches).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth <= 900) setPanel(false);
    const stage = new BoothStage(hostRef.current!);
    stageRef.current = stage;
    stage
      .build((m) => setLoading(m))
      .catch((e) => {
        console.error(e);
        setLoading("Gagal memuat mockup");
      });
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => stageRef.current?.setDims(dims), [dims, loading]);
  useEffect(() => stageRef.current?.setLabels(labels), [labels, loading]);
  useEffect(() => stageRef.current?.setPeople(people), [people]);
  useEffect(() => stageRef.current?.setAutoRotate(spin), [spin]);

  const go = (v: ViewName) => {
    setView(v);
    setSpin(false);
    stageRef.current?.setView(v);
  };

  const download = () => {
    const url = stageRef.current?.screenshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `booth-pojok-kreasi-${view}.png`;
    a.click();
  };

  return (
    <div className={s.root}>
      <div ref={hostRef} className={s.stage} />

      <header className={s.head}>
        <img src="/brand/astragraphia-wordmark.svg" alt="Astragraphia" />
        <div>
          <h1>Booth mockup · Pojok Kreasi</h1>
          <p>Island booth 4 × 3,8 m · WCCE 2026</p>
        </div>
      </header>

      <div className={s.tools}>
        <Toggle on={dims} set={setDims} label="Dimensi" />
        <Toggle on={labels} set={setLabels} label="Label" />
        <Toggle on={people} set={setPeople} label="Orang" />
        <Toggle on={spin} set={setSpin} label="Putar" />
        <button className={s.download} onClick={download}>
          Unduh PNG
        </button>
      </div>

      <aside className={s.specs} data-open={panel}>
        <button className={s.specsToggle} onClick={() => setPanel((v) => !v)}>
          {panel ? "Sembunyikan" : "Spesifikasi"}
        </button>
        {panel && (
          <dl>
            {SPECS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>

      <nav className={s.views}>
        {(Object.keys(VIEWS) as ViewName[]).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => go(v)}>
            {VIEWS[v].label}
          </button>
        ))}
      </nav>

      <p className={s.hint}>Seret untuk memutar · scroll / cubit untuk zoom · klik kanan untuk geser</p>

      {loading && (
        <div className={s.loading}>
          <span className={s.spinner} />
          {loading}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button className={s.toggle} aria-pressed={on} onClick={() => set(!on)}>
      <i />
      {label}
    </button>
  );
}
