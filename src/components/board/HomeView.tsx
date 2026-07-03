"use client";

import { format, isToday, parseISO } from "date-fns";
import { motion } from "framer-motion";
import type { BoardState, CalendarEvent, Member } from "@/lib/types";
import { AnnouncementBar, BigAvatar, Clock, WeatherWidget } from "./bits";

type KidStats = { done: number; total: number };

function kidStats(state: BoardState, kid: Member): KidStats {
  const mine = state.chores.filter((c) => c.member_id === kid.id);
  return {
    done: mine.filter((c) => c.status === "approved" || c.status === "pending").length,
    total: mine.length,
  };
}

function ProgressRing({ done, total, color }: { done: number; total: number; color: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return (
    <svg className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] -rotate-90" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="7" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function HomeView({
  state,
  todayEvents,
  onOpenCalendar,
  onOpenKid,
}: {
  state: BoardState;
  todayEvents: CalendarEvent[];
  onOpenCalendar: () => void;
  onOpenKid: (memberId: string) => void;
}) {
  const kids = state.members.filter((m) => m.role === "child");
  const todayMeal = state.meals.find((m) => isToday(parseISO(m.date)));
  const upcoming = todayEvents
    .filter((e) => e.allDay || parseISO(e.end).getTime() > Date.now())
    .slice(0, 5);

  return (
    <div className="relative flex h-full flex-col gap-5 p-8">
      <header className="flex items-start justify-between">
        <Clock />
        <div className="mx-6 flex-1 self-center">
          <AnnouncementBar state={state} />
        </div>
        <WeatherWidget weather={state.weather} />
      </header>

      <div className="flex min-h-0 flex-1 gap-5">
        {/* Today's schedule */}
        <motion.button
          layout
          onClick={onOpenCalendar}
          className="flex w-[44%] flex-col rounded-[2rem] bg-white/70 p-6 text-left shadow-lg backdrop-blur transition active:scale-[0.98]"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-3xl font-bold text-slate-800">📅 Today</h2>
            <span className="rounded-full bg-violet-100 px-4 py-1.5 font-display text-lg font-bold text-violet-700">
              See the week →
            </span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-hidden">
            {upcoming.length === 0 && (
              <p className="mt-6 text-center font-display text-2xl font-bold text-slate-400">
                Nothing scheduled — free day! 🎈
              </p>
            )}
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                <span className="h-12 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-bold text-slate-800">{e.title}</p>
                  <p className="text-sm font-bold text-slate-500">
                    {e.allDay ? "All day" : `${format(parseISO(e.start), "h:mm a")} – ${format(parseISO(e.end), "h:mm a")}`}
                    {" · "}
                    {e.calendarLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {todayMeal && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-100/80 px-4 py-3">
              <span className="text-3xl">{todayMeal.emoji}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Tonight&apos;s dinner</p>
                <p className="font-display text-xl font-bold text-slate-800">{todayMeal.title}</p>
              </div>
            </div>
          )}
        </motion.button>

        {/* Kids & chores */}
        <div className="flex flex-1 flex-col rounded-[2rem] bg-white/70 p-6 shadow-lg backdrop-blur">
          <h2 className="mb-4 font-display text-3xl font-bold text-slate-800">⭐ Tap your face for your jobs!</h2>
          <div className="grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-6 xl:grid-cols-3">
            {kids.map((kid, i) => {
              const stats = kidStats(state, kid);
              const allDone = stats.total > 0 && stats.done === stats.total;
              return (
                <motion.button
                  key={kid.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => onOpenKid(kid.id)}
                  className="flex flex-col items-center gap-2 transition active:scale-95"
                >
                  <span className="relative">
                    <ProgressRing done={stats.done} total={stats.total} color={kid.color} />
                    <BigAvatar member={kid} size={110} />
                    {allDone && (
                      <span className="absolute -right-1 -top-1 animate-pop rounded-full bg-emerald-500 px-2 py-1 text-lg shadow">
                        🎉
                      </span>
                    )}
                  </span>
                  <span className="font-display text-2xl font-bold text-slate-800">{kid.name}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 font-display text-base font-bold text-amber-700">
                    ⭐ {kid.balance}
                  </span>
                  <span className="text-sm font-bold text-slate-500">
                    {stats.total === 0 ? "No jobs today" : `${stats.done}/${stats.total} jobs done`}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
