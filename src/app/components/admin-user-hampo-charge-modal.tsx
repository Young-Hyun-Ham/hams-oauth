"use client";

import { useRouter } from "next/navigation";

import { HampoChargeModal } from "@/app/components/hampo-charge-modal";

export function AdminUserHampoChargeModal({
  user,
  closeHref,
}: {
  user: {
    id: string;
    nickname: string;
    email: string;
    hampoBalance: number;
  };
  closeHref: string;
}) {
  const router = useRouter();

  return (
    <HampoChargeModal
      targetUser={user}
      onCharged={() => router.refresh()}
      onClose={() => router.replace(closeHref, { scroll: false })}
    />
  );
}
