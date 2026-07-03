import { NextRequest, NextResponse } from "next/server";
import { authBoard, verifyParentPin } from "@/lib/boardAuth";
import { sanitizeLayout } from "@/lib/boardLayout";

// Save the customized card layout. PIN-protected so kids can't rearrange
// the kitchen display mid-breakfast.
export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pinOk = await verifyParentPin(ctx.admin, ctx.familyId, req.headers.get("x-parent-pin"));
  if (!pinOk) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });

  const { layout } = (await req.json()) as { layout?: unknown };
  const clean = sanitizeLayout(layout);

  const { error } = await ctx.admin
    .from("families")
    .update({ board_layout: clean })
    .eq("id", ctx.familyId);
  if (error) return NextResponse.json({ error: "Failed to save layout" }, { status: 500 });
  return NextResponse.json({ ok: true, layout: clean });
}
