import "server-only";
import { getArtworkForOperator, markEmailed } from "./artworks";
import { EVENT } from "./config";
import { shareUrl } from "./http";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Sends the visitor their artwork: signed card image, share link and the QR
 * code (same QR as on the A4 print). Uses Resend's REST API.
 */
export async function sendArtworkEmail(id: string, origin: string) {
  const art = await getArtworkForOperator(id);
  if (art.status !== "submitted" || !art.email) return; // email is optional on the kiosk

  const en = art.locale === "en";
  const link = shareUrl(art.id, origin);
  const card = `${origin}/api/art/${art.id}/card`;
  const qr = `${origin}/api/qr/${art.id}`;
  const logo = `${origin}/brand/astragraphia-wordmark.png`;
  const astra70 = `${origin}/brand/astra70-logo.png`;
  const agit = `${origin}/brand/agit-logo.png`;
  const no = String(art.number).padStart(3, "0");

  const t = en
    ? {
        subject: `Your artwork #${no} is on the wall — ${EVENT.short}`,
        hi: `Hi ${esc(art.name)},`,
        lead: `Thanks for printing your mark at the Astragraphia & agit booth. Your sketch, reimagined by AI, is now part of the live wall at ${EVENT.short}.`,
        cta: "View & download artwork",
        qr: "Scan this QR code anytime to open your artwork.",
        foot: `You received this email because you joined Live Sketch at the Astragraphia & agit booth, ${EVENT.short}.`,
      }
    : {
        subject: `Karyamu #${no} sudah tampil di layar — ${EVENT.short}`,
        hi: `Hai ${esc(art.name)},`,
        lead: `Terima kasih sudah mencetak jejakmu di booth Astragraphia & agit. Sketsamu yang dilukis ulang oleh AI kini menjadi bagian dari dinding karya di ${EVENT.short}.`,
        cta: "Lihat & unduh karya",
        qr: "Pindai QR ini kapan saja untuk membuka karyamu.",
        foot: `Email ini dikirim karena kamu ikut Live Sketch di booth Astragraphia & agit, ${EVENT.short}.`,
      };

  const html = `<!doctype html><html><body style="margin:0;background:#eef3f9;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e3eaf3">
  <table role="presentation" width="100%"><tr>
    <td><img src="${logo}" width="170" alt="Astragraphia" style="display:block;border:0"></td>
    <td align="right"><img src="${astra70}" width="50" alt="70 Tahun Astra" style="display:inline-block;border:0;vertical-align:middle;margin-right:14px"><img src="${agit}" width="56" alt="agit" style="display:inline-block;border:0;vertical-align:middle"></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 28px 8px">
  <p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#2040da;font-weight:bold">${esc(EVENT.campaign)} · #${no}</p>
  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#0b1f3a">${t.hi}</h1>
  <p style="margin:0;font-size:16px;line-height:1.6;color:#3d4f66">${t.lead}</p>
</td></tr>
<tr><td style="padding:20px 28px"><a href="${link}"><img src="${card}" width="544" alt="#${no}" style="display:block;width:100%;height:auto;border-radius:14px;border:0"></a></td></tr>
<tr><td align="center" style="padding:4px 28px 24px">
  <a href="${link}" style="display:inline-block;background:#2040da;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:999px">${t.cta}</a>
</td></tr>
<tr><td align="center" style="padding:8px 28px 28px">
  <img src="${qr}" width="160" height="160" alt="QR" style="display:block;border:0">
  <p style="margin:10px 0 0;font-size:13px;color:#55657c">${t.qr}</p>
</td></tr>
<tr><td style="background:#0b1f3a;color:#d5e0ee;padding:18px 28px;font-size:12px;line-height:1.6">
  <strong style="color:#ffffff">${EVENT.short}</strong> · ${EVENT.dates[en ? "en" : "id"]} · ${EVENT.venue}<br>${t.foot}
</td></tr>
</table></td></tr></table></body></html>`;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — would send "${t.subject}" to ${art.email}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [art.email],
        reply_to: process.env.EMAIL_REPLY_TO || undefined,
        subject: t.subject,
        html,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    await markEmailed(id, null);
  } catch (err) {
    console.error("[email]", err);
    await markEmailed(id, (err as Error).message);
  }
}
