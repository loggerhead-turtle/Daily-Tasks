"use client";

import { useRef, useState } from "react";
import { setBoardToken } from "./useBoard";
import { Blobs } from "./bits";

const KEYS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".split("");

// First-boot screen: enter the code a parent generated in Settings.
// A real <input> so phones/laptops can type with their native keyboard,
// plus an on-screen keypad for the Pi's touchscreen (which has neither).
export function Pairing({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

  async function submit() {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/board/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
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

  return (
    <main className="kiosk relative flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 p-6">
      <Blobs />
      <div className="relative text-center">
        <div className="text-6xl">🏠</div>
        <h1 className="mt-2 font-display text-4xl font-bold text-slate-800 md:text-5xl">
          Let&apos;s pair this board!
        </h1>
        <p className="mt-2 text-lg font-bold text-slate-500 md:text-xl">
          A parent generates a 6-letter code at{" "}
          <span className="text-violet-600">Settings → Pair the kitchen board</span>
        </p>
      </div>

      <input
        ref={inputRef}
        value={code}
        onChange={(e) => setCode(clean(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="······"
        aria-label="Pairing code"
        className="relative w-72 rounded-2xl border-4 border-white bg-white/80 py-4 text-center font-mono text-4xl font-bold tracking-[0.35em] text-slate-800 shadow-lg outline-none backdrop-blur placeholder:text-slate-300 focus:border-violet-400 md:w-96"
      />
      {error && <p className="relative font-display text-xl font-bold text-rose-500">{error}</p>}

      {/* On-screen keypad for the Pi's touchscreen */}
      <div className="relative flex max-w-2xl flex-wrap justify-center gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => {
              setCode((c) => clean(c + k));
              inputRef.current?.blur();
            }}
            className="h-12 w-12 rounded-xl bg-white/80 font-display text-xl font-bold text-slate-700 shadow-sm backdrop-blur transition active:scale-90 active:bg-violet-100 md:h-14 md:w-14 md:text-2xl"
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => setCode((c) => c.slice(0, -1))}
          className="h-12 w-20 rounded-xl bg-white/80 font-display text-xl font-bold text-slate-500 shadow-sm backdrop-blur transition active:scale-90 md:h-14 md:w-24 md:text-2xl"
        >
          ⌫
        </button>
      </div>

      <button
        onClick={submit}
        disabled={code.length < 6 || busy}
        className="relative rounded-full bg-violet-600 px-12 py-4 font-display text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40 md:text-3xl"
      >
        {busy ? "Pairing…" : "Pair"}
      </button>
    </main>
  );
}
