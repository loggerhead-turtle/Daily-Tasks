import { NextRequest, NextResponse } from "next/server";
import { authBoard } from "@/lib/boardAuth";
import { ensureInstancesForDate } from "@/lib/choreEngine";
import type { BoardState, Earning, Weather } from "@/lib/types";

export const dynamic = "force-dynamic";

const weatherCache = new Map<string, { at: number; weather: Weather }>();

async function getWeather(
  lat: number | null,
  lon: number | null,
  location: string | null
): Promise<Weather | null> {
  if (lat == null || lon == null) return null;
  const key = `${lat},${lon}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.weather;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code` +
        `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return cached?.weather ?? null;
    const data = await res.json();
    const d = data.daily;
    const daily = (d?.time ?? []).map((date: string, i: number) => ({
      date,
      code: d.weather_code[i],
      hi: Math.round(d.temperature_2m_max[i]),
      lo: Math.round(d.temperature_2m_min[i]),
    }));
    const weather: Weather = {
      temp: Math.round(data.current.temperature_2m),
      hi: Math.round(data.daily.temperature_2m_max[0]),
      lo: Math.round(data.daily.temperature_2m_min[0]),
      code: data.current.weather_code,
      location: location ?? "",
      daily,
    };
    weatherCache.set(key, { at: Date.now(), weather });
    return weather;
  } catch {
    return cached?.weather ?? null;
  }
}

// The board polls this endpoint. `date` is the board's local calendar date
// so day boundaries follow the kitchen clock, not the server's timezone.
export async function GET(req: NextRequest) {
  const ctx = await authBoard(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { admin, familyId } = ctx;

  const date =
    req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  await ensureInstancesForDate(admin, familyId, date);

  const [
    { data: family },
    { data: members },
    { data: instances },
    { data: rewards },
    { data: redemptions },
    { data: meals },
    { data: announcements },
    { data: ledger },
    { data: photos },
    { data: earnings },
  ] = await Promise.all([
    admin.from("families").select("*").eq("id", familyId).single(),
    admin.from("members").select("*").eq("family_id", familyId).order("sort_order"),
    admin
      .from("chore_instances")
      .select("*, chore:chores(*)")
      .eq("family_id", familyId)
      .eq("date", date),
    admin.from("rewards").select("*").eq("family_id", familyId).eq("active", true).order("cost"),
    admin
      .from("redemptions")
      .select("*, reward:rewards(*)")
      .eq("family_id", familyId)
      .eq("status", "pending"),
    admin
      .from("meals")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", date)
      .order("date")
      .limit(7),
    admin
      .from("announcements")
      .select("*")
      .eq("family_id", familyId)
      .lte("starts_on", date)
      .or(`ends_on.is.null,ends_on.gte.${date}`)
      .order("created_at", { ascending: false })
      .limit(5),
    admin.from("points_ledger").select("member_id, delta").eq("family_id", familyId),
    admin
      .from("photos")
      .select("url")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(50),
    // May not exist until migration 0003 is run — errors resolve to null and
    // simply show $0, so the board keeps working either way.
    admin
      .from("earnings")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });

  const balances = new Map<string, number>();
  for (const row of ledger ?? []) {
    balances.set(row.member_id, (balances.get(row.member_id) ?? 0) + row.delta);
  }

  const balCents = new Map<string, number>();
  const earnedCents = new Map<string, number>();
  const paidCents = new Map<string, number>();
  for (const row of earnings ?? []) {
    balCents.set(row.member_id, (balCents.get(row.member_id) ?? 0) + row.cents);
    if (row.cents > 0)
      earnedCents.set(row.member_id, (earnedCents.get(row.member_id) ?? 0) + row.cents);
    else paidCents.set(row.member_id, (paidCents.get(row.member_id) ?? 0) - row.cents);
  }

  const pendingCount =
    (instances ?? []).filter((i) => i.status === "pending").length +
    (redemptions ?? []).length;

  const state: BoardState = {
    family: {
      id: family.id,
      name: family.name,
      screensaver_minutes: family.screensaver_minutes,
      has_pin: !!family.parent_pin_hash,
      board_layout: family.board_layout ?? null,
    },
    members: (members ?? []).map((m) => ({
      ...m,
      balance: balances.get(m.id) ?? 0,
      earningsCents: balCents.get(m.id) ?? 0,
      earnedCents: earnedCents.get(m.id) ?? 0,
      paidCents: paidCents.get(m.id) ?? 0,
    })),
    chores: instances ?? [],
    rewards: rewards ?? [],
    redemptions: redemptions ?? [],
    meals: meals ?? [],
    announcements: announcements ?? [],
    weather: await getWeather(family.weather_lat, family.weather_lon, family.weather_location),
    photos: (photos ?? []).map((p) => p.url),
    earnings: (earnings as Earning[] | null) ?? [],
    pendingCount,
  };

  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
