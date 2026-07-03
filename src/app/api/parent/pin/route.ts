import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authParent } from "@/lib/parentAuth";

// Set or change the board's parent-mode PIN (hashed server-side).
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin } = (await req.json()) as { pin?: string };
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  }

  const hash = await bcrypt.hash(pin, 10);
  const { error } = await ctx.admin
    .from("families")
    .update({ parent_pin_hash: hash })
    .eq("id", ctx.familyId);
  if (error) return NextResponse.json({ error: "Failed to save PIN" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
