import { NextRequest, NextResponse } from "next/server";
import { authBoard, verifyParentPin } from "@/lib/boardAuth";

export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin } = (await req.json()) as { pin?: string };
  const ok = await verifyParentPin(ctx.admin, ctx.familyId, pin ?? null);
  if (!ok) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
