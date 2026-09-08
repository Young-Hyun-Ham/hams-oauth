import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { DashboardClient } from "@/app/components/dashboard-client";
import { LoginForm } from "@/app/components/login-form";
import { OAuthButtons } from "@/app/components/oauth-buttons";
import { ServiceAccessLink } from "@/app/components/service-access-link";
import { getSession } from "@/lib/auth/session";
import { listServiceSites } from "@/lib/store/service-site-store";
import { findUserById } from "@/lib/store/user-store";
import { toSessionUser } from "@/lib/auth/types";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  invalid_provider: "지원하지 않는 OAuth provider입니다.",
  invalid_state: "OAuth state 검증에 실패했습니다. 다시 시도해 주세요.",
  missing_code: "OAuth 인증 코드가 없습니다. 다시 시도해 주세요.",
  oauth_failed: "OAuth 로그인 처리에 실패했습니다.",
};

const SERVICES_PER_PAGE = 5;

function getPageNumber(value: string | string[] | undefined, totalItems: number) {
  const requestedPage =
    typeof value === "string" ? Number.parseInt(value, 10) : 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / SERVICES_PER_PAGE));
  const currentPage =
    Number.isNaN(requestedPage) || requestedPage < 1
      ? 1
      : Math.min(requestedPage, totalPages);

  return { currentPage, totalPages };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const latestUser = session ? await findUserById(session.userId) : null;
  const user = latestUser ? toSessionUser(latestUser) : null;
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
  const nonFixedPricingSites = serviceSites.filter(
    ({ site }) => !site.isFixedPricing,
  );
  const fixedPricingSites = serviceSites.filter(
    ({ site }) => site.isFixedPricing,
  );
  const { currentPage: nonFixedPage, totalPages: nonFixedTotalPages } =
    getPageNumber(params.nonFixedPage, nonFixedPricingSites.length);
  const { currentPage: fixedPage, totalPages: fixedTotalPages } = getPageNumber(
    params.fixedPage,
    fixedPricingSites.length,
  );
  const nonFixedPageStart = (nonFixedPage - 1) * SERVICES_PER_PAGE;
  const fixedPageStart = (fixedPage - 1) * SERVICES_PER_PAGE;
  const pagedNonFixedPricingSites = nonFixedPricingSites.slice(
    nonFixedPageStart,
    nonFixedPageStart + SERVICES_PER_PAGE,
  );
  const pagedFixedPricingSites = fixedPricingSites.slice(
    fixedPageStart,
    fixedPageStart + SERVICES_PER_PAGE,
  );
  const fixedPricingOpen = params.fixedOpen === "1";

  const renderServiceCards = (
    sites: typeof serviceSites,
    pageStart: number,
  ) => (
    <div className="grid grid-cols-1 gap-2">
      {sites.map(({ site, membership }, index) => (
        <ServiceAccessLink
          key={site.id}
          href={site.url || "#"}
          blockBeforeLogin={
            (!user && !site.isVisible) ||
            membership?.status === "refund_pending"
          }
          blockedTitle={
            membership?.status === "refund_pending"
              ? "환불 진행 중입니다"
              : undefined
          }
          blockedMessage={
            membership?.status === "refund_pending"
              ? "환불 요청이 처리될 때까지 이 서비스를 이용할 수 없습니다."
              : undefined
          }
          className={`group block rounded-2xl border border-border/70 bg-gradient-to-r from-white to-rose-50/40 px-3 py-2.5 transition hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5 ${
            site.url ? "" : "pointer-events-none opacity-60"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
              {String(pageStart + index + 1).padStart(2, "0")}
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
                    기본 제공
                  </span>
                ) : null}
                {membership?.status === "refund_pending" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    환불 진행중
                  </span>
                ) : null}
              </div>

              {!user && site.isFixedPricing ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {(["basic", "standard", "premium"] as const).map((plan) => (
                    <div
                      key={plan}
                      className="rounded-xl border border-border/60 bg-white px-2 py-1.5 text-center"
                    >
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {plan}
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        {site.prices[plan].toLocaleString("ko-KR")}원
                      </p>
                      <p className="text-[10px] text-primary">
                        {(site.prices[plan] / 100).toLocaleString("ko-KR", {
                          maximumFractionDigits: 2,
                        })}
                        햄포
                      </p>
                    </div>
                  ))}
                </div>
              ) : user && site.isFixedPricing && membership ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-semibold uppercase text-primary">
                    {membership.plan}
                  </span>
                  <span className="ml-2 text-foreground">
                    월 {site.prices[membership.plan].toLocaleString("ko-KR")}원
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    (
                    {(site.prices[membership.plan] / 100).toLocaleString(
                      "ko-KR",
                      { maximumFractionDigits: 2 },
                    )}
                    햄포)
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
  );

  const renderPagination = (
    totalPages: number,
    currentPage: number,
    pageParam: "nonFixedPage" | "fixedPage",
    ariaLabel: string,
  ) => {
    if (totalPages <= 1) {
      return null;
    }

    return (
      <nav
        className="flex flex-wrap items-center justify-center gap-2 pt-2"
        aria-label={ariaLabel}
      >
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (page) => {
            const query = new URLSearchParams();
            query.set(pageParam, String(page));

            if (pageParam !== "nonFixedPage" && nonFixedPage > 1) {
              query.set("nonFixedPage", String(nonFixedPage));
            }
            if (pageParam !== "fixedPage" && fixedPage > 1) {
              query.set("fixedPage", String(fixedPage));
            }
            if (pageParam === "fixedPage" || fixedPricingOpen) {
              query.set("fixedOpen", "1");
            }

            return (
              <Link
                key={page}
                href={`/login?${query.toString()}`}
                aria-current={page === currentPage ? "page" : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition ${
                  page === currentPage
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {page}
              </Link>
            );
          },
        )}
      </nav>
    );
  };

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
                    : "가입 전에 이용 가능한 서비스를 둘러보세요."}
                </p>
              </div>
              <div className="rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
                {serviceSites.length} Sites
              </div>
            </div>

            {(
              <div className="space-y-3">
                <details
                  open
                  className="group rounded-3xl border border-emerald-200/70 bg-emerald-50/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <div>
                      <h2 className="font-semibold text-foreground">
                        무료 서비스
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {user
                          ? "이용 가능한 무료 서비스입니다."
                          : "가입 전에 바로 살펴볼 수 있는 서비스입니다."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {nonFixedPricingSites.length}개
                      </span>
                      <span className="text-sm font-medium text-muted-foreground group-open:hidden">
                        펴기
                      </span>
                      <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">
                        접기
                      </span>
                    </div>
                  </summary>
                  <div className="space-y-2 border-t border-emerald-200/70 p-3">
                    {nonFixedPricingSites.length === 0 ? (
                      <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">
                        등록된 무료 서비스가 없습니다.
                      </p>
                    ) : (
                      renderServiceCards(
                        pagedNonFixedPricingSites,
                        nonFixedPageStart,
                      )
                    )}
                    {renderPagination(
                      nonFixedTotalPages,
                      nonFixedPage,
                      "nonFixedPage",
                      "무료 서비스 페이지",
                    )}
                  </div>
                </details>

                <details
                  open={fixedPricingOpen}
                  className="group rounded-3xl border border-border/70 bg-muted/20"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <div>
                      <h2 className="font-semibold text-foreground">
                        부분 유료 서비스
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {user
                          ? "가입한 부분 유료 서비스와 요금제를 확인하세요."
                          : "필요할 때 펼쳐 요금제와 서비스를 확인하세요."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary">
                        {fixedPricingSites.length}개
                      </span>
                      <span className="text-sm font-medium text-muted-foreground group-open:hidden">
                        펴기
                      </span>
                      <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">
                        접기
                      </span>
                    </div>
                  </summary>
                  <div className="space-y-2 border-t border-border/70 p-3">
                    {fixedPricingSites.length === 0 ? (
                      <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">
                        등록된 부분 유료 서비스가 없습니다.
                      </p>
                    ) : (
                      renderServiceCards(
                        pagedFixedPricingSites,
                        fixedPageStart,
                      )
                    )}
                    {renderPagination(
                      fixedTotalPages,
                      fixedPage,
                      "fixedPage",
                      "부분 유료 서비스 페이지",
                    )}
                  </div>
                </details>
              </div>
            )}

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
