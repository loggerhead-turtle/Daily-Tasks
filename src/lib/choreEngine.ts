import type { SupabaseClient } from "@supabase/supabase-js";
import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";
import type { Chore } from "./types";

function isDueOn(chore: Chore, date: string, dayOfWeek: number): boolean {
  switch (chore.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return chore.days_of_week.includes(dayOfWeek);
    case "once":
      return chore.once_date === date;
  }
}

// Deterministic weekly rotation: same week → same kid, no state to store.
export function rotationMemberFor(chore: Chore, date: string): string | null {
  const ids = chore.rotation_member_ids;
  if (!ids.length) return null;
  const d = parseISO(date);
  const weekIndex = getISOWeekYear(d) * 53 + getISOWeek(d);
  return ids[weekIndex % ids.length];
}

// Materialize chore instances for a given local date. Idempotent — the
// unique (chore_id, date) constraint makes re-runs no-ops.
export async function ensureInstancesForDate(
  admin: SupabaseClient,
  familyId: string,
  date: string // yyyy-MM-dd in the family's local time (sent by the board)
) {
  const { data: chores } = await admin
    .from("chores")
    .select("*")
    .eq("family_id", familyId)
    .eq("active", true);
  if (!chores?.length) return;

  const dayOfWeek = parseISO(date).getDay();
  const rows = (chores as Chore[])
    .filter((c) => isDueOn(c, date, dayOfWeek))
    .map((c) => ({
      family_id: familyId,
      chore_id: c.id,
      date,
      member_id:
        c.assign_type === "fixed"
          ? c.member_id
          : c.assign_type === "rotation"
            ? rotationMemberFor(c, date)
            : null, // grab chores stay unclaimed
    }))
    .filter((r) => r.member_id !== undefined);

  if (rows.length) {
    await admin
      .from("chore_instances")
      .upsert(rows, { onConflict: "chore_id,date", ignoreDuplicates: true });
  }
}
