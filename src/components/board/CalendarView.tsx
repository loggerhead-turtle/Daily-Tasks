"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns";
import { motion } from "framer-motion";
import type { BoardState, CalendarEvent } from "@/lib/types";
import { useEvents } from "./useBoard";
import { BackButton, BigAvatar } from "./bits";

// Week calendar with a photo-based person picker a four-year-old can drive:
// tap a face to see just that person's week, tap the rainbow circle for all.
export function CalendarView({ state, onHome }: { state: BoardState; onHome: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | "all">("all");

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 }),
    [weekOffset]
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = useMemo(() => weekStart.toISOString(), [weekStart]);
  const to = useMemo(() => addDays(weekStart, 7).toISOString(), [weekStart]);

  const { events, loading } = useEvents(from, to, true);

  const visible = events.filter((e) => selected === "all" || e.memberId === selected);
  const eventsFor = (day: Date): CalendarEvent[] =>
    visible.filter((e) => {
      const start = e.allDay ? parseISO(e.start + "T00:00:00") : parseISO(e.start);
      return isSameDay(start, day);
    });

  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <BackButton onClick={onHome} />
        <h1 className="font-display text-4xl font-bold text-slate-800">
          {weekOffset === 0 ? "This week" : format(weekStart, "MMM d")}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-full bg-white/80 px-6 py-3 font-display text-2xl font-bold text-slate-600 shadow-md transition active:scale-90"
          >
            ←
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-full bg-violet-600 px-5 py-3 font-display text-xl font-bold text-white shadow-md transition active:scale-95"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-full bg-white/80 px-6 py-3 font-display text-2xl font-bold text-slate-600 shadow-md transition active:scale-90"
          >
            →
          </button>
        </div>
      </header>

      {/* Person picker */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelected("all")}
          className="flex shrink-0 flex-col items-center gap-1 transition active:scale-95"
        >
          <span
            className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 bg-gradient-to-br from-pink-300 via-amber-200 to-sky-300 text-4xl shadow-lg ${
              selected === "all" ? "scale-105 border-white ring-4 ring-violet-400" : "border-white/70"
            }`}
          >
            👨‍👩‍👧‍👦
          </span>
          <span className="font-display text-lg font-bold text-slate-700">Everyone</span>
        </button>
        {state.members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className="flex shrink-0 flex-col items-center gap-1 transition active:scale-95"
          >
            <BigAvatar member={m} size={76} selected={selected === m.id} />
            <span className="font-display text-lg font-bold text-slate-700">{m.name}</span>
          </button>
        ))}
      </div>

      {/* Week grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-2.5">
        {days.map((day) => {
          const dayEvents = eventsFor(day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-0 flex-col rounded-3xl p-2.5 shadow-md backdrop-blur ${
                today ? "bg-violet-600/90" : "bg-white/70"
              }`}
            >
              <div className={`mb-2 text-center ${today ? "text-white" : "text-slate-500"}`}>
                <div className="text-sm font-bold uppercase tracking-wide">{format(day, "EEE")}</div>
                <div className="font-display text-3xl font-bold">{format(day, "d")}</div>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
                {dayEvents.map((e) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl px-2 py-1.5 text-white shadow-sm"
                    style={{ backgroundColor: e.color }}
                  >
                    <p className="text-[13px] font-bold leading-tight">{e.title}</p>
                    {!e.allDay && (
                      <p className="text-[11px] font-semibold opacity-90">{format(parseISO(e.start), "h:mm a")}</p>
                    )}
                  </motion.div>
                ))}
                {dayEvents.length === 0 && !loading && (
                  <p className={`pt-3 text-center text-2xl ${today ? "opacity-60" : "opacity-30"}`}>·</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && !loading && (
        <p className="text-center font-display text-lg font-bold text-slate-400">
          No calendars connected yet — a parent can link Google Calendars from the website.
        </p>
      )}
    </div>
  );
}
