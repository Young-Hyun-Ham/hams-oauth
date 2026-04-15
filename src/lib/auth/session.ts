import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import type {
  OAuthProvider,
  PendingOAuthSignup,
  PendingSSORequest,
  SessionUser,
} from "@/lib/auth/types";

const SESSION_COOKIE_NAME = "hams_session";
const OAUTH_PENDING_COOKIE_NAME = "hams_pending_oauth_signup";
const SSO_PENDING_COOKIE_NAME = "hams_pending_sso";
const POST_LOGIN_REDIRECT_COOKIE_NAME = "hams_post_login_redirect";
const OAUTH_STATE_COOKIE_PREFIX = "hams_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_PENDING_TTL_SECONDS = 60 * 10;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

type SessionPayload = {
  userId: string;
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
};

function getSessionCookieName() {
  return process.env.AUTH_SESSION_COOKIE_NAME || SESSION_COOKIE_NAME;
}

function getCookieDomain() {
  return process.env.AUTH_COOKIE_DOMAIN || undefined;
}

function getCookieSecure() {
  return process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
}

function getCookieSameSite() {
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE;

  if (sameSite === "strict" || sameSite === "lax" || sameSite === "none") {
    return sameSite;
  }

  return "lax";
}

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || "dev-only-auth-session-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encode<T>(payload: T) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode<T>(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function getOAuthStateCookieName(provider: OAuthProvider) {
  return `${OAUTH_STATE_COOKIE_PREFIX}_${provider}`;
}

export async function createSession(user: SessionUser) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  const cookieStore = await cookies();

  cookieStore.set(
    getSessionCookieName(),
    encode<SessionPayload>({ userId: user.id, user, issuedAt, expiresAt }),
    {
      httpOnly: true,
      sameSite: getCookieSameSite(),
      secure: getCookieSecure(),
      path: "/",
      domain: getCookieDomain(),
      maxAge: SESSION_TTL_SECONDS,
    },
  );
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  const payload = decode<SessionPayload>(token);

  if (!payload || !payload.userId || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: getSessionCookieName(),
    path: "/",
    domain: getCookieDomain(),
  });
}

export async function createPendingOAuthSignup(payload: PendingOAuthSignup) {
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_PENDING_COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: getCookieSecure(),
    path: "/",
    domain: getCookieDomain(),
    maxAge: OAUTH_PENDING_TTL_SECONDS,
  });
}

export async function getPendingOAuthSignup() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OAUTH_PENDING_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return decode<PendingOAuthSignup>(token);
}

export async function clearPendingOAuthSignup() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: OAUTH_PENDING_COOKIE_NAME,
    path: "/",
    domain: getCookieDomain(),
  });
}

export async function createPendingSSORequest(payload: PendingSSORequest) {
  const cookieStore = await cookies();

  cookieStore.set(SSO_PENDING_COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: getCookieSecure(),
    path: "/",
    domain: getCookieDomain(),
    maxAge: OAUTH_PENDING_TTL_SECONDS,
  });
}

export async function getPendingSSORequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SSO_PENDING_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return decode<PendingSSORequest>(token);
}

export async function clearPendingSSORequest() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SSO_PENDING_COOKIE_NAME,
    path: "/",
    domain: getCookieDomain(),
  });
}

export async function createPostLoginRedirect(url: string) {
  const cookieStore = await cookies();

  cookieStore.set(POST_LOGIN_REDIRECT_COOKIE_NAME, encode({ url }), {
    httpOnly: true,
    sameSite: "lax",
    secure: getCookieSecure(),
    path: "/",
    domain: getCookieDomain(),
    maxAge: OAUTH_PENDING_TTL_SECONDS,
  });
}

export async function consumePostLoginRedirect() {
  const cookieStore = await cookies();
  const token = cookieStore.get(POST_LOGIN_REDIRECT_COOKIE_NAME)?.value;

  cookieStore.delete({
    name: POST_LOGIN_REDIRECT_COOKIE_NAME,
    path: "/",
    domain: getCookieDomain(),
  });

  if (!token) {
    return null;
  }

  const payload = decode<{ url?: string }>(token);

  if (!payload?.url) {
    return null;
  }

  return payload.url;
}

export async function createOAuthState(provider: OAuthProvider) {
  const cookieStore = await cookies();
  const state = randomUUID();

  cookieStore.set(getOAuthStateCookieName(provider), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: getCookieSecure(),
    path: "/",
    domain: getCookieDomain(),
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  return state;
}

export async function consumeOAuthState(
  provider: OAuthProvider,
  incomingState: string | null,
) {
  const cookieStore = await cookies();
  const cookieName = getOAuthStateCookieName(provider);
  const storedState = cookieStore.get(cookieName)?.value;

  cookieStore.delete({
    name: cookieName,
    path: "/",
    domain: getCookieDomain(),
  });

  if (!storedState || !incomingState) {
    return false;
  }

  return storedState === incomingState;
}
