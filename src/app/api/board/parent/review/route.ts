import { NextRequest, NextResponse } from "next/server";
import { authBoard, verifyParentPin } from "@/lib/boardAuth";
import { applyReview } from "@/lib/review";

// Parent mode on the board: approve/reject a completed chore or a reward
// redemption. Every call re-verifies the PIN from the x-parent-pin header.
export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pinOk = await verifyParentPin(ctx.admin, ctx.familyId, req.headers.get("x-parent-pin"));
  if (!pinOk) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });

  const { type, id, action } = (await req.json()) as {
    type?: "chore" | "redemption";
    id?: string;
    action?: "approve" | "reject";
  };
  if (!type || !id || !action) {
    return NextResponse.json({ error: "Missing type/id/action" }, { status: 400 });
  }

  const result = await applyReview(ctx.admin, ctx.familyId, type, id, action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
