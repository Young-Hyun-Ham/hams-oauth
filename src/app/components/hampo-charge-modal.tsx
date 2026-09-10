"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { chargeHampo } from "@/app/actions/auth";
import { chargeAdminUserHampoFromModal } from "@/app/actions/admin";
import { CardPaymentModal } from "@/app/components/toss-payments";
import { isAcceptIncluded } from "@/lib/auth/accept-include";
import { useAuthStore } from "@/lib/store/auth-store";

function SubmitButton({ isAdminCharge }: { isAdminCharge: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl border border-primary px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-60"
    >
      {pending
        ? "충전 중..."
        : isAdminCharge
          ? "선택 회원에게 함포 충전"
          : "결제 없이 임시 충전"}
    </button>
  );
}

export function HampoChargeModal({
  onClose,
  onCharged,
  initialAmount = 100,
  targetUser,
}: {
  onClose: () => void;
  onCharged?: (balance: number) => void;
  initialAmount?: number;
  targetUser?: {
    id: string;
    nickname: string;
    email: string;
    hampoBalance: number;
  };
}) {
  const viewer = useAuthStore((store) => store.viewer);
  const setHampoBalance = useAuthStore((store) => store.setHampoBalance);
  const [amount, setAmount] = useState(String(initialAmount));
  const [selfState, selfAction] = useActionState(chargeHampo, undefined);
  const [adminState, adminAction] = useActionState(
    chargeAdminUserHampoFromModal,
    undefined,
  );
  const isAdminCharge = Boolean(targetUser);
  const state = isAdminCharge ? adminState : selfState;
  const action = isAdminCharge ? adminAction : selfAction;
  const [targetBalance, setTargetBalance] = useState(
    targetUser?.hampoBalance ?? 0,
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const canChargeWithoutPayment =
    isAdminCharge || isAcceptIncluded(viewer?.email);
  const displayedBalance = isAdminCharge
    ? targetBalance
    : (viewer?.hampoBalance ?? 0);
  const hampoAmount = Number(amount);
  const isValidAmount =
    Number.isSafeInteger(hampoAmount) &&
    hampoAmount >= 1 &&
    hampoAmount <= 1_000_000;
  const paymentAmount = isValidAmount ? hampoAmount * 100 : 0;

  useEffect(() => {
    if (state?.ok && typeof state.balance === "number") {
      if (isAdminCharge) {
        setTargetBalance(state.balance);
      } else {
        setHampoBalance(state.balance);
      }
      onCharged?.(state.balance);
    }
  }, [isAdminCharge, onCharged, state, setHampoBalance]);

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!isMounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hampo-charge-title"
      >
        <div className="max-h-full w-full max-w-md overflow-y-auto rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            HAMPO CHARGE
          </p>
          <h3
            id="hampo-charge-title"
            className="mt-2 text-2xl font-semibold text-foreground"
          >
            함포 충전
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            함포는 유료 서비스 이용 요금 결제에 사용합니다.{" "}
            <strong className="text-foreground">1함포는 100원</strong>입니다.
          </p>
          {targetUser ? (
            <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm text-foreground">
              충전 대상: <strong>{targetUser.nickname}</strong> ·{" "}
              {targetUser.email}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
            <div>
              <p className="text-muted-foreground">현재 보유</p>
              <p className="mt-1 font-semibold text-foreground">
                {displayedBalance.toLocaleString("ko-KR")} 함포
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">충전 금액</p>
              <p className="mt-1 font-semibold text-foreground">
                {paymentAmount.toLocaleString("ko-KR")}원
              </p>
            </div>
          </div>

          <form action={action} className="mt-5 space-y-4">
            {targetUser ? (
              <input type="hidden" name="id" value={targetUser.id} />
            ) : null}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                충전할 함포
              </span>
              <input
                name="amount"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={1000000}
                step={1}
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[100, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setAmount(
                      String(
                        Math.min(
                          1_000_000,
                          (isValidAmount ? hampoAmount : 0) + preset,
                        ),
                      ),
                    )
                  }
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/50"
                >
                  +{preset.toLocaleString("ko-KR")}함포
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount("0")}
                className="rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/5"
              >
                초기화
              </button>
            </div>

            {canChargeWithoutPayment ? (
              <SubmitButton isAdminCharge={isAdminCharge} />
            ) : null}
            {state?.message ? (
              <p
                className={`text-sm font-medium ${state.ok ? "text-primary" : "text-destructive"}`}
              >
                {state.message}
              </p>
            ) : null}

            {!isAdminCharge ? (
              <button
                type="button"
                disabled={!isValidAmount}
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                카드결제 테스트
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
            >
              닫기
            </button>
          </form>
        </div>
      </div>

      {isPaymentModalOpen && !isAdminCharge ? (
        <CardPaymentModal
          amount={paymentAmount}
          orderName={`함포 ${hampoAmount.toLocaleString("ko-KR")}개 충전`}
          createOrderEndpoint="/api/payments/toss/orders"
          createOrderBody={{ hampoAmount }}
          successPath="/payments/toss/success"
          failPath="/payments/toss/fail"
          onClose={() => setIsPaymentModalOpen(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}
