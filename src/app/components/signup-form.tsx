"use client";

import Link from "next/link";
import { FileText, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signup, type AuthActionState } from "@/app/actions/auth";
import type { TermsDocument } from "@/lib/auth/terms";
import { useAuthStore } from "@/lib/store/auth-store";

type EmailCheckState = {
  message: string;
  tone: "neutral" | "success" | "error";
  checkedEmail?: string;
  status: "sending" | "sent" | "verified" | "error";
};

type SignupPlan = "basic" | "standard" | "premium";

type SignupService = {
  id: string;
  clientId: string;
  name: string;
  description: string;
  isFixedPricing: boolean;
  prices: Record<SignupPlan, number>;
};

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from(
  { length: 120 },
  (_, index) => CURRENT_YEAR - index,
);
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

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

  return (
    <p className="text-sm font-medium text-destructive">{state.message}</p>
  );
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

export function SignupForm({
  terms,
  signupService,
}: {
  terms: TermsDocument;
  signupService: SignupService | null;
}) {
  const [state, action] = useActionState(signup, undefined);
  const pendingOAuthSignup = useAuthStore((store) => store.pendingOAuthSignup);
  const isOAuthSignup = Boolean(pendingOAuthSignup);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailCheck, setEmailCheck] = useState<EmailCheckState | null>(null);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SignupPlan>("basic");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const birthDays = useMemo(() => {
    const year = Number(birthYear);
    const month = Number(birthMonth);

    if (
      !Number.isInteger(year) ||
      year < 1 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return [];
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: lastDay }, (_, index) => index + 1);
  }, [birthMonth, birthYear]);

  useEffect(() => {
    const [year = "", month = "", day = ""] =
      pendingOAuthSignup?.birthDate?.split("-") ?? [];
    setBirthYear(year);
    setBirthMonth(month ? String(Number(month)) : "");
    setBirthDay(day ? String(Number(day)) : "");
  }, [pendingOAuthSignup]);

  useEffect(() => {
    if (birthDay && !birthDays.includes(Number(birthDay))) {
      setBirthDay("");
    }
  }, [birthDay, birthDays]);

  useEffect(() => {
    if (state?.field === "email") {
      emailInputRef.current?.focus();
    }
  }, [state]);

  async function handleSendVerification() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setEmailCheck({
        message: "이메일을 입력해 주세요.",
        tone: "error",
        status: "error",
      });
      return;
    }

    setIsCheckingEmail(true);
    setEmailCheck({
      message: "인증 이메일을 발송하는 중입니다.",
      tone: "neutral",
      status: "sending",
    });

    try {
      const response = await fetch("/api/auth/email-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      setEmailCheck({
        message: payload.message ?? "인증 이메일 발송에 실패했습니다.",
        tone: response.ok && payload.ok ? "neutral" : "error",
        status: response.ok && payload.ok ? "sent" : "error",
        checkedEmail:
          response.ok && payload.ok ? normalizedEmail.toLowerCase() : undefined,
      });
    } catch {
      setEmailCheck({
        message: "이메일 확인에 실패했습니다. 다시 시도해 주세요.",
        tone: "error",
        status: "error",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  }

  async function handleVerifyEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\d{6}$/.test(verificationCode)) {
      setEmailCheck({
        message: "인증번호 6자리를 입력해 주세요.",
        tone: "error",
        status: "sent",
        checkedEmail: normalizedEmail,
      });
      return;
    }

    setIsVerifyingEmail(true);
    try {
      const response = await fetch("/api/auth/email-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          code: verificationCode,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      setEmailCheck({
        message: payload.message ?? "이메일 인증에 실패했습니다.",
        tone: response.ok && payload.ok ? "success" : "error",
        status: response.ok && payload.ok ? "verified" : "sent",
        checkedEmail: normalizedEmail,
      });
    } catch {
      setEmailCheck({
        message: "이메일 인증에 실패했습니다. 다시 시도해 주세요.",
        tone: "error",
        status: "sent",
        checkedEmail: normalizedEmail,
      });
    } finally {
      setIsVerifyingEmail(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isOAuthSignup) {
      const normalizedEmail = email.trim().toLowerCase();
      if (
        emailCheck?.status !== "verified" ||
        emailCheck.checkedEmail !== normalizedEmail
      ) {
        event.preventDefault();
        setEmailCheck({
          message: "현재 입력한 이메일의 인증을 완료해 주세요.",
          tone: "error",
          status:
            emailCheck?.checkedEmail === normalizedEmail ? "sent" : "error",
          checkedEmail:
            emailCheck?.checkedEmail === normalizedEmail
              ? normalizedEmail
              : undefined,
        });
        emailInputRef.current?.focus();
        return;
      }
    }

    if (
      signupService?.isFixedPricing &&
      signupService.prices[selectedPlan] > 0
    ) {
      event.preventDefault();
      setPaymentMessage("");
      setIsPaymentModalOpen(true);
    }
  }

  return (
    <>
      <form
        action={action}
        onSubmit={handleSubmit}
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
              <span className="text-sm font-medium text-foreground">
                이메일
              </span>
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
              <span className="text-sm font-medium text-foreground">
                이메일
              </span>
              <div className="flex gap-2">
                <input
                  ref={emailInputRef}
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailCheck(null);
                    setVerificationCode("");
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="user@example.com"
                />
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={isCheckingEmail}
                  className="shrink-0 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingEmail ? "발송 중..." : "인증번호 발송"}
                </button>
              </div>
              <EmailCheckMessage state={emailCheck} />
              {emailCheck?.checkedEmail === email.trim().toLowerCase() &&
              emailCheck.status !== "verified" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="인증번호 6자리"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={isVerifyingEmail}
                    className="shrink-0 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifyingEmail ? "확인 중..." : "인증번호 확인"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              비밀번호
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="8자 이상"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              비밀번호 확인
            </span>
            <input
              name="passwordConfirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="비밀번호 다시 입력"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">로그인 ID</span>
          <input
            type="email"
            value={pendingOAuthSignup?.email ?? email}
            disabled
            aria-disabled="true"
            className="w-full cursor-not-allowed rounded-2xl border border-border bg-muted/40 px-4 py-3 text-foreground opacity-80 outline-none"
            placeholder="이메일이 로그인 ID로 사용됩니다."
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            생년월일
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">년</span>
              <input
                name="birthYear"
                list="birth-year-options"
                inputMode="numeric"
                maxLength={4}
                required
                value={birthYear}
                onChange={(event) =>
                  setBirthYear(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="YYYY"
              />
              <datalist id="birth-year-options">
                {BIRTH_YEARS.map((year) => (
                  <option key={year} value={year} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">월</span>
              <input
                name="birthMonth"
                list="birth-month-options"
                inputMode="numeric"
                maxLength={2}
                required
                value={birthMonth}
                onChange={(event) =>
                  setBirthMonth(
                    event.target.value.replace(/\D/g, "").slice(0, 2),
                  )
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="MM"
              />
              <datalist id="birth-month-options">
                {BIRTH_MONTHS.map((month) => (
                  <option key={month} value={month} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">일</span>
              <input
                name="birthDay"
                list="birth-day-options"
                inputMode="numeric"
                maxLength={2}
                required
                disabled={birthDays.length === 0}
                value={birthDay}
                onChange={(event) =>
                  setBirthDay(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/40"
                placeholder={birthDays.length ? "DD" : "년·월 선택"}
              />
              <datalist id="birth-day-options">
                {birthDays.map((day) => (
                  <option key={day} value={day} />
                ))}
              </datalist>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            목록에서 선택하거나 숫자를 직접 입력할 수 있습니다.
          </p>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">성별</span>
          <select
            name="gender"
            required
            defaultValue=""
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="" disabled>
              선택해 주세요
            </option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
            <option value="prefer_not_to_say">응답하지 않음</option>
          </select>
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
            onChange={(event) =>
              setPhoneNumber(event.target.value.replace(/\D/g, ""))
            }
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="숫자만 입력"
          />
        </label>

        {signupService?.isFixedPricing ? (
          <fieldset className="space-y-3 rounded-3xl border border-primary/25 bg-primary/5 p-4">
            <legend className="px-2 text-sm font-semibold text-foreground">
              가입 서비스 및 요금제
            </legend>
            <input
              type="hidden"
              name="serviceSiteId"
              value={signupService.id}
            />
            <div>
              <p className="font-semibold text-foreground">
                {signupService.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                월 이용요금 · 1함포 = 100원
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["basic", "standard", "premium"] as const).map((plan) => {
                const price = signupService.prices[plan];
                return (
                  <label
                    key={plan}
                    className={`cursor-pointer rounded-2xl border p-3 transition ${selectedPlan === plan ? "border-primary bg-background ring-2 ring-primary/10" : "border-border bg-background/70"}`}
                  >
                    <input
                      type="radio"
                      name="servicePlan"
                      value={plan}
                      checked={selectedPlan === plan}
                      onChange={() => setSelectedPlan(plan)}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold uppercase text-primary">
                      {plan}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-foreground">
                      {price.toLocaleString("ko-KR")}원
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {(price / 100).toLocaleString("ko-KR", {
                        maximumFractionDigits: 2,
                      })}
                      함포
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

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
        <SubmitButton
          label={isOAuthSignup ? "소셜 회원가입 완료" : "회원가입"}
        />

        <p className="text-sm text-muted-foreground">
          이미 계정이 있으시면{" "}
          <Link
            className="font-medium text-primary underline underline-offset-4"
            href="/login"
          >
            로그인
          </Link>
        </p>
      </form>

      {isTermsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {terms.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  시행일: {terms.effectiveDate}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  버전: {terms.version}
                </p>
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
                <p
                  key={line}
                  className="text-sm leading-6 text-muted-foreground"
                >
                  {line}
                </p>
              ))}

              {terms.sections.map((section) => (
                <section key={section.title} className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {section.title}
                  </h4>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {section.body}
                  </p>
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

      {isPaymentModalOpen && signupService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              PAYMENT
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">
              결제 안내
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {signupService.name}의 {selectedPlan.toUpperCase()} 요금제로
              가입하려면 결제가 필요합니다.
            </p>
            <div className="mt-5 rounded-2xl bg-muted/40 p-5 text-center">
              <p className="text-xs text-muted-foreground">월 결제금액</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {signupService.prices[selectedPlan].toLocaleString("ko-KR")}원
              </p>
              <p className="mt-2 text-sm font-medium text-primary">
                {(signupService.prices[selectedPlan] / 100).toLocaleString(
                  "ko-KR",
                  { maximumFractionDigits: 2 },
                )}
                함포 · 1함포는 100원
              </p>
            </div>
            {paymentMessage ? (
              <p className="mt-4 rounded-2xl bg-primary/8 px-4 py-3 text-center text-sm font-semibold text-primary">
                {paymentMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPaymentMessage("준비중입니다")}
                className="w-full rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
              >
                결제하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentMessage("");
                }}
                className="w-full rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
