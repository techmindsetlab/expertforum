"use client";

import { useState } from "react";
import s from "./kiosk.module.css";

type Props = {
  mode: "name" | "email";
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
  labels: { clear: string; space: string };
};

const NUM = "1234567890".split("");
const R1 = "qwertyuiop".split("");
const R2 = "asdfghjkl".split("");
const R3 = "zxcvbnm".split("");
const DOMAINS = ["@gmail.com", "@yahoo.com", "@outlook.com", "@icloud.com"];

/**
 * On-screen keyboard so the Android keyboard never pops up, resizes the
 * layout or offers autocorrect/emoji. Keys fire on pointerdown for speed.
 */
export function Keyboard({ mode, value, maxLength, onChange, labels }: Props) {
  const [shift, setShift] = useState(false);
  const autoCap = mode === "name" && (value.length === 0 || value.endsWith(" "));
  const upper = mode === "name" && (shift || autoCap);

  const press = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
  };
  const type = (ch: string) => {
    if (value.length >= maxLength) return;
    onChange(value + ch);
    if (shift) setShift(false);
  };
  const key = (k: string) => {
    const ch = upper ? k.toUpperCase() : k;
    return (
      <button key={k} className={s.key} onPointerDown={press(() => type(ch))}>
        {ch}
      </button>
    );
  };

  return (
    <div className={s.keyboard} data-anim>
      {mode === "email" && (
        <div className={s.domainRow}>
          {DOMAINS.map((d) => (
            <button
              key={d}
              className={s.domain}
              onPointerDown={press(() => {
                const base = value.split("@")[0];
                onChange((base + d).slice(0, maxLength));
              })}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <div className={s.keyRow}>{NUM.map(key)}</div>
      <div className={s.keyRow}>{R1.map(key)}</div>
      <div className={s.keyRow}>
        <span className={s.keyHalf} />
        {R2.map(key)}
        <span className={s.keyHalf} />
      </div>
      <div className={s.keyRow}>
        {mode === "name" ? (
          <button
            className={`${s.key} ${s.keyWide} ${upper ? s.keyOn : ""}`}
            aria-label="Shift"
            onPointerDown={press(() => setShift((v) => !v))}
          >
            ⇧
          </button>
        ) : (
          <button className={`${s.key} ${s.keyWide}`} onPointerDown={press(() => type("_"))}>
            _
          </button>
        )}
        {R3.map(key)}
        <button className={`${s.key} ${s.keyWide}`} aria-label="Backspace" onPointerDown={press(() => onChange(value.slice(0, -1)))}>
          ⌫
        </button>
      </div>
      <div className={s.keyRow}>
        <button className={`${s.key} ${s.keyAction}`} onPointerDown={press(() => onChange(""))}>
          {labels.clear}
        </button>
        {mode === "name" ? (
          <>
            <button className={`${s.key} ${s.keySpace}`} onPointerDown={press(() => value && !value.endsWith(" ") && type(" "))}>
              {labels.space}
            </button>
            <button className={s.key} onPointerDown={press(() => type("-"))}>
              -
            </button>
            <button className={s.key} onPointerDown={press(() => type("'"))}>
              &apos;
            </button>
          </>
        ) : (
          <>
            <button className={`${s.key} ${s.keyAccent}`} onPointerDown={press(() => !value.includes("@") && type("@"))}>
              @
            </button>
            <button className={s.key} onPointerDown={press(() => type("."))}>
              .
            </button>
            <button className={s.key} onPointerDown={press(() => type("-"))}>
              -
            </button>
            <button className={`${s.key} ${s.keyAction}`} onPointerDown={press(() => type(".com"))}>
              .com
            </button>
            <button className={`${s.key} ${s.keyAction}`} onPointerDown={press(() => type(".co.id"))}>
              .co.id
            </button>
          </>
        )}
      </div>
    </div>
  );
}
