"use client";

import { create } from "zustand";

import type { PendingOAuthSignup, PublicUser } from "@/lib/auth/types";

type AuthStoreState = {
  viewer: PublicUser | null;
  pendingOAuthSignup: PendingOAuthSignup | null;
  hydrate: (input: {
    viewer: PublicUser | null;
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
