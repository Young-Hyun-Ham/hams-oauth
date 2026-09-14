import { createTossOrderPostHandler } from "@hams-fam/sso-client/payments/server";
import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  createTossCustomerKey,
  createTossPaymentOrder,
  getTossClientKey,
} from "@/lib/toss-payments/server";

const post = createTossOrderPostHandler({
  getUser: async () => {
    const session = await getSession();
    return session?.userId
      ? {
          id: session.userId,
          nickname: session.user.nickname,
          email: session.user.email,
        }
      : null;
  },
  createOrder: (user, hampoAmount) =>
    createTossPaymentOrder(user.id, hampoAmount),
  getClientKey: getTossClientKey,
  createCustomerKey: (user) => createTossCustomerKey(user.id),
});

export async function POST(request: NextRequest) {
  return post(request);
}
