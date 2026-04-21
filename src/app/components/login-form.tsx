"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { login, type AuthActionState } from "@/app/actions/auth";
import { unlockAdmin, type AdminUnlockState } from "@/app/actions/admin";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "처리 중..." : "로그인"}
    </button>
  );
}

function Message({ state }: { state: AuthActionState | undefined }) {
  if (!state?.message) {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{state.message}</p>;
}

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  const [adminState, adminAction] = useActionState(unlockAdmin, undefined);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  return (
    <>
      <form
        action={action}
        className="space-y-5 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">로그인</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            이메일 또는 로그인 ID로 로그인합니다.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">로그인 ID / 이메일</span>
          <input
            name="identifier"
            required
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="hams 또는 user@example.com"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="8자 이상"
          />
        </label>

        <Message state={state} />
        <SubmitButton />

        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            아직 계정이 없으시면{" "}
            <Link className="font-medium text-primary underline underline-offset-4" href="/signup">
              회원가입
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setIsAdminModalOpen(true)}
            className="font-medium text-primary underline underline-offset-4"
          >
            관리
          </button>
        </div>
      </form>

      {isAdminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-md rounded-[2rem] bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">관리 인증</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  관리 화면에 들어가려면 비밀번호를 입력해 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="관리 인증 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={adminAction} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">관리 비밀번호</span>
                <input
                  name="adminPassword"
                  type="password"
                  required
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="관리 비밀번호 입력"
                />
              </label>

              {adminState?.message ? (
                <p className="text-sm font-medium text-destructive">{adminState.message}</p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
              >
                관리 화면 들어가기
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
