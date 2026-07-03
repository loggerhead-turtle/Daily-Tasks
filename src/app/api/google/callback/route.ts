import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode, fetchCalendarList, fetchGoogleEmail } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/calendars?error=${encodeURIComponent(reason)}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || state !== cookieState) return fail("Authorization was cancelled");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();
  if (!profile?.family_id) return fail("No family set up yet");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return fail("Google did not return a refresh token — try again");
    const email = await fetchGoogleEmail(tokens.access_token);

    const { data: connection, error } = await admin
      .from("google_connections")
      .upsert(
        {
          family_id: profile.family_id,
          profile_id: user.id,
          google_email: email,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expires: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        { onConflict: "family_id,google_email" }
      )
      .select()
      .single();
    if (error || !connection) return fail("Could not save the connection");

    // Import the calendar list; the parent enables + assigns each one to a
    // family member on the Calendars page.
    const calendars = await fetchCalendarList(tokens.access_token);
    if (calendars.length) {
      await admin.from("calendar_links").upsert(
        calendars.map((c) => ({
          family_id: profile.family_id,
          connection_id: connection.id,
          google_calendar_id: c.id,
          label: c.summary,
          color: c.backgroundColor ?? null,
          enabled: !!c.primary,
        })),
        { onConflict: "connection_id,google_calendar_id", ignoreDuplicates: true }
      );
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Connection failed");
  }

  const response = NextResponse.redirect(`${appUrl}/calendars?connected=1`);
  response.cookies.delete("google_oauth_state");
  return response;
}
