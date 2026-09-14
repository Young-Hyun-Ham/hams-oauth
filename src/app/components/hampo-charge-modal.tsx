"use client";

import { HampoChargeModal as SharedHampoChargeModal } from "@hams-fam/sso-client/payments/react";

import { chargeAdminUserHampoFromModal } from "@/app/actions/admin";
import { chargeHampo } from "@/app/actions/auth";
import { isAcceptIncluded } from "@/lib/auth/accept-include";
import { useAuthStore } from "@/lib/store/auth-store";

export function HampoChargeModal({
  onClose,
  onCharged,
  initialAmount = 100,
  targetUser,
}: {
  onClose: () => void;
  onCharged?: (balance: number) => void;
  initialAmount?: number;
  targetUser?: {
    id: string;
    nickname: string;
    email: string;
    hampoBalance: number;
  };
}) {
  const viewer = useAuthStore((store) => store.viewer);
  const setHampoBalance = useAuthStore((store) => store.setHampoBalance);
  const isAdminCharge = Boolean(targetUser);

  return (
    <SharedHampoChargeModal
      currentBalance={
        targetUser?.hampoBalance ?? viewer?.hampoBalance ?? 0
      }
      initialAmount={initialAmount}
      targetUser={targetUser}
      manualChargeAction={
        isAdminCharge
          ? chargeAdminUserHampoFromModal
          : isAcceptIncluded(viewer?.email)
            ? chargeHampo
            : undefined
      }
      payment={
        isAdminCharge
          ? undefined
          : {
              createOrderEndpoint: "/api/payments/toss/orders",
              createOrderBody: (hampoAmount) => ({ hampoAmount }),
              successPath: "/payments/toss/success",
              failPath: "/payments/toss/fail",
              loginReturnUrl: "/login",
            }
      }
      onCharged={(balance) => {
        if (!isAdminCharge) setHampoBalance(balance);
        onCharged?.(balance);
      }}
      onClose={onClose}
    />
  );
}
