"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { BoardState, ChoreInstance, Member } from "@/lib/types";
import { boardFetch } from "../useBoard";
import { useDragScroll } from "../useDragScroll";
import { BigAvatar, RewardTag } from "../bits";

function celebrate(color: string) {
  confetti({
    particleCount: 130,
    spread: 85,
    origin: { y: 0.7 },
    colors: [color, "#fbbf24", "#34d399", "#f472b6", "#60a5fa"],
  });
}

function StatusBadge({ status }: { status: ChoreInstance["status"] }) {
  if (status === "approved") return <span className="animate-pop text-2xl">✅</span>;
  if (status === "pending")
    return (
      <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
        🕐 Waiting for 👍
      </span>
    );
  if (status === "rejected")
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">Try again!</span>
    );
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-dashed border-slate-300 text-[10px] font-bold text-slate-400">
      Tap!
    </span>
  );
}

function ChoreRow({
  instance,
  onDone,
  showPoints = true,
}: {
  instance: ChoreInstance;
  onDone: () => void;
  showPoints?: boolean;
}) {
  const c = instance.chore!;
  const doneish = instance.status === "pending" || instance.status === "approved";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      disabled={doneish}
      onClick={onDone}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left shadow-sm transition active:scale-[0.97] ${
        instance.status === "approved"
          ? "bg-emerald-100/90"
          : instance.status === "pending"
            ? "bg-sky-100/90"
            : "bg-white/85"
      }`}
    >
      <span className="text-3xl">{c.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-display text-lg font-bold ${doneish ? "text-slate-500" : "text-slate-800"}`}>
          {c.title}
        </span>
        {showPoints && (
          <span className="text-xs">
            <RewardTag points={c.points} cents={c.cents} />
          </span>
        )}
      </span>
      <StatusBadge status={instance.status} />
    </motion.button>
  );
}

// Side card: the day's jobs. With a kid selected it's their tappable list;
// on "Everyone" it groups every kid's jobs so the whole family sees the day.
export function ChoresCard({
  state,
  selected,
  refresh,
}: {
  state: BoardState;
  selected: "all" | string;
  refresh: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const drag = useDragScroll();
  const kids = state.members.filter((m) => m.role === "child");
  const grabs = state.chores.filter((c) => c.member_id === null && c.chore?.assign_type === "grab");
  const selectedKid = kids.find((k) => k.id === selected) ?? null;

  async function complete(instance: ChoreInstance, kid: Member) {
    const res = await boardFetch("/api/board/chore/complete", {
      method: "POST",
      body: JSON.stringify({ instanceId: instance.id, memberId: kid.id }),
    });
    if (res.ok) {
      celebrate(kid.color);
      setToast(`Great job, ${kid.name}! 👍 coming soon`);
      setTimeout(() => setToast(null), 3500);
    }
    refresh();
  }

  return (
    <div className="relative flex h-full flex-col">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-0 z-10 w-max max-w-full -translate-x-1/2 rounded-full bg-slate-800/90 px-5 py-2 font-display text-base font-bold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-2 board-scroll" {...drag}>
        {selectedKid ? (
          <>
            {state.chores
              .filter((c) => c.member_id === selectedKid.id)
              .map((ci) => (
                <ChoreRow key={ci.id} instance={ci} onDone={() => complete(ci, selectedKid)} />
              ))}
            {state.chores.filter((c) => c.member_id === selectedKid.id).length === 0 && (
              <p className="pt-6 text-center font-display text-xl font-bold text-slate-400">
                No jobs today — enjoy! 🎈
              </p>
            )}
          </>
        ) : (
          kids.map((kid) => {
            const mine = state.chores.filter((c) => c.member_id === kid.id);
            const done = mine.filter((c) => c.status === "pending" || c.status === "approved").length;
            return (
              <div key={kid.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <BigAvatar member={kid} size={34} />
                  <span className="font-display text-lg font-bold text-slate-700">{kid.name}</span>
                  {mine.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-slate-400">
                      {done}/{mine.length} done
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {mine.map((ci) => (
                    <ChoreRow key={ci.id} instance={ci} onDone={() => complete(ci, kid)} showPoints={false} />
                  ))}
                  {mine.length === 0 && (
                    <p className="rounded-xl bg-white/50 px-3 py-1.5 text-sm font-bold text-slate-400">
                      No jobs today
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}

        {grabs.length > 0 && (selectedKid || kids.length > 0) && (
          <div>
            <p className="mb-1.5 mt-1 font-display text-base font-bold text-amber-600">
              💰 Bounties — first to claim!
            </p>
            <div className="space-y-1.5">
              {grabs.map((ci) => (
                <ChoreRow
                  key={ci.id}
                  instance={ci}
                  onDone={() => {
                    const kid = selectedKid ?? null;
                    if (kid) complete(ci, kid);
                    else {
                      setToast("Tap your face up top first, then claim it!");
                      setTimeout(() => setToast(null), 3500);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
