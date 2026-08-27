"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createAdminAccess,
  isValidAdminPassword,
  requireAdminAccess,
} from "@/lib/admin/access";
import { updateAdminPassword } from "@/lib/store/admin-settings-store";
import {
  deleteTermsDocument,
  upsertTermsDocument,
} from "@/lib/store/admin-terms-store";
import {
  deleteServiceSite,
  upsertServiceSite,
} from "@/lib/store/service-site-store";
import { listUsers } from "@/lib/store/user-store";

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
