"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearPendingOAuthSignup,
  consumePostLoginRedirect,
  clearSession,
  createSession,
  getPendingOAuthSignup,
} from "@/lib/auth/session";
import { finalizePendingSSORedirect } from "@/lib/auth/sso";
import { toPublicUser } from "@/lib/auth/types";
import { createUser, findPasswordUserByIdentifier } from "@/lib/store/user-store";

export type AuthActionState = {
  message?: string;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  const pendingOAuthSignup = await getPendingOAuthSignup();

  if (loginId.length < 4) {
    return { message: "로그인 ID는 4자 이상이어야 합니다." };
  }

  if (nickname.length < 2) {
    return { message: "닉네임은 2자 이상이어야 합니다." };
  }

  try {
    const user = pendingOAuthSignup
      ? await createUser({
          loginId,
          nickname,
          email: pendingOAuthSignup.email,
          provider: pendingOAuthSignup.provider,
          providerSubject: pendingOAuthSignup.providerSubject,
          passwordHash: null,
        })
      : await createUser({
          loginId,
          nickname,
          email,
          provider: "password",
          providerSubject: null,
          passwordHash: validateAndHashPassword(email, password),
        });

    await clearPendingOAuthSignup();
    return finishLogin(toPublicUser(user));
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "회원가입 처리 중 오류가 발생했습니다.",
    };
  }
}

export async function logout() {
  await clearSession();
  revalidatePath("/");
  redirect("/login");
}
