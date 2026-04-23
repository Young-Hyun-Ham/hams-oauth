import { NextResponse } from "next/server";

import type { AIChatType } from "@/lib/auth/types";

type ModelOption = {
  id: string;
  label: string;
};

function normalizeProvider(value: unknown): AIChatType | null {
  return value === "gpt" || value === "gemini" || value === "claude" ? value : null;
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OpenAI 모델 목록을 가져오지 못했습니다.");
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  return (payload.data ?? [])
    .map((model) => model.id?.trim() ?? "")
    .filter((id) => id.startsWith("gpt") || id.startsWith("o"))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id }));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Gemini 모델 목록을 가져오지 못했습니다.");
  }

  const payload = (await response.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };

  return (payload.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => {
      const id = (model.name ?? "").replace(/^models\//, "").trim();
      const label = model.displayName?.trim() || id;
      return { id, label };
    })
    .filter((model) => model.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchClaudeModels(apiKey: string): Promise<ModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Claude 모델 목록을 가져오지 못했습니다.");
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
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchModels(provider: AIChatType, apiKey: string) {
  switch (provider) {
    case "gpt":
      return fetchOpenAIModels(apiKey);
    case "gemini":
      return fetchGeminiModels(apiKey);
    case "claude":
      return fetchClaudeModels(apiKey);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      provider?: string;
      apiKey?: string;
    };
    const provider = normalizeProvider(payload.provider);
    const apiKey = payload.apiKey?.trim() ?? "";

    if (!provider) {
      return NextResponse.json({ message: "AI Chat type을 선택해 주세요." }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ message: "API KEY를 입력해 주세요." }, { status: 400 });
    }

    const models = await fetchModels(provider, apiKey);

    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "모델 목록 조회 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
