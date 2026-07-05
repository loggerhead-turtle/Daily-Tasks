"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { BoardState, ChoreInstance, Member } from "@/lib/types";
import { MAX_SCALE, MIN_SCALE, SCALE_STEP } from "@/lib/boardLayout";
import { boardFetch } from "./useBoard";
import { useDragScroll } from "./useDragScroll";
import { BigAvatar, Clock, RewardTag, weatherEmoji } from "./bits";
import { CalendarCard } from "./cards/CalendarCard";
import { MealsCard } from "./cards/MealsCard";
import { AnnouncementsCard } from "./cards/AnnouncementsCard";
import { BountyView } from "./BountyView";

type Page = "chores" | "calendar" | "bounty" | "dinner" | "news" | "forecast";

const NAV: { id: Page; label: string; emoji: string }[] = [
  { id: "chores", label: "Jobs", emoji: "✅" },
  { id: "calendar", label: "Calendar", emoji: "📅" },
  { id: "bounty", label: "Bounty", emoji: "💰" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "news", label: "News", emoji: "📣" },
];

// The board home is a set of full-screen pages selected from a top nav bar,
// instead of one crowded grid. Each section (jobs, calendar, dinner, news,
// bounty, weather forecast) gets its own roomy page.
export function Dashboard({
  state,
  refresh,
  scale,
  setScale,
}: {
  state: BoardState;
  refresh: () => void;
  scale: number;
  setScale: (n: number) => void;
}) {
  const [page, setPage] = useState<Page>("chores");
  const navScroll = useDragScroll("x");
  const w = state.weather;
  // Show a moon at night when the sky is clear/mostly clear.
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 6;
  const skyIcon = w && night && w.code <= 2 ? "🌙" : w ? weatherEmoji(w.code) : "";

  return (
    <div className="relative flex h-full flex-col gap-3 p-5">
      {/* Top nav */}
      <header className="flex items-center gap-4">
        <Clock compact />
        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto no-scrollbar"
          {...navScroll}
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-3 font-display text-xl font-bold shadow transition active:scale-95 ${
                page === n.id
                  ? "bg-violet-600 text-white"
                  : "bg-white/70 text-slate-600 backdrop-blur"
              }`}
            >
              <span>{n.emoji}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        {/* Small weather chip — opens the forecast */}
        {w && (
          <button
            onClick={() => setPage("forecast")}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 shadow backdrop-blur transition active:scale-95 ${
              page === "forecast" ? "bg-violet-600 text-white" : "bg-white/70 text-slate-700"
            }`}
          >
            <span className="text-3xl">{skyIcon}</span>
            <span className="font-display text-2xl font-bold">{w.temp}°</span>
          </button>
        )}
      </header>

      {/* Page body */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex flex-col"
          >
            {page === "chores" && <ChoresColumns state={state} refresh={refresh} />}
            {page === "calendar" && <CalendarPage state={state} />}
            {page === "bounty" && (
              <BountyView state={state} refresh={refresh} onHome={() => setPage("chores")} />
            )}
            {page === "dinner" && (
              <PageShell title="🍽️ Dinner">
                <MealsCard state={state} />
              </PageShell>
            )}
            {page === "news" && (
              <PageShell title="📣 News">
                <AnnouncementsCard state={state} />
              </PageShell>
            )}
            {page === "forecast" && <ForecastPage state={state} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Always-on text-size control (no PIN) */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 opacity-80 shadow-lg backdrop-blur transition hover:opacity-100">
        <span className="px-1 font-display text-base font-bold text-slate-500">Size</span>
        <button
          onClick={() => setScale(scale - SCALE_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Smaller"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white font-display text-xl font-bold text-slate-700 shadow transition active:scale-90 disabled:opacity-40"
        >
          A−
        </button>
        <span className="min-w-[3rem] text-center font-display text-base font-bold text-slate-700">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(scale + SCALE_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Bigger"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white font-display text-2xl font-bold text-slate-700 shadow transition active:scale-90 disabled:opacity-40"
        >
          A+
        </button>
      </div>
    </div>
  );
}

// A plain full-page wrapper with a heading and a scrollable body.
function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const drag = useDragScroll();
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] bg-white/60 p-6 shadow-lg backdrop-blur">
      <h2 className="mb-3 font-display text-3xl font-bold text-slate-800">{title}</h2>
      <div className="min-h-0 flex-1 board-scroll" {...drag}>
        {children}
      </div>
    </div>
  );
}

// ── Jobs: one column per child, showing their chores ────────────────────────
function ChoresColumns({ state, refresh }: { state: BoardState; refresh: () => void }) {
  const drag = useDragScroll("x");
  const kids = state.members.filter((m) => m.role === "child");
  const withChores = kids
    .map((kid) => ({ kid, chores: state.chores.filter((c) => c.member_id === kid.id) }))
    .filter((c) => c.chores.length > 0);

  if (withChores.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-display text-3xl font-bold text-slate-400">
          No jobs assigned today — enjoy! 🎈
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto board-scroll" {...drag}>
      {withChores.map(({ kid, chores }) => {
        const done = chores.filter((c) => c.status === "pending" || c.status === "approved").length;
        return (
          <div
            key={kid.id}
            className="flex h-full w-72 shrink-0 flex-col rounded-[1.75rem] bg-white/60 p-4 shadow-lg backdrop-blur"
          >
            <div className="mb-3 flex items-center gap-3">
              <BigAvatar member={kid} size={56} />
              <div>
                <p className="font-display text-2xl font-bold text-slate-800">{kid.name}</p>
                <p className="text-sm font-bold text-slate-400">
                  {done}/{chores.length} done
                </p>
              </div>
            </div>
            <ChoreList kid={kid} chores={chores} refresh={refresh} />
          </div>
        );
      })}
    </div>
  );
}

function ChoreList({
  kid,
  chores,
  refresh,
}: {
  kid: Member;
  chores: ChoreInstance[];
  refresh: () => void;
}) {
  const drag = useDragScroll();
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(ci: ChoreInstance) {
    setBusy(ci.id);
    const res = await boardFetch("/api/board/chore/complete", {
      method: "POST",
      body: JSON.stringify({ instanceId: ci.id, memberId: kid.id }),
    });
    setBusy(null);
    if (res.ok) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.7 },
        colors: [kid.color, "#fbbf24", "#34d399", "#f472b6"],
      });
    }
    refresh();
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 board-scroll" {...drag}>
      {chores.map((ci) => {
        const c = ci.chore!;
        const doneish = ci.status === "pending" || ci.status === "approved";
        return (
          <button
            key={ci.id}
            disabled={doneish || busy === ci.id}
            onClick={() => complete(ci)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left shadow-sm transition active:scale-[0.97] ${
              ci.status === "approved"
                ? "bg-emerald-100/90"
                : ci.status === "pending"
                  ? "bg-sky-100/90"
                  : "bg-white/90"
            }`}
          >
            <span className="text-3xl">{c.emoji}</span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate font-display text-lg font-bold ${
                  doneish ? "text-slate-500" : "text-slate-800"
                }`}
              >
                {c.title}
              </span>
              <span className="text-xs">
                <RewardTag points={c.points} cents={c.cents} />
              </span>
            </span>
            {ci.status === "approved" ? (
              <span className="text-2xl">✅</span>
            ) : ci.status === "pending" ? (
              <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs font-bold text-sky-800">
                🕐 👍?
              </span>
            ) : (
              <span className="rounded-full border-[3px] border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-400">
                Tap!
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Calendar page: person selector + big day/week/month ─────────────────────
function CalendarPage({ state }: { state: BoardState }) {
  const [selected, setSelected] = useState<"all" | string>("all");
  const picker = useDragScroll("x");
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] bg-white/60 p-5 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center gap-3 overflow-x-auto no-scrollbar" {...picker}>
        <button
          onClick={() => setSelected("all")}
          className="flex shrink-0 flex-col items-center transition active:scale-95"
        >
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full border-4 bg-gradient-to-br from-pink-300 via-amber-200 to-sky-300 text-2xl shadow ${
              selected === "all" ? "border-white ring-4 ring-violet-400" : "border-white/70"
            }`}
          >
            👨‍👩‍👧‍👦
          </span>
          <span className="mt-0.5 font-display text-sm font-bold text-slate-700">Everyone</span>
        </button>
        {state.members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(selected === m.id ? "all" : m.id)}
            className="flex shrink-0 flex-col items-center transition active:scale-95"
          >
            <BigAvatar member={m} size={56} selected={selected === m.id} />
            <span className="mt-0.5 font-display text-sm font-bold text-slate-700">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <CalendarCard state={state} selected={selected} />
      </div>
    </div>
  );
}

// ── Forecast page ───────────────────────────────────────────────────────────
function ForecastPage({ state }: { state: BoardState }) {
  const w = state.weather;
  const drag = useDragScroll();
  if (!w) {
    return (
      <PageShell title="🌤️ Weather">
        <p className="font-display text-2xl font-bold text-slate-400">
          Set your location in Settings to see the forecast.
        </p>
      </PageShell>
    );
  }
  const days = w.daily ?? [];
  const dayName = (iso: string, i: number) =>
    i === 0
      ? "Today"
      : new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] bg-white/60 p-6 shadow-lg backdrop-blur">
      <div className="mb-4 flex items-center gap-4">
        <span className="text-7xl">{weatherEmoji(w.code)}</span>
        <div>
          <p className="font-display text-6xl font-bold leading-none text-slate-800">{w.temp}°</p>
          <p className="mt-1 font-bold text-slate-500">
            {w.location ? `${w.location} · ` : ""}H {w.hi}° · L {w.lo}°
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 board-scroll" {...drag}>
        {days.map((d, i) => (
          <div
            key={d.date}
            className="flex items-center gap-4 rounded-2xl bg-white/70 px-5 py-3 shadow-sm"
          >
            <span className="w-36 font-display text-xl font-bold text-slate-700">
              {dayName(d.date, i)}
            </span>
            <span className="text-4xl">{weatherEmoji(d.code)}</span>
            <span className="ml-auto font-display text-2xl font-bold text-slate-800">
              {d.hi}° <span className="text-slate-400">/ {d.lo}°</span>
            </span>
          </div>
        ))}
        {days.length === 0 && (
          <p className="font-display text-xl font-bold text-slate-400">Forecast unavailable.</p>
        )}
      </div>
    </div>
  );
}
