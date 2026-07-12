"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { BountyProposal, Chore } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMOJI = ["🧹", "🛏️", "🍽️", "🐶", "🗑️", "🧺", "🪴", "🧸", "📚", "🚿", "🥗", "🚲"];

type Draft = {
  title: string;
  emoji: string;
  points: number;
  dollars: string; // real-money value, entered as dollars (e.g. "1.50")
  assign_type: Chore["assign_type"];
  member_id: string;
  rotation_member_ids: string[];
  recurrence: Chore["recurrence"];
  days_of_week: number[];
  once_date: string;
};

const emptyDraft = (memberId: string): Draft => ({
  title: "",
  emoji: "🧹",
  points: 0,
  dollars: "",
  assign_type: "fixed",
  member_id: memberId,
  rotation_member_ids: [],
  recurrence: "daily",
  days_of_week: [],
  once_date: new Date().toISOString().slice(0, 10),
});

export default function ChoresPage() {
  const { family, members, loading } = useFamily();
  const [chores, setChores] = useState<Chore[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kids = members.filter((m) => m.role === "child");

  function startNew() {
    setEditingId(null);
    setError(null);
    setDraft(emptyDraft(kids[0]?.id ?? ""));
  }

  function edit(c: Chore) {
    setEditingId(c.id);
    setError(null);
    setDraft({
      title: c.title,
      emoji: c.emoji,
      points: c.points,
      dollars: c.cents ? (c.cents / 100).toString() : "",
      assign_type: c.assign_type,
      member_id: c.member_id ?? kids[0]?.id ?? "",
      rotation_member_ids: c.rotation_member_ids ?? [],
      recurrence: c.recurrence,
      days_of_week: c.days_of_week ?? [],
      once_date: c.once_date ?? new Date().toISOString().slice(0, 10),
    });
  }

  function closeDraft() {
    setDraft(null);
    setEditingId(null);
    setError(null);
  }

  const [proposals, setProposals] = useState<BountyProposal[]>([]);
  const [propPrice, setPropPrice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!family) return;
    const { data } = await createClient()
      .from("chores")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at");
    setChores((data as Chore[]) ?? []);
  }, [family]);

  const loadProposals = useCallback(async () => {
    const res = await fetch("/api/parent/bounty-proposals", { cache: "no-store" });
    if (!res.ok) return;
    const list = ((await res.json()).proposals as BountyProposal[]) ?? [];
    setProposals(list);
    setPropPrice(Object.fromEntries(list.map((p) => [p.id, (p.cents / 100).toFixed(2)])));
  }, []);

  useEffect(() => {
    load();
    loadProposals();
  }, [load, loadProposals]);

  async function acceptProposal(p: BountyProposal) {
    const cents = Math.max(0, Math.round(parseFloat(propPrice[p.id] || "0") * 100)) || 0;
    const res = await fetch("/api/parent/bounty-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, action: "accept", cents }),
    });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't accept it");
    loadProposals();
    load();
  }

  async function declineProposal(p: BountyProposal) {
    await fetch("/api/parent/bounty-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, action: "decline" }),
    });
    loadProposals();
  }

  async function save() {
    if (!family || !draft) return;
    setError(null);
    if (!draft.title.trim()) return setError("Give the chore a name");
    if (draft.assign_type === "rotation" && draft.rotation_member_ids.length < 2)
      return setError("Pick at least two kids for a rotation");
    if (draft.recurrence === "weekly" && draft.days_of_week.length === 0)
      return setError("Pick at least one day of the week");

    const cents = Math.max(0, Math.round(parseFloat(draft.dollars || "0") * 100)) || 0;
    const payload = {
      title: draft.title.trim(),
      emoji: draft.emoji,
      points: draft.points,
      cents,
      assign_type: draft.assign_type,
      member_id: draft.assign_type === "fixed" ? draft.member_id : null,
      rotation_member_ids: draft.assign_type === "rotation" ? draft.rotation_member_ids : [],
      recurrence: draft.recurrence,
      days_of_week: draft.recurrence === "weekly" ? draft.days_of_week : [],
      once_date: draft.recurrence === "once" ? draft.once_date : null,
    };
    if (editingId) {
      const { error } = await createClient().from("chores").update(payload).eq("id", editingId);
      if (error) return setError(error.message);
    } else {
      const { data: created, error } = await createClient()
        .from("chores")
        .insert({ family_id: family.id, ...payload })
        .select("id")
        .single();
      if (error) return setError(error.message);
      // Notify the kids' phones about the new chore/bounty (best-effort).
      if (created?.id) {
        fetch("/api/notify/chore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choreId: created.id }),
        }).catch(() => {});
      }
    }
    closeDraft();
    load();
  }

  async function toggleActive(chore: Chore) {
    await createClient().from("chores").update({ active: !chore.active }).eq("id", chore.id);
    load();
  }

  async function remove(chore: Chore) {
    if (!confirm(`Delete "${chore.title}"? Past history is kept.`)) return;
    await createClient().from("chores").delete().eq("id", chore.id);
    load();
  }

  function describe(c: Chore): string {
    const when =
      c.recurrence === "daily"
        ? "Every day"
        : c.recurrence === "weekly"
          ? c.days_of_week.map((d) => DAYS[d]).join(", ")
          : `Once on ${c.once_date}`;
    const who =
      c.assign_type === "fixed"
        ? (members.find((m) => m.id === c.member_id)?.name ?? "?")
        : c.assign_type === "rotation"
          ? `Rotates: ${c.rotation_member_ids.map((id) => members.find((m) => m.id === id)?.name ?? "?").join(" → ")}`
          : "Bounty — anyone can claim";
    return `${when} · ${who}`;
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Chores</h1>
          <p className="text-sm text-slate-500">They appear on the board automatically on their scheduled days.</p>
        </div>
        {!draft && kids.length > 0 && (
          <button className="btn" onClick={startNew}>
            <Plus size={16} /> New chore
          </button>
        )}
      </header>

      {kids.length === 0 && (
        <div className="card text-sm text-slate-500">Add your kids on the Family page first.</div>
      )}

      {/* Bounty requests from the kids */}
      {proposals.length > 0 && (
        <div className="card space-y-3 border-2 border-emerald-200">
          <p className="font-display text-lg font-bold text-slate-800">
            💪 Bounty requests
            <span className="ml-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              {proposals.length}
            </span>
          </p>
          {proposals.map((p) => {
            const proposer = members.find((m) => m.id === p.member_id)?.name ?? "A kid";
            return (
              <div key={p.id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      from {proposer}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Pays $</span>
                  <input
                    className="input !w-24"
                    type="number"
                    min={0}
                    step="0.25"
                    value={propPrice[p.id] ?? ""}
                    onChange={(e) => setPropPrice({ ...propPrice, [p.id]: e.target.value })}
                  />
                  <button
                    className="btn !py-1.5 text-xs"
                    onClick={() => acceptProposal(p)}
                  >
                    <Check size={14} /> Accept as bounty
                  </button>
                  <button
                    className="btn-secondary !py-1.5 text-xs"
                    onClick={() => declineProposal(p)}
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="card space-y-4">
          <p className="font-display text-lg font-bold text-slate-800">
            {editingId ? "Edit chore" : "New chore"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="label">Chore</label>
              <input
                className="input"
                placeholder="Feed the dog"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Points</label>
              <input
                className="input"
                type="number"
                min={0}
                max={999}
                value={draft.points}
                onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Pays ($)</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.25"
                placeholder="0.00"
                value={draft.dollars}
                onChange={(e) => setDraft({ ...draft, dollars: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraft({ ...draft, emoji: e })}
                  className={`rounded-xl p-2 text-2xl transition ${
                    draft.emoji === e ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Who does it?</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["fixed", "One child"],
                  ["rotation", "Rotates weekly"],
                  ["grab", "Bounty (anyone claims)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, assign_type: value })}
                  className={`rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                    draft.assign_type === value
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {draft.assign_type === "fixed" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {kids.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, member_id: k.id })}
                    className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold transition ${
                      draft.member_id === k.id ? "bg-violet-100 ring-2 ring-violet-400" : "bg-slate-100"
                    }`}
                  >
                    <MemberAvatar member={k} size={24} /> {k.name}
                  </button>
                ))}
              </div>
            )}
            {draft.assign_type === "rotation" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {kids.map((k) => {
                  const on = draft.rotation_member_ids.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          rotation_member_ids: on
                            ? draft.rotation_member_ids.filter((id) => id !== k.id)
                            : [...draft.rotation_member_ids, k.id],
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold transition ${
                        on ? "bg-violet-100 ring-2 ring-violet-400" : "bg-slate-100"
                      }`}
                    >
                      <MemberAvatar member={k} size={24} /> {k.name}
                    </button>
                  );
                })}
                <p className="w-full text-xs text-slate-400">Rotation order follows the order you tap. Switches each week.</p>
              </div>
            )}
          </div>

          <div>
            <label className="label">When?</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["daily", "Every day"],
                  ["weekly", "Weekly — pick days"],
                  ["once", "One time"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, recurrence: value })}
                  className={`rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                    draft.recurrence === value
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {draft.recurrence === "weekly" && (
              <div className="mt-2 flex gap-1">
                {DAYS.map((d, i) => {
                  const on = draft.days_of_week.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          days_of_week: on
                            ? draft.days_of_week.filter((x) => x !== i)
                            : [...draft.days_of_week, i].sort(),
                        })
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                        on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
            {draft.recurrence === "once" && (
              <input
                className="input mt-2 max-w-xs"
                type="date"
                value={draft.once_date}
                onChange={(e) => setDraft({ ...draft, once_date: e.target.value })}
              />
            )}
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={save}>
              {editingId ? "Update chore" : "Save chore"}
            </button>
            <button className="btn-secondary" onClick={closeDraft}>Cancel</button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {chores.map((c) => (
          <li key={c.id} className={`card flex items-center gap-3 !p-4 ${c.active ? "" : "opacity-50"}`}>
            <span className="text-3xl">{c.emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-slate-800">
                {c.title} <span className="ml-1 text-xs font-bold text-amber-600">+{c.points} pts</span>
                {c.cents > 0 && (
                  <span className="ml-1 text-xs font-bold text-emerald-600">
                    ${(c.cents / 100).toFixed(2)}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{describe(c)}</p>
            </div>
            <button className="btn-secondary" onClick={() => toggleActive(c)}>
              {c.active ? "Pause" : "Resume"}
            </button>
            <button
              className="rounded-xl p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
              onClick={() => edit(c)}
              aria-label={`Edit ${c.title}`}
            >
              <Pencil size={18} />
            </button>
            <button
              className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={() => remove(c)}
              aria-label={`Delete ${c.title}`}
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
        {chores.length === 0 && !draft && (
          <li className="card text-sm text-slate-400">No chores yet — add the first one!</li>
        )}
      </ul>
    </div>
  );
}
