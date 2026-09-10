import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";

const PAYMENT_ORDERS_COLLECTION = "toss_payment_orders";
const USERS_COLLECTION = "users";
const HAMPO_CHARGE_HISTORIES_COLLECTION = "hampo_charge_histories";
const HAMPO_USAGE_HISTORIES_COLLECTION = "hampo_usage_histories";
const HAMPO_UNIT_PRICE = 100;

export type TossPaymentOrder = {
  orderId: string;
  userId: string;
  amount: number;
  hampoAmount: number;
  status: "pending" | "completed";
  createdAt: string;
};

function requireDb() {
  const db = getFirebaseAdminDb();
  if (!db) throw new Error("Firebase Admin 설정이 필요합니다.");
  return db;
}

function requireTossSecretKey() {
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY?.trim();
  if (!secretKey)
    throw new Error("TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다.");
  return secretKey;
}

export function getTossClientKey() {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY?.trim();
  if (!clientKey) {
    throw new Error(
      "NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY가 설정되지 않았습니다.",
    );
  }
  return clientKey;
}

export function createTossCustomerKey(userId: string) {
  const secret =
    process.env.AUTH_SESSION_SECRET || "dev-only-auth-session-secret-change-me";
  const digest = createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");
  return `hams_${digest.slice(0, 40)}`;
}

export async function createTossPaymentOrder(
  userId: string,
  hampoAmount: number,
) {
  const db = requireDb();
  const orderId = `hampo_${randomUUID().replaceAll("-", "")}`;
  const order: TossPaymentOrder = {
    orderId,
    userId,
    hampoAmount,
    amount: hampoAmount * HAMPO_UNIT_PRICE,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await db.collection(PAYMENT_ORDERS_COLLECTION).doc(orderId).create(order);
  return order;
}

export async function getTossPaymentOrder(orderId: string) {
  const snapshot = await requireDb()
    .collection(PAYMENT_ORDERS_COLLECTION)
    .doc(orderId)
    .get();
  return snapshot.exists ? (snapshot.data() as TossPaymentOrder) : null;
}

async function requestToss(path: string, init?: RequestInit) {
  const authorization = Buffer.from(`${requireTossSecretKey()}:`).toString(
    "base64",
  );
  return fetch(`https://api.tosspayments.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export async function approveTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  let response = await requestToss("/payments/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });

  // 승인은 성공했지만 서버 저장만 실패한 경우 재시도할 수 있도록 결제 상태를 조회한다.
  if (!response.ok) {
    const lookup = await requestToss(
      `/payments/${encodeURIComponent(input.paymentKey)}`,
    );
    if (lookup.ok) response = lookup;
  }

  const result = (await response.json()) as {
    code?: string;
    message?: string;
    status?: string;
    orderId?: string;
    totalAmount?: number;
    method?: string;
    card?: {
      issuerCode?: string;
      acquirerCode?: string | null;
      number?: string;
      approveNo?: string;
    } | null;
  };

  if (
    !response.ok ||
    result.status !== "DONE" ||
    result.orderId !== input.orderId ||
    result.totalAmount !== input.amount
  ) {
    throw new Error(result.message || "토스페이먼츠 결제 승인에 실패했습니다.");
  }

  return result;
}

export async function completeTossHampoCharge(input: {
  userId: string;
  orderId: string;
  paymentKey: string;
  method: string;
  cardIssuerCode?: string;
  cardAcquirerCode?: string;
  cardNumber?: string;
  cardApproveNo?: string;
}) {
  const db = requireDb();
  const orderRef = db.collection(PAYMENT_ORDERS_COLLECTION).doc(input.orderId);
  const userRef = db.collection(USERS_COLLECTION).doc(input.userId);
  const historyRef = db
    .collection(HAMPO_CHARGE_HISTORIES_COLLECTION)
    .doc(input.orderId);

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, userSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(userRef),
    ]);

    if (!orderSnapshot.exists || !userSnapshot.exists) {
      throw new Error("결제 주문 또는 사용자 정보를 찾을 수 없습니다.");
    }

    const order = orderSnapshot.data() as TossPaymentOrder;
    const storedBalance = userSnapshot.data()?.hampoBalance;
    const currentBalance =
      typeof storedBalance === "number" && Number.isSafeInteger(storedBalance)
        ? Math.max(0, storedBalance)
        : 0;

    if (order.userId !== input.userId)
      throw new Error("결제 주문의 사용자가 다릅니다.");
    if (order.status === "completed") return currentBalance;

    const nextBalance = currentBalance + order.hampoAmount;
    if (!Number.isSafeInteger(nextBalance)) {
      throw new Error("보유 가능한 함포 한도를 초과했습니다.");
    }

    const completedAt = new Date().toISOString();
    transaction.update(userRef, {
      hampoBalance: nextBalance,
      updatedAt: completedAt,
    });
    transaction.update(orderRef, {
      status: "completed",
      paymentKey: input.paymentKey,
      paymentMethod: input.method,
      cardIssuerCode: input.cardIssuerCode || null,
      cardAcquirerCode: input.cardAcquirerCode || null,
      cardNumber: input.cardNumber || null,
      cardApproveNo: input.cardApproveNo || null,
      completedAt,
    });
    transaction.set(historyRef, {
      id: historyRef.id,
      userId: input.userId,
      email: String(userSnapshot.data()?.email ?? ""),
      type: "charge",
      status: "completed",
      amount: order.hampoAmount,
      previousBalance: currentBalance,
      balanceAfter: nextBalance,
      unitPrice: HAMPO_UNIT_PRICE,
      paymentAmount: order.amount,
      paymentStatus: "paid",
      paymentProvider: "toss_payments",
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      paymentMethod: input.method,
      cardIssuerCode: input.cardIssuerCode || null,
      cardAcquirerCode: input.cardAcquirerCode || null,
      cardNumber: input.cardNumber || null,
      cardApproveNo: input.cardApproveNo || null,
      source: "toss_card_payment",
      createdAt: completedAt,
    });

    return nextBalance;
  });
}

export async function refundTossHampoCharge(input: {
  historyId: string;
  cancelReason: string;
}) {
  const db = requireDb();
  const historyRef = db
    .collection(HAMPO_CHARGE_HISTORIES_COLLECTION)
    .doc(input.historyId);

  const reserved = await db.runTransaction(async (transaction) => {
    const historySnapshot = await transaction.get(historyRef);
    if (!historySnapshot.exists)
      throw new Error("충전 이력을 찾을 수 없습니다.");

    const history = historySnapshot.data()!;
    if (history.source !== "toss_card_payment" || !history.paymentKey) {
      throw new Error("토스페이먼츠 카드 결제 건만 환불할 수 있습니다.");
    }
    if (history.refundStatus === "refunded") {
      throw new Error("이미 환불된 충전 내역입니다.");
    }

    const userRef = db.collection(USERS_COLLECTION).doc(String(history.userId));
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists)
      throw new Error("사용자 정보를 찾을 수 없습니다.");

    const amount = Number(history.amount);
    const paymentAmount = Number(history.paymentAmount);
    const currentBalance = Number(userSnapshot.data()?.hampoBalance ?? 0);

    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      !Number.isSafeInteger(currentBalance)
    ) {
      throw new Error("환불할 함포 정보가 올바르지 않습니다.");
    }

    if (history.refundStatus !== "processing") {
      if (currentBalance < amount) {
        throw new Error(
          `현재 보유 함포(${currentBalance.toLocaleString("ko-KR")})가 환불 대상(${amount.toLocaleString("ko-KR")})보다 적습니다.`,
        );
      }
      const reservedAt = new Date().toISOString();
      transaction.update(userRef, {
        hampoBalance: currentBalance - amount,
        updatedAt: reservedAt,
      });
      transaction.update(historyRef, {
        refundStatus: "processing",
        refundReservedAt: reservedAt,
        refundBalanceBefore: currentBalance,
        refundBalanceAfter: currentBalance - amount,
      });
    }

    return {
      userRef,
      userId: String(history.userId),
      paymentKey: String(history.paymentKey),
      paymentAmount,
      hampoAmount: amount,
      email: String(history.email ?? ""),
    };
  });

  const idempotencyKey = `hampo-refund-${input.historyId}`;
  const response = await requestToss(
    `/payments/${encodeURIComponent(reserved.paymentKey)}/cancel`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        cancelReason: input.cancelReason.slice(0, 200),
        cancelAmount: reserved.paymentAmount,
      }),
    },
  );
  const result = (await response.json()) as {
    code?: string;
    message?: string;
    cancels?: Array<{
      cancelStatus?: string;
      transactionKey?: string;
      canceledAt?: string;
    }>;
  };

  if (!response.ok) {
    await db.runTransaction(async (transaction) => {
      const historySnapshot = await transaction.get(historyRef);
      if (
        !historySnapshot.exists ||
        historySnapshot.data()?.refundStatus !== "processing"
      )
        return;
      const userSnapshot = await transaction.get(reserved.userRef);
      if (!userSnapshot.exists) return;
      const balance = Number(userSnapshot.data()?.hampoBalance ?? 0);
      transaction.update(reserved.userRef, {
        hampoBalance: balance + reserved.hampoAmount,
        updatedAt: new Date().toISOString(),
      });
      transaction.update(historyRef, {
        refundStatus: "none",
        refundError: result.message || result.code || "결제 취소 실패",
      });
    });
    throw new Error(
      result.message || "토스페이먼츠 카드 결제 취소에 실패했습니다.",
    );
  }

  const cancel = result.cancels?.find((item) => item.cancelStatus === "DONE");
  const refundedAt = cancel?.canceledAt || new Date().toISOString();
  const usageHistoryRef = db
    .collection(HAMPO_USAGE_HISTORIES_COLLECTION)
    .doc(`charge_refund_${input.historyId}`);
  await db.runTransaction(async (transaction) => {
    const historySnapshot = await transaction.get(historyRef);
    if (!historySnapshot.exists)
      throw new Error("충전 이력을 찾을 수 없습니다.");
    if (historySnapshot.data()?.refundStatus === "refunded") return;

    const history = historySnapshot.data()!;
    const previousBalance = Number(history.refundBalanceBefore ?? 0);
    const balanceAfter = Number(history.refundBalanceAfter ?? 0);
    transaction.update(historyRef, {
      status: "refunded",
      paymentStatus: "refunded",
      refundStatus: "refunded",
      refundedAmount: reserved.hampoAmount,
      refundedPaymentAmount: reserved.paymentAmount,
      refundReason: input.cancelReason,
      refundTransactionKey: cancel?.transactionKey || null,
      refundedAt,
    });
    transaction.set(usageHistoryRef, {
      id: usageHistoryRef.id,
      originalTransactionId: input.historyId,
      userId: reserved.userId,
      email: reserved.email,
      serviceSiteId: "hams-oauth",
      clientId: "hams-oauth",
      serviceName: "함포 충전 환불",
      plan: "card_refund",
      amount: reserved.hampoAmount,
      refundableAmount: 0,
      previousBalance,
      balanceAfter,
      unitPrice: HAMPO_UNIT_PRICE,
      paymentAmount: reserved.paymentAmount,
      source: "toss_charge_refund",
      status: "completed",
      refundStatus: "full",
      refundRequestStatus: "none",
      refundRequestId: null,
      refundedAmount: 0,
      refundedPaymentAmount: 0,
      refundedAt: null,
      refundTransactionIds: cancel?.transactionKey
        ? [cancel.transactionKey]
        : [],
      relatedChargeHistoryId: input.historyId,
      createdAt: refundedAt,
      updatedAt: refundedAt,
    });
  });

  return {
    refundedAmount: reserved.hampoAmount,
    refundedPaymentAmount: reserved.paymentAmount,
    refundedAt,
  };
}
