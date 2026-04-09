"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type AuthActionState } from "@/app/actions/auth";

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

  return (
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

      <p className="text-sm text-muted-foreground">
        아직 계정이 없으면{" "}
        <Link className="font-medium text-primary underline underline-offset-4" href="/signup">
          회원가입
        </Link>
      </p>
    </form>
  );
}
