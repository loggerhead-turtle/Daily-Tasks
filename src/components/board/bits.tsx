"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { BoardState, Weather } from "@/lib/types";

export function BigAvatar({
  member,
  size = 96,
  selected = false,
}: {
  member: { name: string; color: string; emoji: string; avatar_url: string | null };
  size?: number;
  selected?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 shadow-lg transition-transform ${
        selected ? "scale-105 border-white ring-4" : "border-white/70"
      }`}
      style={{
        // rem (not px) so avatars scale with the board's root font size.
        width: `${size / 16}rem`,
        height: `${size / 16}rem`,
        backgroundColor: member.color,
        fontSize: `${(size * 0.5) / 16}rem`,
        ...(selected ? ({ "--tw-ring-color": member.color } as React.CSSProperties) : {}),
      }}
    >
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatar_url} alt={member.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span>{member.emoji}</span>
      )}
    </span>
  );
}

// A chore/bounty's reward: dollars, points, or both — whichever are set.
export function RewardTag({ points, cents }: { points: number; cents: number }) {
  const hasCents = cents > 0;
  const hasPoints = points > 0;
  if (!hasCents && !hasPoints) return null;
  return (
    <span className="font-bold">
      {hasCents && <span className="text-emerald-600">${(cents / 100).toFixed(2)}</span>}
      {hasCents && hasPoints && <span className="text-slate-400"> · </span>}
      {hasPoints && <span className="text-amber-600">⭐ {points}</span>}
    </span>
  );
}

export function Clock({ big = false, compact = false }: { big?: boolean; compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const time = compact ? "text-4xl" : big ? "text-8xl" : "text-5xl";
  const ampm = compact ? "text-xl" : big ? "text-4xl" : "text-2xl";
  const date = compact ? "text-sm" : big ? "text-2xl" : "text-lg";
  return (
    <div className={big ? "text-center" : ""}>
      <div className={`font-display font-bold leading-none text-slate-800 ${time}`}>
        {format(now, "h:mm")}
        <span className={`ml-1 font-bold text-slate-400 ${ampm}`}>{format(now, "a")}</span>
      </div>
      <div className={`mt-1 font-bold text-slate-500 ${date}`}>{format(now, "EEEE, MMMM d")}</div>
    </div>
  );
}

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export function WeatherWidget({ weather }: { weather: Weather | null }) {
  if (!weather) return null;
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white/60 px-5 py-3 shadow-sm backdrop-blur">
      <span className="text-5xl">{weatherEmoji(weather.code)}</span>
      <div>
        <div className="font-display text-4xl font-bold leading-none text-slate-800">{weather.temp}°</div>
        <div className="text-sm font-bold text-slate-500">
          H {weather.hi}° · L {weather.lo}°
        </div>
      </div>
    </div>
  );
}

export function AnnouncementBar({ state }: { state: BoardState }) {
  const items = state.announcements;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [items.length]);
  if (items.length === 0) return null;
  const item = items[index % items.length];
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl bg-white/60 px-6 py-2.5 shadow-sm backdrop-blur">
      <span className="text-2xl">{item.emoji}</span>
      <span key={item.id} className="animate-pop font-display text-xl font-bold text-slate-700">
        {item.message}
      </span>
    </div>
  );
}

export function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-24 h-96 w-96 animate-drift rounded-full bg-violet-200/60 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-80 w-80 animate-drift rounded-full bg-sky-200/60 blur-3xl [animation-delay:-8s]" />
      <div className="absolute -bottom-24 left-1/3 h-96 w-96 animate-drift rounded-full bg-amber-200/50 blur-3xl [animation-delay:-16s]" />
    </div>
  );
}

export function BackButton({ onClick, label = "Home" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-white/80 px-6 py-3 font-display text-xl font-bold text-slate-700 shadow-md backdrop-blur transition active:scale-95"
    >
      <span className="text-2xl">🏠</span> {label}
    </button>
  );
}
