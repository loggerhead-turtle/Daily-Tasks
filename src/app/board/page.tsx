"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Blobs } from "@/components/board/bits";
import { Dashboard } from "@/components/board/Dashboard";
import { Pairing } from "@/components/board/Pairing";
import { ParentMode } from "@/components/board/ParentMode";
import { RewardsView } from "@/components/board/RewardsView";
import { Screensaver } from "@/components/board/Screensaver";
import {
  clearBoardToken,
  getBoardToken,
  useBoardState,
  useIdle,
} from "@/components/board/useBoard";

type View =
  | { name: "dashboard" }
  | { name: "rewards"; memberId: string | null }
  | { name: "parent" };

export default function BoardPage() {
  const [paired, setPaired] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [asleep, setAsleep] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPin, setEditPin] = useState("");

  useEffect(() => {
    setPaired(!!getBoardToken());
  }, []);

  // The board is a wall display read from across the kitchen, so scale the
  // whole UI up from the browser's default 16px root. Every board style is
  // rem/em-based, so this zooms text, icons and spacing together while the
  // flex/grid layout re-fits itself (a CSS transform would overflow instead).
  // Reset on unmount so it never leaks into the parent web app.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.fontSize;
    root.style.fontSize = "200%"; // 2× — bump to 250%/300% for an even bigger board
    return () => {
      root.style.fontSize = prev;
    };
  }, []);

  const { state, refresh, unauthorized } = useBoardState(paired === true);

  useEffect(() => {
    if (unauthorized) {
      // Board was unpaired remotely (or the family was deleted).
      clearBoardToken();
      setPaired(false);
    }
  }, [unauthorized]);

  const idleMs = Math.max(1, state?.family.screensaver_minutes ?? 10) * 60 * 1000;
  const goToSleep = useCallback(() => setAsleep(true), []);
  useIdle(idleMs, goToSleep);

  // At midnight, snap back to the dashboard so the new day's chores appear.
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setView({ name: "dashboard" });
        refresh();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (paired === null) return <main className="kiosk h-screen bg-slate-100" />;
  if (!paired) return <Pairing onPaired={() => setPaired(true)} />;

  return (
    <main
      className="kiosk relative h-screen overflow-hidden bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100"
      onPointerDown={() => asleep && setAsleep(false)}
    >
      <Blobs />

      {!state ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <span className="animate-float text-7xl">🏠</span>
          <p className="font-display text-2xl font-bold text-slate-400">Warming up…</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view.name}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
            className="relative h-full"
          >
            {view.name === "dashboard" && (
              <Dashboard
                state={state}
                refresh={refresh}
                editMode={editMode}
                editPin={editPin}
                onExitEdit={() => {
                  setEditMode(false);
                  setEditPin("");
                }}
                onOpenRewards={(memberId) => setView({ name: "rewards", memberId })}
              />
            )}
            {view.name === "rewards" && (
              <RewardsView
                state={state}
                initialMemberId={view.memberId}
                onHome={() => setView({ name: "dashboard" })}
                refresh={refresh}
              />
            )}
            {view.name === "parent" && (
              <ParentMode
                state={state}
                onHome={() => setView({ name: "dashboard" })}
                refresh={refresh}
                onCustomize={(pin) => {
                  setEditPin(pin);
                  setEditMode(true);
                  setView({ name: "dashboard" });
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Discreet parent-mode gear with a pending badge */}
      {state && view.name !== "parent" && !editMode && (
        <button
          onClick={() => setView({ name: "parent" })}
          className="absolute bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white/50 text-2xl opacity-60 shadow backdrop-blur transition active:scale-90"
          aria-label="Parent mode"
        >
          ⚙️
          {state.pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 font-display text-sm font-bold text-white">
              {state.pendingCount}
            </span>
          )}
        </button>
      )}

      {asleep && <Screensaver photos={state?.photos ?? []} />}
    </main>
  );
}
