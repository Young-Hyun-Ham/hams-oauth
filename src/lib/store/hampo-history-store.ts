import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";

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
  createdAt: string;
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function listHampoChargeHistories(email?: string) {
  const db = getFirebaseAdminDb();
  if (!db) return [];

  const snapshot = await db.collection(COLLECTION).get();
  const rawHistories = snapshot.docs
    .map((doc) => {
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
        createdAt: String(data.createdAt ?? ""),
      } satisfies HampoChargeHistory;
    });

  const legacyUserIds = Array.from(
    new Set(rawHistories.filter((history) => !history.email).map((history) => history.userId)),
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

  return rawHistories
    .map((history) => ({
      ...history,
      email: history.email || legacyEmails.get(history.userId) || "",
    }))
    .filter((history) => !normalizedEmail || history.email.trim().toLowerCase() === normalizedEmail)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
