import { NextRequest, NextResponse } from "next/server";
import { authParent } from "@/lib/parentAuth";

export const dynamic = "force-dynamic";

function friendlyAuthError(msg: string): string {
  if (/already|registered|exists/i.test(msg)) {
    return "That email already has an account. Ask them to sign in, or use a different email.";
  }
  return msg;
}

// Add a co-parent to this family. Created pre-confirmed (email_confirm: true)
// so they can sign in right away without a confirmation email — the same way
// child logins are created. The new account gets a full parent profile in
// this family.
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

  const { data: created, error: createErr } = await ctx.admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: friendlyAuthError(createErr?.message ?? "Could not create the account") },
      { status: 400 }
    );
  }

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

  return NextResponse.json({ ok: true });
}
