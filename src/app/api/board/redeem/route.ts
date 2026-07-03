import { NextRequest, NextResponse } from "next/server";
import { authBoard } from "@/lib/boardAuth";

// A child asks to redeem a reward. Points are only deducted when a parent
// approves; pending redemptions are counted against the spendable balance.
export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId } = ctx;

  const { rewardId, memberId } = (await req.json()) as {
    rewardId?: string;
    memberId?: string;
  };
  if (!rewardId || !memberId) {
    return NextResponse.json({ error: "Missing rewardId/memberId" }, { status: 400 });
  }

  const [{ data: reward }, { data: ledger }, { data: pending }] = await Promise.all([
    admin.from("rewards").select("*").eq("id", rewardId).eq("family_id", familyId).single(),
    admin.from("points_ledger").select("delta").eq("member_id", memberId),
    admin
      .from("redemptions")
      .select("cost")
      .eq("member_id", memberId)
      .eq("status", "pending"),
  ]);
  if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });

  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  const held = (pending ?? []).reduce((s, r) => s + r.cost, 0);
  if (balance - held < reward.cost) {
    return NextResponse.json({ error: "Not enough points yet" }, { status: 409 });
  }

  const { data: redemption, error } = await admin
    .from("redemptions")
    .insert({
      family_id: familyId,
      reward_id: rewardId,
      member_id: memberId,
      cost: reward.cost,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ redemption });
}
