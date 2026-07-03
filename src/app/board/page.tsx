"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Blobs } from "@/components/board/bits";
import { CalendarView } from "@/components/board/CalendarView";
import { HomeView } from "@/components/board/HomeView";
import { KidView } from "@/components/board/KidView";
import { Pairing } from "@/components/board/Pairing";
import { ParentMode } from "@/components/board/ParentMode";
import { Screensaver } from "@/components/board/Screensaver";
import {
  clearBoardToken,
  getBoardToken,
  useBoardState,
  useEvents,
  useIdle,
} from "@/components/board/useBoard";

type View =
  | { name: "home" }
  | { name: "calendar" }
  | { name: "kid"; memberId: string }
  | { name: "parent" };

export default function BoardPage() {
  const [paired, setPaired] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [asleep, setAsleep] = useState(false);

  useEffect(() => {
    setPaired(!!getBoardToken());
  }, []);

  const { state, refresh, unauthorized } = useBoardState(paired === true);

  useEffect(() => {
    if (unauthorized) {
      // Board was unpaired remotely (or the family was deleted).
      clearBoardToken();
      setPaired(false);
    }
  }, [unauthorized]);

  // Today's events power the home screen "Today" card.
  const todayRange = useMemo(() => {
    const now = new Date();
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }, []);
  const { events: todayEvents } = useEvents(todayRange.from, todayRange.to, paired === true);

  const idleMs = Math.max(1, state?.family.screensaver_minutes ?? 10) * 60 * 1000;
  const goToSleep = useCallback(() => setAsleep(true), []);
  useIdle(idleMs, goToSleep);

  // At midnight, snap back home so the new day's chores materialize.
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        setView({ name: "home" });
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
            key={view.name + ("memberId" in view ? view.memberId : "")}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
            className="relative h-full"
          >
            {view.name === "home" && (
              <HomeView
                state={state}
                todayEvents={todayEvents}
                onOpenCalendar={() => setView({ name: "calendar" })}
                onOpenKid={(memberId) => setView({ name: "kid", memberId })}
              />
            )}
            {view.name === "calendar" && (
              <CalendarView state={state} onHome={() => setView({ name: "home" })} />
            )}
            {view.name === "kid" && (
              <KidView
                state={state}
                memberId={view.memberId}
                onHome={() => setView({ name: "home" })}
                refresh={refresh}
              />
            )}
            {view.name === "parent" && (
              <ParentMode state={state} onHome={() => setView({ name: "home" })} refresh={refresh} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Discreet parent-mode gear with a pending badge */}
      {state && view.name !== "parent" && (
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
