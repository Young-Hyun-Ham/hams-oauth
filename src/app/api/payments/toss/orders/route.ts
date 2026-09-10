import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  createTossCustomerKey,
  createTossPaymentOrder,
  getTossClientKey,
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
    const body = (await request.json()) as { hampoAmount?: unknown };
    const hampoAmount = Number(body.hampoAmount);
    if (
      !Number.isSafeInteger(hampoAmount) ||
      hampoAmount < 1 ||
      hampoAmount > 1_000_000
    ) {
      return NextResponse.json(
        { message: "충전할 함포를 1~1,000,000 사이의 정수로 입력해 주세요." },
        { status: 400 },
      );
    }

    const order = await createTossPaymentOrder(session.userId, hampoAmount);
    return NextResponse.json({
      ...order,
      clientKey: getTossClientKey(),
      customerKey: createTossCustomerKey(session.userId),
      customerName: session.user.nickname,
      customerEmail: session.user.email,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "결제 주문 생성에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
