import { NextRequest, NextResponse } from "next/server";
import { authChild } from "@/lib/childAuth";
import { isUuid } from "@/lib/validate";
import { notifyParents } from "@/lib/push";

// A child taps "done" on their phone. Same rules as the board: fixed/rotation
// chores go to pending review; an unclaimed grab chore is claimed by them.
export async function POST(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId, memberId, member } = ctx;

  const { instanceId } = (await req.json()) as { instanceId?: string };
  if (!isUuid(instanceId)) {
    return NextResponse.json({ error: "Missing/invalid instanceId" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "That's not your chore" }, { status: 403 });
  }

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
