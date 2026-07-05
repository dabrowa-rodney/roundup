// At-rest encryption for org secrets (e.g. an organisation's Anthropic API
// key). AES-256-GCM with a key derived from the ENCRYPTION_SECRET env var —
// set it to any long random string; rotating it invalidates stored secrets
// (orgs would simply re-enter their keys).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET is not set");
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

/** Encrypt a secret → "v1.<iv>.<tag>.<ciphertext>" (all base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

/** Decrypt a stored secret, or null if missing/corrupt/wrong key. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, ivB64, tagB64, ctB64] = stored.split(".");
    if (v !== "v1" || !ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
