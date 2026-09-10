"use client";

import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { useState } from "react";

type PaymentOrderResponse = {
  orderId: string;
  amount: number;
  clientKey: string;
  customerKey: string;
  customerName?: string;
  customerEmail?: string;
  message?: string;
};

export type CardPaymentModalProps = {
  amount: number;
  orderName: string;
  onClose: () => void;
  createOrderEndpoint: string;
  createOrderBody?: Record<string, unknown>;
  successPath: string;
  failPath: string;
  title?: string;
  description?: string;
};

export function CardPaymentModal({
  amount,
  orderName,
  onClose,
  createOrderEndpoint,
  createOrderBody,
  successPath,
  failPath,
  title = "카드 결제 테스트",
  description = "토스페이먼츠 테스트 결제창에서 카드 결제를 진행합니다.",
}: CardPaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function requestPayment() {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch(createOrderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createOrderBody ?? {}),
      });
      const order = (await response.json()) as PaymentOrderResponse;
      if (!response.ok)
        throw new Error(order.message || "결제 주문 생성에 실패했습니다.");

      const tossPayments = await loadTossPayments(order.clientKey);
      const payment = tossPayments.payment({ customerKey: order.customerKey });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        orderId: order.orderId,
        orderName,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        successUrl: `${window.location.origin}${successPath}`,
        failUrl: `${window.location.origin}${failPath}`,
        card: {
          flowMode: "DEFAULT",
          useEscrow: false,
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "결제창을 열지 못했습니다.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-payment-modal-title"
    >
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          TOSS PAYMENTS
        </p>
        <h3
          id="card-payment-modal-title"
          className="mt-2 text-2xl font-semibold text-foreground"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 rounded-2xl bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">상품명</span>
            <strong className="text-right text-foreground">{orderName}</strong>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/60 pt-3">
            <span className="text-sm text-muted-foreground">결제 금액</span>
            <strong className="text-xl text-primary">
              {amount.toLocaleString("ko-KR")}원
            </strong>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          테스트 키를 사용하면 실제 카드 대금은 청구되지 않습니다. 운영 전에는
          라이브 키와 결제 정책을 별도로 점검해 주세요.
        </p>
        {message ? (
          <p className="mt-3 text-sm font-medium text-destructive">{message}</p>
        ) : null}
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={requestPayment}
            disabled={isLoading}
            className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? "결제창 여는 중..."
              : `${amount.toLocaleString("ko-KR")}원 카드 결제`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:opacity-60"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
