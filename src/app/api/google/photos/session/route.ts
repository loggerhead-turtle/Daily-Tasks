import { NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import { createPickerSession, getAccessToken } from "@/lib/google";
import type { GoogleConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

// Start a Google Photos picking session and hand the parent the pickerUri to
// open. They select photos there; /api/google/photos/import copies them in.
export async function POST() {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conns } = await ctx.admin
    .from("google_connections")
    .select("*")
    .eq("family_id", ctx.familyId);
  const list = (conns as GoogleConnection[] | null) ?? [];
  // Prefer the signed-in parent's own connection, else any family connection.
  const conn = list.find((c) => c.profile_id === ctx.userId) ?? list[0];
  if (!conn) {
    return NextResponse.json(
      { error: "Connect a Google account on the Calendars page first." },
      { status: 400 }
    );
  }

  try {
    const token = await getAccessToken(ctx.admin, conn);
    const session = await createPickerSession(token);
    return NextResponse.json({ sessionId: session.id, pickerUri: session.pickerUri });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`Photos picker session failed: ${detail}`);
    // 403 typically means the scope wasn't granted or the API isn't enabled.
    const needsReconnect = /photospicker|insufficient|scope|403|PERMISSION_DENIED/i.test(detail);
    return NextResponse.json(
      {
        error: needsReconnect
          ? "Google Photos access isn't granted yet. Reconnect your Google account on the Calendars page, and make sure the Photos Picker API is enabled in your Google Cloud project."
          : "Couldn't start Google Photos. Try again.",
      },
      { status: 400 }
    );
  }
}
