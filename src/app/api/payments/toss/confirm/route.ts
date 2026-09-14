import { createTossConfirmPostHandler } from "@hams-fam/sso-client/payments/server";
import { NextRequest } from "next/server";

import { createSession, getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/store/user-store";
import { toSessionUser } from "@/lib/auth/types";
import {
  completeTossHampoCharge,
  getTossSecretKey,
  getTossPaymentOrder,
} from "@/lib/toss-payments/server";

const post = createTossConfirmPostHandler({
  getUser: async () => {
    const session = await getSession();
    return session?.userId ? { id: session.userId } : null;
  },
  getOrder: getTossPaymentOrder,
  getSecretKey: getTossSecretKey,
  completePayment: async ({ user, order, paymentKey, payment }) => {
    const balance = await completeTossHampoCharge({
      userId: user.id,
      orderId: order.orderId,
      paymentKey,
      method: payment.method || "카드",
      cardIssuerCode: payment.card?.issuerCode,
      cardAcquirerCode: payment.card?.acquirerCode || undefined,
      cardNumber: payment.card?.number,
      cardApproveNo: payment.card?.approveNo,
    });
    return balance;
  },
  afterComplete: async (user) => {
    const updatedUser = await findUserById(user.id);
    if (updatedUser) await createSession(toSessionUser(updatedUser));
  },
});

export async function POST(request: NextRequest) {
  return post(request);
}
