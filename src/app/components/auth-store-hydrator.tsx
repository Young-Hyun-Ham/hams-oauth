"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/lib/store/auth-store";
import type { PendingOAuthSignup, SessionUser } from "@/lib/auth/types";

export function AuthStoreHydrator({
  viewer,
  pendingOAuthSignup,
}: {
  viewer: SessionUser | null;
  pendingOAuthSignup: PendingOAuthSignup | null;
}) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate({
      viewer,
      pendingOAuthSignup,
    });
  }, [hydrate, pendingOAuthSignup, viewer]);

  return null;
}
