import "server-only";

import type { AIChatType } from "@/lib/auth/types";
import { findUserById } from "@/lib/store/user-store";

type ModelOption = {
  id: string;
  label: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: {
    content?: { type?: string; text?: string }[];
  }[];
};

type OpenAIErrorResponse = {
  error?: { message?: unknown };
};

export class AiServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function requireAiCredential(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new AiServiceError(404, "user_not_found", "사용자를 찾을 수 없습니다.");
  }
  if (!user.aiEnabled) {
    throw new AiServiceError(
      403,
      "ai_disabled",
      "사용자 프로필에서 AI 사용을 활성화해주세요.",
    );
  }
  if (!user.aiChatType || !user.apiKey) {
    throw new AiServiceError(
      422,
      "ai_configuration_missing",
      "사용자 프로필에 AI 제공자와 API Key를 등록해주세요.",
    );
  }

  return {
    provider: user.aiChatType,
    apiKey: user.apiKey,
    defaultModel: user.chatModel,
  };
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new AiServiceError(
      response.status === 401 ? 401 : 502,
      "openai_model_list_failed",
      "OpenAI 모델 목록을 가져오지 못했습니다.",
    );
  }
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? [])
    .map((model) => model.id?.trim() ?? "")
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left, "en", { numeric: true }))
    .map((id) => ({ id, label: id }));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store", signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) {
    throw new AiServiceError(
      response.status === 400 || response.status === 403 ? 401 : 502,
      "gemini_model_list_failed",
      "Gemini 모델 목록을 가져오지 못했습니다.",
    );
  }
  const payload = (await response.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  return (payload.models ?? [])
    .filter((model) =>
      model.supportedGenerationMethods?.includes("generateContent"),
    )
    .map((model) => {
      const id = (model.name ?? "").replace(/^models\//, "").trim();
      return { id, label: model.displayName?.trim() || id };
    })
    .filter((model) => model.id)
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function fetchClaudeModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new AiServiceError(
      response.status === 401 ? 401 : 502,
      "claude_model_list_failed",
      "Claude 모델 목록을 가져오지 못했습니다.",
    );
  }
  const payload = (await response.json()) as {
    data?: Array<{ id?: string; display_name?: string }>;
  };
  return (payload.data ?? [])
    .map((model) => ({
      id: model.id?.trim() ?? "",
      label: model.display_name?.trim() || model.id?.trim() || "",
    }))
    .filter((model) => model.id)
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function listModels(provider: AIChatType, apiKey: string) {
  switch (provider) {
    case "gpt":
      return fetchOpenAIModels(apiKey);
    case "gemini":
      return fetchGeminiModels(apiKey);
    case "claude":
      return fetchClaudeModels(apiKey);
  }
}

export async function listUserAiModels(userId: string) {
  const credential = await requireAiCredential(userId);
  const providerModels = await listModels(credential.provider, credential.apiKey);
  const savedModel = credential.defaultModel?.trim() || null;
  const models =
    savedModel && !providerModels.some((model) => model.id === savedModel)
      ? [{ id: savedModel, label: savedModel }, ...providerModels]
      : providerModels;
  const defaultModel = savedModel ?? models[0]?.id ?? null;

  return {
    provider: credential.provider,
    defaultModel,
    models,
  };
}

function responseText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("");
}

export async function generateUserAiResponse(input: {
  userId: string;
  model: string;
  instructions: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  reasoningEffort?: "low" | "medium" | "high";
}) {
  const credential = await requireAiCredential(input.userId);
  if (credential.provider !== "gpt") {
    throw new AiServiceError(
      400,
      "provider_not_supported_for_structured_generation",
      "화면 생성 프록시는 현재 GPT 제공자만 지원합니다.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential.apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      model: input.model,
      store: false,
      ...(input.model.startsWith("gpt-5")
        ? { reasoning: { effort: input.reasoningEffort ?? "medium" } }
        : {}),
      max_output_tokens: input.maxOutputTokens,
      instructions: input.instructions,
      input: input.prompt,
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
        ...(input.model.startsWith("gpt-5") ? { verbosity: "low" } : {}),
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as OpenAIErrorResponse;
    const detail =
      typeof payload.error?.message === "string"
        ? payload.error.message.trim()
        : "";
    throw new AiServiceError(
      response.status === 401 || response.status === 403
        ? response.status
        : response.status === 429
          ? 429
          : 502,
      "openai_generation_failed",
      detail || "OpenAI에서 화면 생성 결과를 받지 못했습니다.",
    );
  }

  const payload = (await response.json()) as OpenAIResponse;
  const output = responseText(payload);
  if (!output) {
    throw new AiServiceError(
      502,
      "empty_ai_response",
      "AI가 화면 생성 결과를 반환하지 않았습니다.",
    );
  }

  return {
    provider: credential.provider,
    model: input.model,
    output,
  };
}
