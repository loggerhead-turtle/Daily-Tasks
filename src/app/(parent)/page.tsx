"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { ChoreInstance, Redemption } from "@/lib/types";

// Shown when a signed-in parent has no family yet (e.g. signup happened
// before their email was confirmed, so the original setup call never ran).
function FirstRunSetup() {
  const [choice, setChoice] = useState<"create" | "join">("create");
  const [displayName, setDisplayName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        choice === "create" ? { familyName, displayName } : { inviteCode, displayName }
      ),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Setup failed");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 text-center">
        <div className="text-4xl">👋</div>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-800">Almost there!</h1>
        <p className="text-sm text-slate-500">Set up your family to finish creating your account.</p>
      </div>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Your name</label>
          <input
            className="input"
            required
            placeholder="e.g. Erik"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setChoice("create")}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              choice === "create" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
            }`}
          >
            New family
          </button>
          <button
            type="button"
            onClick={() => setChoice("join")}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              choice === "join" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
            }`}
          >
            Join with code
          </button>
        </div>
        {choice === "create" ? (
          <div>
            <label className="label">Family name</label>
            <input
              className="input"
              required
              placeholder="The Paul Family"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="label">Invite code</label>
            <input
              className="input uppercase"
              required
              placeholder="From the other parent's Family page"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        <button className="btn w-full py-3" disabled={busy}>
          {busy ? "One moment…" : "Finish setup"}
        </button>
      </form>
    </div>
  );
}

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
  if (!family) return <FirstRunSetup />;

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
