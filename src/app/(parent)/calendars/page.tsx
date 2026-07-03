"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { CalendarLink } from "@/lib/types";

type Connection = { id: string; google_email: string };

function CalendarsInner() {
  const params = useSearchParams();
  const { family, members, loading } = useFamily();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [links, setLinks] = useState<CalendarLink[]>([]);

  const load = useCallback(async () => {
    if (!family) return;
    const supabase = createClient();
    const [{ data: conns }, { data: cals }] = await Promise.all([
      supabase.from("google_connections").select("id, google_email").eq("family_id", family.id),
      supabase.from("calendar_links").select("*").eq("family_id", family.id).order("label"),
    ]);
    setConnections((conns as Connection[]) ?? []);
    setLinks((cals as CalendarLink[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateLink(link: CalendarLink, patch: Partial<CalendarLink>) {
    await createClient().from("calendar_links").update(patch).eq("id", link.id);
    load();
  }

  async function removeConnection(conn: Connection) {
    if (!confirm(`Disconnect ${conn.google_email}? Its calendars disappear from the board.`)) return;
    await createClient().from("google_connections").delete().eq("id", conn.id);
    load();
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  const connError = params.get("error");
  const connected = params.get("connected");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Calendars</h1>
          <p className="text-sm text-slate-500">
            Read-only from Google Calendar. Each parent can connect their own account.
          </p>
        </div>
        <a className="btn" href="/api/google/connect">
          <CalendarPlus size={16} /> Connect Google account
        </a>
      </header>

      {connError && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{connError}</div>
      )}
      {connected && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Connected! Turn on the calendars you want on the board and assign them to a person below.
        </div>
      )}

      {connections.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No Google accounts connected yet. Connect yours to put your calendar on the kitchen board —
          your partner can sign in here and connect theirs too.
        </div>
      ) : (
        connections.map((conn) => (
          <section key={conn.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-800">{conn.google_email}</h2>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                onClick={() => removeConnection(conn)}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {links
                .filter((l) => l.connection_id === conn.id)
                .map((link) => (
                  <li key={link.id} className="flex flex-wrap items-center gap-3 py-3">
                    <label className="flex flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-violet-600"
                        checked={link.enabled}
                        onChange={(e) => updateLink(link, { enabled: e.target.checked })}
                      />
                      <span className="font-bold text-slate-700">{link.label}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase text-slate-400">Shown as</span>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          title={m.name}
                          onClick={() =>
                            updateLink(link, { member_id: link.member_id === m.id ? null : m.id })
                          }
                          className={`rounded-full transition ${
                            link.member_id === m.id ? "ring-2 ring-violet-500 ring-offset-1" : "opacity-40 hover:opacity-100"
                          }`}
                        >
                          <MemberAvatar member={m} size={30} />
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-slate-400">
              Assigning a calendar to a person puts it behind their photo on the board&apos;s calendar picker
              (and colors its events). Unassigned calendars only show in the &ldquo;Everyone&rdquo; view.
            </p>
          </section>
        ))
      )}
    </div>
  );
}

export default function CalendarsPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
      <CalendarsInner />
    </Suspense>
  );
}
