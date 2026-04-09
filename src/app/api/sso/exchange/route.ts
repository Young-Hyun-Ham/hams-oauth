import { NextRequest, NextResponse } from "next/server";

import { exchangeAuthorizationCode } from "@/lib/auth/sso";

type ExchangeRequestBody = {
  client_id?: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ExchangeRequestBody | null;
  const clientId = body?.client_id?.trim() ?? "";
  const clientSecret = body?.client_secret?.trim() ?? "";
  const code = body?.code?.trim() ?? "";
  const redirectUri = body?.redirect_uri?.trim() ?? "";

  if (!clientId || !clientSecret || !code || !redirectUri) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_required_fields",
      },
      { status: 400 },
    );
  }

  const result = await exchangeAuthorizationCode({
    clientId,
    clientSecret,
    code,
    redirectUri,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    user: result.user,
  });
}
