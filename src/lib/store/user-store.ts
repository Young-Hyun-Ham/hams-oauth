import { randomUUID } from "node:crypto";

import type { Timestamp } from "firebase-admin/firestore";

import type { AuthProvider, AuthUser, OAuthProvider } from "@/lib/auth/types";
import { getFirebaseAdminDb, hasFirebaseAdminConfig } from "@/lib/firebase-admin";

const USERS_COLLECTION = "users";

type CreateUserInput = {
  loginId: string;
  email: string;
  nickname: string;
  provider: AuthProvider;
  providerSubject: string | null;
  passwordHash: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function serializeDate(value: unknown, fallback: string) {
  if (typeof value === "string" && value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }

  return fallback;
}

function requireDb() {
  const db = getFirebaseAdminDb();

  if (!db) {
    throw new Error(
      "Firebase Admin 설정이 없어 users 컬렉션을 사용할 수 없습니다. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 확인해 주세요.",
    );
  }

  return db;
}

function mapFirestoreUser(id: string, data: Record<string, unknown>): AuthUser {
  const fallback = new Date().toISOString();

  return {
    id,
    loginId: String(data.loginId ?? ""),
    loginIdLower: String(data.loginIdLower ?? ""),
    email: String(data.email ?? ""),
    emailLower: String(data.emailLower ?? ""),
    passwordHash: typeof data.passwordHash === "string" ? data.passwordHash : null,
    nickname: String(data.nickname ?? ""),
    provider: (data.provider as AuthProvider | undefined) ?? "password",
    providerSubject:
      typeof data.providerSubject === "string" ? data.providerSubject : null,
    createdAt: serializeDate(data.createdAt, fallback),
    updatedAt: serializeDate(data.updatedAt, fallback),
  };
}

export async function findUserById(id: string) {
  const db = requireDb();
  const snapshot = await db.collection(USERS_COLLECTION).doc(id).get();

  if (!snapshot.exists) {
    return null;
  }

  return mapFirestoreUser(snapshot.id, snapshot.data() ?? {});
}

export async function findUserByLoginId(loginId: string) {
  const db = requireDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("loginIdLower", "==", normalize(loginId))
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data() ?? {});
}

export async function findPasswordUserByIdentifier(identifier: string) {
  const normalized = normalize(identifier);
  const db = requireDb();

  const byLoginId = await db
    .collection(USERS_COLLECTION)
    .where("provider", "==", "password")
    .where("loginIdLower", "==", normalized)
    .limit(1)
    .get();

  if (!byLoginId.empty) {
    const doc = byLoginId.docs[0];
    return mapFirestoreUser(doc.id, doc.data() ?? {});
  }

  const byEmail = await db
    .collection(USERS_COLLECTION)
    .where("provider", "==", "password")
    .where("emailLower", "==", normalized)
    .limit(1)
    .get();

  if (byEmail.empty) {
    return null;
  }

  const doc = byEmail.docs[0];
  return mapFirestoreUser(doc.id, doc.data() ?? {});
}

export async function findPasswordUserByEmail(email: string) {
  const db = requireDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("provider", "==", "password")
    .where("emailLower", "==", normalize(email))
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data() ?? {});
}

export async function findOAuthUserByEmail(provider: OAuthProvider, email: string) {
  const db = requireDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("provider", "==", provider)
    .where("emailLower", "==", normalize(email))
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data() ?? {});
}

export async function createUser(input: CreateUserInput) {
  const db = requireDb();
  const loginId = input.loginId.trim();
  const email = input.email.trim();
  const nickname = input.nickname.trim();
  const loginIdLower = normalize(loginId);
  const emailLower = normalize(email);
  const now = new Date().toISOString();

  const duplicateLoginId = await findUserByLoginId(loginId);

  if (duplicateLoginId) {
    throw new Error("이미 사용 중인 로그인 ID입니다.");
  }

  if (input.provider === "password") {
    const duplicatePasswordUser = await findPasswordUserByEmail(email);

    if (duplicatePasswordUser) {
      throw new Error("이미 가입한 이메일입니다.");
    }
  } else {
    const duplicateOAuthUser = await findOAuthUserByEmail(input.provider, email);

    if (duplicateOAuthUser) {
      throw new Error("이미 가입한 소셜 계정입니다.");
    }
  }

  const user: AuthUser = {
    id: randomUUID(),
    loginId,
    loginIdLower,
    email,
    emailLower,
    passwordHash: input.passwordHash,
    nickname,
    provider: input.provider,
    providerSubject: input.providerSubject,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(USERS_COLLECTION).doc(user.id).set(user);

  return user;
}

export function isUsingFirestore() {
  return hasFirebaseAdminConfig();
}
