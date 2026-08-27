"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

import {
  removeServiceSite,
  type RemoveServiceSiteState,
} from "@/app/actions/admin";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "삭제 중..." : "영구 삭제"}
    </button>
  );
}

export function ServiceSiteDeleteButton({
  site,
}: {
  site: { id: string; name: string; clientId: string; isVisible: boolean };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisibilityAlertOpen, setIsVisibilityAlertOpen] = useState(false);
  const [state, action] = useActionState<
    RemoveServiceSiteState | undefined,
    FormData
  >(removeServiceSite, undefined);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (site.isVisible) {
            setIsVisibilityAlertOpen(true);
            return;
          }
          setIsOpen(true);
        }}
        className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
      >
        서비스사이트 삭제
      </button>

      {isVisibilityAlertOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
              <div
                role="alertdialog"
                aria-modal="true"
                className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
              >
                <h3 className="text-xl font-semibold text-amber-900">
                  삭제할 수 없는 서비스사이트
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  현재 서비스사이트가 노출 중입니다. 노출 여부를 OFF로 변경하고
                  수정 저장을 완료한 후 다시 삭제해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => setIsVisibilityAlertOpen(false)}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
              <div
                role="alertdialog"
                aria-modal="true"
                className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  서비스사이트 삭제 확인
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  삭제하면 SSO 연동 설정을 복구할 수 없습니다. 먼저 사이트를
                  비노출 상태로 저장하고 아래 정보를 정확히 입력해 주세요.
                </p>
                <form action={action} className="mt-5 space-y-4">
                  <input type="hidden" name="id" value={site.id} />
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">
                      사이트 이름 확인
                    </span>
                    <input
                      name="confirmSiteName"
                      autoComplete="off"
                      placeholder={site.name}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">
                      Client ID 확인
                    </span>
                    <input
                      name="confirmClientId"
                      autoComplete="off"
                      placeholder={site.clientId}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">
                      최종 확인 문구
                    </span>
                    <input
                      name="deleteConfirmation"
                      autoComplete="off"
                      placeholder="DELETE"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                    <input
                      name="deleteAcknowledged"
                      type="checkbox"
                      className="mt-1"
                    />
                    삭제 결과와 SSO 연동 중단 위험을 이해했습니다.
                  </label>

                  {state?.message && !state.ok ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                    >
                      {state.message}
                    </div>
                  ) : null}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <DeleteSubmitButton />
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
