import { adminStats, listForAdmin } from "@/lib/artworks";
import { jsonError } from "@/lib/http";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/admin/artworks → { stats, items }   ·   ?format=csv → participant export */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rows = await listForAdmin(Number(url.searchParams.get("limit")) || 500);

    if (url.searchParams.get("format") === "csv") {
      const head = ["number", "name", "email", "marketing_opt_in", "locale", "kiosk", "submitted_at", "emailed_at", "print_count", "label_count", "hidden", "share_url"];
      const origin = url.origin;
      const lines = rows.map((r) =>
        [r.number, r.name, r.email, r.marketingOptIn, r.locale, r.kioskId, r.submittedAt?.toISOString(), r.emailedAt?.toISOString(), r.printCount, r.labelCount, r.hidden, `${origin}/a/${r.id}`]
          .map(csvCell)
          .join(","),
      );
      return new Response([head.join(","), ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="astragraphia-wcce-participants.csv"`,
        },
      });
    }

    const stats = await adminStats();
    const items = rows.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      email: r.email,
      marketingOptIn: r.marketingOptIn,
      hidden: r.hidden,
      thumb: r.artSmUrl ?? r.artMdUrl,
      submittedAt: r.submittedAt,
      emailedAt: r.emailedAt,
      emailError: r.emailError,
      printCount: r.printCount,
      labelCount: r.labelCount,
      kioskId: r.kioskId,
    }));
    return Response.json({ stats, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}
