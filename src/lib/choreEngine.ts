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
  const active = (chores as Chore[]) ?? [];

  const dayOfWeek = parseISO(date).getDay();
  const due = active.filter((c) => isDueOn(c, date, dayOfWeek));
  const assignee = (c: Chore): string | null =>
    c.assign_type === "fixed"
      ? (c.member_id ?? null)
      : c.assign_type === "rotation"
        ? rotationMemberFor(c, date)
        : null; // grab/bounty chores stay unclaimed

  // What already exists for the day (so we only write real changes).
  const { data: existing } = await admin
    .from("chore_instances")
    .select("id, chore_id, member_id, status")
    .eq("family_id", familyId)
    .eq("date", date);
  const byChore = new Map((existing ?? []).map((i) => [i.chore_id, i]));

  // 1) Create instances for due chores that don't have one yet.
  const toInsert = due
    .filter((c) => !byChore.has(c.id))
    .map((c) => ({ family_id: familyId, chore_id: c.id, date, member_id: assignee(c) }));
  if (toInsert.length) {
    await admin
      .from("chore_instances")
      .upsert(toInsert, { onConflict: "chore_id,date", ignoreDuplicates: true });
  }

  // 2) Re-sync NOT-yet-started instances to the chore's current assignment, so
  //    edits made after the day started (e.g. turning a chore into a bounty)
  //    show up today. Completed/pending/approved instances are left untouched.
  for (const c of due) {
    const inst = byChore.get(c.id);
    if (inst && inst.status === "todo") {
      const mid = assignee(c);
      if (inst.member_id !== mid) {
        await admin.from("chore_instances").update({ member_id: mid }).eq("id", inst.id);
      }
    }
  }

  // 3) Remove not-started instances for chores that are no longer active or no
  //    longer scheduled today (deactivated or rescheduled after the day began).
  const dueIds = new Set(due.map((c) => c.id));
  const stale = (existing ?? [])
    .filter((i) => i.status === "todo" && !dueIds.has(i.chore_id))
    .map((i) => i.id);
  if (stale.length) {
    await admin.from("chore_instances").delete().in("id", stale);
  }
}
