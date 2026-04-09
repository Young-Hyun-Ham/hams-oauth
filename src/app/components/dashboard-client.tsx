"use client";

import { logout } from "@/app/actions/auth";
import { useAuthStore } from "@/lib/store/auth-store";

export function DashboardClient() {
  const viewer = useAuthStore((store) => store.viewer);

  if (!viewer) {
    return null;
  }

  return (
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

      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90"
        >
          로그아웃
        </button>
      </form>
    </section>
  );
}
