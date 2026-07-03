"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [familyChoice, setFamilyChoice] = useState<"create" | "join">("create");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            familyChoice === "create"
              ? { familyName, displayName }
              : { inviteCode, displayName }
          ),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Setup failed");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-sky-50 to-amber-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-5xl">🏠</div>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-800">Family Board</h1>
          <p className="text-sm text-slate-500">Parent sign in — the kitchen board pairs separately</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 text-sm font-bold transition ${
                  mode === m ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label className="label">Your name</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. Erik"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setFamilyChoice("create")}
                  className={`rounded-lg py-2 text-sm font-bold transition ${
                    familyChoice === "create" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                  }`}
                >
                  New family
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyChoice("join")}
                  className={`rounded-lg py-2 text-sm font-bold transition ${
                    familyChoice === "join" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Join with code
                </button>
              </div>
              {familyChoice === "create" ? (
                <div>
                  <label className="label">Family name</label>
                  <input
                    className="input"
                    required
                    placeholder="The Paul Family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Invite code</label>
                  <input
                    className="input uppercase"
                    required
                    placeholder="From the other parent's Family page (demo: DEMO2026)"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

          <button className="btn w-full py-3" disabled={busy}>
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
