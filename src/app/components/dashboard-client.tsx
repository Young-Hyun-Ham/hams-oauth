"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { unlockAdmin, type AdminUnlockState } from "@/app/actions/admin";
import { logout } from "@/app/actions/auth";
import { useAuthStore } from "@/lib/store/auth-store";

function AdminUnlockSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "확인 중..." : "관리 페이지 열기"}
    </button>
  );
}

function AdminUnlockMessage({ state }: { state: AdminUnlockState | undefined }) {
  if (!state?.message) {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{state.message}</p>;
}

export function DashboardClient() {
  const viewer = useAuthStore((store) => store.viewer);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminState, adminAction] = useActionState(unlockAdmin, undefined);

  if (!viewer) {
    return null;
  }

  return (
    <>
      <section className="space-y-6 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.24em] text-primary">
            SESSION ACTIVE
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            {viewer.nickname}님, 로그인되어 있습니다.
          </h2>
          <p className="text-sm text-muted-foreground">
            {viewer.loginId} / {viewer.email}
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              가입일
            </dt>
            <dd className="mt-2 text-sm font-medium text-foreground">
              {new Date(viewer.createdAt).toLocaleString("ko-KR")}
            </dd>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              로그인 방식
            </dt>
            <dd className="mt-2 text-sm font-medium capitalize text-foreground">
              {viewer.provider}
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <Link
            href="/profile"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50"
          >
            회원정보 수정
          </Link>

          {process.env.NEXT_PUBLIC_ACCEPT_INCLUDE?.includes(viewer.email) && (
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50"
            >
              관리
            </button>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90"
            >
              로그아웃
            </button>
          </form>
        </div>
      </section>

      {isAdminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                ADMIN
              </p>
              <h3 className="text-2xl font-semibold text-foreground">관리 암호 입력</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                관리자 페이지로 이동하려면 관리자 암호를 입력해 주세요.
              </p>
            </div>

            <form action={adminAction} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">관리 암호</span>
                <input
                  name="adminPassword"
                  type="password"
                  required
                  minLength={4}
                  autoFocus
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="관리 암호 입력"
                />
              </label>

              <AdminUnlockMessage state={adminState} />

              <div className="flex flex-col gap-3 sm:flex-row">
                <AdminUnlockSubmitButton />
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="w-full rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
