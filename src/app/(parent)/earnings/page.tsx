"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { Earning } from "@/lib/types";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function EarningsPage() {
  const { family, members, loading } = useFamily();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const kids = members.filter((m) => m.role === "child");

  const load = useCallback(async () => {
    if (!family) return;
    const { data } = await createClient()
      .from("earnings")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false });
    setEarnings((data as Earning[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  function totalsFor(memberId: string) {
    const rows = earnings.filter((e) => e.member_id === memberId);
    const balance = rows.reduce((s, e) => s + e.cents, 0);
    const earned = rows.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0);
    const paid = rows.filter((e) => e.cents < 0).reduce((s, e) => s - e.cents, 0);
    return { balance, earned, paid };
  }

  async function payOut(memberId: string, balance: number) {
    if (!family || balance <= 0) return;
    if (!confirm(`Mark ${money(balance)} as paid out? This resets the "to be paid" balance to $0.`))
      return;
    setBusy(memberId);
    await createClient().from("earnings").insert({
      family_id: family.id,
      member_id: memberId,
      cents: -balance,
      reason: "Paid out",
      kind: "payout",
    });
    setBusy(null);
    load();
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-800">Money</h1>
        <p className="text-sm text-slate-500">
          Chores with a dollar value add to a child&apos;s balance when you approve them. Mark a
          payout when you hand over the cash.
        </p>
      </header>

      {kids.length === 0 && <p className="text-slate-400">Add a child on the Family page first.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {kids.map((m) => {
          const { balance, earned, paid } = totalsFor(m.id);
          return (
            <div key={m.id} className="card space-y-3 !p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar member={m} size={48} />
                <div className="flex-1">
                  <p className="font-display text-lg font-bold text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    Earned {money(earned)} · Paid {money(paid)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    To be paid
                  </p>
                  <p className="font-display text-2xl font-bold text-emerald-600">{money(balance)}</p>
                </div>
              </div>
              <button
                className="btn w-full !py-2 disabled:opacity-40"
                disabled={busy === m.id || balance <= 0}
                onClick={() => payOut(m.id, balance)}
              >
                {balance > 0 ? `Mark ${money(balance)} paid out` : "Nothing owed"}
              </button>
            </div>
          );
        })}
      </div>

      {earnings.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-bold text-slate-700">Recent activity</h2>
          <ul className="space-y-1.5">
            {earnings.slice(0, 40).map((e) => (
              <li
                key={e.id}
                className="card flex items-center gap-3 !py-2.5"
              >
                <span className="text-sm font-bold text-slate-600">{memberName(e.member_id)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
