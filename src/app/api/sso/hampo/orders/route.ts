import { createTossOrderPostHandler } from "@hams-fam/sso-client/payments/server";

import { verifySsoClientCredentials } from "@/lib/auth/sso";
import { findUserById } from "@/lib/store/user-store";
import {
  createTossCustomerKey,
  createTossPaymentOrder,
  getTossClientKey,
} from "@/lib/toss-payments/server";

export const runtime = "nodejs";

const post = createTossOrderPostHandler({
  getUser: async (request) => {
    const clientId = request.headers.get("x-hams-client-id")?.trim() ?? "";
    const clientSecret = request.headers.get("x-hams-client-secret")?.trim() ?? "";
    const userId = request.headers.get("x-hams-user-id")?.trim() ?? "";
    if (!(await verifySsoClientCredentials(clientId, clientSecret))) return null;
    const user = userId ? await findUserById(userId) : null;
    return user ? { id: user.id, nickname: user.nickname, email: user.email } : null;
  },
  createOrder: (user, hampoAmount) => createTossPaymentOrder(user.id, hampoAmount),
  getClientKey: getTossClientKey,
  createCustomerKey: (user) => createTossCustomerKey(user.id),
});

export async function POST(request: Request) {
  return post(request);
}
