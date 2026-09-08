import { redirect } from "next/navigation";

import { ProfileForm } from "@/app/components/profile-form";
import { createPostLoginRedirect, getSession } from "@/lib/auth/session";
import { getValidatedServiceReturnUrl } from "@/lib/auth/sso";
import { findUserById } from "@/lib/store/user-store";
import { listServiceSites } from "@/lib/store/service-site-store";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clientId =
    typeof params.client_id === "string" ? params.client_id : undefined;
  const requestedReturnTo =
    typeof params.return_to === "string" ? params.return_to : undefined;
  const returnTo = await getValidatedServiceReturnUrl(
    clientId,
    requestedReturnTo,
  );
  const session = await getSession();

  if (!session?.userId) {
    if (returnTo && clientId) {
      const query = new URLSearchParams({
        client_id: clientId,
        return_to: returnTo,
      });
      await createPostLoginRedirect(`/profile?${query.toString()}`);
    }
    redirect("/login");
  }

  const user = await findUserById(session.userId);

  if (!user) {
    redirect("/login");
  }

  const serviceSites = (await listServiceSites()).map((site) => ({
    id: site.id,
    clientId: site.clientId,
    name: site.name,
    description: site.description,
    isFixedPricing: site.isFixedPricing,
    prices: site.prices,
  }));

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-border/60 bg-white/85 p-8 shadow-sm backdrop-blur-sm md:p-10">
          <div className="space-y-6">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              PROFILE
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              회원정보 수정
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              사용할 서비스와 월 이용요금을 확인해 주세요. 1함포는 100원입니다.
            </p>
            <div className="space-y-4 pt-2">
              {serviceSites.map((site) => (
                <div
                  key={site.id}
                  className="rounded-3xl border border-border/70 bg-background/70 p-5"
                >
                  <h2 className="font-semibold text-foreground">{site.name}</h2>
                  {site.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {site.description}
                    </p>
                  ) : null}
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      무료 서비스입니다.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProfileForm
          user={user}
          serviceReturn={
            returnTo && clientId ? { clientId, returnTo } : undefined
          }
        />
      </section>
    </main>
  );
}
