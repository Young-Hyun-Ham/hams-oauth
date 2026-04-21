import { NextRequest, NextResponse } from "next/server";

import { clearSession, createPostLoginRedirect } from "@/lib/auth/session";
import { consumeServiceLogoutToken } from "@/lib/auth/sso";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("sso_logout_token");
  const logoutRequest = await consumeServiceLogoutToken(token);

  if (logoutRequest?.logout) {
    await clearSession();
    await createPostLoginRedirect(logoutRequest.loginStartUrl);
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
