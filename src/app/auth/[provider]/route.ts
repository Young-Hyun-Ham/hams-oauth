import { NextRequest, NextResponse } from "next/server";

import { getOAuthAuthorizationUrl, isOAuthProvider } from "@/lib/auth/oauth";
import { createOAuthState } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=invalid_provider", request.url));
  }

  const state = await createOAuthState(provider);
  const authUrl = getOAuthAuthorizationUrl(provider, request.nextUrl.origin, state);

  return NextResponse.redirect(authUrl);
}
