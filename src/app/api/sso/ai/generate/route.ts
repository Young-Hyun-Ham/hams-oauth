import { NextResponse } from "next/server";

import {
  readBearerToken,
  verifyServiceAccessToken,
} from "@/lib/auth/service-access-token";
import { AiServiceError, generateUserAiResponse } from "@/lib/ai/service-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const validModel = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const validSchemaName = (value: string) => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);

export async function POST(request: Request) {
  const access = verifyServiceAccessToken(
    readBearerToken(request),
    "ai:generate",
  );
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "invalid_service_access_token" },
      { status: 401 },
    );
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 500_000) {
      return NextResponse.json(
        { ok: false, error: "request_too_large" },
        { status: 413 },
      );
    }
    const body = JSON.parse(raw) as {
      model?: unknown;
      instructions?: unknown;
      prompt?: unknown;
      schemaName?: unknown;
      schema?: unknown;
      maxOutputTokens?: unknown;
      reasoningEffort?: unknown;
    };
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const instructions =
      typeof body.instructions === "string" ? body.instructions.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const schemaName =
      typeof body.schemaName === "string" ? body.schemaName.trim() : "";
    const schema =
      body.schema && typeof body.schema === "object" && !Array.isArray(body.schema)
        ? (body.schema as Record<string, unknown>)
        : null;
    const maxOutputTokens =
      typeof body.maxOutputTokens === "number" &&
      Number.isSafeInteger(body.maxOutputTokens)
        ? body.maxOutputTokens
        : 16_000;
    const reasoningEffort =
      body.reasoningEffort === "low" ||
      body.reasoningEffort === "medium" ||
      body.reasoningEffort === "high"
        ? body.reasoningEffort
        : undefined;

    if (!validModel(model)) {
      return NextResponse.json(
        { ok: false, error: "invalid_model" },
        { status: 400 },
      );
    }
    if (!instructions || instructions.length > 20_000) {
      return NextResponse.json(
        { ok: false, error: "invalid_instructions" },
        { status: 400 },
      );
    }
    if (!prompt || prompt.length > 400_000) {
      return NextResponse.json(
        { ok: false, error: "invalid_prompt" },
        { status: 400 },
      );
    }
    if (!validSchemaName(schemaName) || !schema) {
      return NextResponse.json(
        { ok: false, error: "invalid_schema" },
        { status: 400 },
      );
    }
    if (maxOutputTokens < 1 || maxOutputTokens > 16_000) {
      return NextResponse.json(
        { ok: false, error: "invalid_max_output_tokens" },
        { status: 400 },
      );
    }

    const result = await generateUserAiResponse({
      userId: access.userId,
      model,
      instructions,
      prompt,
      schemaName,
      schema,
      maxOutputTokens,
      reasoningEffort,
    });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const timeout = error instanceof Error && error.name === "TimeoutError";
    if (!timeout) console.error("Failed to generate service AI response", error);
    return NextResponse.json(
      {
        ok: false,
        error: timeout ? "ai_request_timeout" : "ai_generation_failed",
      },
      { status: timeout ? 504 : 500 },
    );
  }
}
