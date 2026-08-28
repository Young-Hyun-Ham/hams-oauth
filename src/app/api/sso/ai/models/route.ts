import { NextResponse } from "next/server";

import {
  readBearerToken,
  verifyActiveServiceAccessToken,
} from "@/lib/auth/service-access-token";
import { AiServiceError, listUserAiModels } from "@/lib/ai/service-ai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await verifyActiveServiceAccessToken(
    readBearerToken(request),
    "ai:models",
  );
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "invalid_service_access_token" },
      { status: 401 },
    );
  }

  try {
    const result = await listUserAiModels(access.userId);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to load service AI models", error);
    return NextResponse.json(
      { ok: false, error: "ai_model_list_failed" },
      { status: 500 },
    );
  }
}
