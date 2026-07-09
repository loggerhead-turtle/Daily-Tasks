import { NextRequest, NextResponse } from "next/server";
import { authBoard } from "@/lib/boardAuth";

export const dynamic = "force-dynamic";

// A kid proposes a bounty from the kitchen board. The board authenticates as a
// device, so the proposing child is passed as memberId (whoever's selected).
export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId } = ctx;

  const { memberId, title, cents, note } = (await req.json()) as {
    memberId?: string;
    title?: string;
    cents?: number;
    note?: string;
  };
  if (!memberId || !title?.trim()) {
    return NextResponse.json({ error: "Pick who's asking and name the bounty." }, { status: 400 });
  }

  // The member must be a child in this board's family.
  const { data: member } = await admin
    .from("members")
    .select("id, role")
    .eq("id", memberId)
    .eq("family_id", familyId)
    .single();
  if (!member || member.role !== "child") {
    return NextResponse.json({ error: "Bounties can only be proposed by a child." }, { status: 400 });
  }

  const { error } = await admin.from("bounty_proposals").insert({
    family_id: familyId,
    member_id: memberId,
    title: title.trim().slice(0, 120),
    emoji: "💪",
    cents: Math.max(0, Math.round(Number(cents) || 0)),
    note: note?.trim()?.slice(0, 300) || null,
    status: "pending",
  });
  if (error) return NextResponse.json({ error: "Couldn't send the request." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
