"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createAdminAccess,
  isValidAdminPassword,
  requireAdminAccess,
} from "@/lib/admin/access";
import { updateAdminPassword } from "@/lib/store/admin-settings-store";
import { deleteTermsDocument, upsertTermsDocument } from "@/lib/store/admin-terms-store";
import { deleteServiceSite, upsertServiceSite } from "@/lib/store/service-site-store";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
      error instanceof Error ? error.message : "약관 조항 JSON 파싱에 실패했습니다.",
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

export async function saveServiceSite(formData: FormData) {
  await requireAdminAccess();

  await upsertServiceSite({
    id: readString(formData, "id") || undefined,
    name: readString(formData, "name"),
    url: readString(formData, "url"),
    description: readString(formData, "description"),
    clientId: readString(formData, "clientId"),
    clientSecret: readString(formData, "clientSecret"),
    allowedOriginsText: readString(formData, "allowedOriginsText"),
    allowedRedirectUrisText: readString(formData, "allowedRedirectUrisText"),
  });

  revalidatePath("/admin");
}

export async function removeServiceSite(formData: FormData) {
  await requireAdminAccess();
  await deleteServiceSite(readString(formData, "id"));
  revalidatePath("/admin");
}

export type AdminUnlockState = {
  message?: string;
};

export async function unlockAdmin(
  _state: AdminUnlockState | undefined,
  formData: FormData,
): Promise<AdminUnlockState> {
  const password = readString(formData, "adminPassword");

  if (!(await isValidAdminPassword(password))) {
    return { message: "관리 비밀번호가 올바르지 않습니다." };
  }

  await createAdminAccess();
  redirect("/admin");
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
