import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import type { Firestore } from "firebase-admin/firestore";

import {
  clearPendingSSORequest,
  getPendingSSORequest,
} from "@/lib/auth/session";
import type { PendingSSORequest, SessionUser } from "@/lib/auth/types";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

const AUTHORIZATION_CODES_COLLECTION = "sso_authorization_codes";
const AUTHORIZATION_CODE_TTL_MS = 1000 * 60;

type ConfiguredSSOClient = {
  clientName?: string;
  clientId: string;
  clientSecret: string;
  allowedOrigins: string[];
  allowedRedirectUris: string[];
};

export type PublicSSOClient = {
  clientName?: string;
  clientId: string;
  name: string;
  origin: string;
  redirectCount: number;
};

type StoredAuthorizationCode = {
  clientId: string;
  redirectUri: string;
  user: SessionUser;
  expiresAt: number;
};

type ExchangeAuthorizationCodeInput = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

type ExchangeAuthorizationCodeResult =
  | {
      ok: true;
      user: SessionUser;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function getDb() {
  const db = getFirebaseAdminDb();

  if (!db) {
    throw new Error(
      "Firebase Admin 설정이 없어 SSO authorization code를 저장할 수 없습니다.",
    );
  }

  return db;
}

function normalizeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getDefaultClients(): ConfiguredSSOClient[] {
  return [
    {
      clientId: "yumi-neil-shop",
      clientSecret: "yumi-neil-secret",
      allowedOrigins: ["https://yumi-neil-shop.vercel.app","http://localhost:3001"],
      allowedRedirectUris: [],
    },
    {
      clientId: "service-3002",
      clientSecret: "dev-service-3002-secret",
      allowedOrigins: ["http://localhost:3002"],
      allowedRedirectUris: [],
    },
    {
      clientId: "service-3003",
      clientSecret: "dev-service-3003-secret",
      allowedOrigins: ["http://localhost:3003"],
      allowedRedirectUris: [],
    },
  ];
}

function toClientDisplayName(clientId: string) {
  return clientId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function toClientOriginLabel(client: ConfiguredSSOClient) {
  const origin = client.allowedOrigins[0] ?? client.allowedRedirectUris[0] ?? "";
  const parsed = normalizeUrl(origin);

  if (!parsed) {
    return origin || "Origin not configured";
  }

  return parsed.host;
}

function readConfiguredClients() {
  const raw = process.env.SSO_CLIENTS;
  if (!raw) {
    return getDefaultClients();
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      clientName?: string;
      clientId?: string;
      clientSecret?: string;
      allowedOrigins?: string[];
      allowedRedirectUris?: string[];
    }>;

    return parsed
      .filter((item) => item.clientId && item.clientSecret)
      .map((item) => ({
        clientName: item.clientName ?? "",
        clientId: String(item.clientId),
        clientSecret: String(item.clientSecret),
        allowedOrigins: Array.isArray(item.allowedOrigins)
          ? item.allowedOrigins.map(String)
          : [],
        allowedRedirectUris: Array.isArray(item.allowedRedirectUris)
          ? item.allowedRedirectUris.map(String)
          : [],
      }));
  } catch {
    return getDefaultClients();
  }
}

export function getPublicSSOClients(): PublicSSOClient[] {
  return readConfiguredClients().map((client) => ({
    clientId: client.clientId,
    name: client.clientName ?? toClientDisplayName(client.clientId),
    origin: toClientOriginLabel(client),
    redirectCount: client.allowedRedirectUris.length,
  }));
}

function getClient(clientId: string) {
  return readConfiguredClients().find((item) => item.clientId === clientId) ?? null;
}

function isAllowedRedirectUri(client: ConfiguredSSOClient, redirectUri: string) {
  const parsed = normalizeUrl(redirectUri);

  if (!parsed) {
    return false;
  }

  if (client.allowedRedirectUris.includes(parsed.toString())) {
    return true;
  }

  return client.allowedOrigins.includes(parsed.origin);
}

function buildRedirectUrl(request: PendingSSORequest, code: string) {
  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);

  if (request.state) {
    url.searchParams.set("state", request.state);
  }

  return url.toString();
}

async function storeAuthorizationCode(
  db: Firestore,
  request: PendingSSORequest,
  user: SessionUser,
) {
  const code = randomUUID();

  await db.collection(AUTHORIZATION_CODES_COLLECTION).doc(code).set({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    user,
    expiresAt: Date.now() + AUTHORIZATION_CODE_TTL_MS,
  } satisfies StoredAuthorizationCode);

  return code;
}

export function validateStartRequest(clientId: string, redirectUri: string) {
  const client = getClient(clientId);

  if (!client) {
    return { ok: false as const, error: "unknown_client" };
  }

  if (!isAllowedRedirectUri(client, redirectUri)) {
    return { ok: false as const, error: "invalid_redirect_uri" };
  }

  return { ok: true as const, client };
}

export async function createAuthorizationCodeRedirect(
  request: PendingSSORequest,
  user: SessionUser,
) {
  const validation = validateStartRequest(request.clientId, request.redirectUri);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const db = getDb();
  const code = await storeAuthorizationCode(db, request, user);

  return buildRedirectUrl(request, code);
}

export async function finalizePendingSSORedirect(user: SessionUser) {
  const pendingRequest = await getPendingSSORequest();

  if (!pendingRequest) {
    return null;
  }

  const redirectUrl = await createAuthorizationCodeRedirect(pendingRequest, user);
  await clearPendingSSORequest();
  return redirectUrl;
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export async function exchangeAuthorizationCode(
  input: ExchangeAuthorizationCodeInput,
): Promise<ExchangeAuthorizationCodeResult> {
  const client = getClient(input.clientId);

  if (!client) {
    return {
      ok: false,
      status: 401,
      error: "unknown_client",
    };
  }

  if (!safeEqual(client.clientSecret, input.clientSecret)) {
    return {
      ok: false,
      status: 401,
      error: "invalid_client_secret",
    };
  }

  if (!isAllowedRedirectUri(client, input.redirectUri)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_redirect_uri",
    };
  }

  const db = getDb();

  try {
    const user = await db.runTransaction(async (transaction: any) => {
      const docRef = db.collection(AUTHORIZATION_CODES_COLLECTION).doc(input.code);
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) {
        throw new Error("invalid_code");
      }

      const data = snapshot.data() as StoredAuthorizationCode | undefined;

      if (!data) {
        throw new Error("invalid_code");
      }

      if (data.clientId !== input.clientId) {
        throw new Error("invalid_code");
      }

      if (data.redirectUri !== input.redirectUri) {
        throw new Error("invalid_code");
      }

      if (data.expiresAt < Date.now()) {
        transaction.delete(docRef);
        throw new Error("expired_code");
      }

      transaction.delete(docRef);
      return data.user;
    });

    return {
      ok: true,
      user,
    };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: error instanceof Error ? error.message : "exchange_failed",
    };
  }
}
