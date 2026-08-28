import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { findUserById } from "@/lib/store/user-store";

export type ServiceAccessScope = "ai:models" | "ai:generate";

type ServiceAccessTokenPayload = {
  version: 1;
  audience: "hams-sso-service";
  clientId: string;
  userId: string;
  scopes: ServiceAccessScope[];
  issuedAt: number;
  expiresAt: number;
};

const DEFAULT_TTL_SECONDS = 60 * 60;
const MAX_TTL_SECONDS = 60 * 60 * 24;

function getTokenSecret() {
  const secret =
    process.env.HAMS_SSO_SERVICE_ACCESS_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("HAMS_SSO_SERVICE_ACCESS_TOKEN_SECRET is not configured.");
  }

  return secret || "dev-only-sso-service-access-token-secret-change-me";
}

function getTokenTtlSeconds() {
  const configured = Number(process.env.HAMS_SSO_SERVICE_ACCESS_TOKEN_TTL_SEC);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, MAX_TTL_SECONDS)
    : DEFAULT_TTL_SECONDS;
}

function sign(body: string) {
  return createHmac("sha256", getTokenSecret()).update(body).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createServiceAccessToken(input: {
  clientId: string;
  userId: string;
  scopes: ServiceAccessScope[];
}) {
  const issuedAt = Date.now();
  const expiresIn = getTokenTtlSeconds();
  const payload: ServiceAccessTokenPayload = {
    version: 1,
    audience: "hams-sso-service",
    clientId: input.clientId,
    userId: input.userId,
    scopes: Array.from(new Set(input.scopes)),
    issuedAt,
    expiresAt: issuedAt + expiresIn * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return {
    accessToken: `${body}.${sign(body)}`,
    expiresIn,
  };
}

export function verifyServiceAccessToken(
  token: string | null | undefined,
  requiredScope: ServiceAccessScope,
) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ServiceAccessTokenPayload;
    if (
      payload.version !== 1 ||
      payload.audience !== "hams-sso-service" ||
      !payload.clientId ||
      !payload.userId ||
      payload.expiresAt < Date.now() ||
      !Array.isArray(payload.scopes) ||
      !payload.scopes.includes(requiredScope)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyActiveServiceAccessToken(
  token: string | null | undefined,
  requiredScope: ServiceAccessScope,
) {
  const access = verifyServiceAccessToken(token, requiredScope);
  if (!access) return null;

  const user = await findUserById(access.userId);
  const membership = user?.serviceMemberships.find(
    (item) => item.clientId === access.clientId,
  );
  if (membership?.status === "refund_pending") return null;

  return access;
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
