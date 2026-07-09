import { NextRequest, NextResponse } from "next/server";
import { authChild } from "@/lib/childAuth";
import { ensureInstancesForDate } from "@/lib/choreEngine";
import type { ChoreInstance, Earning } from "@/lib/types";

export const dynamic = "force-dynamic";

// The child's phone view: today's chores (theirs + unclaimed bonus chores),
// their points, and their real-money earnings/payout history.
export async function GET(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId, memberId, member } = ctx;

  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  await ensureInstancesForDate(admin, familyId, date);

  const [
    { data: instances },
    { data: earnings },
    { data: ledger },
    { data: announcements },
    { data: redemptions },
    { data: proposals },
  ] = await Promise.all([
    admin
      .from("chore_instances")
      .select("*, chore:chores(*)")
      .eq("family_id", familyId)
      .eq("date", date),
    admin
      .from("earnings")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
    admin.from("points_ledger").select("delta").eq("member_id", memberId),
    admin
      .from("announcements")
      .select("*")
      .eq("family_id", familyId)
      .lte("starts_on", date)
      .or(`ends_on.is.null,ends_on.gte.${date}`)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("redemptions")
      .select("*, reward:rewards(title, emoji)")
      .eq("family_id", familyId)
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("bounty_proposals")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const mine = ((instances as ChoreInstance[] | null) ?? []).filter(
    (i) => i.member_id === memberId || (i.member_id === null && i.chore?.assign_type === "grab")
  );
  const earn = (earnings as Earning[] | null) ?? [];
  const balanceCents = earn.reduce((s, e) => s + e.cents, 0);
  const earnedCents = earn.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0);
  const paidCents = earn.filter((e) => e.cents < 0).reduce((s, e) => s - e.cents, 0);
  const points = (ledger ?? []).reduce((s, l) => s + (l.delta ?? 0), 0);

  // Build a simple notifications feed: family news, bonuses, and prize
  // outcomes — the things a kid would want flagged at the top of their page.
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
  type Note = { id: string; icon: string; text: string; when: string };
  const notifications: Note[] = [];
  for (const a of announcements ?? []) {
    notifications.push({ id: `ann-${a.id}`, icon: a.emoji || "📣", text: a.message, when: a.created_at });
  }
  for (const e of earn) {
    if (e.kind === "adjustment" && e.cents > 0) {
      notifications.push({
        id: `bon-${e.id}`,
        icon: "🎉",
        text: `Bonus: ${e.reason} (+${dollars(e.cents)})`,
        when: e.created_at,
      });
    }
  }
  for (const r of redemptions ?? []) {
    if (r.status === "approved") {
      notifications.push({
        id: `red-${r.id}`,
        icon: r.reward?.emoji ?? "🎁",
        text: `Prize granted: ${r.reward?.title ?? "reward"}`,
        when: r.reviewed_at ?? r.created_at,
      });
    } else if (r.status === "rejected") {
      notifications.push({
        id: `red-${r.id}`,
        icon: "🙈",
        text: `Not right now: ${r.reward?.title ?? "reward"}`,
        when: r.reviewed_at ?? r.created_at,
      });
    }
  }
  for (const p of proposals ?? []) {
    if (p.status === "accepted") {
      notifications.push({
        id: `prop-${p.id}`,
        icon: "🎉",
        text: `Your bounty was accepted: ${p.title}`,
        when: p.reviewed_at ?? p.created_at,
      });
    } else if (p.status === "rejected") {
      notifications.push({
        id: `prop-${p.id}`,
        icon: "🙈",
        text: `Bounty request declined: ${p.title}`,
        when: p.reviewed_at ?? p.created_at,
      });
    }
  }
  notifications.sort((a, b) => (a.when < b.when ? 1 : -1));

  return NextResponse.json({
    notifications: notifications.slice(0, 8),
    proposals: proposals ?? [],
    member: {
      id: member.id,
      name: member.name,
      color: member.color,
      emoji: member.emoji,
      avatar_url: member.avatar_url,
    },
    date,
    chores: mine,
    points,
    balanceCents,
    earnedCents,
    paidCents,
    earnings: earn,
  });
}
