import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// After signup, a parent either creates a new family or joins an existing
// one with its invite code. Runs with the service role so it can create the
// family before the profile row (and its RLS scope) exists.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { familyName, inviteCode, displayName } = (await req.json()) as {
    familyName?: string;
    inviteCode?: string;
    displayName?: string;
  };

  const admin = createAdminClient();
  let familyId: string;

  if (inviteCode) {
    const { data: family } = await admin
      .from("families")
      .select("id")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .maybeSingle();
    if (!family) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    familyId = family.id;
  } else if (familyName) {
    const { data: family, error } = await admin
      .from("families")
      .insert({ name: familyName.trim() })
      .select("id")
      .single();
    if (error || !family) return NextResponse.json({ error: "Could not create family" }, { status: 500 });
    familyId = family.id;
  } else {
    return NextResponse.json({ error: "Provide familyName or inviteCode" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    family_id: familyId,
    display_name: displayName ?? user.email,
  });
  if (error) return NextResponse.json({ error: "Could not save profile" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
