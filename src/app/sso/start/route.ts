import { NextRequest, NextResponse } from "next/server";

import { createPendingSSORequest, getSession } from "@/lib/auth/session";
import { createAuthorizationCodeRedirect, validateStartRequest } from "@/lib/auth/sso";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id")?.trim() ?? "";
  const redirectUri = request.nextUrl.searchParams.get("redirect_uri")?.trim() ?? "";
  const state = request.nextUrl.searchParams.get("state");

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "missing_client_id_or_redirect_uri",
      },
      { status: 400 },
    );
  }

  const validation = await validateStartRequest(clientId, redirectUri);

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
      },
      { status: 400 },
    );
  }

  const session = await getSession();

  if (session?.user) {
    const redirectTo = await createAuthorizationCodeRedirect(
      {
        clientId,
        redirectUri,
        state,
      },
      session.user,
    );

    return NextResponse.redirect(redirectTo);
  }

  await createPendingSSORequest({
    clientId,
    redirectUri,
    state,
  });

  return NextResponse.redirect(new URL("/login", request.url));
}
