// Organisation helpers: slug rules for the future {slug}.roundup.work
// subdomains, shared by signup validation and tests.

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

// Names we can never hand to a tenant (existing or future infrastructure).
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "email", "notifications", "send",
  "help", "support", "docs", "blog", "status", "static", "assets", "cdn",
  "login", "signup", "onboarding", "vercel", "roundup", "demo", "test",
]);

/** Derive a subdomain-safe slug from an organisation name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/** null if valid, otherwise a human-readable reason. */
export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug)) {
    return "Use 3–30 lowercase letters, numbers or hyphens (no leading/trailing hyphen).";
  }
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved.";
  return null;
}
