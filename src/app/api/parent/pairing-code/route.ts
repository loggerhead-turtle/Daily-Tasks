import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { authParent } from "@/lib/parentAuth";

// Generate a short-lived pairing code the kitchen board can enter once.
export async function POST() {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];

  const { error } = await ctx.admin.from("pairing_codes").insert({
    code,
    family_id: ctx.familyId,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  return NextResponse.json({ code, expiresInMinutes: 15 });
}
