"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { ChoreInstance, Redemption } from "@/lib/types";

export default function Dashboard() {
  const { family, members, loading } = useFamily();
  const [pendingChores, setPendingChores] = useState<ChoreInstance[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!family) return;
    const supabase = createClient();
    const [{ data: chores }, { data: redemptions }, { data: ledger }] = await Promise.all([
      supabase
        .from("chore_instances")
        .select("*, chore:chores(*)")
        .eq("family_id", family.id)
        .eq("status", "pending")
        .order("completed_at"),
      supabase
        .from("redemptions")
        .select("*, reward:rewards(*)")
        .eq("family_id", family.id)
        .eq("status", "pending")
        .order("created_at"),
      supabase.from("points_ledger").select("member_id, delta").eq("family_id", family.id),
    ]);
    setPendingChores((chores as ChoreInstance[]) ?? []);
    setPendingRedemptions((redemptions as Redemption[]) ?? []);
    const b = new Map<string, number>();
    for (const row of ledger ?? []) b.set(row.member_id, (b.get(row.member_id) ?? 0) + row.delta);
    setBalances(b);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(type: "chore" | "redemption", id: string, action: "approve" | "reject") {
    setBusy(id);
    await fetch("/api/parent/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, action }),
    });
    setBusy(null);
    load();
  }

  const memberById = new Map(members.map((m) => [m.id, m]));
  const kids = members.filter((m) => m.role === "child");
  const pendingTotal = pendingChores.length + pendingRedemptions.length;

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (!family) {
    return (
      <div className="card">
        <p className="font-bold">No family set up yet.</p>
        <p className="text-sm text-slate-500">Sign out and create an account with a family, or join with an invite code.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-800">{family.name}</h1>
        <p className="text-sm text-slate-500">
          {pendingTotal > 0
            ? `${pendingTotal} thing${pendingTotal === 1 ? "" : "s"} waiting for your thumbs-up`
            : "All caught up! 🎉"}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kids.map((kid) => (
          <div key={kid.id} className="card flex items-center gap-3">
            <MemberAvatar member={kid} size={48} />
            <div>
              <p className="font-display text-lg font-bold text-slate-800">{kid.name}</p>
              <p className="text-sm font-bold text-amber-600">⭐ {balances.get(kid.id) ?? 0} points</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-800">
          Chores to approve{" "}
          {pendingChores.length > 0 && (
            <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
              {pendingChores.length}
            </span>
          )}
        </h2>
        {pendingChores.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing waiting. Kids mark chores done on the kitchen board.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingChores.map((ci) => {
              const kid = ci.member_id ? memberById.get(ci.member_id) : null;
              return (
                <li key={ci.id} className="flex items-center gap-3 py-3">
                  <span className="text-2xl">{ci.chore?.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{ci.chore?.title}</p>
                    <p className="text-xs text-slate-500">
                      {kid?.name} · {ci.date} · +{ci.chore?.points} pts
                    </p>
                  </div>
                  <button
                    className="btn !bg-emerald-600 hover:!bg-emerald-700"
                    disabled={busy === ci.id}
                    onClick={() => review("chore", ci.id, "approve")}
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busy === ci.id}
                    onClick={() => review("chore", ci.id, "reject")}
                  >
                    <X size={16} /> Redo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-800">
          Reward requests{" "}
          {pendingRedemptions.length > 0 && (
            <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
              {pendingRedemptions.length}
            </span>
          )}
        </h2>
        {pendingRedemptions.length === 0 ? (
          <p className="text-sm text-slate-400">
            No requests. Manage the prize catalog on the <Link href="/rewards" className="font-bold text-violet-600">Rewards</Link> page.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingRedemptions.map((r) => {
              const kid = memberById.get(r.member_id);
              return (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <span className="text-2xl">{r.reward?.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{r.reward?.title}</p>
                    <p className="text-xs text-slate-500">
                      {kid?.name} · costs {r.cost} pts
                    </p>
                  </div>
                  <button
                    className="btn !bg-emerald-600 hover:!bg-emerald-700"
                    disabled={busy === r.id}
                    onClick={() => review("redemption", r.id, "approve")}
                  >
                    <Check size={16} /> Grant
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busy === r.id}
                    onClick={() => review("redemption", r.id, "reject")}
                  >
                    <X size={16} /> Not now
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
