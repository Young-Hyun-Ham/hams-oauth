import { redirect } from "next/navigation";

import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { SignupForm } from "@/app/components/signup-form";
import {
  getPendingOAuthSignup,
  getPendingSSORequest,
  getSession,
} from "@/lib/auth/session";
import { getCurrentTermsDocument } from "@/lib/store/admin-terms-store";
import { listServiceSites } from "@/lib/store/service-site-store";

export default async function SignupPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/");
  }

  const [pendingOAuthSignup, pendingSSORequest, currentTerms, allServiceSites] =
    await Promise.all([
      getPendingOAuthSignup(),
      getPendingSSORequest(),
      getCurrentTermsDocument(),
      listServiceSites(),
    ]);
  const serviceSites = allServiceSites
    .filter((site) => site.isVisible)
    .map((site) => ({
      id: site.id,
      clientId: site.clientId,
      name: site.name,
      description: site.description,
      isFixedPricing: site.isFixedPricing,
      prices: site.prices,
    }));
  const signupService =
    serviceSites.find(
      (site) => site.clientId === pendingSSORequest?.clientId,
    ) ?? null;

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <AuthStoreHydrator
        viewer={null}
        pendingOAuthSignup={pendingOAuthSignup}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-border/60 bg-white/85 p-8 shadow-sm backdrop-blur-sm md:p-10">
          <div className="space-y-6">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              SIGN UP
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              회원가입
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              사용할 서비스와 월 이용요금을 확인해 주세요. 1함포는 100원입니다.
            </p>
            <div className="space-y-4 pt-2">
              {serviceSites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  현재 이용 가능한 서비스가 없습니다.
                </div>
              ) : (
                serviceSites.map((site) => (
                  <div
                    key={site.id}
                    className={`rounded-3xl border p-5 ${signupService?.id === site.id ? "border-primary bg-primary/5" : "border-border/70 bg-background/70"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-foreground">
                          {site.name}
                        </h2>
                        {site.description ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {site.description}
                          </p>
                        ) : null}
                      </div>
                      {signupService?.id === site.id ? (
                        <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                          가입 서비스
                        </span>
                      ) : null}
                    </div>
                    {site.isFixedPricing ? (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {(["basic", "standard", "premium"] as const).map(
                          (plan) => (
                            <div
                              key={plan}
                              className="rounded-2xl border border-border/60 bg-white p-3 text-center"
                            >
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {plan}
                              </p>
                              <p className="mt-1 text-sm font-bold text-foreground">
                                {site.prices[plan].toLocaleString("ko-KR")}원
                              </p>
                              <p className="mt-1 text-[11px] text-primary">
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
                    ) : (
                      <p className="mt-3 text-xs font-medium text-muted-foreground">
                        정찰제 요금을 사용하지 않는 서비스입니다.
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <SignupForm terms={currentTerms} signupService={signupService} />
      </section>
    </main>
  );
}
