import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { DashboardClient } from "@/app/components/dashboard-client";
import { LoginForm } from "@/app/components/login-form";
import { OAuthButtons } from "@/app/components/oauth-buttons";
import { ServiceAccessLink } from "@/app/components/service-access-link";
import { getSession } from "@/lib/auth/session";
import { listServiceSites } from "@/lib/store/service-site-store";

const errorMessages: Record<string, string> = {
  invalid_provider: "지원하지 않는 OAuth provider입니다.",
  invalid_state: "OAuth state 검증에 실패했습니다. 다시 시도해 주세요.",
  missing_code: "OAuth 인증 코드가 없습니다. 다시 시도해 주세요.",
  oauth_failed: "OAuth 로그인 처리에 실패했습니다.",
};

const SERVICES_PER_PAGE = 5;

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
  const allServiceSites = await listServiceSites();
  const memberships = user?.serviceMemberships ?? [];
  const serviceSites = allServiceSites
    .map((site) => ({
      site,
      membership:
        memberships.find(
          (item) =>
            item.serviceSiteId === site.id || item.clientId === site.clientId,
        ) ?? null,
    }))
    .filter(({ site, membership }) => {
      if (!user) {
        return true;
      }

      if (membership) {
        return true;
      }

      return site.isVisible && !site.isFixedPricing;
    });
  const requestedServicePage =
    typeof params.servicePage === "string"
      ? Number.parseInt(params.servicePage, 10)
      : 1;
  const totalServicePages = Math.max(
    1,
    Math.ceil(serviceSites.length / SERVICES_PER_PAGE),
  );
  const currentServicePage =
    Number.isNaN(requestedServicePage) || requestedServicePage < 1
      ? 1
      : Math.min(requestedServicePage, totalServicePages);
  const servicePageStart = (currentServicePage - 1) * SERVICES_PER_PAGE;
  const pagedServiceSites = serviceSites.slice(
    servicePageStart,
    servicePageStart + SERVICES_PER_PAGE,
  );

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
                이메일 로그인과 Google, Naver, Kakao OAuth를 함께 지원
              </p>
              {/*
              <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                아래 서비스 목록은 관리자에서 등록한 서비스사이트입니다. 서비스를 클릭하면 해당
                사이트로 이동할 수 있고, 서비스 로그인은 SSO 인증 전담 서버를 통해 처리할 수
                있습니다.
              </p>
              */}
            </div>
          </div>

          <div className="space-y-3 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
                  {user ? "Connected Services" : "Services"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {user
                    ? "현재 이용할 수 있는 서비스와 가입 요금제입니다."
                    : "가입 가능한 서비스와 월 이용요금을 확인해 주세요. 1함포는 100원입니다."}
                </p>
              </div>
              <div className="rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
                {serviceSites.length} Sites
              </div>
            </div>

            {serviceSites.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-white p-6 text-sm text-muted-foreground">
                {user
                  ? "현재 이용할 수 있는 서비스가 없습니다."
                  : "현재 가입 가능한 서비스가 없습니다."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {pagedServiceSites.map(({ site, membership }, index) => (
                  <ServiceAccessLink
                    key={site.id}
                    href={site.url || "#"}
                    blockBeforeLogin={!user && !site.isVisible}
                    className={`group block rounded-2xl border border-border/70 bg-gradient-to-r from-white to-rose-50/40 px-3 py-2.5 transition hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5 ${
                      site.url ? "" : "pointer-events-none opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
                        {String(servicePageStart + index + 1).padStart(2, "0")}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">
                            {site.name}
                          </h2>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {site.clientId}
                          </span>
                          {user && site.isFixedPricing && membership ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">
                              {membership.plan}
                            </span>
                          ) : !site.isFixedPricing ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              정찰제 미사용
                            </span>
                          ) : null}
                        </div>

                        {!user && site.isFixedPricing ? (
                          <div className="grid grid-cols-3 gap-1.5">
                            {(["basic", "standard", "premium"] as const).map(
                              (plan) => (
                                <div
                                  key={plan}
                                  className="rounded-xl border border-border/60 bg-white px-2 py-1.5 text-center"
                                >
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    {plan}
                                  </p>
                                  <p className="text-xs font-semibold text-foreground">
                                    {site.prices[plan].toLocaleString("ko-KR")}
                                    원
                                  </p>
                                  <p className="text-[10px] text-primary">
                                    {(site.prices[plan] / 100).toLocaleString(
                                      "ko-KR",
                                      { maximumFractionDigits: 2 },
                                    )}
                                    함포
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        ) : user && site.isFixedPricing && membership ? (
                          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                            <span className="font-semibold uppercase text-primary">
                              {membership.plan}
                            </span>
                            <span className="ml-2 text-foreground">
                              월{" "}
                              {site.prices[membership.plan].toLocaleString(
                                "ko-KR",
                              )}
                              원
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              (
                              {(
                                site.prices[membership.plan] / 100
                              ).toLocaleString("ko-KR", {
                                maximumFractionDigits: 2,
                              })}
                              함포)
                            </span>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="max-w-full truncate rounded-full border border-border/70 bg-white px-2.5 py-1 font-medium text-foreground">
                            {site.url}
                          </span>
                          {site.url ? (
                            <span className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 font-medium text-primary">
                              서비스로 이동
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </ServiceAccessLink>
                ))}
              </div>
            )}

            {totalServicePages > 1 ? (
              <nav
                className="flex flex-wrap items-center justify-center gap-2 pt-2"
                aria-label="서비스 목록 페이지"
              >
                {Array.from(
                  { length: totalServicePages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <Link
                    key={page}
                    href={`/login?servicePage=${page}`}
                    aria-current={
                      page === currentServicePage ? "page" : undefined
                    }
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition ${
                      page === currentServicePage
                        ? "bg-foreground text-background"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {page}
                  </Link>
                ))}
              </nav>
            ) : null}
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
import Link from "next/link";
