"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  requestServiceRefund,
  type ServiceRefundRequestState,
} from "@/app/actions/auth";
import type { ServiceMembership } from "@/lib/auth/types";

function RefundSubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !enabled}
      className="w-full cursor-pointer rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "환불 요청 중..." : "환불 요청하기"}
    </button>
  );
}

export function ServiceRefundRequestModal({
  membership,
  onClose,
  onRequested,
}: {
  membership: ServiceMembership;
  onClose: () => void;
  onRequested: (memberships: ServiceMembership[], message: string) => void;
}) {
  const [state, action] = useActionState<
    ServiceRefundRequestState | undefined,
    FormData
  >(requestServiceRefund, undefined);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (state?.ok && state.memberships) {
      onRequested(state.memberships, state.message ?? "환불 요청이 접수되었습니다.");
    }
  }, [onRequested, state]);

  const enabled = confirmation === "REFUND" && acknowledged;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-md rounded-[2rem] border border-rose-200 bg-background p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-600">
          REFUND REQUEST
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">
          {membership.serviceName} 환불 요청
        </h3>
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">
          <p className="font-semibold">현재 플랜: {membership.plan.toUpperCase()}</p>
          <p className="mt-1">
            요청 즉시 서비스 이용이 중지됩니다. 함포는 관리자가 환불을 완료한
            후 반환됩니다.
          </p>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <input
            type="hidden"
            name="serviceSiteId"
            value={membership.serviceSiteId}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              확인을 위해 REFUND를 입력하세요.
            </span>
            <input
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm leading-6 text-muted-foreground">
            <input
              name="acknowledged"
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1"
            />
            환불 완료 전까지 서비스를 이용할 수 없음을 확인했습니다.
          </label>

          {state?.message && !state.ok ? (
            <p className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <RefundSubmitButton enabled={enabled} />
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
