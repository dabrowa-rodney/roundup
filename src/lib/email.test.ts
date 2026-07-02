import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appUrl,
  emailConfigured,
  escapeHtml,
  reminderEmail,
  roundupEmail,
  sendEmail,
} from "./email";

describe("email", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevApp = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    process.env.APP_URL = "https://roundup.example.com/";
  });
  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prevApp;
  });

  it("is not configured without RESEND_API_KEY", () => {
    expect(emailConfigured()).toBe(false);
  });

  it("sendEmail no-ops (returns false, never throws) without a key", async () => {
    await expect(
      sendEmail({ to: "a@b.com", subject: "x", html: "<p>x</p>" }),
    ).resolves.toBe(false);
  });

  it("appUrl joins against APP_URL without double slashes", () => {
    expect(appUrl("/my-reports")).toBe(
      "https://roundup.example.com/my-reports",
    );
  });

  it("escapes HTML in user-supplied strings", () => {
    expect(escapeHtml(`<img src=x onerror="p()">&`)).toBe(
      "&lt;img src=x onerror=&quot;p()&quot;&gt;&amp;",
    );
  });

  it("reminderEmail names the reports and close time", () => {
    const msg = reminderEmail({
      name: "Ada Lovelace",
      weekLabel: "Week 27 · 29 Jun–5 Jul",
      reportNames: ["DataSync", "USA"],
      closeLabel: "Sunday 20:00",
    });
    expect(msg.subject).toContain("Week 27");
    expect(msg.html).toContain("Hi Ada,");
    expect(msg.html).toContain("DataSync, USA");
    expect(msg.html).toContain("Sunday 20:00");
    expect(msg.html).toContain("/my-reports");
  });

  it("roundupEmail links to the week and escapes the headline", () => {
    const msg = roundupEmail({
      weekLabel: "Week 27 · 29 Jun–5 Jul",
      headline: `2 on track & 1 <at risk>`,
      weekIso: "2026-06-29",
    });
    expect(msg.subject).toBe("Roundup — Week 27 · 29 Jun–5 Jul");
    expect(msg.html).toContain("/roundups/2026-06-29");
    expect(msg.html).toContain("2 on track &amp; 1 &lt;at risk&gt;");
  });
});
