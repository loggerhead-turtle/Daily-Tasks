"use client";

import { useEffect } from "react";

// The board is an unattended wall display, so a render crash must never leave a
// blank white screen. Show a friendly message, surface the error for debugging,
// and auto-reload once (which also recovers from a stale JS bundle after a
// deploy). A short guard stops a genuinely broken build from reload-looping.
export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const KEY = "board_error_last_reload";
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      const t = setTimeout(() => {
        reset();
        window.location.reload();
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [reset]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 p-8 text-center">
      <span className="text-7xl">🛠️</span>
      <h1 className="font-display text-4xl font-bold text-slate-800">One sec — refreshing the board…</h1>
      <p className="max-w-lg font-bold text-slate-500">
        Something hiccuped. The board will reload itself in a moment.
      </p>
      <button
        onClick={() => {
          reset();
          window.location.reload();
        }}
        className="rounded-full bg-violet-600 px-8 py-4 font-display text-2xl font-bold text-white shadow-lg transition active:scale-95"
      >
        🔄 Reload now
      </button>
      {error?.message && (
        <p className="mt-2 max-w-lg break-words font-mono text-xs text-slate-400">{error.message}</p>
      )}
    </main>
  );
}
