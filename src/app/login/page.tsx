import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { DashboardClient } from "@/app/components/dashboard-client";
import { LoginForm } from "@/app/components/login-form";
import { OAuthButtons } from "@/app/components/oauth-buttons";
import { getSession } from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  invalid_provider: "지원하지 않는 OAuth provider입니다.",
  invalid_state: "OAuth state 검증에 실패했습니다. 다시 시도해 주세요.",
  missing_code: "OAuth 인증 코드가 없습니다. 다시 시도해 주세요.",
  oauth_failed: "OAuth 로그인 처리에 실패했습니다.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const user = session?.user ?? null;
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : "";
  const errorMessage = errorMessages[errorKey];

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <AuthStoreHydrator viewer={user} pendingOAuthSignup={null} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-4xl border border-border/60 bg-white/85 p-8 shadow-sm backdrop-blur-sm md:p-10">
          <div className="space-y-6">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">LOGIN</div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              이메일 로그인과 Google, Naver, Kakao OAuth를 지원합니다
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              소셜 로그인 시 <code>users</code> 컬렉션에서 <code>provider + email</code>로 조회하고,
              가입된 회원이면 바로 로그인되며 처음이면 회원가입 페이지로 이동합니다.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/8 p-4 text-sm font-medium text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {user ? (
            <DashboardClient />
          ) : (
            <>
              <LoginForm />
              <OAuthButtons />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
