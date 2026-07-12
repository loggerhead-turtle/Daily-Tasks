import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import { sendToSubs, type StoredSub } from "@/lib/push";
import type { BountyProposal, Member } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List pending bounty requests. Uses the service role so it works regardless
// of whether the bounty_proposals RLS policy was created.
export async function GET() {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await ctx.admin
    .from("bounty_proposals")
    .select("*")
    .eq("family_id", ctx.familyId)
    .eq("status", "pending")
    .order("created_at");
  return NextResponse.json({ proposals: (data as BountyProposal[] | null) ?? [] });
}

// Accept (posts a bounty at the given price) or decline a request.
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, cents } = (await req.json()) as {
    id?: string;
    action?: "accept" | "decline";
    cents?: number;
  };
  if (!id || !action) return NextResponse.json({ error: "Missing id/action" }, { status: 400 });

  const { data: prop } = await ctx.admin
    .from("bounty_proposals")
    .select("*")
    .eq("id", id)
    .eq("family_id", ctx.familyId)
    .single();
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = prop as BountyProposal;

  if (action === "decline") {
    await ctx.admin
      .from("bounty_proposals")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // Accept → create a one-time claimable bounty at the parent-set price.
  const price = Math.max(0, Math.round(Number(cents) || 0));
  const { data: created } = await ctx.admin
    .from("chores")
    .insert({
      family_id: ctx.familyId,
      title: p.title,
      emoji: p.emoji || "💪",
      points: 0,
      cents: price,
      assign_type: "grab",
      member_id: null,
      rotation_member_ids: [],
      recurrence: "once",
      days_of_week: [],
      once_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  await ctx.admin
    .from("bounty_proposals")
    .update({ status: "accepted", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  // Notify every kid a new bounty is up for grabs.
  const { data: members } = await ctx.admin
    .from("members")
    .select("id, role")
    .eq("family_id", ctx.familyId);
  const kidIds = (members as Pick<Member, "id" | "role">[] | null)?.filter((m) => m.role === "child").map((m) => m.id) ?? [];
  if (kidIds.length) {
    const { data: subs } = await ctx.admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("member_id", kidIds);
    await sendToSubs(ctx.admin, (subs as StoredSub[] | null) ?? [], {
      title: "💰 New bounty!",
      body: `${p.emoji || "💪"} ${p.title}${price > 0 ? ` — $${(price / 100).toFixed(2)}` : ""}`,
      url: "/me",
    });
  }

  return NextResponse.json({ ok: true, choreId: created?.id ?? null });
}
