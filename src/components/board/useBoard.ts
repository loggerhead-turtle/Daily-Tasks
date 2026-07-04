"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { BoardState, CalendarEvent } from "@/lib/types";

const TOKEN_KEY = "family_board_token";
const SCALE_KEY = "family_board_scale";

export function getBoardToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setBoardToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearBoardToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Board zoom is a per-device preference (each screen can be sized for its own
// room and viewing distance), so it lives in this board's localStorage rather
// than the shared, PIN-gated family layout.
export function getBoardScale(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(SCALE_KEY);
  return v ? Number(v) : null;
}

export function setBoardScale(scale: number) {
  localStorage.setItem(SCALE_KEY, String(scale));
}

export async function boardFetch(path: string, init?: RequestInit & { pin?: string }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-board-token": getBoardToken() ?? "",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (init?.pin) headers["x-parent-pin"] = init.pin;
  return fetch(path, { ...init, headers });
}

// Polls board state (chores, points, meals, announcements, weather…).
// Realtime enough for a kitchen: refreshes every 45s and after any action.
export function useBoardState(paired: boolean) {
  const [state, setState] = useState<BoardState | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = useCallback(async () => {
    if (!getBoardToken()) return;
    try {
      const date = format(new Date(), "yyyy-MM-dd");
      const res = await boardFetch(`/api/board/state?date=${date}`);
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (res.ok) {
        // Clear any prior unauthorized flag so a later revoke re-triggers unpair.
        setUnauthorized(false);
        setState(await res.json());
      }
    } catch {
      // Offline — keep showing the last known state.
    }
  }, []);

  useEffect(() => {
    if (!paired) return;
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => clearInterval(id);
  }, [paired, refresh]);

  return { state, refresh, unauthorized };
}

// Fetches calendar events for a date range, cached per range for 5 minutes.
// `issues` carries any per-calendar problems (expired sign-in, Google errors)
// so the calendar card can explain an empty state instead of guessing.
export function useEvents(fromISO: string, toISO: string, enabled: boolean) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, { at: number; events: CalendarEvent[] }>());

  useEffect(() => {
    if (!enabled) return;
    const key = `${fromISO}:${toISO}`;
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) {
      setEvents(hit.events);
      setIssues([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    boardFetch(`/api/board/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: string[] = data.issues ?? [];
        setIssues(list);
        setEvents(data.events);
        // Only cache clean results so a transient failure isn't pinned for 5 min.
        if (list.length === 0) cache.current.set(key, { at: Date.now(), events: data.events });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fromISO, toISO, enabled]);

  return { events, issues, loading };
}

// Milliseconds since the last touch anywhere on the board.
export function useIdle(onIdleMs: number, onIdle: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onIdle, onIdleMs);
    };
    reset();
    const evts = ["pointerdown", "pointermove", "keydown"] as const;
    evts.forEach((e) => window.addEventListener(e, reset));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      evts.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onIdleMs, onIdle]);
}
