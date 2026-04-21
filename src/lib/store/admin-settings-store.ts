import "server-only";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

const ADMIN_SETTINGS_COLLECTION = "admin_settings";
const ADMIN_SECURITY_DOC_ID = "security";
const DEFAULT_ADMIN_PASSWORD = "1234";
const DEFAULT_ADMIN_PASSWORD_SECRET = "hams-oauth-secret";

export type AdminSecuritySettings = {
  passwordHash: string;
  updatedAt: string;
};

function getAdminPasswordSecret() {
  return process.env.ADMIN_PASSWORD_SECRET || DEFAULT_ADMIN_PASSWORD_SECRET;
}

function protectPassword(password: string) {
  return `${getAdminPasswordSecret()}:${password}`;
}

function requireDb() {
  const db = getFirebaseAdminDb();

  if (!db) {
    throw new Error(
      "Firebase Admin 설정이 없어 관리자 설정을 사용할 수 없습니다. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 확인해 주세요.",
    );
  }

  return db;
}

function getDefaultSettings(): AdminSecuritySettings {
  return {
    passwordHash: hashPassword(protectPassword(DEFAULT_ADMIN_PASSWORD)),
    updatedAt: new Date().toISOString(),
  };
}

function mapSettings(data: Record<string, unknown> | undefined): AdminSecuritySettings {
  const fallback = getDefaultSettings();

  return {
    passwordHash:
      typeof data?.passwordHash === "string" && data.passwordHash
        ? data.passwordHash
        : fallback.passwordHash,
    updatedAt:
      typeof data?.updatedAt === "string" && data.updatedAt ? data.updatedAt : fallback.updatedAt,
  };
}

export async function getAdminSecuritySettings() {
  const db = getFirebaseAdminDb();

  if (!db) {
    return getDefaultSettings();
  }

  const snapshot = await db
    .collection(ADMIN_SETTINGS_COLLECTION)
    .doc(ADMIN_SECURITY_DOC_ID)
    .get();

  if (!snapshot.exists) {
    return getDefaultSettings();
  }

  return mapSettings(snapshot.data());
}

export async function verifyAdminPassword(password: string) {
  const settings = await getAdminSecuritySettings();
  return verifyPassword(protectPassword(password), settings.passwordHash);
}

export async function updateAdminPassword(password: string) {
  if (password.length < 4) {
    throw new Error("관리 비밀번호는 4자 이상이어야 합니다.");
  }

  const db = requireDb();
  const now = new Date().toISOString();

  await db.collection(ADMIN_SETTINGS_COLLECTION).doc(ADMIN_SECURITY_DOC_ID).set({
    passwordHash: hashPassword(protectPassword(password)),
    updatedAt: now,
  });
}

export function getAdminPasswordSecretPreview() {
  return getAdminPasswordSecret();
}
