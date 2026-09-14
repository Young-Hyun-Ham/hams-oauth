import { NextResponse } from "next/server";

import {
  readBearerToken,
  verifyActiveServiceToken,
} from "@/lib/auth/service-access-token";
import { consumeUserHampo } from "@/lib/store/user-store";
import { verifySsoClientCredentials } from "@/lib/auth/sso";

export const runtime = "nodejs";

const validText = (value: string, maxLength: number) =>
  value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f]/.test(value);

export async function POST(request: Request) {
  let access = await verifyActiveServiceToken(readBearerToken(request));
  if (!access) {
    const clientId = request.headers.get("x-hams-client-id")?.trim() ?? "";
    const clientSecret =
      request.headers.get("x-hams-client-secret")?.trim() ?? "";
    const userId = request.headers.get("x-hams-user-id")?.trim() ?? "";
    if (
      userId &&
      (await verifySsoClientCredentials(clientId, clientSecret))
    ) {
      access = {
        version: 1,
        audience: "hams-sso-service",
        clientId,
        userId,
        scopes: ["hampo:consume"],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
    }
  }
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "invalid_service_access_token" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const amount = Number(body.amount);
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const referenceId =
      typeof body.referenceId === "string" ? body.referenceId.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > 1000 ||
      !validText(source, 80) ||
      !validText(referenceId, 160) ||
      !validText(description, 200)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_hampo_usage" },
        { status: 400 },
      );
    }

    const result = await consumeUserHampo({
      userId: access.userId,
      clientId: access.clientId,
      amount,
      source,
      referenceId,
      description,
    });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "hampo_consume_failed";
    if (code === "insufficient_hampo") {
      return NextResponse.json(
        { ok: false, error: code, balance: 0 },
        { status: 402 },
      );
    }
    if (code === "user_not_found" || code === "service_membership_required") {
      return NextResponse.json({ ok: false, error: code }, { status: 403 });
    }
    if (code === "hampo_reference_conflict") {
      return NextResponse.json({ ok: false, error: code }, { status: 409 });
    }
    console.error("Failed to consume service hampo", error);
    return NextResponse.json(
      { ok: false, error: "hampo_consume_failed" },
      { status: 500 },
    );
  }
}
