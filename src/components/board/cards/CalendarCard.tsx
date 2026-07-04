"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { motion } from "framer-motion";
import type { BoardState, CalendarEvent } from "@/lib/types";
import { useEvents } from "../useBoard";

type Mode = "day" | "week" | "month";

function eventDay(e: CalendarEvent): Date {
  return e.allDay ? parseISO(e.start + "T00:00:00") : parseISO(e.start);
}

// The center-stage calendar card. Tap Day / Week / Month to switch views;
// the person picker in the top bar filters which events show.
export function CalendarCard({
  state,
  selected,
}: {
  state: BoardState;
  selected: "all" | string;
}) {
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const range = useMemo(() => {
    if (mode === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (mode === "week")
      return { from: startOfWeek(anchor, { weekStartsOn: 0 }), to: addDays(startOfWeek(anchor, { weekStartsOn: 0 }), 7) };
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 }),
      to: addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }), 1),
    };
  }, [mode, anchor]);

  const { events, issues } = useEvents(range.from.toISOString(), range.to.toISOString(), true);
  const visible = events.filter((e) => selected === "all" || e.memberId === selected);

  function shift(dir: 1 | -1) {
    setAnchor((a) => (mode === "day" ? addDays(a, dir) : mode === "week" ? addWeeks(a, dir) : addMonths(a, dir)));
  }

  const title =
    mode === "day"
      ? isToday(anchor)
        ? "Today"
        : format(anchor, "EEE, MMM d")
      : mode === "week"
        ? `Week of ${format(startOfWeek(anchor, { weekStartsOn: 0 }), "MMM d")}`
        : format(anchor, "MMMM yyyy");

  const onToday = isToday(anchor);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => shift(-1)}
          className="rounded-full bg-white/80 px-4 py-1.5 font-display text-lg font-bold text-slate-600 shadow-sm transition active:scale-90"
        >
          ←
        </button>
        <button
          onClick={() => setAnchor(startOfDay(new Date()))}
          className={`min-w-0 truncate rounded-full px-4 py-1.5 font-display text-lg font-bold shadow-sm transition active:scale-95 ${
            onToday ? "bg-white/60 text-slate-700" : "bg-violet-600 text-white"
          }`}
        >
          {title}
        </button>
        <button
          onClick={() => shift(1)}
          className="rounded-full bg-white/80 px-4 py-1.5 font-display text-lg font-bold text-slate-600 shadow-sm transition active:scale-90"
        >
          →
        </button>
        <div className="ml-auto flex gap-1 rounded-full bg-white/60 p-1 shadow-sm">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 font-display text-base font-bold capitalize transition ${
                mode === m ? "bg-violet-600 text-white shadow" : "text-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mb-2 rounded-2xl bg-amber-100/90 px-4 py-2 font-display text-sm font-bold text-amber-800 shadow-sm">
          ⚠️ {issues[0]}
        </div>
      )}

      {mode === "day" && <DayView events={visible.filter((e) => isSameDay(eventDay(e), anchor))} />}
      {mode === "week" && (
        <WeekView
          weekStart={startOfWeek(anchor, { weekStartsOn: 0 })}
          events={visible}
          onPickDay={(d) => {
            setAnchor(d);
            setMode("day");
          }}
        />
      )}
      {mode === "month" && (
        <MonthView
          anchor={anchor}
          from={range.from}
          to={range.to}
          events={visible}
          onPickDay={(d) => {
            setAnchor(d);
            setMode("day");
          }}
        />
      )}
    </div>
  );
}

function DayView({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="min-h-0 flex-1 space-y-2 board-scroll">
      {events.length === 0 && (
        <p className="mt-8 text-center font-display text-2xl font-bold text-slate-400">
          Nothing scheduled — free day! 🎈
        </p>
      )}
      {events.map((e) => (
        <motion.div
          key={e.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl bg-white/85 px-4 py-3 shadow-sm"
        >
          <span className="h-11 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-bold text-slate-800">{e.title}</p>
            <p className="text-sm font-bold text-slate-500">
              {e.allDay
                ? "All day"
                : `${format(parseISO(e.start), "h:mm a")} – ${format(parseISO(e.end), "h:mm a")}`}
              {" · "}
              {e.calendarLabel}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WeekView({
  weekStart,
  events,
  onPickDay,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5">
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(eventDay(e), day));
        const today = isToday(day);
        return (
          <button
            key={day.toISOString()}
            onClick={() => onPickDay(day)}
            className={`flex min-h-0 flex-col rounded-2xl p-1.5 text-left shadow-sm transition active:scale-[0.97] ${
              today ? "bg-violet-600/90" : "bg-white/70"
            }`}
          >
            <div className={`mb-1 text-center ${today ? "text-white" : "text-slate-500"}`}>
              <div className="text-[11px] font-bold uppercase">{format(day, "EEE")}</div>
              <div className="font-display text-xl font-bold leading-none">{format(day, "d")}</div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 board-scroll">
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg px-1.5 py-1 text-white shadow-sm"
                  style={{ backgroundColor: e.color }}
                >
                  <p className="truncate text-[11px] font-bold leading-tight">{e.title}</p>
                  {!e.allDay && (
                    <p className="text-[10px] font-semibold opacity-90">{format(parseISO(e.start), "h:mm a")}</p>
                  )}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  anchor,
  from,
  to,
  events,
  onPickDay,
}: {
  anchor: Date;
  from: Date;
  to: Date;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
}) {
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 pb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-bold uppercase text-slate-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(eventDay(e), day));
          const today = isToday(day);
          const inMonth = isSameMonth(day, anchor);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onPickDay(day)}
              className={`flex min-h-0 flex-col items-center rounded-xl p-1 transition active:scale-95 ${
                today ? "bg-violet-600/90" : inMonth ? "bg-white/70" : "bg-white/30"
              }`}
            >
              <span
                className={`font-display text-base font-bold leading-tight ${
                  today ? "text-white" : inMonth ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {format(day, "d")}
              </span>
              <span className="flex flex-wrap items-center justify-center gap-0.5">
                {dayEvents.slice(0, 4).map((e) => (
                  <span key={e.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                ))}
                {dayEvents.length > 4 && (
                  <span className={`text-[10px] font-bold ${today ? "text-white" : "text-slate-500"}`}>
                    +{dayEvents.length - 4}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
