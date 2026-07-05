"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { BoardState } from "@/lib/types";
import { boardFetch, clearBoardToken } from "./useBoard";
import { useDragScroll } from "./useDragScroll";
import { BackButton, BigAvatar } from "./bits";

// PIN-gated parent mode on the board: approve chores/redemptions at the
// counter without grabbing a phone. Account management stays web-only.
export function ParentMode({
  state,
  onHome,
  refresh,
}: {
  state: BoardState;
  onHome: () => void;
  refresh: () => void;
}) {
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const drag = useDragScroll();

  async function tryPin(value: string) {
    setPin(value);
    if (value.length < 4) return;
    const res = await boardFetch("/api/board/parent/verify", {
      method: "POST",
      body: JSON.stringify({ pin: value }),
    });
    if (res.ok) {
      setVerified(true);
      setError(null);
    } else if (value.length >= 6) {
      setError("Wrong PIN");
      setPin("");
    }
  }

  async function submitPin() {
    const res = await boardFetch("/api/board/parent/verify", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setVerified(true);
      setError(null);
    } else {
      setError("Wrong PIN");
      setPin("");
    }
  }

  async function review(type: "chore" | "redemption", id: string, action: "approve" | "reject") {
    setBusy(id);
    await boardFetch("/api/board/parent/review", {
      method: "POST",
      pin,
      body: JSON.stringify({ type, id, action }),
    });
    setBusy(null);
    refresh();
  }

  function unpair() {
    if (confirm("Unpair this board? You'll need a new pairing code.")) {
      clearBoardToken();
      window.location.reload();
    }
  }

  const memberById = new Map(state.members.map((m) => [m.id, m]));
  const pendingChores = state.chores.filter((c) => c.status === "pending");

  if (!verified) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
        <div className="absolute left-6 top-6">
          <BackButton onClick={onHome} />
        </div>
        <div className="text-6xl">🔒</div>
        <h1 className="font-display text-4xl font-bold text-slate-800">Parents only</h1>
        {!state.family.has_pin && (
          <p className="max-w-md text-center font-bold text-slate-500">
            No PIN is set yet — set one on the parent website under Settings.
          </p>
        )}
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-5 w-5 rounded-full ${i < pin.length ? "bg-violet-600" : "bg-slate-300"}`}
            />
          ))}
        </div>
        {error && <p className="font-display text-xl font-bold text-rose-500">{error}</p>}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === "⌫") setPin(pin.slice(0, -1));
                else if (k === "OK") submitPin();
                else if (pin.length < 6) tryPin(pin + k);
              }}
              className="h-20 w-20 rounded-3xl bg-white/85 font-display text-3xl font-bold text-slate-700 shadow-md backdrop-blur transition active:scale-90 active:bg-violet-100"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <BackButton onClick={onHome} label="Done" />
        <h1 className="font-display text-4xl font-bold text-slate-800">👍 Approvals</h1>
        <button
          onClick={unpair}
          className="ml-auto rounded-full bg-white/70 px-5 py-3 font-display text-lg font-bold text-slate-500 shadow-md transition active:scale-95"
        >
          Unpair board
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 board-scroll" {...drag}>
        {pendingChores.length === 0 && state.redemptions.length === 0 && (
          <p className="mt-16 text-center font-display text-3xl font-bold text-slate-400">
            Nothing waiting — nice work, team! 🎉
          </p>
        )}
        {pendingChores.map((ci) => {
          const kid = ci.member_id ? memberById.get(ci.member_id) : null;
          return (
            <motion.div
              key={ci.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-3xl bg-white/85 p-4 shadow-md backdrop-blur"
            >
              {kid && <BigAvatar member={kid} size={56} />}
              <span className="text-4xl">{ci.chore?.emoji}</span>
              <div className="flex-1">
                <p className="font-display text-2xl font-bold text-slate-800">{ci.chore?.title}</p>
                <p className="font-bold text-slate-500">
                  {kid?.name} says it&apos;s done · ⭐ +{ci.chore?.points}
                </p>
              </div>
              <button
                disabled={busy === ci.id}
                onClick={() => review("chore", ci.id, "approve")}
                className="rounded-2xl bg-emerald-500 px-7 py-4 font-display text-xl font-bold text-white shadow transition active:scale-95"
              >
                👍 Approve
              </button>
              <button
                disabled={busy === ci.id}
                onClick={() => review("chore", ci.id, "reject")}
                className="rounded-2xl bg-white px-7 py-4 font-display text-xl font-bold text-slate-500 shadow transition active:scale-95"
              >
                Redo
              </button>
            </motion.div>
          );
        })}
        {state.redemptions.map((r) => {
          const kid = memberById.get(r.member_id);
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-3xl bg-amber-50/90 p-4 shadow-md backdrop-blur"
            >
              {kid && <BigAvatar member={kid} size={56} />}
              <span className="text-4xl">{r.reward?.emoji}</span>
              <div className="flex-1">
                <p className="font-display text-2xl font-bold text-slate-800">{r.reward?.title}</p>
                <p className="font-bold text-slate-500">
                  {kid?.name} wants this prize · ⭐ −{r.cost}
                </p>
              </div>
              <button
                disabled={busy === r.id}
                onClick={() => review("redemption", r.id, "approve")}
                className="rounded-2xl bg-emerald-500 px-7 py-4 font-display text-xl font-bold text-white shadow transition active:scale-95"
              >
                🎁 Grant
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => review("redemption", r.id, "reject")}
                className="rounded-2xl bg-white px-7 py-4 font-display text-xl font-bold text-slate-500 shadow transition active:scale-95"
              >
                Not now
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
