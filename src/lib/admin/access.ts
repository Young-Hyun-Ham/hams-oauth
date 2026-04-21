import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAdminPassword } from "@/lib/store/admin-settings-store";

const ADMIN_ACCESS_COOKIE_NAME = "hams_admin_access";
const ADMIN_ACCESS_VALUE = "granted";
const ADMIN_ACCESS_TTL_SECONDS = 60 * 60 * 4;

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

  cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, ADMIN_ACCESS_VALUE, {
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
  return cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value === ADMIN_ACCESS_VALUE;
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
