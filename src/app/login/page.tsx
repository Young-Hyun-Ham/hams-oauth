import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { DashboardClient } from "@/app/components/dashboard-client";
import { LoginForm } from "@/app/components/login-form";
import { OAuthButtons } from "@/app/components/oauth-buttons";
import { getSession } from "@/lib/auth/session";
import { getPublicSSOClients } from "@/lib/auth/sso";

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
  const params = await searchParams;
  const session = await getSession();
  const user = session?.user ?? null;
  const errorKey = typeof params.error === "string" ? params.error : "";
  const errorMessage = errorMessages[errorKey];
  const serviceClients = getPublicSSOClients();

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <AuthStoreHydrator viewer={user} pendingOAuthSignup={null} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-4xl border border-border/60 bg-white/90 shadow-sm backdrop-blur-sm">
          <div className="border-b border-border/60 bg-linear-to-br from-rose-50 via-white to-amber-50/70 p-8 md:p-10">
            <div className="space-y-6">
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
                LOGIN
              </div>
              <p className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-xl">
                이메일 로그인과 Google, Naver, Kakao OAuth를 함께 지원합니다.
              </p>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                아래 서비스 목록을 클릭하면 해당 서비스 주소로 이동할 수 있습니다. 로그인은 이
                화면에서 진행하고, 인증이 완료되면 연결된 서비스로 이어집니다.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-8 md:p-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
                  Connected Services
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  통합 로그인을 사용할 수 있는 서비스 목록입니다.
                </p>
              </div>
              <div className="rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
                {serviceClients.length} Sites
              </div>
            </div>

            <div className="grid gap-3">
              {serviceClients.map((client, index) => (
                <a
                  key={client.clientId}
                  href={client.entryUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!client.entryUrl}
                  className={`group block rounded-3xl border border-border/70 bg-gradient-to-r from-white to-rose-50/40 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 ${
                    client.entryUrl ? "" : "pointer-events-none opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{client.name}</h2>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {client.clientId}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full border border-border/70 bg-white px-3 py-1.5 font-medium text-foreground">
                          {client.origin}
                        </span>
                        {client.entryUrl ? (
                          <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 font-medium text-primary">
                            서비스로 이동
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
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
