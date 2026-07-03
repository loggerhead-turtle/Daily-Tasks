"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { BoardState } from "@/lib/types";
import { boardFetch } from "./useBoard";
import { BackButton, BigAvatar } from "./bits";

// Full-screen prize catalog, reached from the top nav. Kids pick their face,
// see their balance, and request prizes; parents grant them from approvals.
export function RewardsView({
  state,
  initialMemberId,
  onHome,
  refresh,
}: {
  state: BoardState;
  initialMemberId: string | null;
  onHome: () => void;
  refresh: () => void;
}) {
  const kids = state.members.filter((m) => m.role === "child");
  const [kidId, setKidId] = useState<string | null>(initialMemberId);
  const [toast, setToast] = useState<string | null>(null);
  const kid = kids.find((k) => k.id === kidId) ?? null;

  const pendingHold = kid
    ? state.redemptions.filter((r) => r.member_id === kid.id).reduce((s, r) => s + r.cost, 0)
    : 0;
  const spendable = (kid?.balance ?? 0) - pendingHold;

  async function redeem(rewardId: string, title: string) {
    if (!kid) return;
    const res = await boardFetch("/api/board/redeem", {
      method: "POST",
      body: JSON.stringify({ rewardId, memberId: kid.id }),
    });
    if (res.ok) {
      confetti({ particleCount: 130, spread: 85, origin: { y: 0.7 }, colors: ["#fbbf24", kid.color, "#f472b6"] });
      setToast(`Asked for "${title}" — waiting for a parent 🤞`);
    } else {
      setToast((await res.json()).error ?? "Not quite enough stars yet!");
    }
    setTimeout(() => setToast(null), 4000);
    refresh();
  }

  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <BackButton onClick={onHome} />
        <h1 className="font-display text-4xl font-bold text-slate-800">🎁 Prizes</h1>
        <div className="ml-auto flex items-center gap-3">
          {kids.map((k) => (
            <button
              key={k.id}
              onClick={() => setKidId(k.id)}
              className="flex flex-col items-center transition active:scale-95"
            >
              <BigAvatar member={k} size={64} selected={kidId === k.id} />
              <span className="font-display text-sm font-bold text-slate-700">
                {k.name} · ⭐{k.balance}
              </span>
            </button>
          ))}
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

      {!kid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <span className="animate-float text-7xl">👆</span>
          <p className="font-display text-3xl font-bold text-slate-500">Tap your face to see your prizes!</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <p className="mb-3 font-display text-2xl font-bold text-slate-700">
            {kid.name}, you have <span className="text-amber-600">⭐ {kid.balance}</span> points
            {pendingHold > 0 && (
              <span className="text-base text-slate-400"> ({pendingHold} on hold for requests)</span>
            )}
          </p>
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
