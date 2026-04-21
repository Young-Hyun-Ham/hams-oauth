import Link from "next/link";
import { Globe, ScrollText, Settings } from "lucide-react";

import { AdminPasswordForm } from "@/app/components/admin-password-form";
import {
  removeServiceSite,
  removeTermsDocument,
  saveServiceSite,
  saveTermsDocument,
} from "@/app/actions/admin";
import { requireAdminAccess } from "@/lib/admin/access";
import {
  getAdminPasswordSecretPreview,
  getAdminSecuritySettings,
} from "@/lib/store/admin-settings-store";
import { listTermsDocuments } from "@/lib/store/admin-terms-store";
import {
  buildServiceSiteSsoConfig,
  listServiceSites,
  stringifyServiceSiteSsoConfig,
} from "@/lib/store/service-site-store";

const ADMIN_TABS = [
  { key: "terms", label: "이용약관", icon: ScrollText },
  { key: "sites", label: "서비스사이트", icon: Globe },
  { key: "settings", label: "설정", icon: Settings },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

function getActiveTab(value: string | string[] | undefined): AdminTab {
  return value === "sites" || value === "settings" ? value : "terms";
}

function getRequestedPage(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ko-KR");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAccess();

  const params = await searchParams;
  const activeTab = getActiveTab(params.tab);
  const [termsDocuments, serviceSites, adminSecuritySettings] = await Promise.all([
    listTermsDocuments(),
    listServiceSites(),
    getAdminSecuritySettings(),
  ]);
  const requestedTermsPage = getRequestedPage(params.page);
  const termsTotalPages = Math.max(1, termsDocuments.length);
  const currentTermsPage = Math.min(requestedTermsPage, termsTotalPages);
  const currentTermsDocument = termsDocuments[currentTermsPage - 1] ?? null;
  const requestedSitesPage = getRequestedPage(params.sitePage);
  const serviceSitesTotalPages = Math.max(1, serviceSites.length);
  const currentServiceSitesPage = Math.min(requestedSitesPage, serviceSitesTotalPages);
  const currentServiceSite = serviceSites[currentServiceSitesPage - 1] ?? null;
  const oauthVersion = process.env.npm_package_version ?? "0.1.0";
  const adminPasswordSecret = getAdminPasswordSecretPreview();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff8f1_32%,_#ffffff_100%)] px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
            Admin
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">관리 페이지</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                관리자만 접근 가능한 운영 화면입니다. 이용약관 버전, 서비스사이트, oauth 버전과 관리자 비밀번호를 관리할 수 있습니다.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              로그인 화면으로 이동
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <Link
                key={tab.key}
                href={`/admin?tab=${tab.key}`}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {activeTab === "terms" ? (
          <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">이용약관 등록</h2>
              <p className="mt-2 text-sm text-slate-600">
                새 약관 버전을 추가합니다. 조항은 JSON 배열 형식으로 입력합니다.
              </p>

              <form action={saveTermsDocument} className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">버전</span>
                  <input
                    name="version"
                    required
                    placeholder="2026-04-21"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">시행일</span>
                  <input
                    name="effectiveDate"
                    type="date"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">제목</span>
                  <input
                    name="title"
                    required
                    defaultValue={termsDocuments[0]?.title ?? "hams-oauth 서비스 이용약관"}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">안내 문구</span>
                  <textarea
                    name="noticeText"
                    rows={4}
                    defaultValue={
                      termsDocuments[0]?.notice.join("\n") ??
                      [
                        "서비스 약관은 회원가입 시점에 동의한 버전이 적용됩니다.",
                        "약관 내용은 사전 공지 없이 변경될 수 있으므로, 정기적으로 확인해 주시기 바랍니다.",
                      ].join("\n")
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">조항 JSON</span>
                  <textarea
                    name="sectionsJson"
                    rows={12}
                    defaultValue={JSON.stringify(termsDocuments[0]?.sections ?? [], null, 2)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  이용약관 버전 등록
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {currentTermsDocument ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          {currentTermsDocument.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          버전 {currentTermsDocument.version} · 시행일{" "}
                          {currentTermsDocument.effectiveDate}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500">
                        수정일 {formatDate(currentTermsDocument.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-600">
                        {currentTermsPage} / {termsTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin?tab=terms&page=${Math.max(1, currentTermsPage - 1)}`}
                          aria-disabled={currentTermsPage === 1}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            currentTermsPage === 1
                              ? "pointer-events-none bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          이전
                        </Link>
                        <Link
                          href={`/admin?tab=terms&page=${Math.min(termsTotalPages, currentTermsPage + 1)}`}
                          aria-disabled={currentTermsPage === termsTotalPages}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            currentTermsPage === termsTotalPages
                              ? "pointer-events-none bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          다음
                        </Link>
                      </div>
                    </div>
                  </div>

                  <form action={saveTermsDocument} className="mt-5 space-y-4">
                    <input
                      type="hidden"
                      name="sourceVersion"
                      value={currentTermsDocument.version}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-900">버전</span>
                        <input
                          name="version"
                          required
                          defaultValue={currentTermsDocument.version}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-900">시행일</span>
                        <input
                          name="effectiveDate"
                          type="date"
                          required
                          defaultValue={currentTermsDocument.effectiveDate}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                      </label>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">제목</span>
                      <input
                        name="title"
                        required
                        defaultValue={currentTermsDocument.title}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">안내 문구</span>
                      <textarea
                        name="noticeText"
                        rows={3}
                        defaultValue={currentTermsDocument.notice.join("\n")}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">조항 JSON</span>
                      <textarea
                        name="sectionsJson"
                        rows={12}
                        defaultValue={JSON.stringify(currentTermsDocument.sections, null, 2)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <button
                        type="submit"
                        className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        수정 저장
                      </button>
                    </div>
                  </form>

                  <form action={removeTermsDocument} className="mt-3">
                    <input type="hidden" name="version" value={currentTermsDocument.version} />
                    <button
                      type="submit"
                      className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      버전 삭제
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "sites" ? (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">서비스사이트 등록</h2>
              <p className="mt-2 text-sm text-slate-600">
                연동 중인 서비스사이트를 등록하고 관리합니다.
              </p>

              <form action={saveServiceSite} className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">이름</span>
                  <input
                    name="name"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">URL</span>
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">SSO Client ID</span>
                  <input
                    name="clientId"
                    required
                    placeholder="example-client-id"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">SSO Client Secret</span>
                  <input
                    name="clientSecret"
                    required
                    placeholder="example-client-secret"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">Allowed Origins</span>
                  <textarea
                    name="allowedOriginsText"
                    rows={3}
                    placeholder={"https://example.com\nhttp://localhost:3001"}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">Allowed Redirect URIs</span>
                  <textarea
                    name="allowedRedirectUrisText"
                    rows={3}
                    placeholder="https://example.com/auth/callback"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">설명</span>
                  <textarea
                    name="description"
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  서비스사이트 등록
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {currentServiceSite ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {currentServiceSite.name}
                      </h3>
                      <a
                        href={currentServiceSite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-sm text-primary underline underline-offset-4"
                      >
                        {currentServiceSite.url}
                      </a>
                      <p className="mt-2 text-xs text-slate-500">
                        수정일 {formatDate(currentServiceSite.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-600">
                        {currentServiceSitesPage} / {serviceSitesTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin?tab=sites&sitePage=${Math.max(1, currentServiceSitesPage - 1)}`}
                          aria-disabled={currentServiceSitesPage === 1}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            currentServiceSitesPage === 1
                              ? "pointer-events-none bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          이전
                        </Link>
                        <Link
                          href={`/admin?tab=sites&sitePage=${Math.min(serviceSitesTotalPages, currentServiceSitesPage + 1)}`}
                          aria-disabled={currentServiceSitesPage === serviceSitesTotalPages}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            currentServiceSitesPage === serviceSitesTotalPages
                              ? "pointer-events-none bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          다음
                        </Link>
                      </div>
                    </div>
                  </div>

                  <form action={saveServiceSite} className="mt-5 space-y-4">
                    <input type="hidden" name="id" value={currentServiceSite.id} />
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">이름</span>
                      <input
                        name="name"
                        required
                        defaultValue={currentServiceSite.name}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">URL</span>
                      <input
                        name="url"
                        type="url"
                        required
                        defaultValue={currentServiceSite.url}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">SSO Client ID</span>
                      <input
                        name="clientId"
                        required
                        defaultValue={currentServiceSite.clientId}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        SSO Client Secret
                      </span>
                      <input
                        name="clientSecret"
                        required
                        defaultValue={currentServiceSite.clientSecret}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">Allowed Origins</span>
                      <textarea
                        name="allowedOriginsText"
                        rows={3}
                        defaultValue={currentServiceSite.allowedOrigins.join("\n")}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        Allowed Redirect URIs
                      </span>
                      <textarea
                        name="allowedRedirectUrisText"
                        rows={3}
                        defaultValue={currentServiceSite.allowedRedirectUris.join("\n")}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">설명</span>
                      <textarea
                        name="description"
                        rows={4}
                        defaultValue={currentServiceSite.description}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">SSO 설정 JSON</span>
                      <textarea
                        readOnly
                        rows={10}
                        value={currentServiceSite.ssoConfigText}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      수정 저장
                    </button>
                  </form>

                  <form action={removeServiceSite} className="mt-3">
                    <input type="hidden" name="id" value={currentServiceSite.id} />
                    <button
                      type="submit"
                      className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      서비스사이트 삭제
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-8 text-sm text-slate-500">
                  등록된 서비스사이트가 없습니다.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-slate-950">설정</h2>
            <p className="mt-2 text-sm text-slate-600">
              현재 oauth 사이트 버전과 관리자 비밀번호 설정을 관리합니다.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  OAuth Version
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{oauthVersion}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Admin Password Secret
                </p>
                <p className="mt-3 break-all text-sm font-semibold text-slate-950">
                  {adminPasswordSecret}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  `.env`의 `ADMIN_PASSWORD_SECRET` 값이 관리자 비밀번호 해시에 사용됩니다.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50/70 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">관리자 비밀번호 설정</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    관리자 비밀번호는 DB에 직접 평문 저장하지 않고, 암호화 키가 반영된 해시 형태로 저장됩니다.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  마지막 저장: {formatDate(adminSecuritySettings.updatedAt)}
                </p>
              </div>

              <AdminPasswordForm />
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
