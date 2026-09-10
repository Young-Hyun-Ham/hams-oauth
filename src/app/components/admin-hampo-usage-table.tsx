"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeAdminHampoRefund,
  type CompleteAdminHampoRefundState,
} from "@/app/actions/admin";

type UsageHistory = {
  id: string;
  email: string;
  serviceName: string;
  clientId: string;
  plan: string;
  amount: number;
  paymentAmount: number;
  previousBalance: number;
  balanceAfter: number;
  refundStatus: "none" | "partial" | "full";
  refundRequestStatus: "none" | "pending";
  refundRequestId: string | null;
  refundedAmount: number;
  source: string;
  createdAt: string;
};

export type RefundPreview = {
  originalAmount: number;
  usedAmount: number;
  refundAmount: number;
  usedDays: number;
  daysInMonth: number;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("ko-KR");
}

function RefundModal({
  history,
  preview,
  onClose,
}: {
  history: UsageHistory;
  preview: RefundPreview;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CompleteAdminHampoRefundState | undefined,
    FormData
  >(completeAdminHampoRefund, undefined);

  useEffect(() => {
    if (!state?.ok) return;

    onClose();
    router.refresh();
  }, [onClose, router, state?.ok]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-refund-title"
        className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Refund request
            </p>
            <h3
              id="admin-refund-title"
              className="mt-2 text-2xl font-semibold text-slate-950"
            >
              {history.serviceName || history.clientId} 환불 처리
            </h3>
            <p className="mt-1 break-all text-sm text-slate-600">
              {history.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="환불 모달 닫기"
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          결제일부터 환불 완료일까지를 사용일로 계산하며, 결제 당일 환불도 1일
          사용으로 처리합니다. 해당 결제월의 일수로 일할 계산한 뒤 소수점 이하
          함포는 버립니다.
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs text-slate-500">환불 대상</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {preview.originalAmount.toLocaleString("ko-KR")}함포
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs text-slate-500">사용일</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {preview.usedDays}일 / {preview.daysInMonth}일
            </dd>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4">
            <dt className="text-xs text-rose-600">사용분 차감</dt>
            <dd className="mt-1 font-semibold text-rose-700">
              -{preview.usedAmount.toLocaleString("ko-KR")}함포
            </dd>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <dt className="text-xs text-emerald-600">예상 환불</dt>
            <dd className="mt-1 text-lg font-bold text-emerald-700">
              +{preview.refundAmount.toLocaleString("ko-KR")}함포
            </dd>
          </div>
        </dl>

        {state?.message ? (
          <p
            className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${
              state.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        {state?.ok ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full cursor-pointer rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            닫기
          </button>
        ) : (
          <form action={formAction} className="mt-6 space-y-4">
            <input
              type="hidden"
              name="refundRequestId"
              value={history.refundRequestId ?? ""}
            />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                관리자 메모 (선택)
              </span>
              <textarea
                name="adminMemo"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="refundConfirmed"
                required
                className="mt-0.5 h-4 w-4 cursor-pointer"
              />
              <span>
                환불 함포가 회원 잔액에 즉시 반영되고 해당 서비스 가입정보가
                삭제되는 것을 확인했습니다.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="cursor-pointer rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "환불 처리 중..." : "환불 완료"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export function AdminHampoUsageTable({
  histories,
  refundPreviews,
}: {
  histories: UsageHistory[];
  refundPreviews: Record<string, RefundPreview>;
}) {
  const [selectedHistory, setSelectedHistory] = useState<UsageHistory | null>(
    null,
  );
  const selectedRefundPreview = selectedHistory?.refundRequestId
    ? refundPreviews[selectedHistory.refundRequestId]
    : undefined;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">사용일시</th>
              <th className="px-4 py-3">회원 이메일</th>
              <th className="px-4 py-3">서비스 / 플랜</th>
              <th className="px-4 py-3 text-right">사용 함포</th>
              <th className="px-4 py-3 text-right">결제금액</th>
              <th className="px-4 py-3 text-right">사용 전</th>
              <th className="px-4 py-3 text-right">사용 후</th>
              <th className="px-4 py-3">환불 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {histories.map((history) => {
              const isChargeRefund = history.source === "toss_charge_refund";
              const isManualReclaim =
                history.source === "manual_charge_reclaim";
              const isChargeBalanceReduction =
                isChargeRefund || isManualReclaim;
              const canRefund =
                !isChargeBalanceReduction &&
                history.refundRequestStatus === "pending" &&
                Boolean(history.refundRequestId);
              return (
                <tr
                  key={history.id}
                  tabIndex={canRefund ? 0 : undefined}
                  role={canRefund ? "button" : undefined}
                  onClick={() => {
                    if (canRefund) setSelectedHistory(history);
                  }}
                  onKeyDown={(event) => {
                    if (
                      canRefund &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      setSelectedHistory(history);
                    }
                  }}
                  className={`bg-white ${
                    canRefund
                      ? "cursor-pointer transition hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none"
                      : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(history.createdAt)}
                  </td>
                  <td className="max-w-56 break-all px-4 py-3 font-medium text-slate-900">
                    {history.email || "-"}
                  </td>
                  <td className="min-w-44 px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {history.serviceName || history.clientId || "-"}
                    </p>
                    <p className="mt-1 text-xs uppercase text-slate-500">
                      {history.plan || "-"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-rose-600">
                    -{history.amount.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {history.paymentAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {history.previousBalance.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {history.balanceAfter.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isChargeBalanceReduction
                          ? "bg-rose-50 text-rose-700"
                          : history.refundRequestStatus === "pending"
                            ? "bg-blue-50 text-blue-700"
                            : history.refundStatus === "full"
                              ? "bg-slate-200 text-slate-700"
                              : history.refundStatus === "partial"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isChargeBalanceReduction
                        ? isManualReclaim
                          ? "수동 충전 회수"
                          : "충전 결제 환불"
                        : history.refundRequestStatus === "pending"
                          ? "환불 요청중"
                          : history.refundStatus === "full"
                            ? `환불 완료 ${history.refundedAmount.toLocaleString("ko-KR")}함포`
                            : history.refundStatus === "partial"
                              ? `부분 환불 ${history.refundedAmount.toLocaleString("ko-KR")}함포`
                              : "환불 가능"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedHistory?.refundRequestId && selectedRefundPreview ? (
        <RefundModal
          key={selectedHistory.refundRequestId}
          history={selectedHistory}
          preview={selectedRefundPreview}
          onClose={() => setSelectedHistory(null)}
        />
      ) : null}
    </>
  );
}
