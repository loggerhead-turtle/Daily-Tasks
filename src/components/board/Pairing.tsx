"use client";

import { useState } from "react";
import { setBoardToken } from "./useBoard";
import { Blobs } from "./bits";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

export function Pairing({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/board/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pairing failed");
      setBoardToken(data.token);
      onPaired();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    const next = (code + k).slice(0, 8);
    setCode(next);
  }

  return (
    <main className="kiosk relative flex h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 p-8">
      <Blobs />
      <div className="relative text-center">
        <div className="text-7xl">🏠</div>
        <h1 className="mt-2 font-display text-5xl font-bold text-slate-800">Let&apos;s pair this board!</h1>
        <p className="mt-2 text-xl font-bold text-slate-500">
          A parent generates a code at <span className="text-violet-600">Settings → Pair the kitchen board</span>
        </p>
      </div>

      <div className="relative flex gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex h-20 w-16 items-center justify-center rounded-2xl bg-white/80 font-mono text-4xl font-bold text-slate-800 shadow-md backdrop-blur"
          >
            {code[i] ?? ""}
          </div>
        ))}
      </div>
      {error && <p className="relative font-display text-xl font-bold text-rose-500">{error}</p>}

      <div className="relative grid max-w-3xl grid-cols-11 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="h-16 w-16 rounded-2xl bg-white/80 font-display text-2xl font-bold text-slate-700 shadow-sm backdrop-blur transition active:scale-90 active:bg-violet-100"
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => setCode(code.slice(0, -1))}
          className="col-span-2 h-16 rounded-2xl bg-white/80 font-display text-2xl font-bold text-slate-500 shadow-sm backdrop-blur transition active:scale-90"
        >
          ⌫
        </button>
      </div>

      <button
        onClick={() => submit(code)}
        disabled={code.length < 6 || busy}
        className="relative rounded-full bg-violet-600 px-12 py-4 font-display text-3xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40"
      >
        {busy ? "Pairing…" : "Pair"}
      </button>
    </main>
  );
}
