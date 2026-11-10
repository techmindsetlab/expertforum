import { notFound } from "next/navigation";
import { getArtworkForOperator } from "@/lib/artworks";
import { FitLine } from "../FitLine";
import { sign } from "../fonts";
import { PrintToolbar } from "../PrintToolbar";
import s from "./label.module.css";

export const dynamic = "force-dynamic";

/**
 * 95 × 110 mm label for the second (label) printer: the A4 poster without its
 * footer — no campaign line, QR or Apeos badge, just the logos and the signed artwork.
 */
export default async function LabelPage(props: PageProps<"/print/[id]/label">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const art = await getArtworkForOperator(id).catch(() => null);
  if (!art || art.status !== "submitted" || !art.artUrl) notFound();

  return (
    <>
      <style>{`@page { size: 95mm 110mm; margin: 0 } html, body { background: #fff !important; }`}</style>
      {sp.embed !== "1" && <PrintToolbar id={art.id} format="label" />}
      <article className={`${s.sheet} ${sign.variable}`}>
        <header className={s.top}>
          <img className={s.logoAg} src="/brand/astragraphia-wordmark.svg" alt="Astragraphia" />
          <img className={s.logo70} src="/brand/astra70-logo.png" alt="70 Tahun Astra" />
          <img className={s.logoAgit} src="/brand/agit-logo.png" alt="agit" />
        </header>

        <div className={s.art}>
          <img src={art.artUrl} alt={art.name} />
          <div className={s.sigCorner}>
            <FitLine className={s.sig} text={art.name} />
          </div>
        </div>
      </article>
    </>
  );
}
