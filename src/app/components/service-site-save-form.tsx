"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

import {
  saveServiceSite,
  type SaveServiceSiteState,
} from "@/app/actions/admin";

function SaveButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "저장 중..." : label}
    </button>
  );
}

export function ServiceSiteSaveForm({
  children,
  className,
  submitLabel,
  submitClassName,
  actions,
}: {
  children: React.ReactNode;
  className: string;
  submitLabel: string;
  submitClassName: string;
  actions?: React.ReactNode;
}) {
  const [state, action] = useActionState<
    SaveServiceSiteState | undefined,
    FormData
  >(saveServiceSite, undefined);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  useEffect(() => {
    if (state?.message) setIsAlertOpen(true);
  }, [state]);

  return (
    <>
      <form action={action} className={className}>
        {children}
        {actions ? (
          <div className="flex items-center justify-between gap-3">
            <SaveButton label={submitLabel} className={submitClassName} />
            {actions}
          </div>
        ) : (
          <SaveButton label={submitLabel} className={submitClassName} />
        )}
      </form>

      {isAlertOpen && state?.message && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4">
              <div
                role="alertdialog"
                aria-modal="true"
                className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
              >
                <h3
                  className={`text-lg font-semibold ${state?.ok ? "text-emerald-800" : "text-rose-800"}`}
                >
                  {state?.ok ? "저장 완료" : "저장 실패"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {state?.message}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAlertOpen(false)}
                  className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
