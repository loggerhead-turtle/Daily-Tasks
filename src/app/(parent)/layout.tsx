"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Gift,
  Home,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  MoreHorizontal,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstallApp from "@/components/pwa/InstallApp";
import PushBell from "@/components/pwa/PushBell";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: boolean;
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home, badge: true },
  { href: "/chores", label: "Chores", icon: ListChecks },
  { href: "/earnings", label: "Money", icon: Wallet },
  { href: "/family", label: "Family", icon: Users },
];
const SECONDARY: NavItem[] = [
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/content", label: "Board content", icon: MonitorSmartphone },
  { href: "/settings", label: "Settings", icon: Settings },
];
const ALL: NavItem[] = [...PRIMARY, ...SECONDARY];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
      {n}
    </span>
  );
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // How many things are waiting for a thumbs-up (chores + reward + idea reqs).
  const loadPending = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.family_id) return;
      const fam = profile.family_id;
      const [chores, redemptions, props] = await Promise.all([
        supabase
          .from("chore_instances")
          .select("id", { count: "exact", head: true })
          .eq("family_id", fam)
          .eq("status", "pending"),
        supabase
          .from("redemptions")
          .select("id", { count: "exact", head: true })
          .eq("family_id", fam)
          .eq("status", "pending"),
        fetch("/api/parent/bounty-proposals", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { proposals: [] }))
          .catch(() => ({ proposals: [] })),
      ]);
      setPending(
        (chores.count ?? 0) + (redemptions.count ?? 0) + (props.proposals?.length ?? 0)
      );
    } catch {
      /* best-effort badge */
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending, pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
        <span className="text-2xl">🏠</span>
        <span className="font-display text-lg font-bold text-slate-800">Family Board</span>
        <div className="ml-auto">
          <PushBell label="Alerts" />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 z-10 hidden md:flex md:h-screen md:w-56 md:flex-col md:items-stretch md:border-r md:border-slate-200 md:bg-white/90 md:px-4 md:py-6 md:backdrop-blur">
          <div className="mb-6 flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="font-display text-lg font-bold text-slate-800">Family Board</span>
          </div>
          {ALL.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                isActive(href)
                  ? "bg-violet-100 text-violet-700"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {badge && <Badge n={pending} />}
            </Link>
          ))}
          <div className="mt-auto flex flex-col gap-1">
            <PushBell label="Notifications" />
            <InstallApp
              label="Install app"
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-violet-600 transition hover:bg-violet-50"
            />
            <button
              onClick={signOut}
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {PRIMARY.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold ${
              isActive(href) ? "text-violet-700" : "text-slate-500"
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {badge && pending > 0 && (
              <span className="absolute right-[22%] top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {pending}
              </span>
            )}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold text-slate-500"
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-slate-800">More</span>
              <button className="btn-icon" aria-label="Close" onClick={() => setMoreOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${
                    isActive(href) ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <InstallApp
                label="Install app"
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white"
              />
              <button
                onClick={signOut}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600"
              >
                <LogOut size={17} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
