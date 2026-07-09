import { NextRequest, NextResponse } from "next/server";
import { authChild } from "@/lib/childAuth";

export const dynamic = "force-dynamic";

// A kid proposes a bounty (a job they think should exist) with a suggested
// price. A parent later accepts (optionally adjusting the price) or declines.
export async function POST(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, cents, note, emoji } = (await req.json()) as {
    title?: string;
    cents?: number;
    note?: string;
    emoji?: string;
  };
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Give your bounty a name." }, { status: 400 });
  }
  const price = Math.max(0, Math.round(Number(cents) || 0));

  const { error } = await ctx.admin.from("bounty_proposals").insert({
    family_id: ctx.familyId,
    member_id: ctx.memberId,
    title: title.trim().slice(0, 120),
    emoji: emoji?.trim()?.slice(0, 8) || "💪",
    cents: price,
    note: note?.trim()?.slice(0, 300) || null,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Couldn't send your request." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
