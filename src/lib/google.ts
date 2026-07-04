import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent, CalendarLink, GoogleConnection, Member } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const PICKER_BASE = "https://photospicker.googleapis.com/v1";
export const GOOGLE_SCOPES =
  "openid email " +
  "https://www.googleapis.com/auth/calendar.readonly " +
  // Photos Picker: the user hand-picks images in a Google-hosted dialog; the
  // app never gets to browse their library (broad album read was retired in 2025).
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true", // keep previously-granted scopes (e.g. calendar)
    prompt: "consent", // always get a refresh token
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };
}

export async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  const info = (await res.json()) as { email: string };
  return info.email;
}

export async function fetchCalendarList(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to list Google calendars");
  const data = (await res.json()) as {
    items?: { id: string; summary: string; backgroundColor?: string; primary?: boolean }[];
  };
  return data.items ?? [];
}

// Returns a valid access token for a stored connection, refreshing (and
// persisting) it when expired.
export async function getAccessToken(
  admin: SupabaseClient,
  conn: GoogleConnection
): Promise<string> {
  if (
    conn.access_token &&
    conn.access_token_expires &&
    new Date(conn.access_token_expires).getTime() > Date.now() + 60_000
  ) {
    return conn.access_token;
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await admin
    .from("google_connections")
    .update({
      access_token: data.access_token,
      access_token_expires: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    })
    .eq("id", conn.id);
  return data.access_token;
}

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

// Fetch and merge events for every enabled linked calendar in a family.
// Returns any per-calendar problems (expired token, Google errors) alongside
// the events so the board can tell "genuinely free day" apart from "couldn't
// reach Google" — otherwise both just look like an empty calendar.
export async function fetchFamilyEvents(
  admin: SupabaseClient,
  familyId: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: CalendarEvent[]; issues: string[] }> {
  const [{ data: links }, { data: conns }, { data: members }] = await Promise.all([
    admin.from("calendar_links").select("*").eq("family_id", familyId).eq("enabled", true),
    admin.from("google_connections").select("*").eq("family_id", familyId),
    admin.from("members").select("*").eq("family_id", familyId),
  ]);
  if (!conns?.length) return { events: [], issues: ["No Google account is connected."] };
  if (!links?.length)
    return { events: [], issues: ["No calendars are turned on — enable them on the Calendars page."] };

  const connById = new Map((conns as GoogleConnection[]).map((c) => [c.id, c]));
  const memberById = new Map((members as Member[] | null)?.map((m) => [m.id, m]) ?? []);
  const tokenCache = new Map<string, Promise<string>>();
  const issues: string[] = [];

  const results = await Promise.all(
    (links as CalendarLink[]).map(async (link) => {
      const conn = connById.get(link.connection_id);
      if (!conn) return [];
      if (!tokenCache.has(conn.id)) tokenCache.set(conn.id, getAccessToken(admin, conn));
      try {
        const token = await tokenCache.get(conn.id)!;
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        });
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            link.google_calendar_id
          )}/events?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const body = await res.text();
          const msg = `Google Calendar "${link.label}" (${conn.google_email}) returned ${res.status}: ${body.slice(0, 300)}`;
          console.error(msg);
          issues.push(`Couldn't load "${link.label}" (Google returned ${res.status}).`);
          return [];
        }
        const data = (await res.json()) as { items?: GoogleEvent[] };
        const color =
          link.color ?? (link.member_id ? memberById.get(link.member_id)?.color : null) ?? "#64748b";
        return (data.items ?? [])
          .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
          .map<CalendarEvent>((e) => ({
            id: `${link.id}:${e.id}`,
            title: e.summary || "(busy)",
            start: e.start!.dateTime ?? e.start!.date!,
            end: e.end?.dateTime ?? e.end?.date ?? e.start!.dateTime ?? e.start!.date!,
            allDay: !e.start!.dateTime,
            color,
            memberId: link.member_id,
            calendarLabel: link.label,
          }));
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error(`Calendar fetch failed for "${link.label}" (${conn.google_email}): ${detail}`);
        // A refresh-token failure (Google apps left in "Testing" expire them
        // after 7 days) surfaces here — tell the parent to reconnect.
        issues.push(
          /invalid_grant|token/i.test(detail)
            ? `${conn.google_email}'s Google sign-in expired — reconnect it on the Calendars page.`
            : `Couldn't reach Google for "${link.label}".`
        );
        return [];
      }
    })
  );
  return {
    events: results.flat().sort((a, b) => a.start.localeCompare(b.start)),
    issues: Array.from(new Set(issues)),
  };
}

// ── Google Photos Picker ───────────────────────────────────────────────────
// Broad library/album read access was retired in 2025, so we use the Picker:
// create a session, send the parent to pickerUri to choose photos, then read
// back exactly the items they selected and copy the bytes into our own bucket.

export type PickerSession = {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
};

type PickedMediaItem = {
  id: string;
  type?: string; // "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED"
  mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string };
};

export async function createPickerSession(accessToken: string): Promise<PickerSession> {
  const res = await fetch(`${PICKER_BASE}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Couldn't start Google Photos picker: ${await res.text()}`);
  return (await res.json()) as PickerSession;
}

export async function getPickerSession(
  accessToken: string,
  sessionId: string
): Promise<PickerSession> {
  const res = await fetch(`${PICKER_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't check picker session: ${await res.text()}`);
  return (await res.json()) as PickerSession;
}

export async function deletePickerSession(accessToken: string, sessionId: string): Promise<void> {
  await fetch(`${PICKER_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

// All photos the parent selected in this session (paginated).
export async function listPickedPhotos(
  accessToken: string,
  sessionId: string
): Promise<{ baseUrl: string; mimeType: string; filename: string }[]> {
  const out: { baseUrl: string; mimeType: string; filename: string }[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ sessionId, pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${PICKER_BASE}/mediaItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Couldn't read picked photos: ${await res.text()}`);
    const data = (await res.json()) as { mediaItems?: PickedMediaItem[]; nextPageToken?: string };
    for (const item of data.mediaItems ?? []) {
      if (item.type === "PHOTO" && item.mediaFile?.baseUrl) {
        out.push({
          baseUrl: item.mediaFile.baseUrl,
          mimeType: item.mediaFile.mimeType ?? "image/jpeg",
          filename: item.mediaFile.filename ?? "photo.jpg",
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Download the full-resolution bytes for a picked photo. Picker baseUrls
// require the access token and the "=d" download parameter.
export async function downloadPickedPhoto(accessToken: string, baseUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(`${baseUrl}=d`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Couldn't download a photo (${res.status})`);
  return res.arrayBuffer();
}
