"use client";

import type { BoardState } from "@/lib/types";

export function AnnouncementsCard({ state }: { state: BoardState }) {
  return (
    <div className="flex h-full min-h-0 flex-col space-y-1.5 board-scroll">
      {state.announcements.length === 0 && (
        <p className="rounded-2xl bg-white/50 px-3 py-2.5 font-display text-base font-bold text-slate-400">
          No news today 😌
        </p>
      )}
      {state.announcements.map((a) => (
        <div key={a.id} className="flex items-start gap-2 rounded-2xl bg-white/70 px-3 py-2">
          <span className="text-xl">{a.emoji}</span>
          <span className="font-display text-base font-bold leading-snug text-slate-700">{a.message}</span>
        </div>
      ))}
    </div>
  );
}
