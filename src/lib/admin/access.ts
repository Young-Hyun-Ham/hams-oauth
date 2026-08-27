import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAdminSecuritySettings,
  verifyAdminPassword,
} from "@/lib/store/admin-settings-store";

const ADMIN_ACCESS_COOKIE_NAME = "hams_admin_access";
const ADMIN_ACCESS_TTL_SECONDS = 60 * 60 * 4;

type AdminAccessPayload = {
  issuedAt: number;
  expiresAt: number;
};

function getSigningSecret() {
  return process.env.AUTH_SESSION_SECRET || "dev-only-auth-session-secret-change-me";
}

async function sign(body: string) {
  const settings = await getAdminSecuritySettings();
  return createHmac("sha256", `${getSigningSecret()}:${settings.passwordHash}`)
    .update(body)
    .digest("base64url");
}

function getCookieSecure() {
  return process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
}

function getCookieDomain() {
  return process.env.AUTH_COOKIE_DOMAIN || undefined;
}

export async function isValidAdminPassword(password: string) {
  return verifyAdminPassword(password);
}

export async function createAdminAccess() {
  const cookieStore = await cookies();
  const now = Date.now();
  const body = Buffer.from(
    JSON.stringify({
      issuedAt: now,
      expiresAt: now + ADMIN_ACCESS_TTL_SECONDS * 1000,
    } satisfies AdminAccessPayload),
  ).toString("base64url");
  const token = `${body}.${await sign(body)}`;

  cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getCookieSecure(),
    path: "/",
    domain: getCookieDomain(),
    maxAge: ADMIN_ACCESS_TTL_SECONDS,
  });
}

export async function hasAdminAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value;
  const [body, signature] = token?.split(".") ?? [];

  if (!body || !signature) return false;

  const expected = await sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AdminAccessPayload;
    return payload.expiresAt > Date.now() && payload.issuedAt <= Date.now();
  } catch {
    return false;
  }
}

export async function clearAdminAccess() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: ADMIN_ACCESS_COOKIE_NAME,
    path: "/",
    domain: getCookieDomain(),
  });
}

export async function requireAdminAccess() {
  if (!(await hasAdminAccess())) {
    redirect("/login");
  }
}
