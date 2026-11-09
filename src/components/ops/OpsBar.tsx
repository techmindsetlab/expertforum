"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import s from "./ops.module.css";

export function OpsBar({ title }: { title: string }) {
  const path = usePathname();
  const router = useRouter();
  const links = [
    { href: "/admin", label: "Admin" },
    { href: "/print", label: "Print" },
    { href: "/wall", label: "Wall ↗" },
    { href: "/kiosk", label: "Kiosk ↗" },
  ];
  return (
    <header className={s.bar}>
      <img src="/brand/astragraphia-wordmark-white.svg" alt="Astragraphia" />
      <h1>{title}</h1>
      <nav>
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} target={l.label.includes("↗") ? "_blank" : undefined}>
            {l.label}
          </Link>
        ))}
        <button
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            router.push("/admin/login");
          }}
        >
          Keluar
        </button>
      </nav>
    </header>
  );
}
