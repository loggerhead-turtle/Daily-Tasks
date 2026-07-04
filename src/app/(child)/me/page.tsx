"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Camera, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, ChoreInstance, Earning } from "@/lib/types";

type Note = { id: string; icon: string; text: string; when: string };

type ChildState = {
  member: { id: string; name: string; color: string; emoji: string; avatar_url: string | null };
  date: string;
  chores: ChoreInstance[];
  points: number;
  balanceCents: number;
  earnedCents: number;
  paidCents: number;
  earnings: Earning[];
  notifications: Note[];
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ChildPage() {
  const router = useRouter();
  const [state, setState] = useState<ChildState | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const date = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/child/state?date=${date}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) setState(await res.json());
  }, [router]);

  const loadEvents = useCallback(async () => {
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `/api/child/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    if (res.ok) setEvents((await res.json()).events ?? []);
  }, []);

  useEffect(() => {
    load();
    loadEvents();
  }, [load, loadEvents]);

  async function complete(instanceId: string) {
    setBusy(instanceId);
    await fetch("/api/child/chore/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId }),
    });
    setBusy(null);
    await load();
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/child/avatar", { method: "POST", body });
    setUploading(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Couldn't upload the picture");
      return;
    }
    await load();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100">
        <p className="animate-pulse font-display text-xl font-bold text-slate-400">Loading…</p>
      </main>
    );
  }

  const { member } = state;
  const todo = state.chores.filter((c) => c.status === "todo" || c.status === "rejected");
  const waiting = state.chores.filter((c) => c.status === "pending");
  const done = state.chores.filter((c) => c.status === "approved");

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 pb-10">
      <div className="mx-auto max-w-md px-4 pt-6">
        {/* Header */}
        <header className="mb-5 flex items-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white text-3xl shadow transition active:scale-95"
            style={{ backgroundColor: member.color }}
            aria-label="Change my picture"
          >
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt={member.name} className="h-full w-full object-cover" />
            ) : (
              member.emoji
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow">
              <Camera size={13} />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
          <div className="flex-1">
            <p className="font-display text-2xl font-bold text-slate-800">Hi, {member.name}!</p>
            <p className="text-sm font-bold text-slate-500">⭐ {state.points} points</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-full bg-white/70 p-2.5 text-slate-500 shadow transition active:scale-90"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* 1 · Notifications */}
        <h2 className="mb-2 font-display text-lg font-bold text-slate-700">🔔 Notifications</h2>
        <div className="mb-6 space-y-1.5">
          {state.notifications.length === 0 && (
            <p className="rounded-2xl bg-white/60 px-4 py-3 text-center font-bold text-slate-400">
              Nothing new right now 😌
            </p>
          )}
          {state.notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-2xl bg-white/75 px-4 py-2.5 shadow-sm"
            >
              <span className="text-xl">{n.icon}</span>
              <span className="font-display text-sm font-bold leading-snug text-slate-700">
                {n.text}
              </span>
            </div>
          ))}
        </div>

        {/* 2 · Today's chores */}
        <h2 className="mb-2 font-display text-lg font-bold text-slate-700">✅ Today&apos;s jobs</h2>
        <div className="mb-6 space-y-2">
          {todo.length === 0 && waiting.length === 0 && done.length === 0 && (
            <p className="rounded-2xl bg-white/60 px-4 py-6 text-center font-display font-bold text-slate-400">
              No jobs today — enjoy! 🎈
            </p>
          )}
          {todo.map((ci) => (
            <button
              key={ci.id}
              disabled={busy === ci.id}
              onClick={() => complete(ci.id)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow transition active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-3xl">{ci.chore?.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-bold text-slate-800">
                  {ci.chore?.title}
                </span>
                <span className="text-xs font-bold text-amber-600">
                  ⭐ +{ci.chore?.points}
                  {ci.chore && ci.chore.cents > 0 && (
                    <span className="ml-2 text-emerald-600">{money(ci.chore.cents)}</span>
                  )}
                </span>
              </span>
              <span className="rounded-full border-[3px] border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-400">
                Tap when done
              </span>
            </button>
          ))}
          {waiting.map((ci) => (
            <div
              key={ci.id}
              className="flex w-full items-center gap-3 rounded-2xl bg-sky-100/80 px-4 py-3 shadow-sm"
            >
              <span className="text-3xl">{ci.chore?.emoji}</span>
              <span className="min-w-0 flex-1 font-display text-lg font-bold text-slate-500 line-through">
                {ci.chore?.title}
              </span>
              <span className="rounded-full bg-sky-200 px-3 py-1 text-xs font-bold text-sky-800">
                🕐 Waiting for 👍
              </span>
            </div>
          ))}
          {done.map((ci) => (
            <div
              key={ci.id}
              className="flex w-full items-center gap-3 rounded-2xl bg-emerald-100/80 px-4 py-3 shadow-sm"
            >
              <span className="text-3xl">{ci.chore?.emoji}</span>
              <span className="min-w-0 flex-1 font-display text-lg font-bold text-slate-500 line-through">
                {ci.chore?.title}
              </span>
              <span className="text-2xl">✅</span>
            </div>
          ))}
        </div>

        {/* 3 · Money */}
        <h2 className="mb-2 font-display text-lg font-bold text-slate-700">💵 My money</h2>
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-emerald-500 p-3 text-white shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">To be paid</p>
              <p className="font-display text-2xl font-bold">{money(state.balanceCents)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 shadow">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Earned</p>
              <p className="font-display text-2xl font-bold text-slate-700">{money(state.earnedCents)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 shadow">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Paid out</p>
              <p className="font-display text-2xl font-bold text-slate-700">{money(state.paidCents)}</p>
            </div>
          </div>
          {state.earnings.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {state.earnings.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 shadow-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-600">
                    {e.kind === "payout" ? "💵 Paid out" : e.reason}
                  </span>
                  <span
                    className={`font-display text-sm font-bold ${
                      e.cents < 0 ? "text-slate-400" : "text-emerald-600"
                    }`}
                  >
                    {e.cents < 0 ? "−" : "+"}
                    {money(Math.abs(e.cents))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4 · Calendar */}
        <h2 className="mb-2 font-display text-lg font-bold text-slate-700">📅 What&apos;s coming up</h2>
        <div className="space-y-1.5">
          {events.length === 0 && (
            <p className="rounded-2xl bg-white/60 px-4 py-3 text-center font-bold text-slate-400">
              Nothing on the calendar 🎈
            </p>
          )}
          {events.slice(0, 25).map((e) => {
            const start = e.allDay ? parseISO(e.start + "T00:00:00") : parseISO(e.start);
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-2xl bg-white/75 px-4 py-2.5 shadow-sm"
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-slate-800">{e.title}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {e.allDay
                      ? `${format(start, "EEE MMM d")} · All day`
                      : format(start, "EEE MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
