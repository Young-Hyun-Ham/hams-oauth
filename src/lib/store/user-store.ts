// hams-oauth/src/lib/store/user-store.ts
import { randomUUID } from "node:crypto";

import type { Timestamp } from "firebase-admin/firestore";

import type {
  AIChatType,
  AuthProvider,
  AuthUser,
  Gender,
  OAuthProvider,
  ServiceMembership,
  ServicePlan,
} from "@/lib/auth/types";
import { getFirebaseAdminDb, hasFirebaseAdminConfig } from "@/lib/firebase-admin";
import { calculateProratedHampoRefund } from "@/lib/hampo/refund-policy";
import { decryptApiKey, encryptApiKey } from "@/lib/security/api-key";

const USERS_COLLECTION = "users";
const HAMPO_CHARGE_HISTORIES_COLLECTION = "hampo_charge_histories";
const HAMPO_USAGE_HISTORIES_COLLECTION = "hampo_usage_histories";
const HAMPO_REFUND_REQUESTS_COLLECTION = "hampo_refund_requests";
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
  hampoUsages?: Array<{
    serviceSiteId: string;
    clientId: string;
    serviceName: string;
    plan: ServicePlan;
    amount: number;
    paymentAmount: number;
  }>;
};

type AdminUpdateUserInput = {
  id: string;
  loginId: string;
  email: string;
  nickname: string;
  phoneNumber: string;
  birthDate: string | null;
  gender: Gender | null;
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
  const usages = input.hampoUsages ?? [];

  for (const usage of usages) {
    if (!Number.isSafeInteger(usage.amount) || usage.amount < 1) {
      throw new Error("사용할 함포는 1 이상 정수여야 합니다.");
    }
  }

  const userRef = db.collection(USERS_COLLECTION).doc(updatedUser.id);
  const balanceAfter = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);

    if (!snapshot.exists) {
      throw new Error("회원정보를 찾을 수 없습니다.");
    }

    const storedBalance = snapshot.data()?.hampoBalance;
    const currentBalance =
      typeof storedBalance === "number" && Number.isSafeInteger(storedBalance)
        ? Math.max(0, storedBalance)
        : 0;
    const totalUsage = usages.reduce((sum, usage) => sum + usage.amount, 0);

    if (!Number.isSafeInteger(totalUsage) || totalUsage > currentBalance) {
      throw new Error("함포 잔액이 부족합니다. 함포를 충전한 후 다시 시도해 주세요.");
    }

    let runningBalance = currentBalance;
    const updatedAt = new Date().toISOString();

    for (const usage of usages) {
      const historyRef = db
        .collection(HAMPO_USAGE_HISTORIES_COLLECTION)
        .doc(randomUUID());
      const previousBalance = runningBalance;
      runningBalance -= usage.amount;

      transaction.set(historyRef, {
        id: historyRef.id,
        originalTransactionId: historyRef.id,
        userId: updatedUser.id,
        email: updatedUser.email,
        serviceSiteId: usage.serviceSiteId,
        clientId: usage.clientId,
        serviceName: usage.serviceName,
        plan: usage.plan,
        amount: usage.amount,
        refundableAmount: usage.amount,
        previousBalance,
        balanceAfter: runningBalance,
        unitPrice: HAMPO_UNIT_PRICE,
        paymentAmount: usage.paymentAmount,
        source: "service_membership",
        status: "completed",
        refundStatus: "none",
        refundedAmount: 0,
        refundedPaymentAmount: 0,
        refundedAt: null,
        refundTransactionIds: [],
        createdAt: updatedAt,
        updatedAt,
      });
    }

    transaction.set(userRef, {
      ...updatedUser,
      hampoBalance: runningBalance,
      apiKey: encryptedApiKey,
      updatedAt,
    });

    return runningBalance;
  });

  return { ...updatedUser, hampoBalance: balanceAfter };
}

export async function updateUserByAdmin(input: AdminUpdateUserInput) {
  const db = requireDb();
  const existingUser = await findUserById(input.id);

  if (!existingUser) {
    throw new Error("회원정보를 찾을 수 없습니다.");
  }

  const loginId = input.loginId.trim();
  const email = input.email.trim();
  const nickname = input.nickname.trim();

  if (!loginId || !email || !nickname) {
    throw new Error("로그인 ID, 이메일, 닉네임을 모두 입력해 주세요.");
  }

  const duplicateLoginId = await findUserByLoginId(loginId);
  if (duplicateLoginId && duplicateLoginId.id !== input.id) {
    throw new Error("이미 사용 중인 로그인 ID입니다.");
  }

  const duplicateEmail = await findUserByEmail(email);
  if (duplicateEmail && duplicateEmail.id !== input.id) {
    throw new Error("이미 가입된 이메일입니다.");
  }

  const updatedAt = new Date().toISOString();
  await db.collection(USERS_COLLECTION).doc(input.id).set(
    {
      loginId,
      loginIdLower: normalize(loginId),
      email,
      emailLower: normalize(email),
      nickname,
      phoneNumber: input.phoneNumber.trim(),
      birthDate: input.birthDate,
      gender: input.gender,
      updatedAt,
    },
    { merge: true },
  );

  return { ...existingUser, ...input, loginId, email, nickname, updatedAt };
}

export async function deleteUserById(id: string) {
  const db = requireDb();
  const existingUser = await findUserById(id);

  if (!existingUser) {
    throw new Error("?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
  }

  await db.collection(USERS_COLLECTION).doc(id).delete();
}

export async function purchaseUserServiceMembership(input: {
  userId: string;
  serviceSiteId: string;
  clientId: string;
  serviceName: string;
  plan: ServicePlan;
  amount: number;
  planPrice: number;
  paymentAmount: number;
}) {
  const db = requireDb();
  const userRef = db.collection(USERS_COLLECTION).doc(input.userId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);

    if (!snapshot.exists) {
      throw new Error("회원정보를 찾을 수 없습니다.");
    }

    const data = snapshot.data() ?? {};
    const memberships = Array.isArray(data.serviceMemberships)
      ? (data.serviceMemberships as ServiceMembership[])
      : [];
    const previous = memberships.find(
      (membership) =>
        membership.serviceSiteId === input.serviceSiteId ||
        membership.clientId === input.clientId,
    );
    const joinedAt = previous?.joinedAt ?? new Date().toISOString();
    const membership: ServiceMembership = {
      serviceSiteId: input.serviceSiteId,
      clientId: input.clientId,
      serviceName: input.serviceName,
      plan: input.plan,
      monthlyPrice: input.planPrice,
      joinedAt,
      status: "active",
      refundRequestedAt: null,
      refundRequestId: null,
    };

    if (previous?.status === "refund_pending") {
      throw new Error("환불 진행 중인 서비스는 변경할 수 없습니다.");
    }

    if (
      previous &&
      previous.monthlyPrice > 0 &&
      input.planPrice <= previous.monthlyPrice
    ) {
      throw new Error("유료 서비스는 상위 플랜으로만 업그레이드할 수 있습니다.");
    }

    if (previous?.plan === input.plan) {
      const currentBalance =
        typeof data.hampoBalance === "number" &&
        Number.isSafeInteger(data.hampoBalance)
          ? Math.max(0, data.hampoBalance)
          : 0;
      return { balance: currentBalance, membership, chargedAmount: 0 };
    }

    if (!Number.isSafeInteger(input.amount) || input.amount < 0) {
      throw new Error("사용할 함포가 올바르지 않습니다.");
    }

    const currentBalance =
      typeof data.hampoBalance === "number" &&
      Number.isSafeInteger(data.hampoBalance)
        ? Math.max(0, data.hampoBalance)
        : 0;
    if (input.amount > currentBalance) {
      throw new Error("함포 잔액이 부족합니다. 함포를 충전한 후 다시 시도해 주세요.");
    }

    const balanceAfter = currentBalance - input.amount;
    const nextMemberships = [
      ...memberships.filter(
        (item) =>
          item.serviceSiteId !== input.serviceSiteId &&
          item.clientId !== input.clientId,
      ),
      membership,
    ];
    const updatedAt = new Date().toISOString();

    transaction.update(userRef, {
      serviceMemberships: nextMemberships,
      hampoBalance: balanceAfter,
      updatedAt,
    });

    if (input.amount > 0) {
      const historyRef = db
        .collection(HAMPO_USAGE_HISTORIES_COLLECTION)
        .doc(randomUUID());
      transaction.set(historyRef, {
        id: historyRef.id,
        originalTransactionId: historyRef.id,
        userId: input.userId,
        email: String(data.email ?? ""),
        serviceSiteId: input.serviceSiteId,
        clientId: input.clientId,
        serviceName: input.serviceName,
        plan: input.plan,
        amount: input.amount,
        refundableAmount: input.amount,
        previousBalance: currentBalance,
        balanceAfter,
        unitPrice: HAMPO_UNIT_PRICE,
        paymentAmount: input.paymentAmount,
        source: "service_membership_purchase_modal",
        status: "completed",
        refundStatus: "none",
        refundedAmount: 0,
        refundedPaymentAmount: 0,
        refundedAt: null,
        refundTransactionIds: [],
        createdAt: updatedAt,
        updatedAt,
      });
    }

    return { balance: balanceAfter, membership, chargedAmount: input.amount };
  });
}

export async function removeUserServiceMembership(
  userId: string,
  serviceSiteId: string,
  clientId: string,
) {
  const db = requireDb();
  const userRef = db.collection(USERS_COLLECTION).doc(userId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);

    if (!snapshot.exists) {
      throw new Error("회원정보를 찾을 수 없습니다.");
    }

    const data = snapshot.data() ?? {};
    const memberships = Array.isArray(data.serviceMemberships)
      ? (data.serviceMemberships as ServiceMembership[])
      : [];
    const nextMemberships = memberships.filter(
      (membership) =>
        membership.serviceSiteId !== serviceSiteId &&
        membership.clientId !== clientId,
    );

    transaction.update(userRef, {
      serviceMemberships: nextMemberships,
      updatedAt: new Date().toISOString(),
    });

    return nextMemberships;
  });
}

export async function requestUserServiceRefund(
  userId: string,
  serviceSiteId: string,
  clientId: string,
) {
  const db = requireDb();
  const usageSnapshot = await db
    .collection(HAMPO_USAGE_HISTORIES_COLLECTION)
    .where("userId", "==", userId)
    .get();
  const usageRefs = usageSnapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return (
        (data.serviceSiteId === serviceSiteId || data.clientId === clientId) &&
        data.status === "completed" &&
        data.refundStatus !== "full" &&
        data.refundRequestStatus !== "pending"
      );
    })
    .map((doc) => doc.ref);

  if (usageRefs.length === 0) {
    throw new Error("환불을 요청할 수 있는 함포 사용이력이 없습니다.");
  }

  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const refundRequestRef = db
    .collection(HAMPO_REFUND_REQUESTS_COLLECTION)
    .doc(randomUUID());

  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const usageSnapshots = await Promise.all(
      usageRefs.map((usageRef) => transaction.get(usageRef)),
    );

    if (!userSnapshot.exists) {
      throw new Error("회원정보를 찾을 수 없습니다.");
    }

    const data = userSnapshot.data() ?? {};
    const memberships = Array.isArray(data.serviceMemberships)
      ? (data.serviceMemberships as ServiceMembership[])
      : [];
    const membership = memberships.find(
      (item) =>
        item.serviceSiteId === serviceSiteId || item.clientId === clientId,
    );

    if (!membership || membership.status === "refund_pending") {
      throw new Error("이미 환불 진행 중이거나 이용 중인 서비스가 아닙니다.");
    }

    const refundableUsages = usageSnapshots.filter((snapshot) => {
      const usage = snapshot.data();
      return (
        snapshot.exists &&
        usage?.status === "completed" &&
        usage.refundStatus !== "full" &&
        usage.refundRequestStatus !== "pending"
      );
    });
    const requestedAmount = refundableUsages.reduce((sum, snapshot) => {
      const usage = snapshot.data() ?? {};
      const amount =
        typeof usage.refundableAmount === "number"
          ? usage.refundableAmount
          : Number(usage.amount ?? 0);
      const refundedAmount = Number(usage.refundedAmount ?? 0);
      return sum + Math.max(0, amount - refundedAmount);
    }, 0);

    if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1) {
      throw new Error("환불 가능한 함포가 없습니다.");
    }

    const requestedAt = new Date().toISOString();
    const nextMembership: ServiceMembership = {
      ...membership,
      status: "refund_pending",
      refundRequestedAt: requestedAt,
      refundRequestId: refundRequestRef.id,
    };
    const nextMemberships = memberships.map((item) =>
      item.serviceSiteId === membership.serviceSiteId ||
      item.clientId === membership.clientId
        ? nextMembership
        : item,
    );
    const usageHistoryIds = refundableUsages.map(
      (snapshot) => snapshot.id,
    );

    transaction.update(userRef, {
      serviceMemberships: nextMemberships,
      updatedAt: requestedAt,
    });
    for (const usageSnapshot of refundableUsages) {
      transaction.update(usageSnapshot.ref, {
        refundRequestStatus: "pending",
        refundRequestId: refundRequestRef.id,
        updatedAt: requestedAt,
      });
    }
    transaction.set(refundRequestRef, {
      id: refundRequestRef.id,
      userId,
      email: String(data.email ?? ""),
      serviceSiteId: membership.serviceSiteId,
      clientId: membership.clientId,
      serviceName: membership.serviceName,
      plan: membership.plan,
      usageHistoryIds,
      requestedAmount,
      requestedPaymentAmount: requestedAmount * HAMPO_UNIT_PRICE,
      status: "pending",
      requestedAt,
      processedAt: null,
      processedBy: null,
      adminMemo: "",
      createdAt: requestedAt,
      updatedAt: requestedAt,
    });

    return {
      membership: nextMembership,
      memberships: nextMemberships,
      refundRequestId: refundRequestRef.id,
      requestedAmount,
    };
  });
}

export async function completeUserServiceRefund(input: {
  refundRequestId: string;
  adminMemo?: string;
}) {
  const db = requireDb();
  const completedAt = new Date().toISOString();
  const refundRequestRef = db
    .collection(HAMPO_REFUND_REQUESTS_COLLECTION)
    .doc(input.refundRequestId);
  const refundHistoryRef = db
    .collection(HAMPO_CHARGE_HISTORIES_COLLECTION)
    .doc(randomUUID());

  return db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(refundRequestRef);
    if (!requestSnapshot.exists) {
      throw new Error("환불 요청을 찾을 수 없습니다.");
    }

    const request = requestSnapshot.data() ?? {};
    if (request.status !== "pending") {
      throw new Error("이미 처리되었거나 처리할 수 없는 환불 요청입니다.");
    }

    const userId = String(request.userId ?? "");
    const usageHistoryIds = Array.isArray(request.usageHistoryIds)
      ? request.usageHistoryIds.map(String).filter(Boolean)
      : [];
    if (!userId || usageHistoryIds.length === 0) {
      throw new Error("환불 요청 데이터가 올바르지 않습니다.");
    }

    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const usageRefs = usageHistoryIds.map((id) =>
      db.collection(HAMPO_USAGE_HISTORIES_COLLECTION).doc(id),
    );
    const [userSnapshot, ...usageSnapshots] = await Promise.all([
      transaction.get(userRef),
      ...usageRefs.map((usageRef) => transaction.get(usageRef)),
    ]);

    if (!userSnapshot.exists) {
      throw new Error("회원정보를 찾을 수 없습니다.");
    }

    const refundItems = usageSnapshots.map((snapshot) => {
      if (!snapshot.exists) {
        throw new Error("환불 대상 함포 사용이력을 찾을 수 없습니다.");
      }

      const usage = snapshot.data() ?? {};
      if (
        usage.refundRequestStatus !== "pending" ||
        usage.refundRequestId !== input.refundRequestId
      ) {
        throw new Error("환불 요청 상태가 변경되었습니다. 목록을 새로고침해 주세요.");
      }

      const refundableAmount = Number(
        usage.refundableAmount ?? usage.amount ?? 0,
      );
      const alreadyRefundedAmount = Number(usage.refundedAmount ?? 0);
      const remainingAmount = Math.max(
        0,
        Math.floor(refundableAmount - alreadyRefundedAmount),
      );
      const calculation = calculateProratedHampoRefund(
        remainingAmount,
        String(usage.createdAt ?? request.requestedAt ?? completedAt),
        completedAt,
      );
      const unitPrice = Number(usage.unitPrice ?? HAMPO_UNIT_PRICE);

      return {
        snapshot,
        usage,
        remainingAmount,
        calculation,
        refundedPaymentAmount: calculation.refundAmount * unitPrice,
      };
    });

    const refundedAmount = refundItems.reduce(
      (sum, item) => sum + item.calculation.refundAmount,
      0,
    );
    const usedAmount = refundItems.reduce(
      (sum, item) => sum + item.calculation.usedAmount,
      0,
    );
    const refundedPaymentAmount = refundItems.reduce(
      (sum, item) => sum + item.refundedPaymentAmount,
      0,
    );
    const userData = userSnapshot.data() ?? {};
    const currentBalance = Number(userData.hampoBalance ?? 0);
    const nextBalance = currentBalance + refundedAmount;

    if (!Number.isSafeInteger(nextBalance)) {
      throw new Error("환불 후 함포 잔액이 허용 범위를 초과합니다.");
    }

    const memberships = Array.isArray(userData.serviceMemberships)
      ? (userData.serviceMemberships as ServiceMembership[])
      : [];
    const nextMemberships = memberships.filter(
      (membership) =>
        membership.refundRequestId !== input.refundRequestId &&
        membership.serviceSiteId !== String(request.serviceSiteId ?? "") &&
        membership.clientId !== String(request.clientId ?? ""),
    );

    transaction.update(userRef, {
      hampoBalance: nextBalance,
      serviceMemberships: nextMemberships,
      updatedAt: completedAt,
    });

    for (const item of refundItems) {
      const existingTransactionIds = Array.isArray(
        item.usage.refundTransactionIds,
      )
        ? item.usage.refundTransactionIds.map(String)
        : [];
      const totalRefundedAmount =
        Number(item.usage.refundedAmount ?? 0) +
        item.calculation.refundAmount;
      const totalRefundedPaymentAmount =
        Number(item.usage.refundedPaymentAmount ?? 0) +
        item.refundedPaymentAmount;

      transaction.update(item.snapshot.ref, {
        refundStatus: "full",
        refundRequestStatus: "none",
        refundedAmount: totalRefundedAmount,
        refundedPaymentAmount: totalRefundedPaymentAmount,
        refundedAt: completedAt,
        refundTransactionIds:
          item.calculation.refundAmount > 0
            ? [...existingTransactionIds, refundHistoryRef.id]
            : existingTransactionIds,
        updatedAt: completedAt,
      });
    }

    transaction.update(refundRequestRef, {
      status: "completed",
      refundedAmount,
      usedAmount,
      refundedPaymentAmount,
      processedAt: completedAt,
      processedBy: "admin",
      adminMemo: input.adminMemo?.trim() ?? "",
      updatedAt: completedAt,
    });

    if (refundedAmount > 0) {
      transaction.set(refundHistoryRef, {
        id: refundHistoryRef.id,
        userId,
        email: String(userData.email ?? request.email ?? ""),
        type: "refund",
        status: "completed",
        amount: refundedAmount,
        previousBalance: currentBalance,
        balanceAfter: nextBalance,
        unitPrice: HAMPO_UNIT_PRICE,
        paymentAmount: refundedPaymentAmount,
        paymentStatus: "refund_completed",
        source: "admin_service_refund",
        refundRequestId: input.refundRequestId,
        createdAt: completedAt,
      });
    }

    return {
      refundedAmount,
      usedAmount,
      refundedPaymentAmount,
      balanceAfter: nextBalance,
    };
  });
}

export async function chargeUserHampo(
  id: string,
  amount: number,
  source = "temporary_manual_charge",
) {
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
      source,
      createdAt,
    });

    return nextBalance;
  });
}

export function isUsingFirestore() {
  return hasFirebaseAdminConfig();
}
