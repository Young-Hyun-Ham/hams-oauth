"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  purchaseServiceMembership,
  removeServiceMembership,
} from "@/app/actions/auth";
import { ServiceMembershipPurchaseModal } from "@/app/components/service-membership-purchase-modal";
import { ServiceRefundRequestModal } from "@/app/components/service-refund-request-modal";
import type {
  AuthUser,
  ServiceMembership,
  ServicePlan,
} from "@/lib/auth/types";
import { useAuthStore } from "@/lib/store/auth-store";

type ManagedService = {
  id: string;
  clientId: string;
  name: string;
  description: string;
  isFixedPricing: boolean;
  prices: Record<ServicePlan, number>;
};

export function ServiceMembershipManager({
  user,
  serviceSites,
}: {
  user: Pick<AuthUser, "hampoBalance" | "serviceMemberships">;
  serviceSites: ManagedService[];
}) {
  const [memberships, setMemberships] = useState(user.serviceMemberships);
  const [selectedServiceId, setSelectedServiceId] = useState(
    [...serviceSites]
      .sort(
        (left, right) =>
          Number(right.prices.basic > 0) - Number(left.prices.basic > 0),
      )
      .find(
        (service) =>
          service.isFixedPricing &&
          !user.serviceMemberships.some(
            (membership) =>
              membership.serviceSiteId === service.id ||
              membership.clientId === service.clientId,
          ),
      )?.id ?? "",
  );
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan>("basic");
  const [purchaseTarget, setPurchaseTarget] = useState<{
    service: ManagedService;
    plan: ServicePlan;
    currentPlan?: ServicePlan;
    currentPlanPrice?: number;
    allowedPlans?: ServicePlan[];
  } | null>(null);
  const [refundTarget, setRefundTarget] =
    useState<ServiceMembership | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const setHampoBalance = useAuthStore((store) => store.setHampoBalance);
  const viewerBalance = useAuthStore(
    (store) => store.viewer?.hampoBalance ?? user.hampoBalance,
  );
  const availableServices = useMemo(
    () =>
      serviceSites.filter(
        (service) =>
          service.isFixedPricing &&
          !memberships.some(
            (membership) =>
              membership.serviceSiteId === service.id ||
              membership.clientId === service.clientId,
          ),
      ).sort(
        (left, right) =>
          Number(right.prices.basic > 0) - Number(left.prices.basic > 0),
      ),
    [memberships, serviceSites],
  );
  const fixedPricingMemberships = useMemo(
    () =>
      memberships
        .filter((membership) =>
          serviceSites.some(
            (service) =>
              service.isFixedPricing &&
              (service.id === membership.serviceSiteId ||
                service.clientId === membership.clientId),
          ),
        )
        .sort(
          (left, right) =>
            Number(right.monthlyPrice > 0) - Number(left.monthlyPrice > 0),
        ),
    [memberships, serviceSites],
  );
  const selectedService = availableServices.find(
    (site) => site.id === selectedServiceId,
  );

  useEffect(() => {
    if (selectedService || availableServices.length === 0) return;

    setSelectedServiceId(availableServices[0].id);
    setSelectedPlan("basic");
  }, [availableServices, selectedService]);

  function applyMembership(membership: ServiceMembership) {
    setMemberships((current) => [
      ...current.filter(
        (item) =>
          item.serviceSiteId !== membership.serviceSiteId &&
          item.clientId !== membership.clientId,
      ),
      membership,
    ]);
  }

  function openPaidPurchase(
    service: ManagedService,
    plan: ServicePlan,
    currentPlan?: ServicePlan,
    allowedPlans?: ServicePlan[],
    currentPlanPrice?: number,
  ) {
    const paymentAmount = Math.max(
      0,
      service.prices[plan] -
        (currentPlanPrice ?? (currentPlan ? service.prices[currentPlan] : 0)),
    );
    const confirmed = window.confirm(
      `${service.name} ${plan.toUpperCase()} 요금제로 변경하면 ${(paymentAmount / 100).toLocaleString("ko-KR")}함포가 사용됩니다. 결제 화면을 여시겠습니까?`,
    );
    if (confirmed) {
      setPurchaseTarget({
        service,
        plan,
        currentPlan,
        currentPlanPrice,
        allowedPlans,
      });
    }
  }

  function addSelectedService() {
    if (!selectedService) return;
    const plan = selectedService.isFixedPricing ? selectedPlan : "basic";
    const currentMembership = memberships.find(
      (item) =>
        item.serviceSiteId === selectedService.id ||
        item.clientId === selectedService.clientId,
    );

    if (
      currentMembership &&
      selectedService.isFixedPricing &&
      selectedService.prices[currentMembership.plan] > 0
    ) {
      setMessage(
        "사용 중인 유료 서비스는 아래 목록의 업그레이드 또는 환불 버튼을 이용해 주세요.",
      );
      return;
    }

    if (currentMembership?.plan === plan) {
      setMessage("이미 선택한 서비스를 이용 중입니다.");
      return;
    }

    if (selectedService.prices[plan] > 0) {
      openPaidPurchase(
        selectedService,
        plan,
        currentMembership?.plan,
        undefined,
        currentMembership?.monthlyPrice,
      );
      return;
    }

    const formData = new FormData();
    formData.set("serviceSiteId", selectedService.id);
    formData.set("plan", plan);
    startTransition(async () => {
      const result = await purchaseServiceMembership(undefined, formData);
      setMessage(result.message ?? "");
      if (result.ok && result.membership) {
        applyMembership(result.membership);
        if (typeof result.balance === "number") {
          setHampoBalance(result.balance);
        }
      }
    });
  }

  function changePlan(membership: ServiceMembership, plan: ServicePlan) {
    if (membership.plan === plan) return;
    const service = serviceSites.find(
      (site) =>
        site.id === membership.serviceSiteId ||
        site.clientId === membership.clientId,
    );
    if (!service) return;

    if (service.prices[plan] > 0) {
      openPaidPurchase(service, plan, membership.plan);
      return;
    }

    const formData = new FormData();
    formData.set("serviceSiteId", service.id);
    formData.set("plan", plan);
    startTransition(async () => {
      const result = await purchaseServiceMembership(undefined, formData);
      setMessage(result.message ?? "");
      if (result.ok && result.membership) applyMembership(result.membership);
    });
  }

  function removeMembership(membership: ServiceMembership) {
    const formData = new FormData();
    formData.set("serviceSiteId", membership.serviceSiteId);
    startTransition(async () => {
      const result = await removeServiceMembership(undefined, formData);
      setMessage(result.message ?? "");
      if (result.ok && result.memberships) {
        setMemberships(result.memberships);
      }
    });
  }

  const handlePurchased = useCallback(
    (membership: ServiceMembership, balance: number) => {
      setMemberships((current) => [
        ...current.filter(
          (item) =>
            item.serviceSiteId !== membership.serviceSiteId &&
            item.clientId !== membership.clientId,
        ),
        membership,
      ]);
      setHampoBalance(balance);
      setMessage("서비스 결제가 완료되었습니다.");
      setPurchaseTarget(null);
    },
    [setHampoBalance],
  );

  const handleRefundRequested = useCallback(
    (nextMemberships: ServiceMembership[], nextMessage: string) => {
      setMemberships(nextMemberships);
      setMessage(nextMessage);
      setRefundTarget(null);
    },
    [],
  );

  return (
    <>
      <section className="space-y-5 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              서비스 변경
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              무료 서비스는 바로 반영되고 부분 유료 서비스는 함포 결제 후 즉시
              추가됩니다.
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-primary">
            {viewerBalance.toLocaleString("ko-KR")}함포
          </p>
        </div>

        {availableServices.length > 0 ? (
          <div className="space-y-3 rounded-3xl border border-primary/20 bg-primary/5 p-4">
            <select
              value={selectedServiceId}
              onChange={(event) => {
                setSelectedServiceId(event.target.value);
                setSelectedPlan("basic");
              }}
              className="w-full cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 text-foreground"
            >
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>

            {selectedService?.isFixedPricing ? (
              <select
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlan(event.target.value as ServicePlan)
                }
                className="w-full cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 text-foreground"
              >
                {(["basic", "standard", "premium"] as const).map((plan) => (
                  <option key={plan} value={plan}>
                    {plan.toUpperCase()} ·{" "}
                    {selectedService.prices[plan].toLocaleString("ko-KR")}원 ·{" "}
                    {(selectedService.prices[plan] / 100).toLocaleString(
                      "ko-KR",
                      { maximumFractionDigits: 2 },
                    )}
                    함포
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={addSelectedService}
              disabled={!selectedService || isPending}
              className="w-full cursor-pointer rounded-2xl border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "처리 중..." : "서비스 추가"}
            </button>
          </div>
        ) : null}

        {message ? (
          <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
            {message}
          </p>
        ) : null}

        <div className="space-y-3">
          {fixedPricingMemberships.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              추가된 서비스가 없습니다.
            </p>
          ) : (
            fixedPricingMemberships.map((membership) => {
              const service = serviceSites.find(
                (site) =>
                  site.id === membership.serviceSiteId ||
                  site.clientId === membership.clientId,
              );
              const canDelete = service
                ? !service.isFixedPricing ||
                  service.prices[membership.plan] === 0
                : membership.monthlyPrice === 0;
              const isPaid = Boolean(
                service?.isFixedPricing &&
                  service.prices[membership.plan] > 0,
              );
              const isRefundPending =
                membership.status === "refund_pending";
              const planOrder: ServicePlan[] = [
                "basic",
                "standard",
                "premium",
              ];
              const higherPlans = service?.isFixedPricing
                ? planOrder.slice(planOrder.indexOf(membership.plan) + 1)
                : [];

              return (
                <div
                  key={`${membership.serviceSiteId}:${membership.clientId}`}
                  className="space-y-3 rounded-3xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {membership.serviceName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {membership.clientId}
                      </p>
                    </div>
                    {canDelete && !isRefundPending ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeMembership(membership)}
                        className="cursor-pointer text-xs font-semibold text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>

                  {isRefundPending ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-800">
                        환불 진행중
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        현재 플랜 {membership.plan.toUpperCase()} · 환불 요청이
                        처리될 때까지 서비스 이용과 변경이 중지됩니다.
                      </p>
                    </div>
                  ) : isPaid ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary/5 px-4 py-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          현재 플랜
                        </span>
                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">
                          {membership.plan}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {higherPlans.length > 0 && service ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPaidPurchase(
                                service,
                                higherPlans[0],
                                membership.plan,
                                higherPlans,
                                membership.monthlyPrice,
                              )
                            }
                            className="cursor-pointer rounded-2xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                          >
                            업그레이드
                          </button>
                        ) : (
                          <span className="rounded-2xl bg-muted px-4 py-2.5 text-center text-sm font-semibold text-muted-foreground">
                            최고 플랜
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setRefundTarget(membership)}
                          className="cursor-pointer rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          환불
                        </button>
                      </div>
                    </div>
                  ) : service?.isFixedPricing ? (
                    <select
                      value={membership.plan}
                      disabled={isPending}
                      onChange={(event) =>
                        changePlan(
                          membership,
                          event.target.value as ServicePlan,
                        )
                      }
                      className="w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-foreground disabled:cursor-not-allowed"
                    >
                      {(["basic", "standard", "premium"] as const).map(
                        (plan) => (
                          <option key={plan} value={plan}>
                            {plan.toUpperCase()} ·{" "}
                            {service.prices[plan].toLocaleString("ko-KR")}원 ·{" "}
                            {(service.prices[plan] / 100).toLocaleString(
                              "ko-KR",
                              { maximumFractionDigits: 2 },
                            )}
                            함포
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-700">
                      정찰제 미사용 · 0함포
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {purchaseTarget ? (
        <ServiceMembershipPurchaseModal
          service={purchaseTarget.service}
          initialPlan={purchaseTarget.plan}
          currentPlan={purchaseTarget.currentPlan}
          currentPlanPrice={purchaseTarget.currentPlanPrice}
          allowedPlans={purchaseTarget.allowedPlans}
          onClose={() => setPurchaseTarget(null)}
          onPurchased={handlePurchased}
        />
      ) : null}

      {refundTarget ? (
        <ServiceRefundRequestModal
          membership={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRequested={handleRefundRequested}
        />
      ) : null}
    </>
  );
}
