import { createTossConfirmPostHandler } from "@hams-fam/sso-client/payments/server";

import { verifySsoClientCredentials } from "@/lib/auth/sso";
import { findUserById } from "@/lib/store/user-store";
import {
  completeTossHampoCharge,
  getTossPaymentOrder,
  getTossSecretKey,
} from "@/lib/toss-payments/server";

export const runtime = "nodejs";

const post = createTossConfirmPostHandler({
  getUser: async (request) => {
    const clientId = request.headers.get("x-hams-client-id")?.trim() ?? "";
    const clientSecret = request.headers.get("x-hams-client-secret")?.trim() ?? "";
    const userId = request.headers.get("x-hams-user-id")?.trim() ?? "";
    if (!(await verifySsoClientCredentials(clientId, clientSecret))) return null;
    const user = userId ? await findUserById(userId) : null;
    return user ? { id: user.id, nickname: user.nickname, email: user.email } : null;
  },
  getOrder: getTossPaymentOrder,
  getSecretKey: getTossSecretKey,
  completePayment: ({ user, order, paymentKey, payment }) =>
    completeTossHampoCharge({
      userId: user.id,
      orderId: order.orderId,
      paymentKey,
      method: payment.method || "카드",
      cardIssuerCode: payment.card?.issuerCode,
      cardAcquirerCode: payment.card?.acquirerCode || undefined,
      cardNumber: payment.card?.number,
      cardApproveNo: payment.card?.approveNo,
    }),
});

export async function POST(request: Request) {
  return post(request);
}
