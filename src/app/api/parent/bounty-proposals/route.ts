import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authParent } from "@/lib/parentAuth";
import { sendToSubs, type StoredSub } from "@/lib/push";
import type { BountyProposal } from "@/lib/types";

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

async function notifyMember(
  admin: SupabaseClient,
  memberId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);
  await sendToSubs(admin, (subs as StoredSub[] | null) ?? [], payload);
}

// Review a bounty request:
//  - decline: reject it
//  - approve: post it as a one-time chore ASSIGNED to the child who proposed
//    it (they complete it, and the money lands when you approve the completion)
//  - approve_complete: same, but immediately mark it done and pay the child now
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, cents } = (await req.json()) as {
    id?: string;
    action?: "decline" | "approve" | "approve_complete";
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

  const price = Math.max(0, Math.round(Number(cents) || 0));
  const today = new Date().toISOString().slice(0, 10);

  // Create the chore, assigned to the child who proposed it.
  const { data: created } = await ctx.admin
    .from("chores")
    .insert({
      family_id: ctx.familyId,
      title: p.title,
      emoji: p.emoji || "💪",
      points: 0,
      cents: price,
      assign_type: "fixed",
      member_id: p.member_id,
      rotation_member_ids: [],
      recurrence: "once",
      days_of_week: [],
      once_date: today,
    })
    .select("id")
    .single();
  if (!created) return NextResponse.json({ error: "Couldn't create the chore" }, { status: 500 });

  const now = new Date().toISOString();
  if (action === "approve_complete") {
    // Post it already done and pay the child immediately.
    const { data: inst } = await ctx.admin
      .from("chore_instances")
      .insert({
        family_id: ctx.familyId,
        chore_id: created.id,
        date: today,
        member_id: p.member_id,
        status: "approved",
        completed_at: now,
        reviewed_at: now,
        points_awarded: 0,
      })
      .select("id")
      .single();
    if (price > 0) {
      await ctx.admin.from("earnings").insert({
        family_id: ctx.familyId,
        member_id: p.member_id,
        cents: price,
        reason: p.title,
        kind: "chore",
        chore_instance_id: inst?.id ?? null,
      });
    }
    await notifyMember(ctx.admin, p.member_id, {
      title: "💵 You got paid!",
      body: `${p.emoji || "💪"} ${p.title}${price > 0 ? ` — $${(price / 100).toFixed(2)}` : ""}`,
      url: "/me",
    });
  } else {
    // Send it as a job for the child to complete.
    await ctx.admin.from("chore_instances").insert({
      family_id: ctx.familyId,
      chore_id: created.id,
      date: today,
      member_id: p.member_id,
      status: "todo",
    });
    await notifyMember(ctx.admin, p.member_id, {
      title: "✅ New job for you",
      body: `${p.emoji || "💪"} ${p.title}${price > 0 ? ` — $${(price / 100).toFixed(2)}` : ""}`,
      url: "/me",
    });
  }

  await ctx.admin
    .from("bounty_proposals")
    .update({ status: "accepted", reviewed_at: now })
    .eq("id", id);

  return NextResponse.json({ ok: true, choreId: created.id });
}
