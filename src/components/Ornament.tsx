"use client";

import { useEffect, useRef } from "react";
import { OrnamentField, ORNAMENT_PRESETS, type OrnamentOptions, type OrnamentPreset } from "@/lib/ornament";

/**
 * Animated Expert Forum ornament on a canvas that fills its parent.
 * - paused: freeze on the current frame (the kiosk pauses while drawing).
 * - tempo: wave frequency multiplier (faster while the AI paints).
 * - burst: change the number to send a fast wave from the centre.
 */
export function Ornament({
  preset,
  className,
  paused = false,
  tempo = 1,
  burst,
}: {
  preset: OrnamentPreset;
  className?: string;
  paused?: boolean;
  tempo?: number;
  burst?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const field = useRef<OrnamentField | null>(null);

  useEffect(() => {
    const f = new OrnamentField(ref.current!, ORNAMENT_PRESETS[preset] as OrnamentOptions);
    field.current = f;
    return () => {
      f.dispose();
      field.current = null;
    };
  }, [preset]);

  useEffect(() => {
    if (paused) field.current?.pause();
    else field.current?.resume();
  }, [paused]);

  useEffect(() => {
    field.current?.setTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    if (burst) field.current?.burst();
  }, [burst]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
