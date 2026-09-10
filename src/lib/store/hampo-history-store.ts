import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { getCardCompanyName } from "@/lib/toss-payments/card-companies";

const COLLECTION = "hampo_charge_histories";

export type HampoChargeHistory = {
  id: string;
  userId: string;
  email: string;
  amount: number;
  previousBalance: number;
  balanceAfter: number;
  unitPrice: number;
  paymentAmount: number;
  paymentStatus: string;
  source: string;
  status: string;
  paymentKey: string;
  orderId: string;
  paymentMethod: string;
  cardIssuerCode: string;
  cardCompany: string;
  cardNumber: string;
  refundStatus: string;
  refundedAmount: number;
  refundedPaymentAmount: number;
  refundedAt: string;
  reclaimStatus: string;
  reclaimedAmount: number;
  reclaimedAt: string;
  currentBalance: number;
  createdAt: string;
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function listHampoChargeHistories(email?: string) {
  const db = getFirebaseAdminDb();
  if (!db) return [];

  const snapshot = await db.collection(COLLECTION).get();
  const rawHistories = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: String(data.userId ?? ""),
      email: String(data.email ?? ""),
      amount: toNumber(data.amount),
      previousBalance: toNumber(data.previousBalance),
      balanceAfter: toNumber(data.balanceAfter),
      unitPrice: toNumber(data.unitPrice),
      paymentAmount: toNumber(data.paymentAmount),
      paymentStatus: String(data.paymentStatus ?? ""),
      source: String(data.source ?? ""),
      status: String(data.status ?? ""),
      paymentKey: String(data.paymentKey ?? ""),
      orderId: String(data.orderId ?? ""),
      paymentMethod: String(data.paymentMethod ?? ""),
      cardIssuerCode: String(data.cardIssuerCode ?? ""),
      cardCompany: getCardCompanyName(String(data.cardIssuerCode ?? "")),
      cardNumber: String(data.cardNumber ?? ""),
      refundStatus: String(data.refundStatus ?? "none"),
      refundedAmount: toNumber(data.refundedAmount),
      refundedPaymentAmount: toNumber(data.refundedPaymentAmount),
      refundedAt: String(data.refundedAt ?? ""),
      reclaimStatus: String(data.reclaimStatus ?? "none"),
      reclaimedAmount: toNumber(data.reclaimedAmount),
      reclaimedAt: String(data.reclaimedAt ?? ""),
      currentBalance: 0,
      createdAt: String(data.createdAt ?? ""),
    } satisfies HampoChargeHistory;
  });

  const usersSnapshot = await db.collection("users").get();
  const usersById = new Map<string, { email: string; hampoBalance: number }>();
  const usersByEmail = new Map<
    string,
    { email: string; hampoBalance: number }
  >();
  usersSnapshot.docs.forEach((doc) => {
    const user = {
      email: String(doc.data()?.email ?? ""),
      hampoBalance: toNumber(doc.data()?.hampoBalance),
    };
    usersById.set(doc.id, user);
    if (user.email) usersByEmail.set(user.email.trim().toLowerCase(), user);
  });

  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  return rawHistories
    .map((history) => {
      const user =
        usersById.get(history.userId) ||
        usersByEmail.get(history.email.trim().toLowerCase());
      return {
        ...history,
        email: history.email || user?.email || "",
        currentBalance: user?.hampoBalance ?? 0,
      };
    })
    .filter(
      (history) =>
        !normalizedEmail ||
        history.email.trim().toLowerCase() === normalizedEmail,
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function reclaimManualHampoCharge(
  historyId: string,
  reason: string,
) {
  const db = getFirebaseAdminDb();
  if (!db) throw new Error("Firebase Admin 설정이 필요합니다.");

  const historyRef = db.collection(COLLECTION).doc(historyId);
  const usageRef = db
    .collection("hampo_usage_histories")
    .doc(`manual_reclaim_${historyId}`);

  return db.runTransaction(async (transaction) => {
    const historySnapshot = await transaction.get(historyRef);
    if (!historySnapshot.exists)
      throw new Error("충전 이력을 찾을 수 없습니다.");

    const history = historySnapshot.data()!;
    if (
      history.source !== "admin_manual_charge" &&
      history.source !== "temporary_manual_charge"
    ) {
      throw new Error("수동으로 충전된 함포만 회수할 수 있습니다.");
    }
    if (
      history.status === "reclaimed" ||
      history.reclaimStatus === "completed"
    ) {
      throw new Error("이미 회수된 충전 내역입니다.");
    }

    const userRef = db.collection("users").doc(String(history.userId ?? ""));
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists)
      throw new Error("사용자 정보를 찾을 수 없습니다.");

    const amount = toNumber(history.amount);
    const currentBalance = toNumber(userSnapshot.data()?.hampoBalance);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new Error("회수할 함포 정보가 올바르지 않습니다.");
    }
    if (currentBalance < amount) {
      throw new Error(
        `현재 보유 함포(${currentBalance.toLocaleString("ko-KR")})가 회수 대상(${amount.toLocaleString("ko-KR")})보다 적습니다.`,
      );
    }

    const balanceAfter = currentBalance - amount;
    const reclaimedAt = new Date().toISOString();
    transaction.update(userRef, {
      hampoBalance: balanceAfter,
      updatedAt: reclaimedAt,
    });
    transaction.update(historyRef, {
      status: "reclaimed",
      reclaimStatus: "completed",
      reclaimedAmount: amount,
      reclaimReason: reason,
      reclaimedAt,
    });
    transaction.set(usageRef, {
      id: usageRef.id,
      originalTransactionId: historyId,
      userId: String(history.userId ?? ""),
      email: String(history.email ?? userSnapshot.data()?.email ?? ""),
      serviceSiteId: "hams-oauth",
      clientId: "hams-oauth",
      serviceName: "수동 충전 함포 회수",
      plan: "manual_reclaim",
      amount,
      refundableAmount: 0,
      previousBalance: currentBalance,
      balanceAfter,
      unitPrice: toNumber(history.unitPrice) || 100,
      paymentAmount: toNumber(history.paymentAmount),
      source: "manual_charge_reclaim",
      status: "completed",
      refundStatus: "full",
      refundRequestStatus: "none",
      refundRequestId: null,
      refundedAmount: 0,
      refundedPaymentAmount: 0,
      refundedAt: null,
      refundTransactionIds: [],
      relatedChargeHistoryId: historyId,
      reason,
      createdAt: reclaimedAt,
      updatedAt: reclaimedAt,
    });

    return { reclaimedAmount: amount, balanceAfter };
  });
}
