import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

// Web Push is only active when VAPID keys are set in the environment.
export function pushReady(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:board@familyboard.app", pub, priv);
    configured = true;
  }
  return true;
}

export type StoredSub = { id: string; endpoint: string; p256dh: string; auth: string };

export type PushPayload = { title: string; body: string; url?: string };

// Notify a single family member (a kid) on every phone they've registered.
export async function notifyMember(
  admin: SupabaseClient,
  memberId: string,
  payload: PushPayload
): Promise<void> {
  if (!pushReady()) return;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);
  await sendToSubs(admin, (subs as StoredSub[] | null) ?? [], payload);
}

// Notify every parent of a family (phones registered against a profile_id).
// Best-effort: if the 0007 migration hasn't run yet, the column is missing and
// we simply skip rather than break the action that triggered the notification.
export async function notifyParents(
  admin: SupabaseClient,
  familyId: string,
  payload: PushPayload
): Promise<void> {
  if (!pushReady()) return;
  try {
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("family_id", familyId)
      .not("profile_id", "is", null);
    if (error) return;
    await sendToSubs(admin, (subs as StoredSub[] | null) ?? [], payload);
  } catch {
    /* column/table not ready — parent push is optional */
  }
}

// Send one notification to every given subscription, pruning dead ones.
export async function sendToSubs(
  admin: SupabaseClient,
  subs: StoredSub[],
  payload: PushPayload
): Promise<void> {
  if (!pushReady() || subs.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (e) {
        const code =
          e && typeof e === "object" && "statusCode" in e ? (e as { statusCode: number }).statusCode : 0;
        // 404/410 mean the subscription is gone — remove it so we stop trying.
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );
}
