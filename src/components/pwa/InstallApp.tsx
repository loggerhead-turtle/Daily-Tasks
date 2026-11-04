"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Registers the service worker (needed for both offline/installability and web
// push) and, when Chrome offers it, shows an "Install app" button that fires
// the native install prompt. Renders nothing once the app is already installed
// or when the browser can't install (e.g. iOS Safari — users Add to Home Screen
// from the share menu there).
export default function InstallApp({
  label = "Install app",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone) setHidden(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setHidden(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setHidden(true);
        setDeferred(null);
      }}
      className={
        className ||
        "inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
      }
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
