"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearPendingOAuthSignup,
  clearSession,
  consumePostLoginRedirect,
  createSession,
  getSession,
  getPendingOAuthSignup,
} from "@/lib/auth/session";
import { finalizePendingSSORedirect } from "@/lib/auth/sso";
import { toPublicUser, type AIChatType } from "@/lib/auth/types";
import { getCurrentTermsDocument } from "@/lib/store/admin-terms-store";
import {
  createUser,
  findPasswordUserByIdentifier,
  findUserById,
  updateUserProfile,
} from "@/lib/store/user-store";

export type AuthActionState = {
  message?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeAIChatType(value: string): AIChatType | null {
  return value === "gpt" || value === "gemini" || value === "claude" ? value : null;
}

function validateAndHashPassword(email: string, password: string) {
  if (!email.includes("@")) {
    throw new Error("유효한 이메일을 입력해 주세요.");
  }

  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }

  return hashPassword(password);
}

async function finishLogin(user: ReturnType<typeof toPublicUser>): Promise<never> {
  await createSession(user);
  const ssoRedirect = await finalizePendingSSORedirect(user);
  const postLoginRedirect = await consumePostLoginRedirect();
  revalidatePath("/");
  redirect(ssoRedirect ?? postLoginRedirect ?? "/");
}

export async function login(
  _state: AuthActionState | undefined,
  formData: FormData,
): Promise<AuthActionState> {
  const identifier = readString(formData, "identifier");
  const password = readString(formData, "password");

  if (!identifier || !password) {
    return { message: "로그인 ID 또는 이메일과 비밀번호를 입력해 주세요." };
  }

  const user = await findPasswordUserByIdentifier(identifier);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { message: "로그인 정보가 올바르지 않습니다." };
  }

  await clearPendingOAuthSignup();
  return finishLogin(toPublicUser(user));
}

export async function signup(
  _state: AuthActionState | undefined,
  formData: FormData,
): Promise<AuthActionState> {
  const loginId = readString(formData, "loginId");
  const nickname = readString(formData, "nickname");
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const phoneNumber = normalizePhoneNumber(readString(formData, "phoneNumber"));
  const hasAcceptedTerms = formData.get("termsAccepted") === "on";
  const pendingOAuthSignup = await getPendingOAuthSignup();
  const currentTerms = await getCurrentTermsDocument();

  if (loginId.length < 4) {
    return { message: "로그인 ID는 4자 이상이어야 합니다." };
  }

  if (nickname.length < 2) {
    return { message: "닉네임은 2자 이상이어야 합니다." };
  }

  if (!phoneNumber) {
    return { message: "전화번호를 입력해 주세요." };
  }

  if (!/^\d+$/.test(phoneNumber)) {
    return { message: "전화번호는 숫자만 입력할 수 있습니다." };
  }

  if (!hasAcceptedTerms) {
    return { message: "이용약관 동의는 필수입니다." };
  }

  const termsAcceptedAt = new Date().toISOString();

  try {
    const user = pendingOAuthSignup
      ? await createUser({
          loginId,
          nickname,
          phoneNumber,
          email: pendingOAuthSignup.email,
          provider: pendingOAuthSignup.provider,
          providerSubject: pendingOAuthSignup.providerSubject,
          passwordHash: null,
          termsVersion: currentTerms.version,
          termsAcceptedAt,
        })
      : await createUser({
          loginId,
          nickname,
          phoneNumber,
          email,
          provider: "password",
          providerSubject: null,
          passwordHash: validateAndHashPassword(email, password),
          termsVersion: currentTerms.version,
          termsAcceptedAt,
        });

    await clearPendingOAuthSignup();
    return finishLogin(toPublicUser(user));
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "회원가입 처리 중 오류가 발생했습니다.",
    };
  }
}

export async function logout() {
  await clearSession();
  revalidatePath("/");
  redirect("/login");
}

export async function updateProfile(
  _state: AuthActionState | undefined,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const loginId = readString(formData, "loginId");
  const nickname = readString(formData, "nickname");
  const phoneNumber = normalizePhoneNumber(readString(formData, "phoneNumber"));
  const aiEnabled = formData.get("aiEnabled") === "on";
  const aiChatType = normalizeAIChatType(readString(formData, "aiChatType"));
  const apiKey = readString(formData, "apiKey");
  const chatModel = readString(formData, "chatModel");

  if (loginId.length < 4) {
    return { message: "로그인 ID는 4자 이상이어야 합니다." };
  }

  if (nickname.length < 2) {
    return { message: "닉네임은 2자 이상이어야 합니다." };
  }

  if (!phoneNumber) {
    return { message: "전화번호를 입력해 주세요." };
  }

  if (!/^\d+$/.test(phoneNumber)) {
    return { message: "전화번호는 숫자만 입력할 수 있습니다." };
  }

  if (aiEnabled && ((aiChatType && !apiKey) || (!aiChatType && apiKey))) {
    return { message: "AI Chat type과 API KEY는 함께 입력해 주세요." };
  }

  if (aiEnabled && chatModel && !aiChatType) {
    return { message: "Chat Model을 저장하려면 AI Chat type을 먼저 선택해 주세요." };
  }

  const existingUser = await findUserById(session.userId);

  if (!existingUser) {
    await clearSession();
    redirect("/login");
  }

  try {
    const user = await updateUserProfile({
      id: existingUser.id,
      loginId,
      nickname,
      phoneNumber,
      aiEnabled,
      aiChatType,
      apiKey: apiKey || null,
      chatModel: chatModel || null,
    });

    await createSession(toPublicUser(user));
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/profile");

    return { message: "회원정보가 수정되었습니다." };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "회원정보 수정 중 오류가 발생했습니다.",
    };
  }
}
