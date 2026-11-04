import { NextRequest, NextResponse } from "next/server";
import { authBoard } from "@/lib/boardAuth";
import { isUuid } from "@/lib/validate";
import { notifyParents } from "@/lib/push";

// A child taps "done". Fixed/rotation chores go to pending review; an
// unclaimed grab chore is claimed by the tapping child at the same time.
export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId } = ctx;

  const { instanceId, memberId } = (await req.json()) as {
    instanceId?: string;
    memberId?: string;
  };
  if (!isUuid(instanceId) || !isUuid(memberId)) {
    return NextResponse.json({ error: "Missing/invalid instanceId or memberId" }, { status: 400 });
  }

  // The claimer must be a child in THIS board's family — never an arbitrary id.
  const { data: member } = await admin
    .from("members")
    .select("id, name")
    .eq("id", memberId)
    .eq("family_id", familyId)
    .eq("role", "child")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Unknown child" }, { status: 400 });

  const { data: instance } = await admin
    .from("chore_instances")
    .select("*, chore:chores(title, emoji)")
    .eq("id", instanceId)
    .eq("family_id", familyId)
    .single();
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (instance.status !== "todo" && instance.status !== "rejected") {
    return NextResponse.json({ error: "Already completed" }, { status: 409 });
  }
  if (instance.member_id && instance.member_id !== memberId) {
    return NextResponse.json({ error: "Assigned to someone else" }, { status: 403 });
  }

  // Guard the grab-chore race: only claim if still unclaimed (or already ours).
  const { data: updated, error } = await admin
    .from("chore_instances")
    .update({
      member_id: memberId,
      status: "pending",
      completed_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .in("status", ["todo", "rejected"])
    .or(`member_id.is.null,member_id.eq.${memberId}`)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Someone beat you to it!" }, { status: 409 });
  }

  const title = `${instance.chore?.emoji ?? ""} ${instance.chore?.title ?? "A chore"}`.trim();
  await notifyParents(admin, familyId, {
    title: "⏳ Needs your OK",
    body: `${member.name} finished ${title}`,
    url: "/",
  });
  return NextResponse.json({ instance: updated });
}
