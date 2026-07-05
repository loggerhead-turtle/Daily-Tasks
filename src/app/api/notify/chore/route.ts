import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import { sendToSubs, type StoredSub } from "@/lib/push";
import type { Chore, Member } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the parent app right after a chore is created. Pushes a
// notification to the phones of the kids it applies to: the assignee for a
// fixed chore, the rotation members for a rotation, or every child for a
// bounty (grab).
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { choreId } = (await req.json()) as { choreId?: string };
  if (!choreId) return NextResponse.json({ error: "Missing choreId" }, { status: 400 });

  const { data: chore } = await ctx.admin
    .from("chores")
    .select("*")
    .eq("id", choreId)
    .eq("family_id", ctx.familyId)
    .single();
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = chore as Chore;

  const { data: members } = await ctx.admin
    .from("members")
    .select("id, role")
    .eq("family_id", ctx.familyId);
  const kids = (members as Pick<Member, "id" | "role">[] | null)?.filter((m) => m.role === "child") ?? [];

  let targetIds: string[] = [];
  if (c.assign_type === "grab") targetIds = kids.map((k) => k.id);
  else if (c.assign_type === "rotation") targetIds = c.rotation_member_ids ?? [];
  else if (c.member_id) targetIds = [c.member_id];
  if (targetIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const { data: subs } = await ctx.admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("member_id", targetIds);

  const reward = [
    c.cents > 0 ? `$${(c.cents / 100).toFixed(2)}` : "",
    c.points > 0 ? `⭐ ${c.points}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const isBounty = c.assign_type === "grab";
  await sendToSubs(ctx.admin, (subs as StoredSub[] | null) ?? [], {
    title: isBounty ? "💰 New bounty!" : "✅ New job for you",
    body: `${c.emoji} ${c.title}${reward ? ` — ${reward}` : ""}`,
    url: "/me",
  });

  return NextResponse.json({ ok: true, sent: subs?.length ?? 0 });
}
