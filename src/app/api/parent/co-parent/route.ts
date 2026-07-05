import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authParent } from "@/lib/parentAuth";

export const dynamic = "force-dynamic";

// Find an existing auth user by email (admin listUsers is paginated).
async function findUserByEmail(admin: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null; // reached the last page
  }
  return null;
}

// Add a co-parent to this family, created pre-confirmed so they can sign in
// right away with no confirmation email. If the email already exists but is
// NOT yet an active member of a family (e.g. a stuck signup that never got
// confirmed), we repair it: confirm it, set the given password, and attach it
// to this family. We refuse to touch an email that's already active in a
// family, so this can't be used to hijack an account.
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password, name } = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };
  if (!email || !password || !name) {
    return NextResponse.json({ error: "Enter their name, email and a password." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const cleanEmail = email.trim().toLowerCase();

  const { data: created, error: createErr } = await ctx.admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    const { error: profErr } = await ctx.admin.from("profiles").upsert({
      id: created.user.id,
      family_id: ctx.familyId,
      role: "parent",
      display_name: name.trim(),
    });
    if (profErr) {
      await ctx.admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      return NextResponse.json({ error: "Could not add them to the family." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, created: true });
  }

  // Email already exists — try to repair a stuck/orphaned account.
  if (createErr && /already|registered|exists/i.test(createErr.message)) {
    const user = await findUserByEmail(ctx.admin, cleanEmail);
    if (!user) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }
    const { data: prof } = await ctx.admin
      .from("profiles")
      .select("id, family_id")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.family_id) {
      return NextResponse.json(
        { error: "That email is already an active account — ask them to just sign in." },
        { status: 400 }
      );
    }
    const { error: updErr } = await ctx.admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password,
    });
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    const { error: profErr } = await ctx.admin.from("profiles").upsert({
      id: user.id,
      family_id: ctx.familyId,
      role: "parent",
      display_name: name.trim(),
    });
    if (profErr) return NextResponse.json({ error: "Could not add them to the family." }, { status: 500 });
    return NextResponse.json({ ok: true, repaired: true });
  }

  return NextResponse.json(
    { error: createErr?.message ?? "Could not create the account" },
    { status: 400 }
  );
}
