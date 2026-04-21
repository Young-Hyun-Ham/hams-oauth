import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { DEFAULT_TERMS_DOCUMENT, type TermsDocument, type TermsSection } from "@/lib/auth/terms";

const TERMS_COLLECTION = "admin_terms";

export type ManagedTermsDocument = TermsDocument & {
  createdAt: string;
  updatedAt: string;
};

type UpsertTermsDocumentInput = TermsDocument;

function requireDb() {
  const db = getFirebaseAdminDb();

  if (!db) {
    throw new Error(
      "Firebase Admin 설정이 없어 이용약관 관리를 사용할 수 없습니다. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 확인해 주세요.",
    );
  }

  return db;
}

function serializeDate(value: unknown, fallback: string) {
  if (typeof value === "string" && value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return fallback;
}

function sanitizeSections(sections: TermsSection[]) {
  return sections
    .map((section) => ({
      title: section.title.trim(),
      body: section.body.trim(),
    }))
    .filter((section) => section.title && section.body);
}

function mapTermsDocument(data: Record<string, unknown>, fallbackVersion: string): ManagedTermsDocument {
  const now = new Date().toISOString();
  const rawSections = Array.isArray(data.sections) ? data.sections : [];
  const sections = sanitizeSections(
    rawSections.map((section) => ({
      title:
        section && typeof section === "object" && "title" in section
          ? String(section.title ?? "")
          : "",
      body:
        section && typeof section === "object" && "body" in section
          ? String(section.body ?? "")
          : "",
    })),
  );
  const notice = Array.isArray(data.notice)
    ? data.notice.map((line) => String(line).trim()).filter(Boolean)
    : [];

  return {
    version: String(data.version ?? fallbackVersion),
    effectiveDate: String(data.effectiveDate ?? ""),
    title: String(data.title ?? "hams-oauth 서비스 이용약관"),
    notice,
    sections,
    createdAt: serializeDate(data.createdAt, now),
    updatedAt: serializeDate(data.updatedAt, now),
  };
}

export async function listTermsDocuments() {
  const db = getFirebaseAdminDb();

  if (!db) {
    return [
      {
        ...DEFAULT_TERMS_DOCUMENT,
        createdAt: DEFAULT_TERMS_DOCUMENT.effectiveDate,
        updatedAt: DEFAULT_TERMS_DOCUMENT.effectiveDate,
      },
    ];
  }

  const snapshot = await db.collection(TERMS_COLLECTION).get();

  if (snapshot.empty) {
    return [
      {
        ...DEFAULT_TERMS_DOCUMENT,
        createdAt: DEFAULT_TERMS_DOCUMENT.effectiveDate,
        updatedAt: DEFAULT_TERMS_DOCUMENT.effectiveDate,
      },
    ];
  }

  return snapshot.docs
    .map((doc) => mapTermsDocument(doc.data() ?? {}, doc.id))
    .sort((a, b) => {
      if (a.effectiveDate === b.effectiveDate) {
        return a.version < b.version ? 1 : -1;
      }

      return a.effectiveDate < b.effectiveDate ? 1 : -1;
    });
}

export async function getCurrentTermsDocument() {
  const documents = await listTermsDocuments();
  return documents[0] ?? { ...DEFAULT_TERMS_DOCUMENT, createdAt: "", updatedAt: "" };
}

export async function upsertTermsDocument(input: UpsertTermsDocumentInput, sourceVersion?: string) {
  const db = requireDb();
  const version = input.version.trim();

  if (!version) {
    throw new Error("약관 버전은 필수입니다.");
  }

  if (!input.effectiveDate.trim()) {
    throw new Error("시행일은 필수입니다.");
  }

  if (!input.title.trim()) {
    throw new Error("약관 제목은 필수입니다.");
  }

  const notice = input.notice.map((line) => line.trim()).filter(Boolean);
  const sections = sanitizeSections(input.sections);

  if (sections.length === 0) {
    throw new Error("약관 조항은 최소 1개 이상 필요합니다.");
  }

  const targetRef = db.collection(TERMS_COLLECTION).doc(version);
  const targetSnapshot = await targetRef.get();
  const now = new Date().toISOString();

  await targetRef.set({
    version,
    effectiveDate: input.effectiveDate.trim(),
    title: input.title.trim(),
    notice,
    sections,
    createdAt: targetSnapshot.exists ? targetSnapshot.data()?.createdAt ?? now : now,
    updatedAt: now,
  });

  if (sourceVersion && sourceVersion !== version) {
    await db.collection(TERMS_COLLECTION).doc(sourceVersion).delete();
  }
}

export async function deleteTermsDocument(version: string) {
  const db = requireDb();
  const documents = await listTermsDocuments();

  if (documents.length <= 1) {
    throw new Error("최소 1개의 이용약관 문서는 유지되어야 합니다.");
  }

  await db.collection(TERMS_COLLECTION).doc(version).delete();
}
