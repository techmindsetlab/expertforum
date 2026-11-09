"use client";

import { useCallback, useEffect, useRef } from "react";
import { drawStroke, renderDrawing, type Stroke, type StrokePoint, type Tool } from "@/lib/strokes";
import s from "./kiosk.module.css";

type Props = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  color: string;
  size: number;
  tool: Tool;
  placeholder: string;
  /** Time is up: no new strokes (a stroke in progress is committed). */
  disabled?: boolean;
  onStrokeStart?: () => void;
  onStrokeEnd?: () => void;
};

/**
 * Two stacked canvases: `base` holds committed strokes, `live` redraws only
 * the stroke in progress — keeps it smooth on the Galaxy Tab A's Mali GPU.
 * Palm rejection: once the S Pen is seen, finger touches are ignored.
 */
export function DrawCanvas({ strokes, onChange, color, size, tool, placeholder, disabled, onStrokeStart, onStrokeEnd }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<{ id: number; stroke: Stroke; t0: number } | null>(null);
  const penSeen = useRef(false);
  const raf = useRef(0);
  const dims = useRef({ w: 0, dpr: 1 });

  const redrawBase = useCallback(() => {
    const c = baseRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { w, dpr } = dims.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderDrawing(ctx, { v: 1, strokes }, w);
  }, [strokes]);

  // Size canvases to the container (square) at device pixel ratio.
  useEffect(() => {
    const wrap = wrapRef.current!;
    const resize = () => {
      const base = baseRef.current;
      const live = liveRef.current;
      if (!base || !live) return;
      const w = wrap.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dims.current = { w, dpr };
      for (const c of [base, live]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(w * dpr);
      }
      redrawBase();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redrawBase]);

  useEffect(() => {
    redrawBase();
  }, [redrawBase]);

  const renderLive = () => {
    raf.current = 0;
    const c = liveRef.current;
    const cur = current.current;
    if (!c || !cur) return;
    const ctx = c.getContext("2d")!;
    const { w, dpr } = dims.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);
    drawStroke(ctx, cur.stroke, w);
  };

  const toPoint = (e: PointerEvent | React.PointerEvent, t0: number): StrokePoint => {
    const rect = liveRef.current!.getBoundingClientRect();
    const pen = e.pointerType === "pen";
    const pressure = pen ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5;
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, pressure, performance.now() - t0];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (e.pointerType === "pen") penSeen.current = true;
    else if (e.pointerType === "touch" && penSeen.current) return; // palm
    if (current.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const t0 = performance.now();
    const pen = e.pointerType === "pen";
    current.current = {
      id: e.pointerId,
      t0,
      stroke: { color, size, pen, tool, points: [toPoint(e, t0)] },
    };
    if (!raf.current) raf.current = requestAnimationFrame(renderLive);
    onStrokeStart?.();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = current.current;
    if (!cur || e.pointerId !== cur.id) return;
    const native = e.nativeEvent;
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];
    for (const ev of events.length ? events : [native]) cur.stroke.points.push(toPoint(ev, cur.t0));
    if (!raf.current) raf.current = requestAnimationFrame(renderLive);
  };

  /** Commits the stroke in progress onto the base canvas. */
  const finish = () => {
    const cur = current.current;
    if (!cur) return;
    current.current = null;
    onStrokeEnd?.();
    // Commit onto the base canvas immediately (no flash), then clear live.
    const base = baseRef.current!.getContext("2d")!;
    const { w, dpr } = dims.current;
    base.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStroke(base, cur.stroke, w);
    const live = liveRef.current!.getContext("2d")!;
    live.setTransform(1, 0, 0, 1, 0, 0);
    live.clearRect(0, 0, liveRef.current!.width, liveRef.current!.height);
    onChange([...strokes, cur.stroke]);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (current.current?.id === e.pointerId) finish();
  };

  // Time ran out mid-stroke: keep what was drawn so far.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => {
    if (disabled) finishRef.current();
  }, [disabled]);

  return (
    <div ref={wrapRef} className={s.canvasWrap} data-disabled={disabled || undefined}>
      <canvas ref={baseRef} className={s.canvas} />
      <canvas
        ref={liveRef}
        className={s.canvas}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {strokes.length === 0 && (
        <div className={s.canvasHint} aria-hidden>
          <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M30 8l10 10L18 40H8V30L30 8z" />
            <path d="M26 12l10 10" />
          </svg>
          <span>{placeholder}</span>
        </div>
      )}
    </div>
  );
}

/** Renders the drawing at 1024px on white for the AI + archive. */
export function exportDrawing(strokes: Stroke[], size = 1024) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  renderDrawing(c.getContext("2d")!, { v: 1, strokes }, size);
  return c.toDataURL("image/png");
}
