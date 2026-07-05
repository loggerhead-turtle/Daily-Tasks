"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import type { BoardState, CalendarEvent, ChoreInstance, Member } from "@/lib/types";
import { MAX_SCALE, MIN_SCALE, SCALE_STEP } from "@/lib/boardLayout";
import { boardFetch, useEvents } from "./useBoard";
import { useDragScroll } from "./useDragScroll";
import { BigAvatar, Clock, RewardTag, weatherEmoji } from "./bits";
import { CalendarCard } from "./cards/CalendarCard";
import { MealsCard } from "./cards/MealsCard";
import { AnnouncementsCard } from "./cards/AnnouncementsCard";
import { BountyView } from "./BountyView";

type Page = "chores" | "calendar" | "bounty" | "earnings" | "dinner" | "news" | "forecast";
type Selected = "all" | string;

const NAV: { id: Page; label: string; emoji: string }[] = [
  { id: "chores", label: "Jobs", emoji: "✅" },
  { id: "calendar", label: "Calendar", emoji: "📅" },
  { id: "earnings", label: "Money", emoji: "💵" },
  { id: "bounty", label: "Bounty", emoji: "💰" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "news", label: "News", emoji: "📣" },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const eventDay = (e: CalendarEvent): Date =>
  e.allDay ? parseISO(e.start + "T00:00:00") : parseISO(e.start);

// The board home: a top nav of full-screen pages, a persistent family-member
// selector underneath, and a page body that reacts to who's selected.
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
  const [selected, setSelected] = useState<Selected>("all");
  const navScroll = useDragScroll("x");
  const w = state.weather;
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 6;
  const skyIcon = w && night && w.code <= 2 ? "🌙" : w ? weatherEmoji(w.code) : "";

  return (
    <div className="relative flex h-full flex-col gap-3 p-5">
      {/* Row 1: page nav */}
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
                page === n.id ? "bg-violet-600 text-white" : "bg-white/70 text-slate-600 backdrop-blur"
              }`}
            >
              <span>{n.emoji}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
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

      {/* Row 2: family-member selector */}
      <PeopleRow members={state.members} selected={selected} setSelected={setSelected} />

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
            {page === "chores" && (
              <ChoresColumns state={state} refresh={refresh} selected={selected} />
            )}
            {page === "calendar" && <CalendarPage state={state} selected={selected} />}
            {page === "earnings" && <EarningsBoard state={state} selected={selected} />}
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

function PeopleRow({
  members,
  selected,
  setSelected,
}: {
  members: BoardState["members"];
  selected: Selected;
  setSelected: (s: Selected) => void;
}) {
  const drag = useDragScroll("x");
  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar" {...drag}>
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
      {members.map((m) => (
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
  );
}

// A plain full-page wrapper with a heading and scrollable body.
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

// ── Jobs: one column per child ──────────────────────────────────────────────
function ChoresColumns({
  state,
  refresh,
  selected,
}: {
  state: BoardState;
  refresh: () => void;
  selected: Selected;
}) {
  const drag = useDragScroll("x");
  const kids = state.members.filter((m) => m.role === "child");
  const shown = selected === "all" ? kids : kids.filter((k) => k.id === selected);

  if (shown.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-display text-3xl font-bold text-slate-400">No kids to show.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto board-scroll" {...drag}>
      {shown.map((kid) => {
        const chores = state.chores.filter((c) => c.member_id === kid.id);
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

  if (chores.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="font-display text-lg font-bold text-slate-400">No jobs today 🎈</p>
      </div>
    );
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

// ── Calendar: agenda (left, smaller) + day/week/month (right, bigger) ───────
function CalendarPage({ state, selected }: { state: BoardState; selected: Selected }) {
  return (
    <div className="flex h-full gap-4">
      <div className="w-72 shrink-0 rounded-[1.75rem] bg-white/60 p-4 shadow-lg backdrop-blur">
        <Agenda selected={selected} />
      </div>
      <div className="min-h-0 flex-1 rounded-[1.75rem] bg-white/60 p-5 shadow-lg backdrop-blur">
        <CalendarCard state={state} selected={selected} />
      </div>
    </div>
  );
}

// Google-style agenda: upcoming week, events listed under each day.
function Agenda({ selected }: { selected: Selected }) {
  const drag = useDragScroll();
  const AGENDA_DAYS = 28; // 4 weeks
  const from = startOfDay(new Date());
  const to = addDays(from, AGENDA_DAYS + 1);
  const { events, loading } = useEvents(from.toISOString(), to.toISOString(), true);
  const visible = events.filter((e) => selected === "all" || e.memberId === selected);
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(from, i));

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 font-display text-2xl font-bold text-slate-800">Agenda</h2>
      <div className="min-h-0 flex-1 space-y-3 board-scroll" {...drag}>
        {loading && visible.length === 0 && (
          <p className="font-bold text-slate-400">Loading…</p>
        )}
        {days.map((day) => {
          const dayEvents = visible
            .filter((e) => isSameDay(eventDay(e), day))
            .sort((a, b) => a.start.localeCompare(b.start));
          if (dayEvents.length === 0) return null;
          return (
            <div key={day.toISOString()}>
              <p className="mb-1 font-display text-sm font-bold uppercase tracking-wide text-violet-600">
                {isSameDay(day, from) ? "Today" : format(day, "EEE, MMM d")}
              </p>
              <div className="space-y-1.5">
                {dayEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2 shadow-sm">
                    <span
                      className="mt-1 h-4 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-slate-800">{e.title}</p>
                      <p className="text-[11px] font-bold text-slate-500">
                        {e.allDay ? "All day" : format(parseISO(e.start), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!loading && visible.length === 0 && (
          <p className="font-display font-bold text-slate-400">Nothing coming up 🎈</p>
        )}
      </div>
    </div>
  );
}

// ── Earnings page: pick a child (top selector) to see their money ───────────
function EarningsBoard({ state, selected }: { state: BoardState; selected: Selected }) {
  const drag = useDragScroll();
  const kids = state.members.filter((m) => m.role === "child");
  const kid = kids.find((k) => k.id === selected) ?? null;

  if (!kid) {
    // Everyone (or a parent selected): show every child's balance.
    return (
      <div className="flex h-full flex-col rounded-[1.75rem] bg-white/60 p-6 shadow-lg backdrop-blur">
        <h2 className="mb-3 font-display text-3xl font-bold text-slate-800">💵 Money</h2>
        <p className="mb-4 font-bold text-slate-400">Tap a child above to see their history.</p>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 board-scroll" {...drag}>
          {kids.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 shadow-sm">
              <BigAvatar member={k} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold text-slate-800">{k.name}</p>
                <p className="text-xs font-bold text-slate-400">Earned {money(k.earnedCents)}</p>
              </div>
              <p className="font-display text-2xl font-bold text-emerald-600">{money(k.earningsCents)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const history = state.earnings.filter((e) => e.member_id === kid.id);
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] bg-white/60 p-6 shadow-lg backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <BigAvatar member={kid} size={56} />
        <h2 className="font-display text-3xl font-bold text-slate-800">{kid.name}&apos;s money</h2>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-emerald-500 p-4 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">To be paid</p>
          <p className="font-display text-3xl font-bold">{money(kid.earningsCents)}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Earned</p>
          <p className="font-display text-3xl font-bold text-slate-700">{money(kid.earnedCents)}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Paid out</p>
          <p className="font-display text-3xl font-bold text-slate-700">{money(kid.paidCents)}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 board-scroll" {...drag}>
        {history.length === 0 && (
          <p className="font-display font-bold text-slate-400">No money history yet.</p>
        )}
        {history.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2.5 shadow-sm">
            <span className="min-w-0 flex-1 truncate font-bold text-slate-600">
              {e.kind === "payout" ? "💵 Paid out" : e.reason}
            </span>
            <span
              className={`font-display font-bold ${e.cents < 0 ? "text-slate-400" : "text-emerald-600"}`}
            >
              {e.cents < 0 ? "−" : "+"}
              {money(Math.abs(e.cents))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Forecast ────────────────────────────────────────────────────────────────
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
    i === 0 ? "Today" : new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
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
          <div key={d.date} className="flex items-center gap-4 rounded-2xl bg-white/70 px-5 py-3 shadow-sm">
            <span className="w-36 font-display text-xl font-bold text-slate-700">{dayName(d.date, i)}</span>
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
