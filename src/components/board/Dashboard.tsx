"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { BoardState } from "@/lib/types";
import {
  type BoardLayout,
  type CardId,
  CARD_META,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
  nextSize,
  sanitizeLayout,
} from "@/lib/boardLayout";
import { boardFetch } from "./useBoard";
import { BigAvatar, Clock, WeatherWidget } from "./bits";
import { CalendarCard } from "./cards/CalendarCard";
import { ChoresCard } from "./cards/ChoresCard";
import { MealsCard } from "./cards/MealsCard";
import { AnnouncementsCard } from "./cards/AnnouncementsCard";

const SPAN: Record<string, string> = {
  sm: "col-span-1 row-span-1",
  md: "col-span-1 row-span-2",
  lg: "col-span-2 row-span-2",
};

// The board home: person picker + a grid of cards (calendar center-stage,
// jobs at its side by default). In edit mode (entered from PIN-gated parent
// mode) cards can be dragged onto each other to swap, resized, and hidden.
export function Dashboard({
  state,
  refresh,
  editMode,
  editPin,
  scale,
  setScale,
  onExitEdit,
  onOpenBounty,
}: {
  state: BoardState;
  refresh: () => void;
  editMode: boolean;
  editPin: string;
  scale: number;
  setScale: (n: number) => void;
  onExitEdit: () => void;
  onOpenBounty: () => void;
}) {
  const [selected, setSelected] = useState<"all" | string>("all");
  const [layout, setLayout] = useState<BoardLayout>(() => sanitizeLayout(state.family.board_layout));
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef(new Map<CardId, HTMLDivElement>());

  // Follow server changes, but never clobber an in-progress edit.
  useEffect(() => {
    if (!editMode) setLayout(sanitizeLayout(state.family.board_layout));
  }, [state.family.board_layout, editMode]);

  function swapWithCardAt(dragged: CardId, point: { x: number; y: number }) {
    for (const [id, el] of Array.from(cardRefs.current.entries())) {
      if (id === dragged || !el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        setLayout((l) => {
          const order = [...l.order];
          const a = order.indexOf(dragged);
          const b = order.indexOf(id);
          if (a === -1 || b === -1) return l;
          [order[a], order[b]] = [order[b], order[a]];
          return { ...l, order };
        });
        return;
      }
    }
  }

  function resize(id: CardId) {
    setLayout((l) => ({ ...l, sizes: { ...l.sizes, [id]: nextSize(l.sizes[id]) } }));
  }

  function hide(id: CardId) {
    setLayout((l) => ({
      ...l,
      order: l.order.filter((c) => c !== id),
      hidden: [...l.hidden, id],
    }));
  }

  function show(id: CardId) {
    setLayout((l) => ({
      ...l,
      hidden: l.hidden.filter((c) => c !== id),
      order: [...l.order, id],
    }));
  }

  async function save() {
    setSaving(true);
    const res = await boardFetch("/api/board/layout", {
      method: "POST",
      pin: editPin,
      body: JSON.stringify({ layout }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Don't silently swallow a failed save (e.g. the board_layout column
      // hasn't been added to the database yet) — the layout would just snap
      // back on the next refresh and look like nothing happened.
      alert(
        `Couldn't save the layout (${res.status}). ${
          body.error ?? "Check that database migration 0002 has been run in Supabase."
        }`
      );
      return;
    }
    // Apply the server-confirmed layout right away so there's no chance the
    // refresh/edit-mode timing snaps it back to the old one.
    if (body.layout) setLayout(sanitizeLayout(body.layout));
    await refresh();
    onExitEdit();
  }

  function cancel() {
    setLayout(sanitizeLayout(state.family.board_layout));
    onExitEdit();
  }

  const selectedMember = state.members.find((m) => m.id === selected) ?? null;

  function renderCard(id: CardId) {
    switch (id) {
      case "calendar":
        return <CalendarCard state={state} selected={selected} />;
      case "chores":
        return <ChoresCard state={state} selected={selected} refresh={refresh} />;
      case "meals":
        return <MealsCard state={state} />;
      case "announcements":
        return <AnnouncementsCard state={state} />;
    }
  }

  return (
    <div className="relative flex h-full flex-col gap-3 p-5">
      {/* Top bar: clock · person picker · prizes + weather */}
      <header className="flex items-center gap-4">
        <Clock compact />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto px-2 no-scrollbar">
          <button
            onClick={() => setSelected("all")}
            className="flex shrink-0 flex-col items-center transition active:scale-95"
          >
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full border-4 bg-gradient-to-br from-pink-300 via-amber-200 to-sky-300 text-3xl shadow-lg ${
                selected === "all" ? "scale-105 border-white ring-4 ring-violet-400" : "border-white/70"
              }`}
            >
              👨‍👩‍👧‍👦
            </span>
            <span className="mt-0.5 font-display text-sm font-bold text-slate-700">Everyone</span>
          </button>
          {state.members.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(selected === m.id ? "all" : m.id)}
              className="flex shrink-0 flex-col items-center transition active:scale-95"
            >
              <BigAvatar member={m} size={64} selected={selected === m.id} />
              <span className="mt-0.5 font-display text-sm font-bold text-slate-700">{m.name}</span>
            </button>
          ))}
        </div>

        {/* Selected child's balances — points and real money */}
        {selectedMember && selectedMember.role === "child" && (
          <div className="flex shrink-0 items-center gap-3 rounded-full bg-white/75 px-5 py-2.5 shadow-lg backdrop-blur">
            <span className="font-display text-2xl font-bold text-amber-500">
              ⭐ {selectedMember.balance}
            </span>
            <span className="font-display text-2xl font-bold text-emerald-600">
              ${(selectedMember.earningsCents / 100).toFixed(2)}
            </span>
          </div>
        )}

        <button
          onClick={onOpenBounty}
          className="flex shrink-0 items-center gap-2 rounded-full bg-amber-400 px-5 py-3 font-display text-xl font-bold text-white shadow-lg transition active:scale-95"
        >
          💰 Bounty
        </button>
        <WeatherWidget weather={state.weather} />
      </header>

      {/* Card grid */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4 [grid-auto-flow:dense] [grid-auto-rows:minmax(0,1fr)]">
        {layout.order.map((id) => {
          const size = layout.sizes[id];
          return (
            <motion.div
              key={id}
              layout
              ref={(el) => {
                if (el) cardRefs.current.set(id, el);
                else cardRefs.current.delete(id);
              }}
              drag={editMode}
              dragMomentum={false}
              dragSnapToOrigin
              whileDrag={{ scale: 0.95, zIndex: 30, boxShadow: "0 24px 48px rgba(0,0,0,0.25)" }}
              onDragEnd={(_, info) => swapWithCardAt(id, info.point)}
              className={`relative flex min-h-0 flex-col rounded-[1.75rem] bg-white/70 p-4 shadow-lg backdrop-blur ${SPAN[size]} ${
                editMode ? "cursor-grab ring-2 ring-dashed ring-violet-400" : ""
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-slate-800">
                  {CARD_META[id].emoji} {CARD_META[id].title}
                  {id === "chores" && selectedMember && (
                    <span className="text-slate-400"> · {selectedMember.name}</span>
                  )}
                </h2>
                {editMode && (
                  <div className="ml-auto flex gap-1.5">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => resize(id)}
                      className="rounded-full bg-violet-600 px-3 py-1 text-sm font-bold text-white shadow transition active:scale-90"
                    >
                      ⤢ {size.toUpperCase()}
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => hide(id)}
                      className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow transition active:scale-90"
                    >
                      🙈 Hide
                    </button>
                  </div>
                )}
              </div>
              <div className={`min-h-0 flex-1 ${editMode ? "pointer-events-none opacity-60" : ""}`}>
                {renderCard(id)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Always-on text-size control — no PIN, so anyone can size the board to
          the room. Persists per-device via changeScale (localStorage). */}
      {!editMode && (
        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 opacity-80 shadow-lg backdrop-blur transition hover:opacity-100">
          <span className="px-1 font-display text-base font-bold text-slate-500">Size</span>
          <button
            onClick={() => setScale(scale - SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Smaller text and icons"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white font-display text-xl font-bold text-slate-700 shadow transition active:scale-90 disabled:opacity-40"
          >
            A−
          </button>
          <span className="min-w-[3rem] text-center font-display text-base font-bold text-slate-700">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(scale + SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Bigger text and icons"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white font-display text-2xl font-bold text-slate-700 shadow transition active:scale-90 disabled:opacity-40"
          >
            A+
          </button>
        </div>
      )}

      {/* Edit-mode toolbar */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-800/95 px-4 py-2.5 shadow-2xl"
        >
          <span className="mr-1 font-display text-base font-bold text-white">
            Drag cards onto each other to swap
          </span>
          {layout.hidden.map((id) => (
            <button
              key={id}
              onClick={() => show(id)}
              className="rounded-full bg-slate-600 px-3 py-1.5 text-sm font-bold text-white transition active:scale-90"
            >
              ➕ {CARD_META[id].emoji} {CARD_META[id].title}
            </button>
          ))}
          <button
            onClick={cancel}
            className="rounded-full bg-slate-600 px-4 py-1.5 font-display text-base font-bold text-white transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-emerald-500 px-5 py-1.5 font-display text-base font-bold text-white transition active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "✓ Save layout"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
