"use client";

import { useCallback, useEffect, useState } from "react";

export type OpsArtwork = {
  id: string;
  number: number;
  name: string;
  email: string;
  marketingOptIn: boolean;
  hidden: boolean;
  thumb: string | null;
  submittedAt: string | null;
  emailedAt: string | null;
  emailError: string | null;
  printCount: number;
  labelCount: number;
  kioskId: string | null;
};

export type OpsStats = {
  submitted: number;
  drafts: number;
  printed: number;
  labeled: number;
  emailed: number;
  optIn: number;
  today: number;
  generations: { total: number; fallback: number; blocked: number; avgMs: number };
};

export function useArtworks(intervalMs = 5000, limit = 500) {
  const [items, setItems] = useState<OpsArtwork[]>([]);
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/artworks?limit=${limit}`, { cache: "no-store" });
      if (res.status === 401) {
        location.href = `/admin/login?next=${encodeURIComponent(location.pathname)}`;
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setStats(data.stats ?? null);
      setError(null);
    } catch {
      setError("Offline — mencoba lagi…");
    }
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, then poll
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  const act = useCallback(
    async (id: string, action: "hide" | "unhide" | "printed" | "label" | "email") => {
      await fetch(`/api/admin/artworks/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      refresh();
    },
    [refresh],
  );

  return { items, stats, error, refresh, act };
}

export const fmtNo = (n: number) => `#${String(n).padStart(3, "0")}`;
export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
