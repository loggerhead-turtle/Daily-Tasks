import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

// List which child members already have a phone login (memberId -> email).
export async function GET() {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: members } = await ctx.admin
    .from("members")
    .select("id")
    .eq("family_id", ctx.familyId);
  const memberIds = new Set((members as Pick<Member, "id">[] | null)?.map((m) => m.id) ?? []);

  const { data: profiles } = await ctx.admin
    .from("profiles")
    .select("id, member_id")
    .eq("role", "child");

  const logins: Record<string, string> = {};
  for (const p of profiles ?? []) {
    if (!p.member_id || !memberIds.has(p.member_id)) continue;
    const { data } = await ctx.admin.auth.admin.getUserById(p.id);
    if (data.user?.email) logins[p.member_id] = data.user.email;
  }
  return NextResponse.json({ logins });
}

// Create (or reset the password of) a child's phone login. The child account
// is a real auth user whose profile is role='child' with family_id NULL, so
// existing family-scoped RLS gives it no direct database access.
export async function POST(req: NextRequest) {
  const ctx = await authParent();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, email, password } = (await req.json()) as {
    memberId?: string;
    email?: string;
    password?: string;
  };
  if (!memberId || !email || !password) {
    return NextResponse.json({ error: "Missing memberId, email or password" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // The member must be a child in this parent's family.
  const { data: member } = await ctx.admin
    .from("members")
    .select("id, name, role, family_id")
    .eq("id", memberId)
    .eq("family_id", ctx.familyId)
    .single();
  if (!member) return NextResponse.json({ error: "Child not found" }, { status: 404 });
  if (member.role !== "child") {
    return NextResponse.json({ error: "Logins are for children only." }, { status: 400 });
  }

  // Already has a login? Update email/password instead of creating a duplicate.
  const { data: existing } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("role", "child")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing) {
    const { error } = await ctx.admin.auth.admin.updateUserById(existing.id, { email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, updated: true });
  }

  const { data: created, error: createErr } = await ctx.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? "Could not create login" }, { status: 400 });
  }

  const { error: profErr } = await ctx.admin.from("profiles").insert({
    id: created.user.id,
    family_id: null, // children are scoped via member_id, not family RLS
    role: "child",
    member_id: memberId,
    display_name: member.name,
  });
  if (profErr) {
    // Roll back the orphaned auth user so the parent can retry cleanly.
    await ctx.admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: "Could not link the login" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true });
}
