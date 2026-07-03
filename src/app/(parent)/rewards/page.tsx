"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import type { Reward } from "@/lib/types";

const EMOJI = ["🎁", "📱", "🍿", "🍦", "🌙", "🛝", "💵", "🎮", "🧁", "🎨", "⚽", "📖"];

export default function RewardsPage() {
  const { family, loading } = useFamily();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [cost, setCost] = useState(50);

  const load = useCallback(async () => {
    if (!family) return;
    const { data } = await createClient()
      .from("rewards")
      .select("*")
      .eq("family_id", family.id)
      .order("cost");
    setRewards((data as Reward[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!family || !title.trim()) return;
    await createClient().from("rewards").insert({
      family_id: family.id,
      title: title.trim(),
      emoji,
      cost,
    });
    setTitle("");
    setEmoji("🎁");
    setCost(50);
    setAdding(false);
    load();
  }

  async function toggleActive(r: Reward) {
    await createClient().from("rewards").update({ active: !r.active }).eq("id", r.id);
    load();
  }

  async function remove(r: Reward) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    await createClient().from("rewards").delete().eq("id", r.id);
    load();
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Rewards</h1>
          <p className="text-sm text-slate-500">The prize catalog kids see on the board. They request; you approve.</p>
        </div>
        {!adding && (
          <button className="btn" onClick={() => setAdding(true)}>
            <Plus size={16} /> New reward
          </button>
        )}
      </header>

      {adding && (
        <div className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Reward</label>
              <input
                className="input"
                placeholder="30 min extra screen time"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Cost (points)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
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
                  onClick={() => setEmoji(e)}
                  className={`rounded-xl p-2 text-2xl transition ${
                    emoji === e ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Save reward</button>
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => (
          <li key={r.id} className={`card flex items-center gap-3 !p-4 ${r.active ? "" : "opacity-50"}`}>
            <span className="text-3xl">{r.emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-slate-800">{r.title}</p>
              <p className="text-xs font-bold text-amber-600">⭐ {r.cost} points</p>
            </div>
            <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => toggleActive(r)}>
              {r.active ? "Hide" : "Show"}
            </button>
            <button
              className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={() => remove(r)}
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
        {rewards.length === 0 && !adding && (
          <li className="card text-sm text-slate-400">No rewards yet — add the first prize!</li>
        )}
      </ul>
    </div>
  );
}
