"use client";

// Keep the parent app from ever dropping to a blank white screen: on a render
// error, show a message and a way to recover instead of nothing.
export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">🛠️</span>
      <h1 className="font-display text-2xl font-bold text-slate-800">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-500">
        Try again — if it keeps happening, sign out and back in.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-xl bg-violet-600 px-5 py-2.5 font-bold text-white shadow transition active:scale-95"
      >
        Try again
      </button>
      {error?.message && (
        <p className="mt-1 max-w-md break-words font-mono text-xs text-slate-400">{error.message}</p>
      )}
    </div>
  );
}
