import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import { applyReview } from "@/lib/review";

export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
