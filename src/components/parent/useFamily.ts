"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Family, Member } from "@/lib/types";

// Loads the signed-in parent's family + members (RLS scopes every query).
export function useFamily() {
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.family_id) {
      setLoading(false);
      return;
    }
    const [{ data: fam }, { data: mem }] = await Promise.all([
      supabase.from("families").select("*").eq("id", profile.family_id).single(),
      supabase.from("members").select("*").eq("family_id", profile.family_id).order("sort_order"),
    ]);
    setFamily(fam);
    setMembers(mem ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { family, members, loading, reload };
}
