"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useFormStatus } from "react-dom";

import {
  purchaseServiceMembership,
  type ServiceMembershipPurchaseState,
} from "@/app/actions/auth";
import { HampoChargeModal } from "@/app/components/hampo-charge-modal";
import type { ServiceMembership, ServicePlan } from "@/lib/auth/types";
import { useAuthStore } from "@/lib/store/auth-store";

type PurchaseService = {
  id: string;
  name: string;
  prices: Record<ServicePlan, number>;
};

function PurchaseSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full cursor-pointer rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "서비스 추가 중..." : "결제하고 서비스 추가"}
    </button>
  );
}

export function ServiceMembershipPurchaseModal({
  service,
  initialPlan,
  currentPlan,
  currentPlanPrice,
  allowedPlans = ["basic", "standard", "premium"],
  onClose,
  onPurchased,
}: {
  service: PurchaseService;
  initialPlan: ServicePlan;
  currentPlan?: ServicePlan;
  currentPlanPrice?: number;
  allowedPlans?: ServicePlan[];
  onClose: () => void;
  onPurchased: (membership: ServiceMembership, balance: number) => void;
}) {
  const [state, action] = useActionState<
    ServiceMembershipPurchaseState | undefined,
    FormData
  >(purchaseServiceMembership, undefined);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState(0);
  const balance = useAuthStore(
    (store) => store.viewer?.hampoBalance ?? 0,
  );
  const setHampoBalance = useAuthStore((store) => store.setHampoBalance);
  const formRef = useRef<HTMLFormElement>(null);
  const chargedBalanceRef = useRef<number | null>(null);
  const handledStateRef = useRef<
    ServiceMembershipPurchaseState | undefined
  >(undefined);
  const paymentAmount = service.prices[selectedPlan];
  const currentPlanAmount =
    currentPlanPrice ?? (currentPlan ? service.prices[currentPlan] : 0);
  const requiredHampo =
    currentPlan === selectedPlan
      ? 0
      : Math.max(0, paymentAmount - currentPlanAmount) / 100;

  useEffect(() => {
    if (!state || handledStateRef.current === state) return;
    handledStateRef.current = state;

    if (state?.ok && state.membership && typeof state.balance === "number") {
      setHampoBalance(state.balance);
      onPurchased(state.membership, state.balance);
      return;
    }

    if (state?.code === "insufficient_hampo") {
      const currentBalance = state.balance ?? balance;
      setChargeAmount(
        Math.min(
          1_000_000,
          Math.max(1, Math.ceil((state.requiredHampo ?? requiredHampo) - currentBalance)),
        ),
      );
      setIsChargeModalOpen(true);
    }
  }, [balance, onPurchased, requiredHampo, setHampoBalance, state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const availableBalance = chargedBalanceRef.current ?? balance;

    if (requiredHampo <= availableBalance) return;

    event.preventDefault();
    setChargeAmount(
      Math.min(1_000_000, Math.ceil(requiredHampo - availableBalance)),
    );
    setIsChargeModalOpen(true);
  }

  const handleCharged = useCallback((nextBalance: number) => {
    chargedBalanceRef.current = nextBalance;
    setIsChargeModalOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-background p-6 shadow-2xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            SERVICE PAYMENT
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground">
            {service.name} 추가
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            요금제를 선택하고 함포로 결제하면 회원정보 저장과 별개로 서비스가
            즉시 추가됩니다.
          </p>
        </div>

        <form
          ref={formRef}
          action={action}
          onSubmit={handleSubmit}
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="serviceSiteId" value={service.id} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">요금제</span>
            <select
              name="plan"
              value={selectedPlan}
              onChange={(event) => {
                chargedBalanceRef.current = null;
                setSelectedPlan(event.target.value as ServicePlan);
              }}
              className="w-full cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
            >
              {allowedPlans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan.toUpperCase()} ·{" "}
                  {service.prices[plan].toLocaleString("ko-KR")}원 ·{" "}
                  {(service.prices[plan] / 100).toLocaleString("ko-KR", {
                    maximumFractionDigits: 2,
                  })}
                  함포
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
            <div>
              <p className="text-muted-foreground">사용 함포</p>
              <p className="mt-1 font-semibold text-foreground">
                {requiredHampo.toLocaleString("ko-KR")}함포
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">현재 보유</p>
              <p className="mt-1 font-semibold text-foreground">
                {balance.toLocaleString("ko-KR")}함포
              </p>
            </div>
          </div>

          {state?.message ? (
            <p
              className={`text-sm font-medium ${state.ok ? "text-emerald-700" : "text-destructive"}`}
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <PurchaseSubmitButton />
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
            >
              취소
            </button>
          </div>
        </form>
      </div>

      {isChargeModalOpen ? (
        <HampoChargeModal
          initialAmount={chargeAmount}
          onCharged={handleCharged}
          onClose={() => setIsChargeModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
