import { NextRequest, NextResponse } from "next/server";
import { authChild } from "@/lib/childAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A kid's phone registers its push subscription (from Chrome/Android etc.).
export async function POST(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription } = (await req.json()) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await ctx.admin.from("push_subscriptions").upsert(
    { family_id: ctx.familyId, member_id: ctx.memberId, endpoint, p256dh, auth },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Turn notifications off for this phone.
export async function DELETE(req: NextRequest) {
  const ctx = await authChild();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) {
    await ctx.admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return NextResponse.json({ ok: true });
}
