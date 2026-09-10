"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createAdminAccess,
  isValidAdminPassword,
  requireAdminAccess,
} from "@/lib/admin/access";
import { updateAdminPassword } from "@/lib/store/admin-settings-store";
import { refundTossHampoCharge } from "@/lib/toss-payments/server";
import { reclaimManualHampoCharge } from "@/lib/store/hampo-history-store";
import {
  deleteTermsDocument,
  upsertTermsDocument,
} from "@/lib/store/admin-terms-store";
import {
  deleteServiceSite,
  upsertServiceSite,
} from "@/lib/store/service-site-store";
import {
  chargeUserHampo,
  completeUserServiceRefund,
  deleteUserById,
  findUserById,
  listUsers,
  updateUserByAdmin,
} from "@/lib/store/user-store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  const isPresent = formData.get(`${key}__present`);

  if (value === null && isPresent === null) {
    return undefined;
  }

  return value === "on";
}

function readPrice(formData: FormData, key: string) {
  const value = readString(formData, key);
  const parsed = Number(value);
  if (!value || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${key} 요금은 0 이상의 정수로 입력해 주세요.`);
  }
  return parsed;
}

function parseNotice(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSectionsJson(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("약관 조항 JSON은 배열이어야 합니다.");
    }

    return parsed.map((section) => ({
      title:
        section && typeof section === "object" && "title" in section
          ? String(section.title ?? "")
          : "",
      body:
        section && typeof section === "object" && "body" in section
          ? String(section.body ?? "")
          : "",
    }));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "약관 조항 JSON 파싱에 실패했습니다.",
    );
  }
}

export async function saveTermsDocument(formData: FormData) {
  await requireAdminAccess();

  await upsertTermsDocument(
    {
      version: readString(formData, "version"),
      effectiveDate: readString(formData, "effectiveDate"),
      title: readString(formData, "title"),
      notice: parseNotice(readString(formData, "noticeText")),
      sections: parseSectionsJson(readString(formData, "sectionsJson")),
    },
    readString(formData, "sourceVersion") || undefined,
  );

  revalidatePath("/admin");
  revalidatePath("/signup");
}

export async function removeTermsDocument(formData: FormData) {
  await requireAdminAccess();
  await deleteTermsDocument(readString(formData, "version"));
  revalidatePath("/admin");
  revalidatePath("/signup");
}

export type SaveServiceSiteState = {
  ok?: boolean;
  message?: string;
};

export async function saveServiceSite(
  _state: SaveServiceSiteState | undefined,
  formData: FormData,
): Promise<SaveServiceSiteState> {
  try {
    await requireAdminAccess();
    const isUpdate = Boolean(readString(formData, "id"));
    const isFixedPricing =
      readOptionalBoolean(formData, "isFixedPricing") ?? false;

    await upsertServiceSite({
      id: readString(formData, "id") || undefined,
      name: readString(formData, "name"),
      url: readString(formData, "url"),
      description: readString(formData, "description"),
      isVisible: readOptionalBoolean(formData, "isVisible"),
      clientId: readString(formData, "clientId"),
      clientSecret: readString(formData, "clientSecret"),
      allowedOriginsText: readString(formData, "allowedOriginsText"),
      allowedRedirectUrisText: readString(formData, "allowedRedirectUrisText"),
      isFixedPricing,
      prices: isFixedPricing
        ? {
            basic: readPrice(formData, "basicPrice"),
            standard: readPrice(formData, "standardPrice"),
            premium: readPrice(formData, "premiumPrice"),
          }
        : undefined,
    });

    revalidatePath("/admin");
    return {
      ok: true,
      message: isUpdate
        ? "서비스사이트 수정사항을 저장했습니다."
        : "서비스사이트를 등록했습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "서비스사이트 저장 중 오류가 발생했습니다.",
    };
  }
}

export type RemoveServiceSiteState = {
  ok?: boolean;
  message?: string;
};

export async function removeServiceSite(
  _state: RemoveServiceSiteState | undefined,
  formData: FormData,
): Promise<RemoveServiceSiteState> {
  try {
    await requireAdminAccess();
    await deleteServiceSite({
      id: readString(formData, "id"),
      confirmName: readString(formData, "confirmSiteName"),
      confirmClientId: readString(formData, "confirmClientId"),
      confirmation: readString(formData, "deleteConfirmation"),
      acknowledged: formData.get("deleteAcknowledged") === "on",
    });
    revalidatePath("/admin");
    return { ok: true, message: "서비스사이트가 삭제되었습니다." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "서비스사이트 삭제 중 오류가 발생했습니다.",
    };
  }
}

export type AdminUnlockState = {
  message?: string;
  success?: boolean;
};

export async function unlockAdmin(
  _state: AdminUnlockState | undefined,
  formData: FormData,
): Promise<AdminUnlockState> {
  const password = readString(formData, "adminPassword");
  const returnPath = readString(formData, "returnPath");

  if (
    returnPath &&
    (!returnPath.startsWith("/") || returnPath.startsWith("//"))
  ) {
    return { success: false, message: "올바르지 않은 이동 경로입니다." };
  }

  if (!(await isValidAdminPassword(password))) {
    return { success: false, message: "관리자 비밀번호가 올바르지 않습니다." };
  }

  await createAdminAccess();

  if (returnPath) {
    redirect(returnPath);
  }

  return { success: true };
}

export async function changeAdminPassword(formData: FormData) {
  await requireAdminAccess();

  const nextPassword = readString(formData, "nextAdminPassword");
  const confirmPassword = readString(formData, "confirmAdminPassword");

  if (!nextPassword) {
    throw new Error("새 관리자 비밀번호를 입력해 주세요.");
  }

  if (nextPassword !== confirmPassword) {
    throw new Error("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
  }

  await updateAdminPassword(nextPassword);
  revalidatePath("/admin");
}

export async function getAdminUserSummaries() {
  await requireAdminAccess();
  const users = await listUsers();
  return users.map((user) => ({
    id: user.id,
    loginId: user.loginId,
    email: user.email,
    nickname: user.nickname,
    provider: user.provider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
}

function getUserAdminPath(
  formData: FormData,
  values: Record<string, string | undefined> = {},
) {
  const requestedPage = Number.parseInt(readString(formData, "userPage"), 10);
  const query = new URLSearchParams({
    tab: "users",
    userPage: String(
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    ),
  });

  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }

  return `/admin?${query.toString()}`;
}

export async function saveAdminUser(formData: FormData) {
  await requireAdminAccess();
  const id = readString(formData, "id");
  const genderValue = readString(formData, "gender");
  const gender =
    genderValue === "male" ||
    genderValue === "female" ||
    genderValue === "other" ||
    genderValue === "prefer_not_to_say"
      ? genderValue
      : null;

  try {
    await updateUserByAdmin({
      id,
      loginId: readString(formData, "loginId"),
      email: readString(formData, "email"),
      nickname: readString(formData, "nickname"),
      phoneNumber: readString(formData, "phoneNumber"),
      birthDate: readString(formData, "birthDate") || null,
      gender,
    });
  } catch (error) {
    redirect(
      getUserAdminPath(formData, {
        userId: id,
        userMode: "edit",
        userError:
          error instanceof Error
            ? error.message
            : "회원정보 수정 중 오류가 발생했습니다.",
      }),
    );
  }

  revalidatePath("/admin");
  redirect(
    getUserAdminPath(formData, {
      userId: id,
      userMessage: "회원정보를 수정했습니다.",
    }),
  );
}

export async function chargeAdminUserHampo(formData: FormData) {
  await requireAdminAccess();
  const id = readString(formData, "id");
  const rawAmount = readString(formData, "amount");
  const amount = Number(rawAmount);

  if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount < 1) {
    redirect(
      getUserAdminPath(formData, {
        userId: id,
        userMode: "charge",
        userError: "충전할 함포를 1 이상 정수로 입력해 주세요.",
      }),
    );
  }

  if (amount > 1_000_000) {
    redirect(
      getUserAdminPath(formData, {
        userId: id,
        userMode: "charge",
        userError: "한 번에 최대 1,000,000함포까지 충전할 수 있습니다.",
      }),
    );
  }

  try {
    await chargeUserHampo(id, amount, "admin_manual_charge");
  } catch (error) {
    redirect(
      getUserAdminPath(formData, {
        userId: id,
        userMode: "charge",
        userError:
          error instanceof Error
            ? error.message
            : "함포 충전 중 오류가 발생했습니다.",
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/login");
  redirect(
    getUserAdminPath(formData, {
      userId: id,
      userMessage: `${amount.toLocaleString("ko-KR")}함포를 충전했습니다.`,
    }),
  );
}

export type AdminHampoChargeModalState = {
  ok?: boolean;
  message?: string;
  balance?: number;
};

export async function chargeAdminUserHampoFromModal(
  _state: AdminHampoChargeModalState | undefined,
  formData: FormData,
): Promise<AdminHampoChargeModalState> {
  await requireAdminAccess();

  const id = readString(formData, "id");
  const rawAmount = readString(formData, "amount");
  const amount = Number(rawAmount);
  if (!id) return { message: "충전할 회원 정보가 없습니다." };
  if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount < 1) {
    return { message: "충전할 함포를 1 이상의 정수로 입력해 주세요." };
  }
  if (amount > 1_000_000) {
    return { message: "한 번에 최대 1,000,000함포까지 충전할 수 있습니다." };
  }

  try {
    const balance = await chargeUserHampo(id, amount, "admin_manual_charge");
    revalidatePath("/admin");
    revalidatePath("/login");
    return {
      ok: true,
      balance,
      message: `${amount.toLocaleString("ko-KR")}함포를 충전했습니다.`,
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

export type CompleteAdminHampoRefundState = {
  ok?: boolean;
  message?: string;
  refundedAmount?: number;
};

export type RefundHampoChargeState = {
  ok?: boolean;
  message?: string;
};

export async function refundHampoCharge(
  _state: RefundHampoChargeState | undefined,
  formData: FormData,
): Promise<RefundHampoChargeState> {
  await requireAdminAccess();

  try {
    const historyId = readString(formData, "historyId");
    if (!historyId)
      return { ok: false, message: "환불할 충전 이력을 선택해 주세요." };
    if (formData.get("refundConfirmed") !== "on") {
      return {
        ok: false,
        message: "카드 결제 취소와 함포 회수를 확인해 주세요.",
      };
    }

    const result = await refundTossHampoCharge({
      historyId,
      cancelReason:
        readString(formData, "cancelReason") || "함포 충전 결제 환불",
    });
    revalidatePath("/admin");
    revalidatePath("/login");
    return {
      ok: true,
      message: `${result.refundedAmount.toLocaleString("ko-KR")}함포, ${result.refundedPaymentAmount.toLocaleString("ko-KR")}원 환불이 완료되었습니다.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "함포 충전 환불 중 오류가 발생했습니다.",
    };
  }
}

export async function reclaimManualCharge(
  _state: RefundHampoChargeState | undefined,
  formData: FormData,
): Promise<RefundHampoChargeState> {
  await requireAdminAccess();

  try {
    const historyId = readString(formData, "historyId");
    if (!historyId)
      return { ok: false, message: "회수할 충전 이력을 선택해 주세요." };
    if (formData.get("reclaimConfirmed") !== "on") {
      return { ok: false, message: "수동 충전 함포 회수를 확인해 주세요." };
    }

    const result = await reclaimManualHampoCharge(
      historyId,
      readString(formData, "reclaimReason") || "수동 충전 함포 회수",
    );
    revalidatePath("/admin");
    revalidatePath("/login");
    return {
      ok: true,
      message: `${result.reclaimedAmount.toLocaleString("ko-KR")}함포를 회수했습니다.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "수동 충전 함포 회수 중 오류가 발생했습니다.",
    };
  }
}

export async function completeAdminHampoRefund(
  _state: CompleteAdminHampoRefundState | undefined,
  formData: FormData,
): Promise<CompleteAdminHampoRefundState> {
  await requireAdminAccess();

  try {
    const refundRequestId = readString(formData, "refundRequestId");
    if (!refundRequestId) {
      return { ok: false, message: "환불 요청 ID가 없습니다." };
    }
    if (formData.get("refundConfirmed") !== "on") {
      return {
        ok: false,
        message: "일할 계산 환불금과 서비스 해지 내용을 확인해 주세요.",
      };
    }

    const result = await completeUserServiceRefund({
      refundRequestId,
      adminMemo: readString(formData, "adminMemo"),
    });

    revalidatePath("/admin");
    revalidatePath("/login");
    revalidatePath("/profile/services");
    return {
      ok: true,
      message: `${result.refundedAmount.toLocaleString("ko-KR")}함포 환불을 완료했습니다.`,
      refundedAmount: result.refundedAmount,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "환불 처리 중 오류가 발생했습니다.",
    };
  }
}

export async function removeAdminUser(formData: FormData) {
  await requireAdminAccess();
  const id = readString(formData, "id");
  const user = await findUserById(id);

  if (!user) {
    redirect(
      getUserAdminPath(formData, {
        userError: "회원정보를 찾을 수 없습니다.",
      }),
    );
  }

  if (
    formData.get("deleteAcknowledged") !== "on" ||
    readString(formData, "deleteConfirmation").toLowerCase() !==
      user.email.toLowerCase()
  ) {
    redirect(
      getUserAdminPath(formData, {
        userId: id,
        userMode: "delete",
        userError: "삭제 확인에 체크하고 회원 이메일을 정확히 입력해 주세요.",
      }),
    );
  }

  await deleteUserById(id);
  revalidatePath("/admin");
  redirect(
    getUserAdminPath(formData, {
      userMessage: "회원정보를 삭제했습니다.",
    }),
  );
}
