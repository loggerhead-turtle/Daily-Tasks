"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";
import { MemberAvatar } from "@/components/parent/MemberChip";
import type { Member } from "@/lib/types";

const COLORS = ["#ec4899", "#8b5cf6", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#f97316"];
const EMOJI = ["🦄", "🦖", "🐱", "🐶", "🦊", "🐼", "🦋", "🦅", "🐸", "🐙", "🦁", "🐧"];

export default function FamilyPage() {
  const { family, members, loading, reload } = useFamily();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "child">("child");
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const fileInputs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Child phone logins (memberId -> email) and the inline "set login" editor.
  const [logins, setLogins] = useState<Record<string, string>>({});
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loadLogins = useCallback(async () => {
    const res = await fetch("/api/parent/child-login");
    if (res.ok) setLogins((await res.json()).logins ?? {});
  }, []);

  useEffect(() => {
    loadLogins();
  }, [loadLogins]);

  function openLogin(m: Member) {
    setLoginFor(m.id);
    setLoginEmail(logins[m.id] ?? "");
    setLoginPassword("");
    setLoginError(null);
  }

  async function saveLogin(memberId: string) {
    setLoginBusy(true);
    setLoginError(null);
    const res = await fetch("/api/parent/child-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, login: loginEmail.trim(), password: loginPassword }),
    });
    setLoginBusy(false);
    if (!res.ok) {
      setLoginError((await res.json()).error ?? "Couldn't save the login");
      return;
    }
    setLoginFor(null);
    await loadLogins();
  }

  async function save() {
    if (!family || !name.trim()) return;
    await createClient().from("members").insert({
      family_id: family.id,
      name: name.trim(),
      role,
      color,
      emoji,
      sort_order: members.length,
    });
    setName("");
    setAdding(false);
    reload();
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name}? Their chores and points history will be deleted too.`)) return;
    await createClient().from("members").delete().eq("id", m.id);
    reload();
  }

  async function uploadAvatar(m: Member, file: File) {
    if (!family) return;
    const supabase = createClient();
    const path = `${family.id}/${m.id}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("members").update({ avatar_url: data.publicUrl }).eq("id", m.id);
    reload();
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Family</h1>
          <p className="text-sm text-slate-500">
            Everyone here appears on the board. Photos make the calendar picker magic for little ones.
          </p>
        </div>
        {!adding && (
          <button className="btn" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add person
          </button>
        )}
      </header>

      {family && (
        <div className="card flex items-center justify-between !py-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Invite the other parent</p>
            <p className="text-xs text-slate-500">They sign up with this code to co-manage the family.</p>
          </div>
          <code className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-violet-700">
            {family.invite_code}
          </code>
        </div>
      )}

      {adding && (
        <div className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Ava" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <div className="flex gap-2">
                {(["child", "parent"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-bold capitalize transition ${
                      role === r ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Signature color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-slate-800" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Emoji (until you upload a photo)</label>
            <div className="flex flex-wrap gap-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`rounded-xl p-2 text-2xl transition ${
                    emoji === e ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Add to family</button>
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.id} className="card flex flex-col gap-3 !p-4">
            <div className="flex items-center gap-4">
              <MemberAvatar member={m} size={56} />
              <div className="flex-1">
                <p className="font-display text-lg font-bold text-slate-800">{m.name}</p>
                <p className="text-xs capitalize text-slate-500">
                  {m.role}
                  {m.role === "child" && logins[m.id] && (
                    <span className="ml-1 text-emerald-600">· has a phone login</span>
                  )}
                </p>
              </div>
              <input
                ref={(el) => {
                  if (el) fileInputs.current.set(m.id, el);
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(m, f);
                  e.target.value = "";
                }}
              />
              {m.role === "child" && (
                <button
                  className="btn-secondary !px-2.5 !py-1.5 text-xs"
                  onClick={() => openLogin(m)}
                >
                  <KeyRound size={14} /> {logins[m.id] ? "Reset login" : "Set login"}
                </button>
              )}
              <button
                className="btn-secondary !px-2.5 !py-1.5 text-xs"
                onClick={() => fileInputs.current.get(m.id)?.click()}
              >
                <Upload size={14} /> Photo
              </button>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                onClick={() => remove(m)}
              >
                <Trash2 size={18} />
              </button>
            </div>

            {loginFor === m.id && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold text-slate-500">
                  {m.name} signs in at the same login page. Use a simple username (e.g.{" "}
                  <span className="font-mono">ava</span>) or an email — plus a password.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="Username or email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Password (min 8 chars)"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                {loginError && <p className="mt-2 text-xs font-bold text-rose-600">{loginError}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    className="btn !py-1.5 text-xs"
                    disabled={loginBusy}
                    onClick={() => saveLogin(m.id)}
                  >
                    {loginBusy ? "Saving…" : "Save login"}
                  </button>
                  <button className="btn-secondary !py-1.5 text-xs" onClick={() => setLoginFor(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
