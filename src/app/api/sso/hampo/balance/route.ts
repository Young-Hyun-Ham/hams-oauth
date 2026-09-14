import { NextResponse } from "next/server";

import {
  readBearerToken,
  verifyActiveServiceToken,
} from "@/lib/auth/service-access-token";
import { findUserById } from "@/lib/store/user-store";
import { verifySsoClientCredentials } from "@/lib/auth/sso";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await verifyActiveServiceToken(readBearerToken(request));
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "invalid_service_access_token" },
      { status: 401 },
    );
  }
  const user = await findUserById(access.userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, hampoBalance: user.hampoBalance },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const clientId = request.headers.get("x-hams-client-id")?.trim() ?? "";
  const clientSecret = request.headers.get("x-hams-client-secret")?.trim() ?? "";
  if (!(await verifySsoClientCredentials(clientId, clientSecret))) {
    return NextResponse.json(
      { ok: false, error: "invalid_client_credentials" },
      { status: 401 },
    );
  }
  const body = (await request.json()) as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const user = userId ? await findUserById(userId) : null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }
  const membership = user.serviceMemberships.find(
    (item) => item.clientId === clientId,
  );
  if (membership?.status === "refund_pending") {
    return NextResponse.json(
      { ok: false, error: "service_refund_pending" },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { ok: true, hampoBalance: user.hampoBalance },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
