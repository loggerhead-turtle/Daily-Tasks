// Kids can sign in with a plain username instead of an email. Supabase auth is
// email-based, so a username is mapped to a deterministic internal email
// (username@kids.familyboard.local). A real email (anything containing "@") is
// used as-is. Because the mapping is deterministic, the login page can convert
// a typed username to the same email with no server lookup.

export const CHILD_LOGIN_DOMAIN = "kids.familyboard.local";

export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}

// Normalize a username to a valid, stable email local-part.
export function usernameSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

// Turn whatever the user typed (email OR username) into the auth email.
// Returns null if a username normalizes to nothing usable.
export function resolveLoginEmail(input: string): string | null {
  const v = input.trim();
  if (looksLikeEmail(v)) return v.toLowerCase();
  const slug = usernameSlug(v);
  if (slug.length < 3) return null;
  return `${slug}@${CHILD_LOGIN_DOMAIN}`;
}
