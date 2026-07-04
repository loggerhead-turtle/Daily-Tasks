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

  const [{ data: instances }, { data: earnings }, { data: ledger }] = await Promise.all([
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
  ]);

  const mine = ((instances as ChoreInstance[] | null) ?? []).filter(
    (i) => i.member_id === memberId || (i.member_id === null && i.chore?.assign_type === "grab")
  );
  const earn = (earnings as Earning[] | null) ?? [];
  const balanceCents = earn.reduce((s, e) => s + e.cents, 0);
  const earnedCents = earn.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0);
  const paidCents = earn.filter((e) => e.cents < 0).reduce((s, e) => s - e.cents, 0);
  const points = (ledger ?? []).reduce((s, l) => s + (l.delta ?? 0), 0);

  return NextResponse.json({
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
