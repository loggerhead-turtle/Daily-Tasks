"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import type { BoardState, ChoreInstance } from "@/lib/types";
import { boardFetch } from "./useBoard";
import { BackButton, BigAvatar } from "./bits";

function celebrate(color: string) {
  confetti({
    particleCount: 140,
    spread: 90,
    origin: { y: 0.7 },
    colors: [color, "#fbbf24", "#34d399", "#f472b6", "#60a5fa"],
  });
}

function ChoreCard({
  instance,
  color,
  onDone,
}: {
  instance: ChoreInstance;
  color: string;
  onDone: () => void;
}) {
  const c = instance.chore!;
  const status = instance.status;
  const doneish = status === "pending" || status === "approved";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      disabled={doneish}
      onClick={onDone}
      className={`relative flex items-center gap-4 rounded-3xl p-5 text-left shadow-lg backdrop-blur transition active:scale-[0.97] ${
        status === "approved"
          ? "bg-emerald-100/90"
          : status === "pending"
            ? "bg-sky-100/90"
            : "bg-white/85"
      }`}
    >
      <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-5xl" style={{ backgroundColor: `${color}22` }}>
        {c.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-display text-2xl font-bold ${doneish ? "text-slate-500" : "text-slate-800"}`}>
          {c.title}
        </span>
        <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-0.5 font-display text-base font-bold text-amber-700">
          ⭐ +{c.points}
        </span>
      </span>
      <span className="shrink-0 text-center">
        {status === "todo" || status === "rejected" ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-dashed border-slate-300 font-display text-sm font-bold text-slate-400">
            Tap!
          </span>
        ) : status === "pending" ? (
          <span className="flex flex-col items-center">
            <span className="animate-float text-4xl">🕐</span>
            <span className="font-display text-sm font-bold text-sky-700">Waiting for 👍</span>
          </span>
        ) : (
          <span className="animate-pop text-5xl">✅</span>
        )}
      </span>
      {status === "rejected" && (
        <span className="absolute -top-2 left-6 rounded-full bg-rose-500 px-3 py-0.5 font-display text-sm font-bold text-white shadow">
          Try again!
        </span>
      )}
    </motion.button>
  );
}

export function KidView({
  state,
  memberId,
  onHome,
  refresh,
}: {
  state: BoardState;
  memberId: string;
  onHome: () => void;
  refresh: () => void;
}) {
  const [tab, setTab] = useState<"jobs" | "prizes">("jobs");
  const [toast, setToast] = useState<string | null>(null);
  const kid = state.members.find((m) => m.id === memberId);
  if (!kid) return null;

  const mine = state.chores.filter((c) => c.member_id === kid.id);
  const grabs = state.chores.filter((c) => c.member_id === null && c.chore?.assign_type === "grab");
  const pendingHold = state.redemptions
    .filter((r) => r.member_id === kid.id)
    .reduce((s, r) => s + r.cost, 0);
  const spendable = kid.balance - pendingHold;

  async function completeChore(instance: ChoreInstance) {
    const res = await boardFetch("/api/board/chore/complete", {
      method: "POST",
      body: JSON.stringify({ instanceId: instance.id, memberId: kid!.id }),
    });
    if (res.ok) {
      celebrate(kid!.color);
      setToast(`Great job, ${kid!.name}! A parent will check it soon 👍`);
      setTimeout(() => setToast(null), 4000);
    }
    refresh();
  }

  async function redeem(rewardId: string, title: string) {
    const res = await boardFetch("/api/board/redeem", {
      method: "POST",
      body: JSON.stringify({ rewardId, memberId: kid!.id }),
    });
    if (res.ok) {
      celebrate("#fbbf24");
      setToast(`Asked for "${title}" — waiting for a parent 🤞`);
    } else {
      setToast((await res.json()).error ?? "Not quite enough stars yet!");
    }
    setTimeout(() => setToast(null), 4000);
    refresh();
  }

  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-5">
        <BackButton onClick={onHome} />
        <BigAvatar member={kid} size={84} />
        <div>
          <h1 className="font-display text-4xl font-bold text-slate-800">{kid.name}</h1>
          <p className="font-display text-xl font-bold text-amber-600">⭐ {kid.balance} points</p>
        </div>
        <div className="ml-auto flex gap-2 rounded-full bg-white/70 p-1.5 shadow-md backdrop-blur">
          <button
            onClick={() => setTab("jobs")}
            className={`rounded-full px-7 py-3 font-display text-xl font-bold transition ${
              tab === "jobs" ? "text-white shadow" : "text-slate-500"
            }`}
            style={tab === "jobs" ? { backgroundColor: kid.color } : {}}
          >
            My jobs
          </button>
          <button
            onClick={() => setTab("prizes")}
            className={`rounded-full px-7 py-3 font-display text-xl font-bold transition ${
              tab === "prizes" ? "text-white shadow" : "text-slate-500"
            }`}
            style={tab === "prizes" ? { backgroundColor: kid.color } : {}}
          >
            Prizes
          </button>
        </div>
      </header>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-slate-800/90 px-8 py-4 font-display text-xl font-bold text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {tab === "jobs" ? (
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            {mine.map((ci) => (
              <ChoreCard key={ci.id} instance={ci} color={kid.color} onDone={() => completeChore(ci)} />
            ))}
          </div>
          {mine.length === 0 && (
            <p className="mt-10 text-center font-display text-3xl font-bold text-slate-400">
              No jobs today — enjoy! 🎈
            </p>
          )}
          {grabs.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 font-display text-2xl font-bold text-slate-700">
                🌟 Bonus jobs — first to tap wins!
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {grabs.map((ci) => (
                  <ChoreCard key={ci.id} instance={ci} color="#f59e0b" onDone={() => completeChore(ci)} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-3 gap-4">
            {state.rewards.map((r) => {
              const affordable = spendable >= r.cost;
              const requested = state.redemptions.some(
                (rd) => rd.member_id === kid.id && rd.reward_id === r.id
              );
              return (
                <motion.button
                  key={r.id}
                  layout
                  disabled={!affordable || requested}
                  onClick={() => redeem(r.id, r.title)}
                  className={`flex flex-col items-center gap-2 rounded-3xl p-6 shadow-lg backdrop-blur transition active:scale-95 ${
                    requested ? "bg-sky-100/90" : affordable ? "bg-white/85" : "bg-white/50 opacity-60"
                  }`}
                >
                  <span className="text-6xl">{r.emoji}</span>
                  <span className="text-center font-display text-xl font-bold text-slate-800">{r.title}</span>
                  <span
                    className={`rounded-full px-4 py-1 font-display text-lg font-bold ${
                      affordable ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    ⭐ {r.cost}
                  </span>
                  {requested ? (
                    <span className="font-display text-sm font-bold text-sky-700">Waiting for 👍</span>
                  ) : !affordable ? (
                    <span className="font-display text-sm font-bold text-slate-400">
                      {r.cost - spendable} more to go!
                    </span>
                  ) : (
                    <span className="font-display text-sm font-bold text-emerald-600">You can get this! 🎉</span>
                  )}
                </motion.button>
              );
            })}
          </div>
          {state.rewards.length === 0 && (
            <p className="mt-10 text-center font-display text-3xl font-bold text-slate-400">
              No prizes in the catalog yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
