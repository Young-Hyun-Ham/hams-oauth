import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";

const COLLECTION = "hampo_usage_histories";

export type HampoRefundStatus = "none" | "partial" | "full";
export type HampoRefundFilter =
  | ""
  | "available"
  | "pending"
  | "partial"
  | "full";

export type HampoUsageHistory = {
  id: string;
  originalTransactionId: string;
  userId: string;
  email: string;
  serviceSiteId: string;
  clientId: string;
  serviceName: string;
  plan: string;
  amount: number;
  refundableAmount: number;
  previousBalance: number;
  balanceAfter: number;
  unitPrice: number;
  paymentAmount: number;
  source: string;
  status: string;
  refundStatus: HampoRefundStatus;
  refundRequestStatus: "none" | "pending";
  refundRequestId: string | null;
  refundedAmount: number;
  refundedPaymentAmount: number;
  refundedAt: string | null;
  refundTransactionIds: string[];
  createdAt: string;
  updatedAt: string;
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function listHampoUsageHistories(
  email?: string,
  serviceSiteId?: string,
  refundFilter?: HampoRefundFilter,
) {
  const db = getFirebaseAdminDb();
  if (!db) return [];

  const snapshot = await db.collection(COLLECTION).get();
  const rawHistories = snapshot.docs.map((doc) => {
    const data = doc.data();
    const refundStatus =
      data.refundStatus === "partial" || data.refundStatus === "full"
        ? data.refundStatus
        : "none";

    return {
      id: doc.id,
      originalTransactionId: String(data.originalTransactionId ?? doc.id),
      userId: String(data.userId ?? ""),
      email: String(data.email ?? ""),
      serviceSiteId: String(data.serviceSiteId ?? ""),
      clientId: String(data.clientId ?? ""),
      serviceName: String(data.serviceName ?? ""),
      plan: String(data.plan ?? ""),
      amount: toNumber(data.amount),
      refundableAmount: toNumber(data.refundableAmount ?? data.amount),
      previousBalance: toNumber(data.previousBalance),
      balanceAfter: toNumber(data.balanceAfter),
      unitPrice: toNumber(data.unitPrice),
      paymentAmount: toNumber(data.paymentAmount),
      source: String(data.source ?? ""),
      status: String(data.status ?? ""),
      refundStatus,
      refundRequestStatus:
        data.refundRequestStatus === "pending" ? "pending" : "none",
      refundRequestId:
        typeof data.refundRequestId === "string" ? data.refundRequestId : null,
      refundedAmount: toNumber(data.refundedAmount),
      refundedPaymentAmount: toNumber(data.refundedPaymentAmount),
      refundedAt:
        typeof data.refundedAt === "string" ? data.refundedAt : null,
      refundTransactionIds: Array.isArray(data.refundTransactionIds)
        ? data.refundTransactionIds.map(String)
        : [],
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? data.createdAt ?? ""),
    } satisfies HampoUsageHistory;
  });

  const legacyUserIds = Array.from(
    new Set(
      rawHistories
        .filter((history) => !history.email)
        .map((history) => history.userId),
    ),
  ).filter(Boolean);
  const legacyEmails = new Map<string, string>();

  await Promise.all(
    legacyUserIds.map(async (userId) => {
      const userSnapshot = await db.collection("users").doc(userId).get();
      if (userSnapshot.exists) {
        legacyEmails.set(userId, String(userSnapshot.data()?.email ?? ""));
      }
    }),
  );

  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const normalizedServiceSiteId = serviceSiteId?.trim() ?? "";
  const normalizedRefundFilter = refundFilter ?? "";
  let searchedUserId = "";

  if (normalizedEmail) {
    const userSnapshot = await db
      .collection("users")
      .where("emailLower", "==", normalizedEmail)
      .limit(1)
      .get();
    searchedUserId = userSnapshot.docs[0]?.id ?? "";
  }

  return rawHistories
    .map((history) => ({
      ...history,
      email: history.email || legacyEmails.get(history.userId) || "",
    }))
    .filter(
      (history) =>
        (!normalizedEmail ||
          history.email.trim().toLowerCase() === normalizedEmail ||
          (searchedUserId && history.userId === searchedUserId)) &&
        (!normalizedServiceSiteId ||
          history.serviceSiteId === normalizedServiceSiteId) &&
        (!normalizedRefundFilter ||
          (normalizedRefundFilter === "pending" &&
            history.refundRequestStatus === "pending") ||
          (normalizedRefundFilter === "available" &&
            history.refundRequestStatus === "none" &&
            history.refundStatus === "none") ||
          (normalizedRefundFilter === "partial" &&
            history.refundRequestStatus === "none" &&
            history.refundStatus === "partial") ||
          (normalizedRefundFilter === "full" &&
            history.refundRequestStatus === "none" &&
            history.refundStatus === "full")),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
