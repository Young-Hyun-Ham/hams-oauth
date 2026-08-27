// hams-oauth/src/lib/store/user-store.ts
import { randomUUID } from "node:crypto";

import type { Timestamp } from "firebase-admin/firestore";

import type { AIChatType, AuthProvider, AuthUser, Gender, OAuthProvider, ServiceMembership } from "@/lib/auth/types";
import { getFirebaseAdminDb, hasFirebaseAdminConfig } from "@/lib/firebase-admin";
import { decryptApiKey, encryptApiKey } from "@/lib/security/api-key";

const USERS_COLLECTION = "users";
const HAMPO_CHARGE_HISTORIES_COLLECTION = "hampo_charge_histories";
const HAMPO_UNIT_PRICE = 100;

type CreateUserInput = {
  loginId: string;
  email: string;
  nickname: string;
  phoneNumber: string;
  birthDate: string;
  gender: Gender;
  provider: AuthProvider;
  providerSubject: string | null;
  passwordHash: string | null;
  termsVersion: string;
  termsAcceptedAt: string;
  serviceMemberships?: ServiceMembership[];
};

type UpdateUserProfileInput = {
  id: string;
  nickname: string;
  phoneNumber: string;
  birthDate: string;
  gender: Gender;
  passwordHash?: string;
  serviceMemberships: ServiceMembership[];
  aiEnabled: boolean;
  aiChatType: AIChatType | null;
  apiKey: string | null;
  chatModel: string | null;
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
    phoneNumber: String(data.phoneNumber ?? ""),
    birthDate: typeof data.birthDate === "string" ? data.birthDate : null,
    gender:
      data.gender === "male" ||
      data.gender === "female" ||
      data.gender === "other" ||
      data.gender === "prefer_not_to_say"
        ? data.gender
        : null,
    hampoBalance:
      typeof data.hampoBalance === "number" && Number.isSafeInteger(data.hampoBalance)
        ? Math.max(0, data.hampoBalance)
        : 0,
    serviceMemberships: Array.isArray(data.serviceMemberships)
      ? (data.serviceMemberships as ServiceMembership[])
      : [],
    aiEnabled: typeof data.aiEnabled === "boolean" ? data.aiEnabled : false,
    aiChatType:
      data.aiChatType === "gpt" || data.aiChatType === "gemini" || data.aiChatType === "claude"
        ? data.aiChatType
        : null,
    apiKey: decryptApiKey(typeof data.apiKey === "string" ? data.apiKey : null),
    chatModel: typeof data.chatModel === "string" ? data.chatModel : null,
    provider: (data.provider as AuthProvider | undefined) ?? "password",
    providerSubject:
      typeof data.providerSubject === "string" ? data.providerSubject : null,
    termsVersion: typeof data.termsVersion === "string" ? data.termsVersion : null,
    termsAcceptedAt:
      typeof data.termsAcceptedAt === "string" ? data.termsAcceptedAt : null,
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

export async function listUsers() {
  const db = requireDb();
  const snapshot = await db.collection(USERS_COLLECTION).get();

  return snapshot.docs
    .map((doc) => mapFirestoreUser(doc.id, doc.data() ?? {}))
    .sort((a, b) => {
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      return Number.isNaN(bTime) || Number.isNaN(aTime) ? 0 : bTime - aTime;
    });
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
    .where("loginIdLower", "==", normalized)
    .limit(1)
    .get();

  if (!byLoginId.empty) {
    const doc = byLoginId.docs[0];
    return mapFirestoreUser(doc.id, doc.data() ?? {});
  }

  const byEmail = await db
    .collection(USERS_COLLECTION)
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

export async function findUserByEmail(email: string) {
  const db = requireDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
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
  const phoneNumber = input.phoneNumber.trim();
  const birthDate = input.birthDate.trim();
  const loginIdLower = normalize(loginId);
  const emailLower = normalize(email);
  const now = new Date().toISOString();

  const duplicateLoginId = await findUserByLoginId(loginId);

  if (duplicateLoginId) {
    throw new Error("이미 사용 중인 로그인 ID입니다.");
  }

  const duplicateEmailUser = await findUserByEmail(email);

  if (duplicateEmailUser) {
    throw new Error("이미 가입된 이메일입니다.");
  }

  const user: AuthUser = {
    id: randomUUID(),
    loginId,
    loginIdLower,
    email,
    emailLower,
    passwordHash: input.passwordHash,
    nickname,
    phoneNumber,
    birthDate,
    gender: input.gender,
    hampoBalance: 0,
    serviceMemberships: input.serviceMemberships ?? [],
    aiEnabled: false,
    aiChatType: null,
    apiKey: null,
    chatModel: null,
    provider: input.provider,
    providerSubject: input.providerSubject,
    termsVersion: input.termsVersion,
    termsAcceptedAt: input.termsAcceptedAt,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(USERS_COLLECTION).doc(user.id).set({
    ...user,
    apiKey: null,
  });

  return user;
}

export async function updateUserProfile(input: UpdateUserProfileInput) {
  const db = requireDb();
  const existingUser = await findUserById(input.id);

  if (!existingUser) {
    throw new Error("사용자 정보를 찾을 수 없습니다.");
  }

  const nickname = input.nickname.trim();
  const phoneNumber = input.phoneNumber.trim();

  const encryptedApiKey = input.aiEnabled ? encryptApiKey(input.apiKey) : null;

  const updatedUser: AuthUser = {
    ...existingUser,
    nickname,
    phoneNumber,
    birthDate: input.birthDate,
    gender: input.gender,
    passwordHash: input.passwordHash ?? existingUser.passwordHash,
    serviceMemberships: input.serviceMemberships,
    aiEnabled: input.aiEnabled,
    aiChatType: input.aiEnabled ? input.aiChatType : null,
    apiKey: input.aiEnabled ? input.apiKey : null,
    chatModel: input.aiEnabled ? input.chatModel : null,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(USERS_COLLECTION).doc(updatedUser.id).set({
    ...updatedUser,
    apiKey: encryptedApiKey,
  });

  return updatedUser;
}

export async function deleteUserById(id: string) {
  const db = requireDb();
  const existingUser = await findUserById(id);

  if (!existingUser) {
    throw new Error("?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
  }

  await db.collection(USERS_COLLECTION).doc(id).delete();
}

export async function chargeUserHampo(id: string, amount: number) {
  const db = requireDb();
  const userRef = db.collection(USERS_COLLECTION).doc(id);
  const historyRef = db
    .collection(HAMPO_CHARGE_HISTORIES_COLLECTION)
    .doc(randomUUID());

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);

    if (!snapshot.exists) {
      throw new Error("사용자 정보를 찾을 수 없습니다.");
    }

    const currentValue = snapshot.data()?.hampoBalance;
    const currentBalance =
      typeof currentValue === "number" && Number.isSafeInteger(currentValue)
        ? Math.max(0, currentValue)
        : 0;
    const nextBalance = currentBalance + amount;

    if (!Number.isSafeInteger(nextBalance)) {
      throw new Error("보유 가능한 함포 한도를 초과했습니다.");
    }

    const createdAt = new Date().toISOString();

    transaction.update(userRef, {
      hampoBalance: nextBalance,
      updatedAt: createdAt,
    });
    transaction.set(historyRef, {
      id: historyRef.id,
      userId: id,
      email: String(snapshot.data()?.email ?? ""),
      type: "charge",
      status: "completed",
      amount,
      previousBalance: currentBalance,
      balanceAfter: nextBalance,
      unitPrice: HAMPO_UNIT_PRICE,
      paymentAmount: amount * HAMPO_UNIT_PRICE,
      paymentStatus: "not_linked",
      source: "temporary_manual_charge",
      createdAt,
    });

    return nextBalance;
  });
}

export function isUsingFirestore() {
  return hasFirebaseAdminConfig();
}
