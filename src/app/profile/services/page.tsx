import Link from "next/link";
import { redirect } from "next/navigation";

import { ServiceMembershipManager } from "@/app/components/service-membership-manager";
import { createPostLoginRedirect, getSession } from "@/lib/auth/session";
import { getValidatedServiceReturnUrl } from "@/lib/auth/sso";
import { listServiceSites } from "@/lib/store/service-site-store";
import { findUserById } from "@/lib/store/user-store";

export default async function ProfileServicesPage({
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
      await createPostLoginRedirect(`/profile/services?${query.toString()}`);
    }
    redirect("/login");
  }

  const [user, serviceSites] = await Promise.all([
    findUserById(session.userId),
    listServiceSites(),
  ]);
  if (!user) redirect("/login");

  const manageableSites = serviceSites.map((site) => ({
    id: site.id,
    clientId: site.clientId,
    name: site.name,
    description: site.description,
    isFixedPricing: site.isFixedPricing,
    prices: site.prices,
  }));

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-col gap-4 rounded-4xl border border-border/60 bg-white/85 p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              MY SERVICES
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              서비스 변경
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              이용할 서비스를 추가하거나 요금제를 변경할 수 있습니다.
            </p>
          </div>
          <Link
            href={returnTo ?? "/login"}
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
          >
            {returnTo ? "서비스로 이동" : "로그인 화면으로"}
          </Link>
        </div>

        <ServiceMembershipManager
          user={{
            hampoBalance: user.hampoBalance,
            serviceMemberships: user.serviceMemberships,
          }}
          serviceSites={manageableSites}
        />
      </section>
    </main>
  );
}
