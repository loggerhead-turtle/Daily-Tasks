/** @type {import('next').NextConfig} */

// Build a Content-Security-Policy that allows the app's own assets plus the
// Supabase project (API + public storage for avatars/photos). Scripts/styles
// keep 'unsafe-inline' because Next's runtime and framer-motion inject inline
// script/style; everything else is locked down. Framing is denied (clickjacking).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  `connect-src 'self' ${supabase}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
