"use client";

import { useId, useState } from "react";

export function ServicePricingFields({
  defaultEnabled = false,
  prices = { basic: 0, standard: 0, premium: 0 },
}: {
  defaultEnabled?: boolean;
  prices?: { basic: number; standard: number; premium: number };
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const inputId = useId();
  const plans = [
    { key: "basicPrice", label: "Basic", value: prices.basic },
    { key: "standardPrice", label: "Standard", value: prices.standard },
    { key: "premiumPrice", label: "Premium", value: prices.premium },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <input type="hidden" name="isFixedPricing__present" value="1" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            가격 정찰제 사용
          </p>
          <p className="mt-1 text-xs text-slate-500">
            활성화하면 Basic, Standard, Premium 월 요금을 설정합니다.
          </p>
        </div>
        <label htmlFor={inputId} className="cursor-pointer">
          <input
            id={inputId}
            name="isFixedPricing"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="sr-only"
          />
          <span
            className={`flex h-8 w-16 items-center rounded-full p-1 transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <span
              className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-8" : "translate-x-0"}`}
            />
          </span>
        </label>
      </div>

      {enabled ? (
        <fieldset className="space-y-3 border-t border-slate-200 pt-4">
          <legend className="sr-only">월 이용 요금</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => (
              <label key={plan.key} className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {plan.label}
                </span>
                <div className="relative">
                  <input
                    name={plan.key}
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={plan.value}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
                    원
                  </span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
