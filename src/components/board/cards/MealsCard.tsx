"use client";

import { format, isToday, parseISO } from "date-fns";
import type { BoardState } from "@/lib/types";
import { useDragScroll } from "../useDragScroll";

export function MealsCard({ state }: { state: BoardState }) {
  const drag = useDragScroll();
  const tonight = state.meals.find((m) => isToday(parseISO(m.date)));
  const upcoming = state.meals.filter((m) => !isToday(parseISO(m.date))).slice(0, 4);

  return (
    <div className="flex h-full flex-col">
      {tonight ? (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-100/80 px-3 py-2.5">
          <span className="text-3xl">{tonight.emoji}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Tonight</p>
            <p className="truncate font-display text-xl font-bold text-slate-800">{tonight.title}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-white/50 px-3 py-2.5 font-display text-base font-bold text-slate-400">
          Tonight&apos;s dinner: surprise! 🤷
        </p>
      )}
      <div className="mt-2 min-h-0 flex-1 space-y-1 board-scroll" {...drag}>
        {upcoming.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-1.5">
            <span className="w-10 text-xs font-bold uppercase text-slate-400">
              {format(parseISO(m.date), "EEE")}
            </span>
            <span className="text-lg">{m.emoji}</span>
            <span className="truncate text-sm font-bold text-slate-700">{m.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
