// A tiny in-memory sliding-window rate limiter. Good enough for the free-tier
// single-instance deployment: it caps brute-force attempts against unauthenticated
// endpoints (e.g. board pairing) without needing a datastore. State resets on a
// cold start, which is fine — it's defense-in-depth, not the primary control.

type Bucket = { hits: number[]; blockedUntil: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number; blockMs: number }
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], blockedUntil: 0 };
    buckets.set(key, bucket);
  }

  if (bucket.blockedUntil > now) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }

  bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);
  if (bucket.hits.length >= opts.max) {
    bucket.blockedUntil = now + opts.blockMs;
    return { ok: false, retryAfterSeconds: Math.ceil(opts.blockMs / 1000) };
  }
  bucket.hits.push(now);

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of Array.from(buckets.entries())) {
      if (b.blockedUntil < now && (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > opts.windowMs)) {
        buckets.delete(k);
      }
    }
  }

  return { ok: true, retryAfterSeconds: 0 };
}

// Best-effort client IP behind Render's proxy.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
