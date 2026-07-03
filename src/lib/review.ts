import type { SupabaseClient } from "@supabase/supabase-js";

// Shared approve/reject logic for completed chores and reward redemptions.
// Used by both the board's PIN-protected parent mode and the parent web app.
export async function applyReview(
  admin: SupabaseClient,
  familyId: string,
  type: "chore" | "redemption",
  id: string,
  action: "approve" | "reject"
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const status = action === "approve" ? "approved" : "rejected";
  const now = new Date().toISOString();

  if (type === "chore") {
    const { data: instance } = await admin
      .from("chore_instances")
      .select("*, chore:chores(points, title, emoji)")
      .eq("id", id)
      .eq("family_id", familyId)
      .eq("status", "pending")
      .single();
    if (!instance) return { ok: false, error: "Not found", status: 404 };

    const points = action === "approve" ? (instance.chore?.points ?? 0) : 0;
    await admin
      .from("chore_instances")
      .update({
        status,
        reviewed_at: now,
        points_awarded: points,
        // A rejected chore goes back on the child's list to redo.
        completed_at: action === "approve" ? instance.completed_at : null,
      })
      .eq("id", id);
    if (action === "approve" && points > 0 && instance.member_id) {
      await admin.from("points_ledger").insert({
        family_id: familyId,
        member_id: instance.member_id,
        delta: points,
        reason: `${instance.chore?.emoji ?? ""} ${instance.chore?.title ?? "Chore"}`.trim(),
      });
    }
    return { ok: true };
  }

  const { data: redemption } = await admin
    .from("redemptions")
    .select("*, reward:rewards(title, emoji)")
    .eq("id", id)
    .eq("family_id", familyId)
    .eq("status", "pending")
    .single();
  if (!redemption) return { ok: false, error: "Not found", status: 404 };

  await admin.from("redemptions").update({ status, reviewed_at: now }).eq("id", id);
  if (action === "approve") {
    await admin.from("points_ledger").insert({
      family_id: familyId,
      member_id: redemption.member_id,
      delta: -redemption.cost,
      reason: `${redemption.reward?.emoji ?? "🎁"} ${redemption.reward?.title ?? "Reward"}`.trim(),
    });
  }
  return { ok: true };
}
