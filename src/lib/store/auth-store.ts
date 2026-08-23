"use client";

import { create } from "zustand";

import type { PendingOAuthSignup, SessionUser } from "@/lib/auth/types";

type AuthStoreState = {
  viewer: SessionUser | null;
  pendingOAuthSignup: PendingOAuthSignup | null;
  hydrate: (input: {
    viewer: SessionUser | null;
    pendingOAuthSignup: PendingOAuthSignup | null;
  }) => void;
  clearPendingOAuthSignup: () => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  viewer: null,
  pendingOAuthSignup: null,
  hydrate: ({ viewer, pendingOAuthSignup }) =>
    set({
      viewer,
      pendingOAuthSignup,
    }),
  clearPendingOAuthSignup: () =>
    set({
      pendingOAuthSignup: null,
    }),
}));
