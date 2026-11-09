"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * One line of handwriting that never overflows its box. CSS gives a size
 * estimate from the character count; once the font is in, this measures the
 * real width and shrinks the text if it still doesn't fit — or, with `fill`,
 * scales it either way so it spans the box exactly.
 */
export function FitLine({ text, className, fill = false }: { text: string; className?: string; fill?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      const el = ref.current;
      if (!live || !el) return;
      el.style.fontSize = "";
      const cs = getComputedStyle(el);
      const box = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const range = document.createRange();
      range.selectNodeContents(el);
      const width = range.getBoundingClientRect().width;
      if (width > box || (fill && width > 0)) el.style.fontSize = `${(parseFloat(cs.fontSize) * box) / width}px`;
    });
    return () => {
      live = false;
    };
  }, [text, fill]);

  return (
    <span ref={ref} className={className} style={{ "--n": Math.max(text.length, 6) } as CSSProperties}>
      {text}
    </span>
  );
}
