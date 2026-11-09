"use client";

import { useState } from "react";
import s from "@/components/ops/ops.module.css";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Gagal masuk");
    const next = new URLSearchParams(location.search).get("next");
    location.href = next && next.startsWith("/") ? next : "/admin";
  };

  return (
    <main className={s.login}>
      <form className={s.loginCard} onSubmit={submit}>
        <img src="/brand/astragraphia-wordmark-white.svg" alt="Astragraphia" />
        <h1>Operator · Live Sketch</h1>
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <div className={s.error}>{error}</div>}
        <button className={`${s.btn} ${s.btnGold}`} disabled={busy} style={{ justifyContent: "center", padding: "13px" }}>
          {busy ? "…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
