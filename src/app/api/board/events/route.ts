import { NextRequest, NextResponse } from "next/server";
import { authBoard } from "@/lib/boardAuth";
import { fetchFamilyEvents } from "@/lib/google";
import type { CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; events: CalendarEvent[] }>();

export async function GET(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  const key = `${ctx.familyId}:${from}:${to}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return NextResponse.json({ events: cached.events, issues: [] });
  }

  const { events, issues } = await fetchFamilyEvents(ctx.admin, ctx.familyId, from, to);
  // Only cache clean results, so a transient Google hiccup doesn't stick around.
  if (issues.length === 0) cache.set(key, { at: Date.now(), events });
  return NextResponse.json({ events, issues });
}
