import Link from "next/link";
import s from "./home.module.css";

const LINKS = [
  { href: "/kiosk", title: "Kiosk", desc: "Tablet Galaxy Tab A · portrait · S Pen" },
  { href: "/wall", title: "Wall", desc: "TV landscape · layar besar" },
  { href: "/print", title: "Print station", desc: "Antrian cetak A4 · Apeos" },
  { href: "/admin", title: "Admin", desc: "Moderasi, data peserta, CSV" },
];

export default function Home() {
  return (
    <main className={s.main}>
      <div className={s.head}>
        <img src="/brand/astragraphia-wordmark-white.svg" alt="Astragraphia" className={s.logo} />
        <img src="/brand/wcce-mark-white.png" alt="WCCE 2026" className={s.mark} />
      </div>
      <h1 className={s.title}>
        print <span className="signature">your</span> mark
      </h1>
      <p className={s.sub}>Live Sketch → AI → Digital Wall · WCCE 2026</p>
      <nav className={s.grid}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={s.card}>
            <strong>{l.title}</strong>
            <span>{l.desc}</span>
            <em>{l.href} →</em>
          </Link>
        ))}
      </nav>
    </main>
  );
}
