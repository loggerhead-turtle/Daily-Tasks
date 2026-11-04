import { NextRequest, NextResponse } from "next/server";
import { authBoard, verifyParentPin } from "@/lib/boardAuth";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle PIN guessing: a 4–6 digit PIN is small enough to brute-force
  // without this. Keyed per board so one compromised board can't be used to
  // grind the PIN. ~10 tries/5 min, then a 15-min lockout.
  const limit = rateLimit(`pin:${ctx.boardId}`, {
    max: 10,
    windowMs: 5 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many PIN attempts — wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { pin } = (await req.json()) as { pin?: string };
  const ok = await verifyParentPin(ctx.admin, ctx.familyId, pin ?? null);
  if (!ok) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
