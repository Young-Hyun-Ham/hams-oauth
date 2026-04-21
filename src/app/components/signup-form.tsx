"use client";

import Link from "next/link";
import { FileText, X } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signup, type AuthActionState } from "@/app/actions/auth";
import type { TermsDocument } from "@/lib/auth/terms";
import { useAuthStore } from "@/lib/store/auth-store";

type EmailCheckState = {
  message: string;
  tone: "neutral" | "success" | "error";
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "처리 중..." : label}
    </button>
  );
}

function Message({ state }: { state: AuthActionState | undefined }) {
  if (!state?.message) {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{state.message}</p>;
}

function EmailCheckMessage({ state }: { state: EmailCheckState | null }) {
  if (!state?.message) {
    return null;
  }

  const className =
    state.tone === "success"
      ? "text-emerald-700"
      : state.tone === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  return <p className={`text-sm ${className}`}>{state.message}</p>;
}

export function SignupForm({ terms }: { terms: TermsDocument }) {
  const [state, action] = useActionState(signup, undefined);
  const pendingOAuthSignup = useAuthStore((store) => store.pendingOAuthSignup);
  const isOAuthSignup = Boolean(pendingOAuthSignup);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailCheck, setEmailCheck] = useState<EmailCheckState | null>(null);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  async function handleEmailCheck() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setEmailCheck({
        message: "이메일을 입력해 주세요.",
        tone: "error",
      });
      return;
    }

    setIsCheckingEmail(true);
    setEmailCheck({
      message: "이메일 확인 중...",
      tone: "neutral",
    });

    try {
      const response = await fetch(
        `/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`,
      );
      const payload = (await response.json()) as {
        available?: boolean;
        message?: string;
      };

      setEmailCheck({
        message: payload.message ?? "이메일 확인에 실패했습니다.",
        tone: payload.available ? "success" : "error",
      });
    } catch {
      setEmailCheck({
        message: "이메일 확인에 실패했습니다. 다시 시도해 주세요.",
        tone: "error",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  }

  return (
    <>
      <form
        action={action}
        className="space-y-5 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">회원가입</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {isOAuthSignup
              ? `${pendingOAuthSignup?.provider} 계정으로 가입을 마무리합니다.`
              : "이메일과 비밀번호로 계정을 생성합니다."}
          </p>
        </div>

        {isOAuthSignup ? (
          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-foreground">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">이메일</span>
              <input
                name="email"
                type="email"
                value={pendingOAuthSignup?.email ?? ""}
                readOnly
                aria-readonly="true"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground opacity-80 outline-none"
              />
            </label>
            <p>Provider: {pendingOAuthSignup?.provider}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">이메일</span>
              <div className="flex gap-2">
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailCheck(null);
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="user@example.com"
                />
                <button
                  type="button"
                  onClick={handleEmailCheck}
                  disabled={isCheckingEmail}
                  className="shrink-0 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingEmail ? "확인 중..." : "이메일 체크"}
                </button>
              </div>
              <EmailCheckMessage state={emailCheck} />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">비밀번호</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="8자 이상"
              />
            </label>
          </>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">로그인 ID</span>
          <input
            name="loginId"
            required
            minLength={4}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="4자 이상"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">닉네임</span>
          <input
            name="nickname"
            required
            minLength={2}
            defaultValue={pendingOAuthSignup?.nickname ?? ""}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="표시 이름"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">전화번호</span>
          <input
            name="phoneNumber"
            required
            inputMode="numeric"
            pattern="[0-9]*"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, ""))}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="숫자만 입력"
          />
        </label>

        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="min-w-0 flex-1">
              <label
                htmlFor="termsAccepted"
                className="text-sm font-medium text-foreground"
              >
                [필수] hams-oauth 이용약관에 동의합니다.
              </label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                회원가입을 진행하려면 이용약관 동의가 필요합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsTermsModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/50"
            >
              <FileText className="h-4 w-4" />
              이용약관 보기
            </button>
          </div>
        </div>

        <Message state={state} />
        <SubmitButton label={isOAuthSignup ? "소셜 회원가입 완료" : "회원가입"} />

        <p className="text-sm text-muted-foreground">
          이미 계정이 있으시면{" "}
          <Link className="font-medium text-primary underline underline-offset-4" href="/login">
            로그인
          </Link>
        </p>
      </form>

      {isTermsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{terms.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  시행일: {terms.effectiveDate}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">버전: {terms.version}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="이용약관 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {terms.notice.map((line) => (
                <p key={line} className="text-sm leading-6 text-muted-foreground">
                  {line}
                </p>
              ))}

              {terms.sections.map((section) => (
                <section key={section.title} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                  <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
                </section>
              ))}
            </div>

            <div className="border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="w-full rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
