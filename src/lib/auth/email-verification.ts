import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const COOKIE_NAME = "hams_email_verification";
const CODE_TTL_SECONDS = 60 * 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

type VerificationPayload = {
  email: string;
  codeHash: string;
  sentAt: number;
  expiresAt: number;
  attempts: number;
  verifiedAt: number | null;
};

function secret() {
  return process.env.EMAIL_VERIFICATION_SECRET || process.env.AUTH_SESSION_SECRET || "dev-only-email-verification-secret";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function hashCode(email: string, code: string) {
  return createHmac("sha256", secret()).update(`${normalizeEmail(email)}:${code}`).digest("base64url");
}

function encode(payload: VerificationPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(value: string | undefined) {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as VerificationPayload;
  } catch {
    return null;
  }
}

async function setPayload(payload: VerificationPayload) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CODE_TTL_SECONDS,
  });
}

export async function createEmailVerification(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const cookieStore = await cookies();
  const existing = decode(cookieStore.get(COOKIE_NAME)?.value);
  const now = Date.now();

  if (
    existing?.email === normalizedEmail &&
    now - existing.sentAt < RESEND_COOLDOWN_SECONDS * 1000
  ) {
    return { ok: false as const, retryAfter: Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (now - existing.sentAt)) / 1000) };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await setPayload({
    email: normalizedEmail,
    codeHash: hashCode(normalizedEmail, code),
    sentAt: now,
    expiresAt: now + CODE_TTL_SECONDS * 1000,
    attempts: 0,
    verifiedAt: null,
  });
  return { ok: true as const, code };
}

export async function verifyEmailCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const cookieStore = await cookies();
  const payload = decode(cookieStore.get(COOKIE_NAME)?.value);

  if (!payload || payload.email !== normalizedEmail || payload.expiresAt <= Date.now()) {
    return { ok: false as const, error: "인증코드가 만료되었거나 요청 정보가 없습니다." };
  }
  if (payload.attempts >= MAX_ATTEMPTS) {
    return { ok: false as const, error: "인증 시도 횟수를 초과했습니다. 인증코드를 다시 요청해 주세요." };
  }

  const actual = Buffer.from(hashCode(normalizedEmail, code));
  const expected = Buffer.from(payload.codeHash);
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected);

  if (!matches) {
    await setPayload({ ...payload, attempts: payload.attempts + 1 });
    return { ok: false as const, error: "인증번호가 일치하지 않습니다." };
  }

  await setPayload({ ...payload, verifiedAt: Date.now() });
  return { ok: true as const };
}

export async function isEmailVerified(email: string) {
  const cookieStore = await cookies();
  const payload = decode(cookieStore.get(COOKIE_NAME)?.value);
  return Boolean(
    payload &&
    payload.email === normalizeEmail(email) &&
    payload.verifiedAt &&
    payload.expiresAt > Date.now(),
  );
}

export async function clearEmailVerification() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
