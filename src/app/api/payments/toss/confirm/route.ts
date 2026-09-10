import { NextRequest, NextResponse } from "next/server";

import { createSession, getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/store/user-store";
import { toSessionUser } from "@/lib/auth/types";
import {
  approveTossPayment,
  completeTossHampoCharge,
  getTossPaymentOrder,
} from "@/lib/toss-payments/server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const paymentKey =
      typeof body.paymentKey === "string" ? body.paymentKey : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const amount = Number(body.amount);
    const order = await getTossPaymentOrder(orderId);

    if (
      !paymentKey ||
      !order ||
      order.userId !== session.userId ||
      order.amount !== amount
    ) {
      return NextResponse.json(
        { message: "결제 주문 정보가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (order.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const payment = await approveTossPayment({ paymentKey, orderId, amount });
    const balance = await completeTossHampoCharge({
      userId: session.userId,
      orderId,
      paymentKey,
      method: payment.method || "카드",
      cardIssuerCode: payment.card?.issuerCode,
      cardAcquirerCode: payment.card?.acquirerCode || undefined,
      cardNumber: payment.card?.number,
      cardApproveNo: payment.card?.approveNo,
    });
    const updatedUser = await findUserById(session.userId);
    if (updatedUser) await createSession(toSessionUser(updatedUser));

    return NextResponse.json({ ok: true, balance });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
