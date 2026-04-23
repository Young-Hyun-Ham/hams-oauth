import "server-only";

import { randomUUID } from "node:crypto";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";

const SERVICE_SITES_COLLECTION = "service_sites";

export type ServiceSite = {
  id: string;
  name: string;
  url: string;
  description: string;
  isVisible: boolean;
  clientId: string;
  clientSecret: string;
  allowedOrigins: string[];
  allowedRedirectUris: string[];
  ssoConfigText: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceSiteSsoConfig = {
  clientName: string;
  clientId: string;
  clientSecret: string;
  allowedOrigins: string[];
  allowedRedirectUris: string[];
};

function requireDb() {
  const db = getFirebaseAdminDb();

  if (!db) {
    throw new Error(
      "Firebase Admin 설정이 없어 서비스사이트 관리를 사용할 수 없습니다. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 확인해 주세요.",
    );
  }

  return db;
}

function serializeDate(value: unknown, fallback: string) {
  if (typeof value === "string" && value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseMultilineInput(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildServiceSiteSsoConfig(input: {
  name: string;
  clientId: string;
  clientSecret: string;
  allowedOrigins: string[];
  allowedRedirectUris: string[];
}): ServiceSiteSsoConfig {
  return {
    clientName: input.name.trim(),
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    allowedOrigins: input.allowedOrigins.map((item) => item.trim()).filter(Boolean),
    allowedRedirectUris: input.allowedRedirectUris.map((item) => item.trim()).filter(Boolean),
  };
}

export function stringifyServiceSiteSsoConfig(config: ServiceSiteSsoConfig) {
  return JSON.stringify([config], null, 2);
}

function mapServiceSite(id: string, data: Record<string, unknown>): ServiceSite {
  const now = new Date().toISOString();
  const config = buildServiceSiteSsoConfig({
    name: String(data.name ?? ""),
    clientId: String(data.clientId ?? ""),
    clientSecret: String(data.clientSecret ?? ""),
    allowedOrigins: normalizeStringArray(data.allowedOrigins),
    allowedRedirectUris: normalizeStringArray(data.allowedRedirectUris),
  });

  return {
    id,
    name: String(data.name ?? ""),
    url: String(data.url ?? ""),
    description: String(data.description ?? ""),
    isVisible: typeof data.isVisible === "boolean" ? data.isVisible : true,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    allowedOrigins: config.allowedOrigins,
    allowedRedirectUris: config.allowedRedirectUris,
    ssoConfigText:
      typeof data.ssoConfigText === "string" && data.ssoConfigText
        ? data.ssoConfigText
        : stringifyServiceSiteSsoConfig(config),
    createdAt: serializeDate(data.createdAt, now),
    updatedAt: serializeDate(data.updatedAt, now),
  };
}

export async function listServiceSites() {
  const db = getFirebaseAdminDb();

  if (!db) {
    return [];
  }

  const snapshot = await db.collection(SERVICE_SITES_COLLECTION).get();

  return snapshot.docs
    .map((doc) => mapServiceSite(doc.id, doc.data() ?? {}))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function upsertServiceSite(input: {
  id?: string;
  name: string;
  url: string;
  description: string;
  isVisible?: boolean;
  clientId: string;
  clientSecret: string;
  allowedOriginsText: string;
  allowedRedirectUrisText: string;
}) {
  const db = requireDb();
  const id = input.id?.trim() || randomUUID();
  const now = new Date().toISOString();
  const ref = db.collection(SERVICE_SITES_COLLECTION).doc(id);
  const snapshot = await ref.get();
  const allowedOrigins = parseMultilineInput(input.allowedOriginsText);
  const allowedRedirectUris = parseMultilineInput(input.allowedRedirectUrisText);
  const isVisible =
    input.isVisible ?? (snapshot.exists ? Boolean(snapshot.data()?.isVisible ?? true) : true);

  if (!input.name.trim()) {
    throw new Error("서비스사이트 이름은 필수입니다.");
  }

  if (!input.url.trim()) {
    throw new Error("서비스사이트 URL은 필수입니다.");
  }

  if (!input.clientId.trim()) {
    throw new Error("SSO clientId는 필수입니다.");
  }

  if (!input.clientSecret.trim()) {
    throw new Error("SSO clientSecret은 필수입니다.");
  }

  if (allowedOrigins.length === 0) {
    throw new Error("allowedOrigins는 최소 1개 이상 필요합니다.");
  }

  const ssoConfig = buildServiceSiteSsoConfig({
    name: input.name,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    allowedOrigins,
    allowedRedirectUris,
  });

  await ref.set({
    id,
    name: input.name.trim(),
    url: input.url.trim(),
    description: input.description.trim(),
    isVisible,
    clientId: ssoConfig.clientId,
    clientSecret: ssoConfig.clientSecret,
    allowedOrigins: ssoConfig.allowedOrigins,
    allowedRedirectUris: ssoConfig.allowedRedirectUris,
    ssoConfigText: stringifyServiceSiteSsoConfig(ssoConfig),
    createdAt: snapshot.exists ? snapshot.data()?.createdAt ?? now : now,
    updatedAt: now,
  });
}

export async function deleteServiceSite(id: string) {
  const db = requireDb();
  await db.collection(SERVICE_SITES_COLLECTION).doc(id).delete();
}
