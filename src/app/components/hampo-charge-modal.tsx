"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { chargeHampo, type HampoChargeActionState } from "@/app/actions/auth";
import { isAcceptIncluded } from "@/lib/auth/accept-include";
import { useAuthStore } from "@/lib/store/auth-store";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "충전 중..." : "함포 충전하기"}
    </button>
  );
}

function Message({ state }: { state: HampoChargeActionState | undefined }) {
  if (!state?.message) {
    return null;
  }

  return (
    <p
      className={`text-sm font-medium ${state.ok ? "text-primary" : "text-destructive"}`}
    >
      {state.message}
    </p>
  );
}

export function HampoChargeModal({
  onClose,
  onCharged,
  initialAmount = 0,
}: {
  onClose: () => void;
  onCharged?: (balance: number) => void;
  initialAmount?: number;
}) {
  const viewer = useAuthStore((store) => store.viewer);
  const setHampoBalance = useAuthStore((store) => store.setHampoBalance);
  const [amount, setAmount] = useState(String(initialAmount));
  const [state, action] = useActionState(chargeHampo, undefined);
  const canCharge = isAcceptIncluded(viewer?.email);

  useEffect(() => {
    if (state?.ok && typeof state.balance === "number") {
      setHampoBalance(state.balance);
      onCharged?.(state.balance);
    }
  }, [onCharged, state, setHampoBalance]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            HAMPO CHARGE
          </p>
          <h3 className="text-2xl font-semibold text-foreground">함포 충전</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            함포는 서비스사이트의 정찰제 요금을 결제할 때 사용합니다.
            <br />
            <strong className="ml-1 text-foreground">1함포는 100원</strong>
            입니다.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
          <div>
            <p className="text-muted-foreground">현재 보유</p>
            <p className="mt-1 font-semibold text-foreground">
              {(viewer?.hampoBalance ?? 0).toLocaleString("ko-KR")} 함포
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">충전 금액</p>
            <p className="mt-1 font-semibold text-foreground">
              {(Number(amount || 0) * 100).toLocaleString("ko-KR")}원
            </p>
          </div>
        </div>

        {canCharge ? (
          <form action={action} className="mt-5 space-y-4">
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
                  onClick={() => {
                    const currentAmount = Number(amount);
                    const safeCurrentAmount =
                      Number.isSafeInteger(currentAmount) && currentAmount > 0
                        ? currentAmount
                        : 0;
                    setAmount(
                      String(Math.min(1_000_000, safeCurrentAmount + preset)),
                    );
                  }}
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

            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              결제 기능 연동 전 임시 충전입니다. 현재는 결제 없이 입력한 함포가
              계정에 바로 저장됩니다.
            </p>

            <Message state={state} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <SubmitButton />
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
              >
                닫기
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">카드 결제 연동 준비 중입니다.</p>
              <p className="mt-1 text-sm leading-6">
                현재 계정에서는 함포를 충전할 수 없습니다. 결제 서비스가
                준비되면 이용할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
