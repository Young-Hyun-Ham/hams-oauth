"use client";

import { X } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { unlockAdmin } from "@/app/actions/admin";

function SubmitButton({ redirects }: { redirects: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
    >
      {pending ? "확인 중..." : redirects ? "관리 페이지 열기" : "확인"}
    </button>
  );
}

export function AdminUnlockModal({
  returnPath,
  onClose,
  onResult,
}: {
  returnPath?: string;
  onClose: () => void;
  onResult?: (success: boolean) => void;
}) {
  const [state, action] = useActionState(unlockAdmin, undefined);

  useEffect(() => {
    if (typeof state?.success === "boolean") onResult?.(state.success);
  }, [state, onResult]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] text-primary">
              ADMIN
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">
              관리자 암호 입력
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              관리자 권한을 확인하기 위해 암호를 입력해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border p-2 text-muted-foreground hover:bg-muted"
            aria-label="관리자 인증 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form action={action} className="mt-6 space-y-4">
          {returnPath ? (
            <input type="hidden" name="returnPath" value={returnPath} />
          ) : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              관리자 암호
            </span>
            <input
              name="adminPassword"
              type="password"
              required
              minLength={4}
              autoFocus
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="관리자 암호 입력"
            />
          </label>
          {state?.message ? (
            <p className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton redirects={Boolean(returnPath)} />
            <button
              type="button"
              onClick={() => {
                onResult?.(false);
                onClose();
              }}
              className="w-full rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
