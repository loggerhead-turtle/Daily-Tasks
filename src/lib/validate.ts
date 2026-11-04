// Input validators for values that get spliced into PostgREST filter strings
// (e.g. `.or(...)`). Rejecting non-conforming values prevents filter-injection
// and keeps queries well-formed. Cross-family access is already blocked by the
// ANDed family_id scope; this is defense-in-depth on top of that.

export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export function isYmd(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// A board/child-supplied date, falling back to today when missing/malformed.
export function safeDate(v: string | null): string {
  return isYmd(v) ? (v as string) : new Date().toISOString().slice(0, 10);
}
