"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Gift,
  Home,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/chores", label: "Chores", icon: ListChecks },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/earnings", label: "Money", icon: Wallet },
  { href: "/family", label: "Family", icon: Users },
  { href: "/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/content", label: "Board content", icon: MonitorSmartphone },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        <aside className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur md:h-screen md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-6 no-scrollbar">
          <div className="mr-3 flex items-center gap-2 md:mb-6 md:mr-0">
            <span className="text-2xl">🏠</span>
            <span className="hidden font-display text-lg font-bold text-slate-800 md:block">
              Family Board
            </span>
          </div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-violet-100 text-violet-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:mt-auto"
          >
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
