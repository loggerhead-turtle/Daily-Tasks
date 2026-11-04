"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type PushState = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

// A notifications toggle for the parent app. Subscribes this phone to web push
// against the parent's profile so they get "needs your OK" alerts. Mirrors the
// kid page's logic but posts to the parent subscribe endpoint.
export default function PushBell({
  subscribePath = "/api/parent/push/subscribe",
  label = "Notifications",
}: {
  subscribePath?: string;
  label?: string;
}) {
  const [push, setPush] = useState<PushState>("loading");
  const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      !!VAPID;
    if (!supported) return setPush("unsupported");
    if (Notification.permission === "denied") return setPush("denied");
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPush(sub ? "on" : "off"))
      .catch(() => setPush("off"));
  }, [VAPID]);

  async function enable() {
    if (!VAPID) return;
    setPush("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setPush(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as unknown as BufferSource,
      });
      const res = await fetch(subscribePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setPush(res.ok ? "on" : "off");
    } catch {
      setPush("off");
    }
  }

  async function disable() {
    setPush("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(subscribePath, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPush("off");
    } catch {
      setPush("off");
    }
  }

  if (push === "unsupported" || push === "loading") return null;

  const on = push === "on";
  return (
    <button
      onClick={on ? disable : enable}
      disabled={push === "busy" || push === "denied"}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${
        on ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
      title={
        push === "denied"
          ? "Notifications are blocked in your phone/browser settings"
          : on
            ? "Notifications on — tap to turn off"
            : "Turn on notifications"
      }
    >
      {on ? <Bell size={17} /> : <BellOff size={17} />}
      <span>{push === "denied" ? "Blocked" : on ? "Alerts on" : label}</span>
    </button>
  );
}
