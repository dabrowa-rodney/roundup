import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("crypto", () => {
  const prev = process.env.ENCRYPTION_SECRET;
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "test-secret-for-unit-tests";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = prev;
  });

  it("round-trips a secret", () => {
    const stored = encryptSecret("sk-ant-abc123");
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("sk-ant-abc123");
    expect(decryptSecret(stored)).toBe("sk-ant-abc123");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("returns null for null/garbage/tampered input", () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret("not-a-secret")).toBeNull();
    const stored = encryptSecret("hello");
    const tampered = stored.slice(0, -2) + "zz";
    expect(decryptSecret(tampered)).toBeNull();
  });

  it("returns null when decrypting under a different secret", () => {
    const stored = encryptSecret("hello");
    process.env.ENCRYPTION_SECRET = "rotated-secret";
    expect(decryptSecret(stored)).toBeNull();
  });
});
