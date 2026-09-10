"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  reclaimManualCharge,
  refundHampoCharge,
  type RefundHampoChargeState,
} from "@/app/actions/admin";
import type { HampoChargeHistory } from "@/lib/store/hampo-history-store";

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("ko-KR");
}

function ManualReclaimModal({
  history,
  onClose,
}: {
  history: HampoChargeHistory;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    RefundHampoChargeState | undefined,
    FormData
  >(reclaimManualCharge, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state?.ok]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-reclaim-title"
        className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl md:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          MANUAL RECLAIM
        </p>
        <h3
          id="manual-reclaim-title"
          className="mt-2 text-2xl font-semibold text-slate-950"
        >
          수동 충전 함포를 회수할까요?
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          카드 취소 없이 현재 보유 잔액에서{" "}
          {history.amount.toLocaleString("ko-KR")}
          함포를 회수하고 사용이력을 생성합니다.
        </p>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
          현재 보유{" "}
          <strong>{history.currentBalance.toLocaleString("ko-KR")}함포</strong>
          <span className="mx-2 text-slate-400">→</span>
          회수 후{" "}
          <strong>
            {(history.currentBalance - history.amount).toLocaleString("ko-KR")}
            함포
          </strong>
        </div>

        {state?.message ? (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
          >
            {state.message}
          </p>
        ) : null}

        {state?.ok ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            닫기
          </button>
        ) : (
          <form action={action} className="mt-6 space-y-4">
            <input type="hidden" name="historyId" value={history.id} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                회수 사유
              </span>
              <input
                name="reclaimReason"
                maxLength={200}
                defaultValue="수동 충전 함포 회수"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="reclaimConfirmed"
                required
                className="mt-0.5 h-4 w-4"
              />
              <span>
                현재 잔액에서 수동 충전된 함포를 회수하는 것에 동의합니다.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {pending ? "회수 처리 중..." : "수동 충전 회수"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function RefundModal({
  history,
  onClose,
}: {
  history: HampoChargeHistory;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    RefundHampoChargeState | undefined,
    FormData
  >(refundHampoCharge, undefined);

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
  }, [router, state?.ok]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-refund-title"
        className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl md:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          TOSS REFUND
        </p>
        <h3
          id="charge-refund-title"
          className="mt-2 text-2xl font-semibold text-slate-950"
        >
          함포 충전 결제를 환불할까요?
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          토스페이먼츠를 통해 카드 결제{" "}
          {history.paymentAmount.toLocaleString("ko-KR")}원을 취소하고, 보유
          함포에서 {history.amount.toLocaleString("ko-KR")}함포를 회수합니다.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-slate-500">결제 카드</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {history.cardCompany}
              <br />
              <span className="text-xs font-normal text-slate-500">
                {history.cardNumber || "카드번호 정보 없음"}
              </span>
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-slate-500">현재 보유</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {history.currentBalance.toLocaleString("ko-KR")}함포
            </dd>
          </div>
        </dl>

        {state?.message ? (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
          >
            {state.message}
          </p>
        ) : null}

        {state?.ok ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            닫기
          </button>
        ) : (
          <form action={action} className="mt-6 space-y-4">
            <input type="hidden" name="historyId" value={history.id} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                환불 사유
              </span>
              <input
                name="cancelReason"
                maxLength={200}
                defaultValue="함포 충전 결제 환불"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                name="refundConfirmed"
                required
                className="mt-0.5 h-4 w-4"
              />
              <span>
                카드 결제를 취소하고 충전된 함포를 현재 잔액에서 회수하는 것에
                동의합니다.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {pending ? "환불 처리 중..." : "환불"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export function AdminHampoChargeTable({
  histories,
}: {
  histories: HampoChargeHistory[];
}) {
  const [selected, setSelected] = useState<HampoChargeHistory | null>(null);
  const [refundTarget, setRefundTarget] = useState<HampoChargeHistory | null>(
    null,
  );
  const [reclaimTarget, setReclaimTarget] = useState<HampoChargeHistory | null>(
    null,
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">처리일시</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3 text-right">충전 함포</th>
              <th className="px-4 py-3 text-right">결제금액</th>
              <th className="px-4 py-3">결제 카드</th>
              <th className="px-4 py-3 text-right">충전 전</th>
              <th className="px-4 py-3 text-right">충전 후</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {histories.map((history) => {
              const isSelected = selected?.id === history.id;
              const isCardPayment =
                Boolean(history.paymentKey) ||
                history.paymentStatus === "paid" ||
                history.source === "toss_card_payment";
              const isRefunded =
                history.refundStatus === "refunded" ||
                history.status === "refunded";
              const isRefundProcessing = history.refundStatus === "processing";
              const isManualCharge =
                history.source === "admin_manual_charge" ||
                history.source === "temporary_manual_charge";
              const isReclaimed =
                history.status === "reclaimed" ||
                history.reclaimStatus === "completed";
              const canRefund =
                isCardPayment &&
                !isRefunded &&
                (isRefundProcessing ||
                  history.currentBalance >= history.amount);
              const unavailableReason = !isCardPayment
                ? "카드 결제 건이 아닙니다."
                : isRefunded
                  ? "이미 환불된 내역입니다."
                  : "현재 보유 함포가 부족합니다.";
              return (
                <tr
                  key={history.id}
                  tabIndex={0}
                  onClick={() => setSelected(history)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(history);
                    }
                  }}
                  className={`${isSelected ? "cursor-default bg-blue-50/70" : "cursor-pointer bg-white hover:bg-slate-50"} relative transition focus:outline-none`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(history.createdAt)}
                    {isSelected ? (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-end gap-2 border-y border-primary/30 bg-white/55 px-4 shadow-sm"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={
                            isManualCharge
                              ? isReclaimed ||
                                history.currentBalance < history.amount
                              : !canRefund
                          }
                          title={
                            isManualCharge
                              ? history.currentBalance < history.amount
                                ? "현재 보유 함포가 부족합니다."
                                : ""
                              : canRefund
                                ? ""
                                : unavailableReason
                          }
                          onClick={() =>
                            isManualCharge
                              ? setReclaimTarget(history)
                              : setRefundTarget(history)
                          }
                          className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                        >
                          {isManualCharge ? "수동 충전 회수" : "환불"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                        >
                          닫기
                        </button>
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-56 break-all px-4 py-3 font-medium text-slate-900">
                    {history.email || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-primary">
                    +{history.amount.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {history.paymentAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-900">
                      {history.cardCompany}
                    </span>
                    {history.cardNumber ? (
                      <span className="block text-xs text-slate-500">
                        {history.cardNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {history.previousBalance.toLocaleString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {history.balanceAfter.toLocaleString("ko-KR")}
                  </td>
                  <td className="min-w-36 px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isRefunded ? "bg-slate-200 text-slate-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {isReclaimed
                        ? "회수 완료"
                        : isRefunded
                          ? "환불 완료"
                          : isRefundProcessing
                            ? "환불 처리 중"
                            : history.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {refundTarget ? (
        <RefundModal
          history={refundTarget}
          onClose={() => {
            setRefundTarget(null);
            setSelected(null);
          }}
        />
      ) : null}
      {reclaimTarget ? (
        <ManualReclaimModal
          history={reclaimTarget}
          onClose={() => {
            setReclaimTarget(null);
            setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}
