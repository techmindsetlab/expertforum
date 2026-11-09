import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getArtworkForOperator } from "@/lib/artworks";
import { EVENT } from "@/lib/config";
import { publicOrigin } from "@/lib/http";
import { FitLine } from "./FitLine";
import { sign } from "./fonts";
import { PrintToolbar } from "./PrintToolbar";
import s from "./print.module.css";

export const dynamic = "force-dynamic";

/** A4 portrait poster for the Apeos print desk. Always English, whatever the kiosk locale. */
export default async function PrintPage(props: PageProps<"/print/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const art = await getArtworkForOperator(id).catch(() => null);
  if (!art || art.status !== "submitted" || !art.artUrl) notFound();

  const origin = publicOrigin();
  const qr = await QRCode.toString(`${origin}/a/${art.id}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1f3a", light: "#FFFFFF" },
  });
  const no = `#${String(art.number).padStart(3, "0")}`;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(art.submittedAt ?? art.createdAt);

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0 } html, body { background: #fff !important; }`}</style>
      {sp.embed !== "1" && <PrintToolbar id={art.id} format="a4" />}
      <article className={`${s.sheet} ${sign.variable}`}>
        <header className={s.top}>
          <img className={s.logoAg} src="/brand/astragraphia-wordmark.svg" alt="Astragraphia" />
          <img className={s.logo70} src="/brand/astra70-logo.png" alt="70 Tahun Astra" />
          <img className={s.logoAgit} src="/brand/agit-logo.png" alt="agit" />
          <img className={s.logoEf} src="/brand/expert-forum-logo.png" alt="Expert Forum" />
        </header>

        <div className={s.art}>
          <img src={art.artUrl} alt={art.name} />
          <div className={s.sigCorner}>
            <FitLine className={s.sig} text={art.name} />
          </div>
        </div>

        <footer className={s.footer}>
          <div className={s.meta}>
            <div className={s.who}>
              <div className={s.campaign}>
                print <em>your</em> mark <span className={s.no}>{no}</span>
              </div>
              <div className={s.name}>{art.name}</div>
              <div className={s.desc}>
                <div className={s.caption}>A hand sketch, reimagined by AI</div>
                <div className={s.date}>
                  <FitLine className={s.dateText} text={date} fill />
                </div>
              </div>
            </div>
            <div className={s.qr}>
              <div className={s.qrCode} dangerouslySetInnerHTML={{ __html: qr }} />
              <span>DOWNLOAD YOUR ART</span>
            </div>
          </div>
          {/* Event: tagline left, day · date · time and venue right. */}
          <div className={s.event}>
            <div className={s.eventTag}>
              <b>{EVENT.tagline}</b>
              <span>{EVENT.subline}</span>
            </div>
            <div className={s.eventWhen}>
              <b>
                {EVENT.day} · {EVENT.dateShort} · {EVENT.time}
              </b>
              <span>{EVENT.venue}</span>
            </div>
          </div>
          <div className={s.printedBy}>
            <img src="/brand/apeos-logo.png" alt="Apeos" />
            <span>Printed by Astragraphia using Fujifilm ApeosPrint C5570.</span>
          </div>
        </footer>
      </article>
    </>
  );
}
