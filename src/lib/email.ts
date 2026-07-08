// Email sending via Resend's REST API (https://resend.com/docs/api-reference).
//
// Mirrors the ANTHROPIC_API_KEY pattern: if RESEND_API_KEY is unset, every
// send silently no-ops (returns false) so the platform keeps working without
// email until the key is added. EMAIL_FROM defaults to Resend's shared test
// sender so the key alone is enough to start testing.

const FROM_DEFAULT = "Roundup <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Absolute URL for links in emails (falls back to the auth base URL). */
export function appUrl(path: string): string {
  const base = (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Send one email. Never throws; returns whether the send succeeded. */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || FROM_DEFAULT,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Templates ──────────────────────────────────────────
// Minimal inline-styled HTML (email clients ignore stylesheets). Wonde-ish
// palette: primary #4368FA, ink #27325E.

// Full table skeleton with attribute fallbacks (bgcolor/cellpadding survive
// clients that strip CSS, e.g. screening/preview modes). The explicit spacer
// row keeps a blank line between the content and the footer even when all
// styling is discarded and the email renders as flat text.
function shell(body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#27325E;" bgcolor="#F4F6FB">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F6FB">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 2px 20px;font-size:19px;font-weight:800;letter-spacing:-0.02em;color:#27325E;">Roundup</td>
            </tr>
            <tr>
              <td bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid #E3E8F4;border-radius:16px;padding:32px;color:#27325E;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="font-size:16px;line-height:16px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:0 2px;font-size:12px;color:#8792AD;line-height:1.5;">Sent by Roundup, the weekly update platform.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Bulletproof button: table-based so it renders as a real button in every
// client (CSS-only anchors degrade to plain links in Outlook), with breathing
// room above and below.
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
    <tr>
      <td bgcolor="#4368FA" style="border-radius:999px;background:#4368FA;">
        <a href="${href}" style="display:inline-block;padding:13px 30px;font-size:14.5px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;" target="_blank">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reminder to a contributor who hasn't submitted this week's report. */
export function reminderEmail(opts: {
  name: string;
  weekLabel: string; // "Week 27 · 29 Jun–5 Jul"
  reportNames: string[];
  closeLabel: string; // "Sunday 20:00"
}): { subject: string; html: string } {
  const first = escapeHtml(opts.name.split(" ")[0] || "there");
  const reports = opts.reportNames.map(escapeHtml).join(", ");
  return {
    subject: `Reminder: your weekly update is due (${opts.weekLabel})`,
    html: shell(`
      <p style="margin:0 0 12px;font-size:15px;">Hi ${first},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
        A quick nudge — your update${opts.reportNames.length === 1 ? "" : "s"}
        <strong>${reports}</strong> for <strong>${escapeHtml(opts.weekLabel)}</strong>
        ${opts.reportNames.length === 1 ? "hasn't" : "haven't"} been submitted yet.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.55;">
        The week closes <strong>${escapeHtml(opts.closeLabel)}</strong>.
      </p>
      ${button(appUrl("/my-reports"), "Complete my update")}
    `),
  };
}

/** Invitation to join an organisation on Roundup. */
export function inviteEmail(opts: {
  inviterName: string;
  orgName: string;
}): { subject: string; html: string } {
  const inviter = escapeHtml(opts.inviterName);
  const org = escapeHtml(opts.orgName);
  return {
    subject: `${opts.inviterName} invited you to ${opts.orgName} on Roundup`,
    html: shell(`
      <p style="margin:0 0 12px;font-size:15px;">You've been invited</p>
      <p style="margin:0;font-size:14px;line-height:1.55;">
        <strong>${inviter}</strong> has invited you to join
        <strong>${org}</strong> on Roundup — the place your team files short
        weekly updates that roll up into one leadership summary.
      </p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.55;">
        Sign in with this email address (Google or an emailed link) and
        you'll land straight in the team.
      </p>
      ${button(appUrl("/login"), "Join on Roundup")}
    `),
  };
}

/** Magic sign-in link. */
export function magicLinkEmail(opts: { url: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your Roundup sign-in link",
    html: shell(`
      <p style="margin:0 0 12px;font-size:15px;">Sign in to Roundup</p>
      <p style="margin:0;font-size:14px;line-height:1.55;">
        Click the button below to sign in. The link works once and expires in
        15 minutes.
      </p>
      ${button(opts.url, "Sign in to Roundup")}
      <p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#8792AD;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `),
  };
}

/** The weekly Roundup, sent (or announced) to recipients. */
export function roundupEmail(opts: {
  weekLabel: string; // "Week 27 · 29 Jun–5 Jul"
  headline: string;
  weekIso: string; // "2026-06-29"
}): { subject: string; html: string } {
  return {
    subject: `Roundup — ${opts.weekLabel}`,
    html: shell(`
      <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;color:#8792AD;text-transform:uppercase;margin-bottom:10px;">
        ${escapeHtml(opts.weekLabel)}
      </div>
      <p style="margin:0;font-size:16px;line-height:1.5;font-weight:600;">
        ${escapeHtml(opts.headline)}
      </p>
      ${button(appUrl(`/roundups/${opts.weekIso}`), "Read the Roundup")}
    `),
  };
}
