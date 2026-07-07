// Platform-owner ("super admin") access — for the business console, NOT for
// anything tenants can grant. Controlled by the SUPER_ADMIN_EMAILS env var
// (comma-separated) so it can only be changed by whoever owns the deployment.

const SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.has(email.toLowerCase());
}
