"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function PaymentConfirmation({
  paymentKey,
  orderId,
  amount,
}: {
  paymentKey: string;
  orderId: string;
  amount: string;
}) {
  const requested = useRef(false);
  const [result, setResult] = useState<{
    status: "loading" | "success" | "error";
    message: string;
  }>({ status: "loading", message: "토스페이먼츠 결제를 승인하고 있습니다." });

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void fetch("/api/payments/toss/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { message?: string };
        if (!response.ok)
          throw new Error(body.message || "결제 승인에 실패했습니다.");
        setResult({
          status: "success",
          message: "카드 결제가 완료되어 함포가 충전되었습니다.",
        });
      })
      .catch((error: unknown) => {
        setResult({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "결제 승인에 실패했습니다.",
        });
      });
  }, [amount, orderId, paymentKey]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-primary">
          TOSS PAYMENTS
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          {result.status === "loading"
            ? "결제 확인 중"
            : result.status === "success"
              ? "결제 완료"
              : "결제 확인 실패"}
        </h1>
        <p
          className={`mt-4 text-sm leading-6 ${result.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {result.message}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          주문번호: {orderId}
        </p>
        {result.status !== "loading" ? (
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            로그인 화면으로 돌아가기
          </Link>
        ) : null}
      </section>
    </main>
  );
}
