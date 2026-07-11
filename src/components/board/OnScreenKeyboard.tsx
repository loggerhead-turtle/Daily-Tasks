"use client";

import { useState } from "react";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((r) => r.split(""));

// A touch keyboard rendered inside the board, because a Pi kiosk has no OS
// on-screen keyboard. `mode` picks a full text keyboard or a number pad.
export function OnScreenKeyboard({
  mode,
  onKey,
  onBackspace,
  onDone,
}: {
  mode: "text" | "number";
  onKey: (ch: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}) {
  const [caps, setCaps] = useState(false);
  const Key = "flex h-14 min-w-[3rem] items-center justify-center rounded-xl bg-white px-3 font-display text-2xl font-bold text-slate-800 shadow transition active:scale-90 active:bg-violet-100";

  if (mode === "number") {
    return (
      <div className="rounded-3xl bg-slate-800/95 p-3 shadow-2xl">
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <button
              key={k}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => (k === "⌫" ? onBackspace() : onKey(k))}
              className={Key}
            >
              {k}
            </button>
          ))}
          <button
            onClick={onDone}
            className="col-span-3 rounded-xl bg-emerald-500 py-3 font-display text-2xl font-bold text-white shadow active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-3xl bg-slate-800/95 p-3 shadow-2xl">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {i === 2 && (
            <button
              onClick={() => setCaps((c) => !c)}
              className={`flex h-14 items-center justify-center rounded-xl px-3 text-2xl font-bold shadow active:scale-90 ${
                caps ? "bg-violet-500 text-white" : "bg-slate-300 text-slate-700"
              }`}
            >
              ⇧
            </button>
          )}
          {row.map((ch) => (
            <button
              key={ch}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey(caps ? ch.toUpperCase() : ch)}
              className={Key}
            >
              {caps ? ch.toUpperCase() : ch}
            </button>
          ))}
          {i === 2 && (
            <button
              onClick={onBackspace}
              className="flex h-14 items-center justify-center rounded-xl bg-slate-300 px-3 text-2xl font-bold text-slate-700 shadow active:scale-90"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
      <div className="flex justify-center gap-1.5">
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey(" ")}
          className="flex h-14 flex-1 items-center justify-center rounded-xl bg-white font-display text-xl font-bold text-slate-500 shadow active:scale-95"
        >
          space
        </button>
        <button
          onClick={onDone}
          className="flex h-14 items-center justify-center rounded-xl bg-emerald-500 px-6 font-display text-xl font-bold text-white shadow active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  );
}
