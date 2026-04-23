"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateProfile, type AuthActionState } from "@/app/actions/auth";
import type { AIChatType, AuthUser } from "@/lib/auth/types";

type ModelOption = {
  id: string;
  label: string;
};

const AI_CHAT_TYPE_OPTIONS: Array<{ value: AIChatType; label: string }> = [
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "저장 중..." : "회원정보 저장"}
    </button>
  );
}

function Message({ state }: { state: AuthActionState | undefined }) {
  if (!state?.message) {
    return null;
  }

  const className = state.message.includes("수정되었습니다")
    ? "text-emerald-700"
    : "text-destructive";

  return <p className={`text-sm font-medium ${className}`}>{state.message}</p>;
}

export function ProfileForm({ user }: { user: AuthUser }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [aiEnabled, setAIEnabled] = useState(user.aiEnabled);
  const [aiChatType, setAIChatType] = useState<AIChatType | "">(user.aiChatType ?? "");
  const [apiKey, setApiKey] = useState(user.apiKey ?? "");
  const [chatModel, setChatModel] = useState(user.chatModel ?? "");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelMessage, setModelMessage] = useState("");
  const modelListId = useId();

  useEffect(() => {
    setPhoneNumber(user.phoneNumber);
    setAIEnabled(user.aiEnabled);
    setAIChatType(user.aiChatType ?? "");
    setApiKey(user.apiKey ?? "");
    setChatModel(user.chatModel ?? "");
  }, [user]);

  useEffect(() => {
    if (!aiEnabled) {
      setModels([]);
      setModelMessage("");
      return;
    }

    if (!aiChatType || !apiKey.trim()) {
      setModels([]);
      setModelMessage(aiChatType ? "API KEY를 입력하면 모델을 조회합니다." : "");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingModels(true);
      setModelMessage("모델 목록을 불러오는 중입니다.");

      try {
        const response = await fetch("/api/ai/models", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: aiChatType,
            apiKey,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          models?: ModelOption[];
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "모델 목록 조회에 실패했습니다.");
        }

        setModels(payload.models ?? []);
        setModelMessage(
          (payload.models?.length ?? 0) > 0
            ? `모델 ${payload.models?.length ?? 0}개를 불러왔습니다.`
            : "사용 가능한 모델을 찾지 못했습니다.",
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setModels([]);
        setModelMessage(
          error instanceof Error ? error.message : "모델 목록 조회 중 오류가 발생했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingModels(false);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [aiEnabled, aiChatType, apiKey]);

  function handleAIEnabledChange(checked: boolean) {
    setAIEnabled(checked);

    if (!checked) {
      setAIChatType("");
      setApiKey("");
      setChatModel("");
      setModels([]);
      setModelMessage("");
    }
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7"
    >
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">회원정보 수정</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          기본 회원정보와 개인 AI 채팅 설정을 함께 관리할 수 있습니다.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">이메일</span>
        <input
          type="email"
          value={user.email}
          readOnly
          aria-readonly="true"
          className="w-full rounded-2xl border border-border bg-muted/40 px-4 py-3 text-foreground opacity-80 outline-none"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">로그인 ID</span>
        <input
          name="loginId"
          required
          minLength={4}
          defaultValue={user.loginId}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">닉네임</span>
        <input
          name="nickname"
          required
          minLength={2}
          defaultValue={user.nickname}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">전화번호</span>
        <input
          name="phoneNumber"
          required
          inputMode="numeric"
          pattern="[0-9]*"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, ""))}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          placeholder="숫자만 입력"
        />
      </label>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI 사용 여부</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              개인 AI 채팅 기능을 사용할지 선택합니다.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center">
            <input
              name="aiEnabled"
              type="checkbox"
              checked={aiEnabled}
              onChange={(event) => handleAIEnabledChange(event.target.checked)}
              className="peer sr-only"
            />
            <span
              className={`flex h-8 w-16 items-center rounded-full p-1 transition ${
                aiEnabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${
                  aiEnabled ? "translate-x-8" : "translate-x-0"
                }`}
              />
            </span>
          </label>
        </div>
      </div>

      {aiEnabled ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Chat Settings</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Hams 서비스 사이트에서 AI 채팅 기능을 사용하기 위한 설정입니다.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              선택한 provider와 API KEY를 사용해 모델 목록을 조회합니다.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">AI Chat type</span>
            <select
              name="aiChatType"
              value={aiChatType}
              onChange={(event) => setAIChatType(event.target.value as AIChatType | "")}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">선택 안 함</option>
              {AI_CHAT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">API KEY</span>
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="API KEY 입력"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Chat Model</span>
            <input
              name="chatModel"
              list={modelListId}
              value={chatModel}
              onChange={(event) => setChatModel(event.target.value)}
              disabled={!aiChatType}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/40"
              placeholder={
                !aiChatType
                  ? "먼저 AI Chat type을 선택해 주세요."
                  : !apiKey.trim()
                    ? "직접 입력하거나 API KEY 입력 후 자동완성을 사용하세요."
                    : "모델명을 검색하거나 선택하세요."
              }
            />
            <datalist id={modelListId}>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              {isLoadingModels ? "모델 목록을 불러오는 중입니다." : modelMessage}
            </p>
          </label>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        가입 방식은 <span className="font-semibold text-foreground">{user.provider}</span>
        이며 이메일은 로그인 연동 안정성을 위해 읽기 전용입니다.
      </div>

      <Message state={state} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton />
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50"
        >
          돌아가기
        </Link>
      </div>
    </form>
  );
}
