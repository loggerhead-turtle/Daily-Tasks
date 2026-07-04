import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { Member } from "./types";

export type ChildContext = {
  admin: SupabaseClient;
  userId: string;
  memberId: string;
  familyId: string;
  member: Member;
};

// Child API routes: authenticate the Supabase session, confirm it's a child
// account, and resolve their member row (and family via that member). A child
// profile has family_id = NULL by design, so we go through the member link.
export async function authChild(): Promise<ChildContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, member_id")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "child" || !profile.member_id) return null;

  const { data: member } = await admin
    .from("members")
    .select("*")
    .eq("id", profile.member_id)
    .single();
  if (!member) return null;

  return {
    admin,
    userId: user.id,
    memberId: member.id,
    familyId: member.family_id,
    member: member as Member,
  };
}
