import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A parent's phone registers its push subscription. Keyed by profile_id (a
// parent authenticates as a profile, not a member). Requires the 0007 migration.
export async function POST(req: NextRequest) {
  const ctx = await authParent();
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
    { family_id: ctx.familyId, profile_id: ctx.userId, endpoint, p256dh, auth },
    { onConflict: "endpoint" }
  );
  if (error) {
    return NextResponse.json(
      { error: "Could not save subscription (run the 0007 migration?)" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// Turn notifications off for this phone.
export async function DELETE(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) {
    await ctx.admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return NextResponse.json({ ok: true });
}
