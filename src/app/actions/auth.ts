"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAcceptIncluded } from "@/lib/auth/accept-include";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearEmailVerification,
  isEmailVerified,
} from "@/lib/auth/email-verification";
import {
  clearPendingOAuthSignup,
  clearSession,
  consumePostLoginRedirect,
  createSession,
  getSession,
  getPendingOAuthSignup,
  getPendingSSORequest,
} from "@/lib/auth/session";
import {
  finalizePendingSSORedirect,
  getValidatedServiceReturnUrl,
} from "@/lib/auth/sso";
import {
  toPublicUser,
  toSessionUser,
  type AIChatType,
  type Gender,
  type ServiceMembership,
  type ServicePlan,
} from "@/lib/auth/types";
import { getCurrentTermsDocument } from "@/lib/store/admin-terms-store";
import { listServiceSites } from "@/lib/store/service-site-store";
import {
  createUser,
  chargeUserHampo,
  deleteUserById,
  findPasswordUserByIdentifier,
  findUserByEmail,
  findUserById,
  purchaseUserServiceMembership,
  removeUserServiceMembership,
  requestUserServiceRefund,
  updateUserProfile,
} from "@/lib/store/user-store";

export type HampoChargeActionState = {
  message?: string;
  balance?: number;
  ok?: boolean;
};

export type ServiceMembershipPurchaseState = {
  ok?: boolean;
  message?: string;
  code?: "insufficient_hampo";
  balance?: number;
  requiredHampo?: number;
  membership?: ServiceMembership;
};

export type ServiceMembershipRemovalState = {
  ok?: boolean;
  message?: string;
  memberships?: ServiceMembership[];
};

export type ServiceRefundRequestState = {
  ok?: boolean;
  message?: string;
  requestedAmount?: number;
  membership?: ServiceMembership;
  memberships?: ServiceMembership[];
};

export type AuthActionState = {
  ok?: boolean;
  message?: string;
  field?: "email";
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeAIChatType(value: string): AIChatType | null {
  return value === "gpt" || value === "gemini" || value === "claude"
    ? value
    : null;
}

function normalizeGender(value: string): Gender | null {
  return value === "male" ||
    value === "female" ||
    value === "other" ||
    value === "prefer_not_to_say"
    ? value
    : null;
}

function normalizeServicePlan(value: string): ServicePlan | null {
  return value === "basic" || value === "standard" || value === "premium"
    ? value
    : null;
}

function normalizeBirthDate(formData: FormData) {
  const year = readString(formData, "birthYear");
  const month = readString(formData, "birthMonth").padStart(2, "0");
  const day = readString(formData, "birthDay").padStart(2, "0");

  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    throw new Error("생년월일을 정확히 입력해 주세요.");
  }

  const birthDate = `${year}-${month}-${day}`;
  const parsed = new Date(`${birthDate}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== birthDate ||
    birthDate > today
  ) {
    throw new Error("유효한 생년월일을 입력해 주세요.");
  }

  return birthDate;
}

function validateAndHashPassword(
  email: string,
  password: string,
  passwordConfirm: string,
) {
  if (!email.includes("@")) {
    throw new Error("유효한 이메일을 입력해 주세요.");
  }

  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }

  if (password !== passwordConfirm) {
    throw new Error("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
  }

  return hashPassword(password);
}

async function finishLogin(
  user: ReturnType<typeof toPublicUser>,
): Promise<never> {
  const sessionUser = toSessionUser(user);
  await createSession(sessionUser);
  const ssoRedirect = await finalizePendingSSORedirect(sessionUser);
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
  const nickname = readString(formData, "nickname");
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const passwordConfirm = readString(formData, "passwordConfirm");
  const gender = normalizeGender(readString(formData, "gender"));
  const phoneNumber = normalizePhoneNumber(readString(formData, "phoneNumber"));
  const hasAcceptedTerms = formData.get("termsAccepted") === "on";
  const pendingOAuthSignup = await getPendingOAuthSignup();
  const pendingSSORequest = await getPendingSSORequest();
  const currentTerms = await getCurrentTermsDocument();

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

  if (!gender) {
    return { message: "성별을 선택해 주세요." };
  }

  const termsAcceptedAt = new Date().toISOString();

  try {
    const signupEmail = pendingOAuthSignup?.email ?? email;
    const loginId = signupEmail;
    const birthDate = normalizeBirthDate(formData);
    const passwordHash = validateAndHashPassword(
      signupEmail,
      password,
      passwordConfirm,
    );
    const requestedServiceSiteId = readString(formData, "serviceSiteId");
    const requestedPlan = normalizeServicePlan(
      readString(formData, "servicePlan"),
    );
    const serviceSites = pendingSSORequest ? await listServiceSites() : [];
    const signupService = serviceSites.find(
      (site) => site.isVisible && site.clientId === pendingSSORequest?.clientId,
    );
    const serviceMemberships: ServiceMembership[] = [];

    if (signupService?.isFixedPricing) {
      if (requestedServiceSiteId !== signupService.id || !requestedPlan) {
        return { message: "가입할 서비스의 요금제를 선택해 주세요." };
      }

      const monthlyPrice = signupService.prices[requestedPlan];

      if (monthlyPrice > 0) {
        return {
          message: `${monthlyPrice.toLocaleString("ko-KR")}원 결제가 필요합니다. 결제 기능은 준비중입니다.`,
        };
      }

      serviceMemberships.push({
        serviceSiteId: signupService.id,
        clientId: signupService.clientId,
        serviceName: signupService.name,
        plan: requestedPlan,
        monthlyPrice,
        joinedAt: termsAcceptedAt,
      });
    } else if (signupService) {
      serviceMemberships.push({
        serviceSiteId: signupService.id,
        clientId: signupService.clientId,
        serviceName: signupService.name,
        plan: "basic",
        monthlyPrice: 0,
        joinedAt: termsAcceptedAt,
      });
    }

    if (!signupEmail.includes("@")) {
      return { message: "유효한 이메일을 입력해 주세요.", field: "email" };
    }

    if (!pendingOAuthSignup && !(await isEmailVerified(signupEmail))) {
      return { message: "이메일 인증을 완료해 주세요.", field: "email" };
    }

    const existingEmailUser = await findUserByEmail(signupEmail);
    if (existingEmailUser) {
      return {
        message: "중복된 사용자입니다. 이미 가입된 이메일입니다.",
        field: "email",
      };
    }

    const user = pendingOAuthSignup
      ? await createUser({
          loginId,
          nickname,
          phoneNumber,
          birthDate,
          gender,
          email: pendingOAuthSignup.email,
          provider: pendingOAuthSignup.provider,
          providerSubject: pendingOAuthSignup.providerSubject,
          passwordHash,
          termsVersion: currentTerms.version,
          termsAcceptedAt,
          serviceMemberships,
        })
      : await createUser({
          loginId,
          nickname,
          phoneNumber,
          birthDate,
          gender,
          email,
          provider: "password",
          providerSubject: null,
          passwordHash,
          termsVersion: currentTerms.version,
          termsAcceptedAt,
          serviceMemberships,
        });

    await clearPendingOAuthSignup();
    if (!pendingOAuthSignup) {
      await clearEmailVerification();
    }
    return finishLogin(toPublicUser(user));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "회원가입 처리 중 오류가 발생했습니다.";
    return {
      message,
      field: message.includes("이메일") ? "email" : undefined,
    };
  }
}

export async function logout() {
  await clearSession();
  revalidatePath("/");
  redirect("/login");
}

export async function chargeHampo(
  _state: HampoChargeActionState | undefined,
  formData: FormData,
): Promise<HampoChargeActionState> {
  const session = await getSession();

  if (!session?.userId) {
    return { message: "로그인이 필요합니다." };
  }

  if (!isAcceptIncluded(session.user.email)) {
    return { message: "카드 결제 연동 준비 중입니다." };
  }

  const rawAmount = readString(formData, "amount");
  const amount = Number(rawAmount);

  if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount < 1) {
    return { message: "충전할 함포를 1 이상 정수로 입력해 주세요." };
  }

  if (amount > 1_000_000) {
    return { message: "한 번에 최대 1,000,000함포까지 충전할 수 있습니다." };
  }

  try {
    const balance = await chargeUserHampo(session.userId, amount);
    const updatedUser = await findUserById(session.userId);

    if (!updatedUser) {
      return { message: "사용자 정보를 찾을 수 없습니다." };
    }

    await createSession(toSessionUser(updatedUser));
    revalidatePath("/");
    revalidatePath("/login");

    return {
      ok: true,
      balance,
      message: `${amount.toLocaleString("ko-KR")}함포가 충전되었습니다.`,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "함포 충전 중 오류가 발생했습니다.",
    };
  }
}

export async function purchaseServiceMembership(
  _state: ServiceMembershipPurchaseState | undefined,
  formData: FormData,
): Promise<ServiceMembershipPurchaseState> {
  const session = await getSession();

  if (!session?.userId) {
    return { message: "로그인이 필요합니다." };
  }

  const serviceSiteId = readString(formData, "serviceSiteId");
  const requestedPlan = normalizeServicePlan(readString(formData, "plan"));
  const site = (await listServiceSites()).find(
    (candidate) => candidate.id === serviceSiteId,
  );

  if (!site || (site.isFixedPricing && !requestedPlan)) {
    return { message: "유효한 서비스와 요금제를 선택해 주세요." };
  }

  const plan = site.isFixedPricing ? requestedPlan! : "basic";
  const currentUser = await findUserById(session.userId);
  if (!currentUser) return { message: "회원정보를 찾을 수 없습니다." };
  const currentMembership = currentUser.serviceMemberships.find(
    (membership) =>
      membership.serviceSiteId === site.id ||
      membership.clientId === site.clientId,
  );

  if (currentMembership?.status === "refund_pending") {
    return { message: "환불 진행 중인 서비스는 변경할 수 없습니다." };
  }

  const planPrice = site.prices[plan];
  const currentPlanPrice = currentMembership
    ? typeof currentMembership.monthlyPrice === "number"
      ? currentMembership.monthlyPrice
      : site.prices[currentMembership.plan]
    : 0;
  if (currentMembership && currentPlanPrice > 0) {
    const planOrder: ServicePlan[] = ["basic", "standard", "premium"];
    if (planOrder.indexOf(plan) <= planOrder.indexOf(currentMembership.plan)) {
      return {
        message:
          "유료 서비스는 현재 플랜보다 높은 단계로만 업그레이드할 수 있습니다.",
      };
    }
  }

  const paymentAmount = Math.max(0, planPrice - currentPlanPrice);
  if (paymentAmount % 100 !== 0) {
    return {
      message: `${site.name}의 요금은 100원 단위로 설정되어야 함포를 사용할 수 있습니다.`,
    };
  }

  const requiredHampo = paymentAmount / 100;

  try {
    const result = await purchaseUserServiceMembership({
      userId: session.userId,
      serviceSiteId: site.id,
      clientId: site.clientId,
      serviceName: site.name,
      plan,
      amount: requiredHampo,
      planPrice,
      paymentAmount,
    });
    const updatedUser = await findUserById(session.userId);

    if (!updatedUser) {
      return { message: "회원정보를 찾을 수 없습니다." };
    }

    await createSession(toSessionUser(updatedUser));
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/profile");
    revalidatePath("/profile/services");

    return {
      ok: true,
      balance: result.balance,
      membership: result.membership,
      requiredHampo,
      message:
        result.chargedAmount > 0
          ? `${site.name} 서비스가 추가되고 ${result.chargedAmount.toLocaleString("ko-KR")}함포가 사용되었습니다.`
          : "이미 선택한 요금제를 이용 중입니다.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "서비스 추가 중 오류가 발생했습니다.";
    const latestUser = await findUserById(session.userId);
    return {
      message,
      code: message.includes("잔액이 부족") ? "insufficient_hampo" : undefined,
      balance: latestUser?.hampoBalance ?? session.user.hampoBalance,
      requiredHampo,
    };
  }
}

export async function removeServiceMembership(
  _state: ServiceMembershipRemovalState | undefined,
  formData: FormData,
): Promise<ServiceMembershipRemovalState> {
  const session = await getSession();

  if (!session?.userId) {
    return { message: "로그인이 필요합니다." };
  }

  const serviceSiteId = readString(formData, "serviceSiteId");
  const serviceSites = await listServiceSites();
  const site = serviceSites.find((candidate) => candidate.id === serviceSiteId);
  const user = await findUserById(session.userId);
  const membership = user?.serviceMemberships.find(
    (item) =>
      item.serviceSiteId === serviceSiteId || item.clientId === site?.clientId,
  );

  if (!user || !membership) {
    return { message: "삭제할 서비스 가입정보를 찾을 수 없습니다." };
  }

  const canDelete = site
    ? !site.isFixedPricing || site.prices[membership.plan] === 0
    : membership.monthlyPrice === 0;
  if (!canDelete) {
    return { message: "유료 정찰제 서비스는 삭제할 수 없습니다." };
  }

  const memberships = await removeUserServiceMembership(
    user.id,
    membership.serviceSiteId,
    membership.clientId,
  );
  const updatedUser = await findUserById(user.id);
  if (updatedUser) await createSession(toSessionUser(updatedUser));
  revalidatePath("/login");
  revalidatePath("/profile/services");

  return { ok: true, message: "서비스를 삭제했습니다.", memberships };
}

export async function requestServiceRefund(
  _state: ServiceRefundRequestState | undefined,
  formData: FormData,
): Promise<ServiceRefundRequestState> {
  const session = await getSession();

  if (!session?.userId) return { message: "로그인이 필요합니다." };
  if (
    readString(formData, "confirmation") !== "REFUND" ||
    formData.get("acknowledged") !== "on"
  ) {
    return { message: "환불 요청 확인 문구를 정확히 입력해 주세요." };
  }

  const serviceSiteId = readString(formData, "serviceSiteId");
  const user = await findUserById(session.userId);
  const site = (await listServiceSites()).find(
    (candidate) => candidate.id === serviceSiteId,
  );
  const membership = user?.serviceMemberships.find(
    (item) =>
      item.serviceSiteId === serviceSiteId || item.clientId === site?.clientId,
  );

  if (!user || !site || !membership) {
    return { message: "환불할 서비스 가입정보를 찾을 수 없습니다." };
  }
  if (membership.status === "refund_pending") {
    return { message: "이미 환불 진행 중인 서비스입니다." };
  }
  if (!site.isFixedPricing || site.prices[membership.plan] <= 0) {
    return { message: "유료 정찰제 서비스만 환불을 요청할 수 있습니다." };
  }

  try {
    const result = await requestUserServiceRefund(
      user.id,
      membership.serviceSiteId,
      membership.clientId,
    );
    const updatedUser = await findUserById(user.id);
    if (updatedUser) await createSession(toSessionUser(updatedUser));
    revalidatePath("/login");
    revalidatePath("/profile/services");

    return {
      ok: true,
      message:
        "환불 요청이 접수되었습니다. 관리자 처리 전까지 서비스를 이용할 수 없습니다.",
      requestedAmount: result.requestedAmount,
      membership: result.membership,
      memberships: result.memberships,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "환불 요청 중 오류가 발생했습니다.",
    };
  }
}

export async function updateProfile(
  _state: AuthActionState | undefined,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const nickname = readString(formData, "nickname");
  const phoneNumber = normalizePhoneNumber(readString(formData, "phoneNumber"));
  const aiEnabled = formData.get("aiEnabled") === "on";
  const aiChatType = normalizeAIChatType(readString(formData, "aiChatType"));
  const apiKey = readString(formData, "apiKey");
  const chatModel = readString(formData, "chatModel");
  const gender = normalizeGender(readString(formData, "gender"));
  const password = readString(formData, "password");
  const passwordConfirm = readString(formData, "passwordConfirm");
  const serviceReturnTo = await getValidatedServiceReturnUrl(
    readString(formData, "serviceClientId") || undefined,
    readString(formData, "serviceReturnTo") || undefined,
  );

  if (nickname.length < 2) {
    return { message: "닉네임은 2자 이상이어야 합니다." };
  }

  if (!phoneNumber) {
    return { message: "전화번호를 입력해 주세요." };
  }

  if (!/^\d+$/.test(phoneNumber)) {
    return { message: "전화번호는 숫자만 입력할 수 있습니다." };
  }

  if (!gender) {
    return { message: "성별을 선택해 주세요." };
  }

  if (aiEnabled && ((aiChatType && !apiKey) || (!aiChatType && apiKey))) {
    return { message: "AI Chat type과 API KEY는 함께 입력해 주세요." };
  }

  if (aiEnabled && chatModel && !aiChatType) {
    return {
      message: "Chat Model을 저장하려면 AI Chat type을 먼저 선택해 주세요.",
    };
  }

  const existingUser = await findUserById(session.userId);

  if (!existingUser) {
    await clearSession();
    redirect("/login");
  }

  try {
    const birthDate = normalizeBirthDate(formData);
    let passwordHash: string | undefined;
    if (password || passwordConfirm) {
      passwordHash = validateAndHashPassword(
        existingUser.email,
        password,
        passwordConfirm,
      );
    }

    const rawMemberships = readString(formData, "serviceMemberships");
    const requestedMemberships = rawMemberships
      ? (JSON.parse(rawMemberships) as Array<{
          serviceSiteId?: string;
          plan?: string;
        }>)
      : [];
    const serviceSites = await listServiceSites();
    const serviceMemberships: ServiceMembership[] = rawMemberships
      ? []
      : existingUser.serviceMemberships;
    const hampoUsages: Array<{
      serviceSiteId: string;
      clientId: string;
      serviceName: string;
      plan: ServicePlan;
      amount: number;
      paymentAmount: number;
    }> = [];

    if (rawMemberships) {
      for (const previous of existingUser.serviceMemberships) {
        const remainsSelected = requestedMemberships.some(
          (requested) =>
            requested.serviceSiteId === previous.serviceSiteId ||
            serviceSites.some(
              (site) =>
                site.id === requested.serviceSiteId &&
                site.clientId === previous.clientId,
            ),
        );

        if (remainsSelected) continue;

        const previousSite = serviceSites.find(
          (site) =>
            site.id === previous.serviceSiteId ||
            site.clientId === previous.clientId,
        );
        const canDelete = previousSite
          ? !previousSite.isFixedPricing ||
            previousSite.prices[previous.plan] === 0
          : previous.monthlyPrice === 0;

        if (!canDelete) {
          throw new Error(
            `${previous.serviceName}은(는) 유료 정찰제 서비스라 삭제할 수 없습니다.`,
          );
        }
      }

      for (const requested of requestedMemberships) {
        const site = serviceSites.find(
          (item) => item.id === requested.serviceSiteId,
        );
        const plan = normalizeServicePlan(requested.plan ?? "");
        if (!site || !plan) {
          throw new Error(
            "유효하지 않은 서비스 또는 요금제가 포함되어 있습니다.",
          );
        }
        const previous = existingUser.serviceMemberships.find(
          (item) =>
            item.serviceSiteId === site.id || item.clientId === site.clientId,
        );
        if (previous?.status === "refund_pending") {
          throw new Error(
            "환불 진행 중인 서비스는 회원정보 수정에서 변경할 수 없습니다.",
          );
        }
        if (site.isFixedPricing && (!previous || previous.plan !== plan)) {
          const paymentAmount = site.prices[plan];

          if (paymentAmount % 100 !== 0) {
            throw new Error(
              `${site.name}의 요금은 100원 단위로 설정되어야 함포를 사용할 수 있습니다.`,
            );
          }

          const amount = paymentAmount / 100;
          if (amount > 0) {
            hampoUsages.push({
              serviceSiteId: site.id,
              clientId: site.clientId,
              serviceName: site.name,
              plan,
              amount,
              paymentAmount,
            });
          }
        }
        serviceMemberships.push({
          serviceSiteId: site.id,
          clientId: site.clientId,
          serviceName: site.name,
          plan: site.isFixedPricing ? plan : "basic",
          monthlyPrice: site.isFixedPricing ? site.prices[plan] : 0,
          joinedAt: previous?.joinedAt ?? new Date().toISOString(),
          status: previous?.status ?? "active",
          refundRequestedAt: previous?.refundRequestedAt ?? null,
          refundRequestId: previous?.refundRequestId ?? null,
        });
      }
    }

    const user = await updateUserProfile({
      id: existingUser.id,
      nickname,
      phoneNumber,
      birthDate,
      gender,
      passwordHash,
      serviceMemberships,
      aiEnabled,
      aiChatType,
      apiKey: apiKey || null,
      chatModel: chatModel || null,
      hampoUsages,
    });

    await createSession(toSessionUser(user));
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/profile");
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "회원정보 수정 중 오류가 발생했습니다.",
    };
  }

  if (serviceReturnTo) {
    redirect(serviceReturnTo);
  }

  return { ok: true, message: "회원정보가 수정되었습니다." };
}

export async function deleteAccount(
  _state: AuthActionState | undefined,
  _formData: FormData,
): Promise<AuthActionState> {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const existingUser = await findUserById(session.userId);

  if (!existingUser) {
    await clearSession();
    redirect("/login");
  }

  try {
    await deleteUserById(existingUser.id);
    await clearSession();
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/profile");
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "회원 삭제 중 오류가 발생했습니다.",
    };
  }

  redirect("/login");
}
