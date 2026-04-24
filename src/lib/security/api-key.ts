// src/lib/security/api-key.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const API_KEY_SECRET =
  process.env.HAMS_SSO_SERVER_API_KEY_SECRET || "hams-sso-server-api-key-secret";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  return createHash("sha256").update(API_KEY_SECRET).digest();
}

export function encryptApiKey(value: string | null | undefined) {
  const plain = value?.trim();

  if (!plain) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptApiKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length !== 3) {
    return value;
  }

  const [ivPart, encryptedPart, tagPart] = parts;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return decrypted || null;
  } catch {
    return value;
  }
}
