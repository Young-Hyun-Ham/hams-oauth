"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteAccount,
  updateProfile,
  type AuthActionState,
} from "@/app/actions/auth";
import type { AIChatType, AuthUser, ServicePlan } from "@/lib/auth/types";

type ProfileService = {
  id: string;
  clientId: string;
  name: string;
  description: string;
  isFixedPricing: boolean;
  prices: Record<ServicePlan, number>;
};

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from(
  { length: 120 },
  (_, index) => CURRENT_YEAR - index,
);
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

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

function DeleteButton({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-2xl bg-red-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      회원삭제
    </button>
  );
}

function DeleteConfirmSubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || !enabled;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex flex-1 items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "삭제 중..." : "삭제 진행"}
    </button>
  );
}

function Message({
  state,
  successKeyword = "수정",
}: {
  state: AuthActionState | undefined;
  successKeyword?: string;
}) {
  if (!state?.message) {
    return null;
  }

  const className = state.message.includes(successKeyword)
    ? "text-emerald-700"
    : "text-destructive";

  return <p className={`text-sm font-medium ${className}`}>{state.message}</p>;
}

export function ProfileForm({
  user,
  serviceSites,
}: {
  user: AuthUser;
  serviceSites: ProfileService[];
}) {
  const fixedPricingSites = serviceSites.filter((site) => site.isFixedPricing);
  const [state, action] = useActionState(updateProfile, undefined);
  const [deleteState, deleteAction] = useActionState(deleteAccount, undefined);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [birthYear, setBirthYear] = useState(
    user.birthDate?.split("-")[0] ?? "",
  );
  const initialBirthMonth = user.birthDate?.split("-")[1];
  const initialBirthDay = user.birthDate?.split("-")[2];
  const [birthMonth, setBirthMonth] = useState(
    initialBirthMonth ? String(Number(initialBirthMonth)) : "",
  );
  const [birthDay, setBirthDay] = useState(
    initialBirthDay ? String(Number(initialBirthDay)) : "",
  );
  const [memberships, setMemberships] = useState(user.serviceMemberships);
  const [selectedServiceId, setSelectedServiceId] = useState(
    fixedPricingSites[0]?.id ?? "",
  );
  const [selectedPlan, setSelectedPlan] = useState<ServicePlan>("basic");
  const [aiEnabled, setAIEnabled] = useState(user.aiEnabled);
  const [aiChatType, setAIChatType] = useState<AIChatType | "">(
    user.aiChatType ?? "",
  );
  const [apiKey, setApiKey] = useState(user.apiKey ?? "");
  const [chatModel, setChatModel] = useState(user.chatModel ?? "");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelMessage, setModelMessage] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoginIdInput, setDeleteLoginIdInput] = useState("");
  const modelListId = useId();
  const birthDays = useMemo(() => {
    const year = Number(birthYear);
    const month = Number(birthMonth);
    if (
      !Number.isInteger(year) ||
      year < 1 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    )
      return [];
    return Array.from(
      { length: new Date(Date.UTC(year, month, 0)).getUTCDate() },
      (_, index) => index + 1,
    );
  }, [birthMonth, birthYear]);

  useEffect(() => {
    setPhoneNumber(user.phoneNumber);
    const [year = "", month = "", day = ""] = user.birthDate?.split("-") ?? [];
    setBirthYear(year);
    setBirthMonth(month ? String(Number(month)) : "");
    setBirthDay(day ? String(Number(day)) : "");
    setMemberships(user.serviceMemberships);
    setAIEnabled(user.aiEnabled);
    setAIChatType(user.aiChatType ?? "");
    setApiKey(user.apiKey ?? "");
    setChatModel(user.chatModel ?? "");
  }, [user]);

  useEffect(() => {
    if (birthDay && !birthDays.includes(Number(birthDay))) setBirthDay("");
  }, [birthDay, birthDays]);

  function addServiceMembership() {
    const site = fixedPricingSites.find(
      (item) => item.id === selectedServiceId,
    );
    if (!site) return;
    const plan = site.isFixedPricing ? selectedPlan : "basic";
    setMemberships((current) => [
      ...current.filter(
        (item) =>
          item.serviceSiteId !== site.id && item.clientId !== site.clientId,
      ),
      {
        serviceSiteId: site.id,
        clientId: site.clientId,
        serviceName: site.name,
        plan,
        monthlyPrice: site.isFixedPricing ? site.prices[plan] : 0,
        joinedAt:
          current.find((item) => item.serviceSiteId === site.id)?.joinedAt ??
          new Date().toISOString(),
      },
    ]);
  }

  useEffect(() => {
    if (!aiEnabled) {
      setModels([]);
      setModelMessage("");
      return;
    }

    if (!aiChatType || !apiKey.trim()) {
      setModels([]);
      setModelMessage(
        aiChatType ? "API KEY를 입력하면 모델 목록을 조회합니다." : "",
      );
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
          error instanceof Error
            ? error.message
            : "모델 목록 조회 중 오류가 발생했습니다.",
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

  useEffect(() => {
    if (deleteState?.message) {
      setIsDeleteModalOpen(true);
    }
  }, [deleteState]);

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

  function openDeleteModal() {
    setDeleteLoginIdInput("");
    setIsDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteLoginIdInput("");
    setIsDeleteModalOpen(false);
  }

  const isDeleteConfirmed = deleteLoginIdInput.trim() === user.loginId;

  return (
    <>
      <form
        action={action}
        className="space-y-5 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            회원정보 수정
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            기본 회원정보와 개인 AI 채팅 설정을 직접 관리할 수 있습니다.
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
            value={user.loginId}
            disabled
            aria-disabled="true"
            className="w-full cursor-not-allowed rounded-2xl border border-border bg-muted/40 px-4 py-3 text-foreground opacity-80 outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              새 비밀번호
            </span>
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="변경할 때만 8자 이상 입력"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              새 비밀번호 확인
            </span>
            <input
              name="passwordConfirm"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="새 비밀번호 다시 입력"
            />
          </label>
        </div>

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
            onChange={(event) =>
              setPhoneNumber(event.target.value.replace(/\D/g, ""))
            }
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="숫자만 입력"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            생년월일
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <input
              name="birthYear"
              list="profile-birth-years"
              inputMode="numeric"
              maxLength={4}
              required
              value={birthYear}
              onChange={(event) =>
                setBirthYear(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none focus:border-primary"
              placeholder="YYYY"
            />
            <datalist id="profile-birth-years">
              {BIRTH_YEARS.map((year) => (
                <option key={year} value={year} />
              ))}
            </datalist>
            <input
              name="birthMonth"
              list="profile-birth-months"
              inputMode="numeric"
              maxLength={2}
              required
              value={birthMonth}
              onChange={(event) =>
                setBirthMonth(event.target.value.replace(/\D/g, "").slice(0, 2))
              }
              className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none focus:border-primary"
              placeholder="MM"
            />
            <datalist id="profile-birth-months">
              {BIRTH_MONTHS.map((month) => (
                <option key={month} value={month} />
              ))}
            </datalist>
            <input
              name="birthDay"
              list="profile-birth-days"
              inputMode="numeric"
              maxLength={2}
              required
              disabled={!birthDays.length}
              value={birthDay}
              onChange={(event) =>
                setBirthDay(event.target.value.replace(/\D/g, "").slice(0, 2))
              }
              className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none focus:border-primary disabled:bg-muted/40"
              placeholder="DD"
            />
            <datalist id="profile-birth-days">
              {birthDays.map((day) => (
                <option key={day} value={day} />
              ))}
            </datalist>
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">성별</span>
          <select
            name="gender"
            required
            defaultValue={user.gender ?? ""}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
          >
            <option value="" disabled>
              선택해 주세요.
            </option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
            <option value="prefer_not_to_say">응답하지 않음</option>
          </select>
        </label>

        <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/5 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              서비스사이트 추가
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              서비스와 이용 타입을 선택한 후 추가해 주세요.
            </p>
          </div>
          <input
            type="hidden"
            name="serviceMemberships"
            value={JSON.stringify(
              memberships.map((item) => ({
                serviceSiteId: item.serviceSiteId,
                plan: item.plan,
              })),
            )}
          />
          <select
            value={selectedServiceId}
            onChange={(event) => {
              setSelectedServiceId(event.target.value);
              setSelectedPlan("basic");
            }}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground"
          >
            {fixedPricingSites.length === 0 ? (
              <option value="">
                추가 가능한 가격정찰제 서비스가 없습니다.
              </option>
            ) : null}
            {fixedPricingSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          {fixedPricingSites.find((site) => site.id === selectedServiceId) ? (
            <select
              value={selectedPlan}
              onChange={(event) =>
                setSelectedPlan(event.target.value as ServicePlan)
              }
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground"
            >
              {(["basic", "standard", "premium"] as const).map((plan) => {
                const site = fixedPricingSites.find(
                  (item) => item.id === selectedServiceId,
                )!;
                return (
                  <option key={plan} value={plan}>
                    {plan.toUpperCase()} ·{" "}
                    {site.prices[plan].toLocaleString("ko-KR")}원
                  </option>
                );
              })}
            </select>
          ) : null}
          <button
            type="button"
            onClick={addServiceMembership}
            disabled={!selectedServiceId}
            className="w-full rounded-2xl border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50"
          >
            서비스 추가
          </button>
          <div className="space-y-2">
            {memberships.map((item) => (
              <div
                key={item.serviceSiteId}
                className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {item.serviceName}
                </span>
                <span className="font-semibold uppercase text-primary">
                  {item.plan}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                AI 사용 여부
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                개인 AI 채팅 기능 사용 여부를 선택합니다.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                name="aiEnabled"
                type="checkbox"
                checked={aiEnabled}
                onChange={(event) =>
                  handleAIEnabledChange(event.target.checked)
                }
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
              <h3 className="text-sm font-semibold text-foreground">
                AI Chat Settings
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Hams 서비스 사이트에서 AI 채팅 기능을 사용하기 위한 설정입니다.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                선택한 provider와 API KEY로 모델 목록을 조회합니다.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                AI Chat type
              </span>
              <select
                name="aiChatType"
                value={aiChatType}
                onChange={(event) =>
                  setAIChatType(event.target.value as AIChatType | "")
                }
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                <option value="">선택하세요</option>
                {AI_CHAT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                API KEY
              </span>
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
              <span className="text-sm font-medium text-foreground">
                Chat Model
              </span>
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
                      ? "직접 입력하거나 API KEY 입력 후 자동완성을 사용해 주세요."
                      : "모델명을 검색하거나 선택해 주세요."
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
                {isLoadingModels
                  ? "모델 목록을 불러오는 중입니다."
                  : modelMessage}
              </p>
            </label>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          가입 방식은{" "}
          <span className="font-semibold text-foreground">{user.provider}</span>
          이고 이메일은 로그인 연동 유지를 위해 읽기 전용입니다.
        </div>

        <Message state={state} />

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SubmitButton />
            <DeleteButton onClick={openDeleteModal} />
          </div>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50"
          >
            돌아가기
          </Link>
        </div>
      </form>

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                회원삭제 확인
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                계정을 삭제하면 회원정보를 복구할 수 없습니다. 정말
                삭제하시겠습니까?
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                삭제를 진행하려면 회원 ID{" "}
                <span className="font-semibold text-foreground">
                  {user.loginId}
                </span>{" "}
                를 정확히 입력해 주세요.
              </p>
            </div>

            <div className="mt-4">
              <Message state={deleteState} successKeyword="삭제" />
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-foreground">
                회원 ID 확인
              </span>
              <input
                type="text"
                value={deleteLoginIdInput}
                onChange={(event) => setDeleteLoginIdInput(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                placeholder="회원 ID를 입력하세요"
                autoComplete="off"
              />
            </label>

            <form
              action={deleteAction}
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <button
                type="button"
                onClick={closeDeleteModal}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
              >
                취소
              </button>
              <DeleteConfirmSubmitButton enabled={isDeleteConfirmed} />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
