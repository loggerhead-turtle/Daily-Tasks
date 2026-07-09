"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { BoardState } from "@/lib/types";
import { boardFetch } from "./useBoard";
import { useDragScroll } from "./useDragScroll";
import { BackButton, BigAvatar, RewardTag } from "./bits";

// Full-screen bounty board: chores anyone can claim. A kid taps a bounty to see
// its reward, taps their face, and confirms they did it — which sends it to a
// parent for approval. On approval the reward lands in their balance.
export function BountyView({
  state,
  onHome,
  refresh,
  selected,
}: {
  state: BoardState;
  onHome: () => void;
  refresh: () => void;
  selected: "all" | string;
}) {
  const kids = state.members.filter((m) => m.role === "child");
  const memberById = new Map(state.members.map((m) => [m.id, m]));
  const bounties = state.chores.filter((c) => c.chore?.assign_type === "grab");
  const available = bounties.filter((c) => c.member_id === null && c.status === "todo");
  const claimed = bounties.filter((c) => !(c.member_id === null && c.status === "todo"));
  const selectedKid = kids.find((k) => k.id === selected) ?? null;

  const [openId, setOpenId] = useState<string | null>(null);
  const [pickKid, setPickKid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const drag = useDragScroll();

  // Propose-a-bounty form
  const [proposing, setProposing] = useState(false);
  const [propTitle, setPropTitle] = useState("");
  const [propDollars, setPropDollars] = useState("");
  const [propBusy, setPropBusy] = useState(false);

  async function propose() {
    if (!selectedKid || !propTitle.trim()) return;
    setPropBusy(true);
    const cents = Math.max(0, Math.round(parseFloat(propDollars || "0") * 100)) || 0;
    const res = await boardFetch("/api/board/propose-bounty", {
      method: "POST",
      body: JSON.stringify({ memberId: selectedKid.id, title: propTitle.trim(), cents }),
    });
    setPropBusy(false);
    setProposing(false);
    setPropTitle("");
    setPropDollars("");
    setToast(
      res.ok ? `Sent to a parent to approve, ${selectedKid.name}! 🙌` : "Couldn't send it — try again."
    );
    setTimeout(() => setToast(null), 3500);
  }

  function openBounty(id: string) {
    setOpenId(openId === id ? null : id);
    setPickKid(null);
  }

  async function claim(instanceId: string, kidId: string) {
    setBusy(true);
    const res = await boardFetch("/api/board/chore/complete", {
      method: "POST",
      body: JSON.stringify({ instanceId, memberId: kidId }),
    });
    setBusy(false);
    if (res.ok) {
      const kid = memberById.get(kidId);
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.7 },
        colors: [kid?.color ?? "#fbbf24", "#34d399", "#f472b6", "#60a5fa"],
      });
      setToast(`Nice, ${kid?.name}! Sent to a parent to approve 👍`);
      setTimeout(() => setToast(null), 3500);
      setOpenId(null);
      setPickKid(null);
    } else {
      setToast("Someone may have grabbed it first — try another!");
      setTimeout(() => setToast(null), 3500);
    }
    refresh();
  }

  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-4">
        <BackButton onClick={onHome} />
        <h1 className="font-display text-4xl font-bold text-slate-800">💰 Bounties</h1>
        <span className="ml-auto font-display text-xl font-bold text-slate-400">
          {available.length} up for grabs
        </span>
        <button
          onClick={() => {
            if (!selectedKid) {
              setToast("Tap your face up top first, then suggest a bounty!");
              setTimeout(() => setToast(null), 3500);
              return;
            }
            setProposing((p) => !p);
          }}
          className="rounded-full bg-emerald-500 px-5 py-3 font-display text-xl font-bold text-white shadow transition active:scale-95"
        >
          💪 Suggest a bounty
        </button>
      </header>

      {proposing && selectedKid && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-3xl bg-white/85 p-4 shadow-md backdrop-blur"
        >
          <p className="mb-2 font-display text-xl font-bold text-slate-800">
            {selectedKid.name}, what job should we add?
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              autoFocus
              className="min-w-[16rem] flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 font-display text-xl font-bold text-slate-800 outline-none focus:border-violet-400"
              placeholder="e.g. Wash the car"
              value={propTitle}
              onChange={(e) => setPropTitle(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-slate-500">$</span>
              <input
                className="w-28 rounded-2xl border-2 border-slate-200 px-4 py-3 font-display text-xl font-bold text-slate-800 outline-none focus:border-violet-400"
                type="number"
                min={0}
                step="0.25"
                placeholder="price"
                value={propDollars}
                onChange={(e) => setPropDollars(e.target.value)}
              />
            </div>
            <button
              onClick={propose}
              disabled={propBusy || !propTitle.trim()}
              className="rounded-2xl bg-violet-600 px-6 py-3 font-display text-xl font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
            >
              {propBusy ? "Sending…" : "Ask a parent"}
            </button>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-400">
            A parent will set the price and approve it before it shows up here.
          </p>
        </motion.div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-20 z-20 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-slate-800/95 px-6 py-3 font-display text-lg font-bold text-white shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-3 board-scroll" {...drag}>
        {available.length === 0 && claimed.length === 0 && (
          <p className="mt-16 text-center font-display text-3xl font-bold text-slate-400">
            No bounties right now — check back later! 🎈
          </p>
        )}

        {available.map((ci) => {
          const c = ci.chore!;
          const open = openId === ci.id;
          return (
            <div key={ci.id} className="overflow-hidden rounded-3xl bg-white/85 shadow-md backdrop-blur">
              <button
                onClick={() => openBounty(ci.id)}
                className="flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99]"
              >
                <span className="text-4xl">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xl font-bold text-slate-800">{c.title}</p>
                  <p className="text-lg">
                    <RewardTag points={c.points} cents={c.cents} />
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500 px-4 py-2 font-display text-lg font-bold text-white shadow">
                  {open ? "Close" : "💵 Claim"}
                </span>
              </button>

              {open && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="border-t border-slate-200/70 p-4"
                >
                  {c.description && (
                    <p className="mb-3 font-bold text-slate-500">{c.description}</p>
                  )}
                  <p className="mb-2 font-display text-lg font-bold text-slate-700">
                    Who completed it?
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {kids.map((kid) => (
                      <button
                        key={kid.id}
                        onClick={() => setPickKid(kid.id)}
                        className="flex flex-col items-center transition active:scale-95"
                      >
                        <BigAvatar member={kid} size={64} selected={pickKid === kid.id} />
                        <span className="mt-1 font-display text-base font-bold text-slate-700">
                          {kid.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  {pickKid && (
                    <button
                      disabled={busy}
                      onClick={() => claim(ci.id, pickKid)}
                      className="mt-4 w-full rounded-2xl bg-emerald-500 py-4 font-display text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50"
                    >
                      ✅ {memberById.get(pickKid)?.name} completed it!
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          );
        })}

        {claimed.map((ci) => {
          const c = ci.chore!;
          const kid = ci.member_id ? memberById.get(ci.member_id) : null;
          return (
            <div
              key={ci.id}
              className="flex items-center gap-4 rounded-3xl bg-white/60 p-4 opacity-80 shadow-sm"
            >
              <span className="text-4xl">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold text-slate-500">{c.title}</p>
                <p className="text-sm">
                  <RewardTag points={c.points} cents={c.cents} />
                </p>
              </div>
              {kid && <BigAvatar member={kid} size={40} />}
              <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-600">
                {ci.status === "approved" ? "✅ Done" : "🕐 Waiting for 👍"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
