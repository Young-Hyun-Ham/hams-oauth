import { NextRequest, NextResponse } from "next/server";

import { exchangeCodeForProfile, isOAuthProvider } from "@/lib/auth/oauth";
import {
  consumeOAuthState,
  createPendingOAuthSignup,
  createSession,
} from "@/lib/auth/session";
import { finalizePendingSSORedirect } from "@/lib/auth/sso";
import { toPublicUser } from "@/lib/auth/types";
import { findOAuthUserByEmail } from "@/lib/store/user-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=invalid_provider", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const isValidState = await consumeOAuthState(provider, state);

  if (!isValidState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  try {
    const profile = await exchangeCodeForProfile(
      provider,
      code,
      state,
      request.nextUrl.origin,
    );

    const existingUser = await findOAuthUserByEmail(profile.provider, profile.email);

    if (existingUser) {
      const sessionUser = toPublicUser(existingUser);
      await createSession(sessionUser);
      const ssoRedirect = await finalizePendingSSORedirect(sessionUser);
      return NextResponse.redirect(
        ssoRedirect ? new URL(ssoRedirect) : new URL("/login", request.url),
      );
    }

    await createPendingOAuthSignup(profile);
    return NextResponse.redirect(new URL("/signup", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}
