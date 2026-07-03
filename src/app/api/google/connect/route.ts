import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { googleAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

// Starts the Google OAuth flow for the signed-in parent.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
    path: "/",
  });
  return response;
}
