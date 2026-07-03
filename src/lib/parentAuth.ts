import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";

export type ParentContext = {
  admin: SupabaseClient;
  userId: string;
  familyId: string;
};

// Parent API routes: authenticate the Supabase session, resolve the family.
export async function authParent(): Promise<ParentContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();
  if (!profile?.family_id) return null;
  return { admin, userId: user.id, familyId: profile.family_id };
}
