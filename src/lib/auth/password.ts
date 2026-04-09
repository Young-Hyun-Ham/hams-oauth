import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString(
    "hex",
  );

  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt,
    derived,
  ].join("$");
}

export function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [algorithm, n, r, p, salt, hash] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, Buffer.from(hash, "hex").length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return timingSafeEqual(derived, Buffer.from(hash, "hex"));
}
