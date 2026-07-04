"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, MapPin, MonitorSmartphone, Trash2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/parent/useFamily";

type GeoResult = { name: string; admin1?: string; country_code: string; latitude: number; longitude: number };
type Device = { id: string; name: string; last_seen_at: string | null; created_at: string };

export default function SettingsPage() {
  const { family, loading, reload } = useFamily();
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [saverMinutes, setSaverMinutes] = useState<number | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (!family) return;
    const { data } = await createClient()
      .from("boards")
      .select("id, name, last_seen_at, created_at")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false });
    setDevices((data as Device[]) ?? []);
  }, [family]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  async function revokeDevice(d: Device) {
    if (!confirm(`Unpair "${d.name}"? It will drop to the pairing screen and need a new code.`)) return;
    setRevoking(d.id);
    // Deleting the board row invalidates its token; the board gets a 401 on its
    // next poll and returns to the pairing screen on its own.
    await createClient().from("boards").delete().eq("id", d.id);
    setRevoking(null);
    loadDevices();
  }

  async function savePin() {
    setPinMsg(null);
    const res = await fetch("/api/parent/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    setPinMsg(res.ok ? "PIN saved ✓" : (data.error ?? "Failed"));
    if (res.ok) {
      setPin("");
      reload();
    }
  }

  async function generateCode() {
    const res = await fetch("/api/parent/pairing-code", { method: "POST" });
    if (res.ok) setPairCode((await res.json()).code);
  }

  async function searchLocation() {
    if (!query.trim()) return;
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`
    );
    const data = await res.json();
    setResults(data.results ?? []);
  }

  async function pickLocation(r: GeoResult) {
    if (!family) return;
    await createClient()
      .from("families")
      .update({
        weather_lat: r.latitude,
        weather_lon: r.longitude,
        weather_location: `${r.name}${r.admin1 ? `, ${r.admin1}` : ""}`,
      })
      .eq("id", family.id);
    setResults([]);
    setQuery("");
    reload();
  }

  async function saveScreensaver() {
    if (!family || saverMinutes == null) return;
    await createClient()
      .from("families")
      .update({ screensaver_minutes: saverMinutes })
      .eq("id", family.id);
    reload();
  }

  if (loading || !family) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Board pairing, parent PIN, weather and screensaver.</p>
      </header>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-800">
          <MonitorSmartphone size={18} /> Pair the kitchen board
        </h2>
        <p className="text-sm text-slate-500">
          On the Raspberry Pi, open <code className="rounded bg-slate-100 px-1">/board</code> and enter this
          code. Codes work once and expire after 15 minutes.
        </p>
        <div className="flex items-center gap-3">
          <button className="btn" onClick={generateCode}>Generate pairing code</button>
          {pairCode && (
            <code className="rounded-lg bg-violet-50 px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-violet-700">
              {pairCode}
            </code>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-sm font-bold text-slate-700">Paired devices</h3>
          {devices.length === 0 ? (
            <p className="text-sm text-slate-400">
              No devices paired yet. Generate a code above and enter it on the board.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <MonitorSmartphone size={18} className="shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {d.last_seen_at
                        ? `Last seen ${formatDistanceToNow(parseISO(d.last_seen_at), { addSuffix: true })}`
                        : "Never connected"}
                    </p>
                  </div>
                  <button
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    onClick={() => revokeDevice(d)}
                    disabled={revoking === d.id}
                    aria-label={`Unpair ${d.name}`}
                    title="Unpair this device"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-800">
          <KeyRound size={18} /> Parent PIN on the board
        </h2>
        <p className="text-sm text-slate-500">
          Unlocks approvals and settings on the board itself (tap the ⚙️ in the corner).{" "}
          {family.parent_pin_hash ? "A PIN is set — enter a new one to change it." : "No PIN set yet."}
        </p>
        <div className="flex items-center gap-2">
          <input
            className="input max-w-40 text-center font-mono text-lg tracking-widest"
            inputMode="numeric"
            placeholder="4–6 digits"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn" onClick={savePin} disabled={pin.length < 4}>Save PIN</button>
          {pinMsg && <span className="text-sm font-semibold text-slate-500">{pinMsg}</span>}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-800">
          <MapPin size={18} /> Weather location
        </h2>
        <p className="text-sm text-slate-500">
          Currently: <strong>{family.weather_location ?? "not set"}</strong>
        </p>
        <div className="flex gap-2">
          <input
            className="input max-w-sm"
            placeholder="Search a city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchLocation()}
          />
          <button className="btn-secondary" onClick={searchLocation}>Search</button>
        </div>
        {results.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-violet-50"
                  onClick={() => pickLocation(r)}
                >
                  {r.name}
                  {r.admin1 ? `, ${r.admin1}` : ""} ({r.country_code})
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-800">🌙 Screensaver</h2>
        <p className="text-sm text-slate-500">
          After how many idle minutes the board becomes a photo frame (photos upload on Board content).
        </p>
        <div className="flex items-center gap-2">
          <input
            className="input max-w-24 text-center"
            type="number"
            min={1}
            max={120}
            value={saverMinutes ?? family.screensaver_minutes}
            onChange={(e) => setSaverMinutes(Number(e.target.value))}
          />
          <span className="text-sm text-slate-500">minutes</span>
          <button className="btn" onClick={saveScreensaver} disabled={saverMinutes == null}>Save</button>
        </div>
      </section>
    </div>
  );
}
