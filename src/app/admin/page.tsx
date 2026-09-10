import Link from "next/link";
import {
  Coins,
  Globe,
  ReceiptText,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

import { AdminPasswordForm } from "@/app/components/admin-password-form";
import { AdminHampoUsageTable } from "@/app/components/admin-hampo-usage-table";
import { AdminHampoChargeTable } from "@/app/components/admin-hampo-charge-table";
import { AdminUserHampoChargeModal } from "@/app/components/admin-user-hampo-charge-modal";
import { VisibilityToggle } from "@/app/components/visibility-toggle";
import { ServiceSiteDeleteButton } from "@/app/components/service-site-delete-button";
import { ServiceSiteSaveForm } from "@/app/components/service-site-save-form";
import { ServicePricingFields } from "@/app/components/service-pricing-fields";
import {
  removeAdminUser,
  removeTermsDocument,
  saveAdminUser,
  saveTermsDocument,
} from "@/app/actions/admin";
import { requireAdminAccess } from "@/lib/admin/access";
import {
  getAdminPasswordSecretPreview,
  getAdminSecuritySettings,
} from "@/lib/store/admin-settings-store";
import { listTermsDocuments } from "@/lib/store/admin-terms-store";
import { listServiceSites } from "@/lib/store/service-site-store";
import { listHampoChargeHistories } from "@/lib/store/hampo-history-store";
import {
  listHampoUsageHistories,
  type HampoRefundFilter,
} from "@/lib/store/hampo-usage-history-store";
import { listUsers } from "@/lib/store/user-store";
import { calculateProratedHampoRefund } from "@/lib/hampo/refund-policy";

const ADMIN_TABS = [
  { key: "terms", label: "이용약관", icon: ScrollText },
  { key: "sites", label: "서비스사이트", icon: Globe },
  { key: "users", label: "회원정보", icon: Users },
  { key: "hampo", label: "함포 충전이력", icon: Coins },
  { key: "usage", label: "함포 사용이력", icon: ReceiptText },
  { key: "settings", label: "설정", icon: Settings },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

function getActiveTab(value: string | string[] | undefined): AdminTab {
  return value === "sites" ||
    value === "users" ||
    value === "hampo" ||
    value === "usage" ||
    value === "settings"
    ? value
    : "terms";
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
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("ko-KR");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminAccess();

  const params = await searchParams;
  const activeTab = getActiveTab(params.tab);
  const [termsDocuments, serviceSites, adminSecuritySettings, users] =
    await Promise.all([
      listTermsDocuments(),
      listServiceSites(),
      getAdminSecuritySettings(),
      activeTab === "users" ? listUsers() : Promise.resolve([]),
    ]);

  const requestedTermsPage = getRequestedPage(params.page);
  const termsTotalPages = Math.max(1, termsDocuments.length);
  const currentTermsPage = Math.min(requestedTermsPage, termsTotalPages);
  const currentTermsDocument = termsDocuments[currentTermsPage - 1] ?? null;

  const requestedSitesPage = getRequestedPage(params.sitePage);
  const serviceSitesTotalPages = Math.max(1, serviceSites.length);
  const currentServiceSitesPage = Math.min(
    requestedSitesPage,
    serviceSitesTotalPages,
  );
  const currentServiceSite = serviceSites[currentServiceSitesPage - 1] ?? null;

  const searchedEmail =
    typeof params.email === "string" ? params.email.trim() : "";
  const hampoHistories =
    activeTab === "hampo" ? await listHampoChargeHistories(searchedEmail) : [];
  const requestedHampoPage = getRequestedPage(params.hampoPage);
  const hampoTotalPages = Math.max(1, Math.ceil(hampoHistories.length / 10));
  const currentHampoPage = Math.min(requestedHampoPage, hampoTotalPages);
  const pagedHampoHistories = hampoHistories.slice(
    (currentHampoPage - 1) * 10,
    currentHampoPage * 10,
  );
  const usageEmail =
    typeof params.usageEmail === "string" ? params.usageEmail.trim() : "";
  const usageServiceSiteId =
    typeof params.usageServiceSiteId === "string"
      ? params.usageServiceSiteId.trim()
      : "";
  const usageRefundStatusValue =
    typeof params.usageRefundStatus === "string"
      ? params.usageRefundStatus
      : "";
  const usageRefundStatus: HampoRefundFilter =
    usageRefundStatusValue === "available" ||
    usageRefundStatusValue === "pending" ||
    usageRefundStatusValue === "partial" ||
    usageRefundStatusValue === "full"
      ? usageRefundStatusValue
      : "";
  const usageHistories =
    activeTab === "usage"
      ? await listHampoUsageHistories(
          usageEmail,
          usageServiceSiteId,
          usageRefundStatus,
        )
      : [];
  const usageRefundPreviews = usageHistories.reduce<
    Record<
      string,
      {
        originalAmount: number;
        usedAmount: number;
        refundAmount: number;
        usedDays: number;
        daysInMonth: number;
      }
    >
  >((previews, history) => {
    if (history.refundRequestStatus !== "pending" || !history.refundRequestId) {
      return previews;
    }

    const remainingAmount = Math.max(
      0,
      history.refundableAmount - history.refundedAmount,
    );
    const calculation = calculateProratedHampoRefund(
      remainingAmount,
      history.createdAt,
    );
    const current = previews[history.refundRequestId] ?? {
      originalAmount: 0,
      usedAmount: 0,
      refundAmount: 0,
      usedDays: calculation.usedDays,
      daysInMonth: calculation.daysInMonth,
    };
    previews[history.refundRequestId] = {
      originalAmount: current.originalAmount + calculation.originalAmount,
      usedAmount: current.usedAmount + calculation.usedAmount,
      refundAmount: current.refundAmount + calculation.refundAmount,
      usedDays: Math.max(current.usedDays, calculation.usedDays),
      daysInMonth: Math.max(current.daysInMonth, calculation.daysInMonth),
    };
    return previews;
  }, {});
  const requestedUsagePage = getRequestedPage(params.usagePage);
  const usageTotalPages = Math.max(1, Math.ceil(usageHistories.length / 10));
  const currentUsagePage = Math.min(requestedUsagePage, usageTotalPages);
  const pagedUsageHistories = usageHistories.slice(
    (currentUsagePage - 1) * 10,
    currentUsagePage * 10,
  );

  const requestedUserPage = getRequestedPage(params.userPage);
  const userTotalPages = Math.max(1, Math.ceil(users.length / 10));
  const currentUserPage = Math.min(requestedUserPage, userTotalPages);
  const pagedUsers = users.slice(
    (currentUserPage - 1) * 10,
    currentUserPage * 10,
  );
  const selectedUserId = typeof params.userId === "string" ? params.userId : "";
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const userMode =
    params.userMode === "charge" ||
    params.userMode === "edit" ||
    params.userMode === "delete"
      ? params.userMode
      : "";
  const userMessage =
    typeof params.userMessage === "string" ? params.userMessage : "";
  const userError =
    typeof params.userError === "string" ? params.userError : "";

  function getUserHref(userId?: string, mode?: string) {
    const query = new URLSearchParams({
      tab: "users",
      userPage: String(currentUserPage),
    });
    if (userId) query.set("userId", userId);
    if (mode) query.set("userMode", mode);
    return `/admin?${query.toString()}`;
  }

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
              <h1 className="text-3xl font-semibold text-slate-950">
                관리 페이지
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                이용약관 버전, 서비스사이트, OAuth 설정과 관리자 비밀번호를
                관리합니다.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:ml-auto md:shrink-0">
              <Link
                href="/login"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                로그인 화면으로 이동
              </Link>
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                홈 화면으로 이동
              </Link>
            </div>
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
              <h2 className="text-xl font-semibold text-slate-950">
                이용약관 등록
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                새 약관 버전을 등록합니다. 조항은 JSON 배열 형식으로 입력합니다.
              </p>

              <form action={saveTermsDocument} className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    버전
                  </span>
                  <input
                    name="version"
                    required
                    placeholder="2026-04-21"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    시행일
                  </span>
                  <input
                    name="effectiveDate"
                    type="date"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    제목
                  </span>
                  <input
                    name="title"
                    required
                    defaultValue={
                      termsDocuments[0]?.title ?? "hams-oauth 서비스 이용약관"
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    안내 문구
                  </span>
                  <textarea
                    name="noticeText"
                    rows={4}
                    defaultValue={
                      termsDocuments[0]?.notice.join("\n") ??
                      [
                        "서비스 약관은 회원가입 시점의 동의된 버전으로 적용됩니다.",
                        "약관 내용은 사전 공지 없이 변경될 수 있으므로 정기적으로 확인해 주세요.",
                      ].join("\n")
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    조항 JSON
                  </span>
                  <textarea
                    name="sectionsJson"
                    rows={12}
                    defaultValue={JSON.stringify(
                      termsDocuments[0]?.sections ?? [],
                      null,
                      2,
                    )}
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
                <div
                  key={currentTermsDocument.version}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          {currentTermsDocument.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          버전 {currentTermsDocument.version} / 시행일{" "}
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
                        <span className="text-sm font-medium text-slate-900">
                          버전
                        </span>
                        <input
                          name="version"
                          required
                          defaultValue={currentTermsDocument.version}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-900">
                          시행일
                        </span>
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
                      <span className="text-sm font-medium text-slate-900">
                        제목
                      </span>
                      <input
                        name="title"
                        required
                        defaultValue={currentTermsDocument.title}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        안내 문구
                      </span>
                      <textarea
                        name="noticeText"
                        rows={3}
                        defaultValue={currentTermsDocument.notice.join("\n")}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        조항 JSON
                      </span>
                      <textarea
                        name="sectionsJson"
                        rows={12}
                        defaultValue={JSON.stringify(
                          currentTermsDocument.sections,
                          null,
                          2,
                        )}
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
                    <input
                      type="hidden"
                      name="version"
                      value={currentTermsDocument.version}
                    />
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
              <h2 className="text-xl font-semibold text-slate-950">
                서비스사이트 등록
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                연동 중인 서비스사이트를 등록하고 관리합니다.
              </p>

              <ServiceSiteSaveForm
                className="mt-6 space-y-4"
                submitLabel="서비스사이트 등록"
                submitClassName="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    이름
                  </span>
                  <input
                    name="name"
                    required
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    URL
                  </span>
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    SSO Client ID
                  </span>
                  <input
                    name="clientId"
                    required
                    placeholder="example-client-id"
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
                    placeholder="example-client-secret"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    Allowed Origins
                  </span>
                  <textarea
                    name="allowedOriginsText"
                    rows={3}
                    placeholder={"https://example.com\nhttp://localhost:3001"}
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
                    placeholder="https://example.com/auth/callback"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    설명
                  </span>
                  <textarea
                    name="description"
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <ServicePricingFields />
              </ServiceSiteSaveForm>
            </div>

            <div className="space-y-4">
              {currentServiceSite ? (
                <div
                  key={currentServiceSite.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
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
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            currentServiceSite.isVisible
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {currentServiceSite.isVisible ? "노출 중" : "숨김"}
                        </span>
                        <span className="text-xs text-slate-500">
                          수정일 {formatDate(currentServiceSite.updatedAt)}
                        </span>
                      </div>
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
                          aria-disabled={
                            currentServiceSitesPage === serviceSitesTotalPages
                          }
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

                  <ServiceSiteSaveForm
                    className="mt-5 space-y-4"
                    submitLabel="수정 저장"
                    submitClassName="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    actions={
                      <ServiceSiteDeleteButton site={currentServiceSite} />
                    }
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={currentServiceSite.id}
                    />
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        이름
                      </span>
                      <input
                        name="name"
                        required
                        defaultValue={currentServiceSite.name}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        URL
                      </span>
                      <input
                        name="url"
                        type="url"
                        required
                        defaultValue={currentServiceSite.url}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        SSO Client ID
                      </span>
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
                      <span className="text-sm font-medium text-slate-900">
                        Allowed Origins
                      </span>
                      <textarea
                        name="allowedOriginsText"
                        rows={3}
                        defaultValue={currentServiceSite.allowedOrigins.join(
                          "\n",
                        )}
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
                        defaultValue={currentServiceSite.allowedRedirectUris.join(
                          "\n",
                        )}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        설명
                      </span>
                      <textarea
                        name="description"
                        rows={4}
                        defaultValue={currentServiceSite.description}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </label>
                    <ServicePricingFields
                      defaultEnabled={currentServiceSite.isFixedPricing}
                      prices={currentServiceSite.prices}
                    />
                    <VisibilityToggle
                      name="isVisible"
                      defaultChecked={currentServiceSite.isVisible}
                    />
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-900">
                        SSO 설정 JSON
                      </span>
                      <textarea
                        readOnly
                        rows={10}
                        value={currentServiceSite.ssoConfigText}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs outline-none"
                      />
                    </label>
                  </ServiceSiteSaveForm>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-8 text-sm text-slate-500">
                  등록된 서비스사이트가 없습니다.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm [&_a]:cursor-pointer [&_button]:cursor-pointer md:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  회원정보
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  회원을 선택해 정보를 수정하거나 함포를 충전하고 계정을 삭제할
                  수 있습니다.
                </p>
              </div>
              <p className="text-sm font-medium text-slate-600">
                총 {users.length.toLocaleString("ko-KR")}명
              </p>
            </div>

            {userMessage ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {userMessage}
              </p>
            ) : null}
            {userError ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {userError}
              </p>
            ) : null}

            <div className="relative min-h-[32rem] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/50">
              <div className="hidden grid-cols-[1.1fr_1.4fr_1fr_0.8fr_0.7fr] gap-3 border-b border-slate-200 bg-slate-100/80 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
                <span>회원</span>
                <span>이메일</span>
                <span>로그인 ID</span>
                <span>가입 방식</span>
                <span className="text-right">보유 함포</span>
              </div>

              {pagedUsers.length === 0 ? (
                <div className="flex min-h-80 items-center justify-center p-8 text-sm text-slate-500">
                  등록된 회원정보가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {pagedUsers.map((user) => (
                    <Link
                      key={user.id}
                      href={getUserHref(user.id)}
                      className="grid gap-2 bg-white px-5 py-4 transition hover:bg-primary/5 md:grid-cols-[1.1fr_1.4fr_1fr_0.8fr_0.7fr] md:items-center md:gap-3"
                    >
                      <span className="font-semibold text-slate-950">
                        {user.nickname || "-"}
                      </span>
                      <span className="break-all text-sm text-slate-600">
                        {user.email}
                      </span>
                      <span className="text-sm text-slate-600">
                        {user.loginId || "-"}
                      </span>
                      <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                        {user.provider}
                      </span>
                      <span className="font-semibold text-primary md:text-right">
                        {user.hampoBalance.toLocaleString("ko-KR")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {selectedUser ? (
                <div className="absolute inset-0 z-10 overflow-y-auto bg-white/[0.98] p-5 backdrop-blur-sm md:p-7">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Selected Member
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedUser.nickname}
                      </h3>
                      <p className="mt-1 break-all text-sm text-slate-600">
                        {selectedUser.email}
                      </p>
                    </div>
                    <Link
                      href={getUserHref()}
                      aria-label="회원 상세 닫기"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-100"
                    >
                      ×
                    </Link>
                  </div>

                  <div className="mt-6 flex flex-col gap-6 lg:flex-row">
                    <div className="min-w-0 flex-1 space-y-5">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["로그인 ID", selectedUser.loginId || "-"],
                          ["가입 방식", selectedUser.provider],
                          ["전화번호", selectedUser.phoneNumber || "-"],
                          ["생년월일", selectedUser.birthDate || "-"],
                          ["성별", selectedUser.gender || "-"],
                          [
                            "보유 함포",
                            `${selectedUser.hampoBalance.toLocaleString("ko-KR")}함포`,
                          ],
                          ["가입일", formatDate(selectedUser.createdAt)],
                          ["수정일", formatDate(selectedUser.updatedAt)],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl bg-slate-50 p-4"
                          >
                            <dt className="text-xs font-medium text-slate-500">
                              {label}
                            </dt>
                            <dd className="mt-1 break-all text-sm font-semibold text-slate-900">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {userMode === "charge" ? (
                        <AdminUserHampoChargeModal
                          user={{
                            id: selectedUser.id,
                            nickname: selectedUser.nickname,
                            email: selectedUser.email,
                            hampoBalance: selectedUser.hampoBalance,
                          }}
                          closeHref={getUserHref(selectedUser.id)}
                        />
                      ) : null}

                      {userMode === "edit" ? (
                        <form
                          action={saveAdminUser}
                          className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={selectedUser.id}
                          />
                          <input
                            type="hidden"
                            name="userPage"
                            value={currentUserPage}
                          />
                          <label className="space-y-2">
                            <span className="text-sm font-medium">
                              로그인 ID
                            </span>
                            <input
                              name="loginId"
                              required
                              defaultValue={selectedUser.loginId}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">이메일</span>
                            <input
                              name="email"
                              type="email"
                              required
                              defaultValue={selectedUser.email}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">닉네임</span>
                            <input
                              name="nickname"
                              required
                              defaultValue={selectedUser.nickname}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">
                              전화번호
                            </span>
                            <input
                              name="phoneNumber"
                              defaultValue={selectedUser.phoneNumber}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">
                              생년월일
                            </span>
                            <input
                              name="birthDate"
                              type="date"
                              defaultValue={selectedUser.birthDate ?? ""}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-medium">성별</span>
                            <select
                              name="gender"
                              defaultValue={selectedUser.gender ?? ""}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-primary"
                            >
                              <option value="">미선택</option>
                              <option value="male">남성</option>
                              <option value="female">여성</option>
                              <option value="other">기타</option>
                              <option value="prefer_not_to_say">
                                응답 안 함
                              </option>
                            </select>
                          </label>
                          <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white sm:col-span-2">
                            회원정보 저장
                          </button>
                        </form>
                      ) : null}

                      {userMode === "delete" ? (
                        <form
                          action={removeAdminUser}
                          className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-5"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={selectedUser.id}
                          />
                          <input
                            type="hidden"
                            name="userPage"
                            value={currentUserPage}
                          />
                          <div>
                            <h4 className="font-semibold text-rose-900">
                              회원 삭제
                            </h4>
                            <p className="mt-1 text-sm leading-6 text-rose-700">
                              삭제한 회원정보는 복구할 수 없습니다. 확인을 위해
                              아래에 회원 이메일을 입력하세요.
                            </p>
                          </div>
                          <input
                            name="deleteConfirmation"
                            required
                            placeholder={selectedUser.email}
                            className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 outline-none focus:border-rose-400"
                          />
                          <label className="flex items-start gap-2 text-sm text-rose-800">
                            <input
                              name="deleteAcknowledged"
                              type="checkbox"
                              required
                              className="mt-1"
                            />
                            회원정보가 영구 삭제되는 것을 확인했습니다.
                          </label>
                          <button className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white">
                            회원 삭제하기
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <aside className="flex shrink-0 flex-row gap-2 lg:w-40 lg:flex-col lg:border-l lg:border-slate-200 lg:pl-5">
                      <Link
                        href={getUserHref(selectedUser.id, "charge")}
                        scroll={false}
                        className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                          userMode === "charge"
                            ? "bg-primary text-primary-foreground"
                            : "border border-primary/30 text-primary hover:bg-primary/5"
                        }`}
                      >
                        함포 충전
                      </Link>
                      <Link
                        href={getUserHref(selectedUser.id, "edit")}
                        className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                          userMode === "edit"
                            ? "bg-slate-950 text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        수정
                      </Link>
                      <Link
                        href={getUserHref(selectedUser.id, "delete")}
                        className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                          userMode === "delete"
                            ? "bg-rose-600 text-white"
                            : "border border-rose-200 text-rose-600 hover:bg-rose-50"
                        }`}
                      >
                        삭제
                      </Link>
                    </aside>
                  </div>
                </div>
              ) : null}
            </div>

            {userTotalPages > 1 ? (
              <nav
                className="flex flex-wrap justify-center gap-2"
                aria-label="회원정보 페이지"
              >
                {Array.from(
                  { length: userTotalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <Link
                    key={page}
                    href={`/admin?tab=users&userPage=${page}`}
                    aria-current={page === currentUserPage ? "page" : undefined}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold ${
                      page === currentUserPage
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </Link>
                ))}
              </nav>
            ) : null}
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-slate-950">설정</h2>
            <p className="mt-2 text-sm text-slate-600">
              현재 OAuth 버전과 관리자 비밀번호 설정을 관리합니다.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  OAuth Version
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {oauthVersion}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Admin Password Secret
                </p>
                <p className="mt-3 break-all text-sm font-semibold text-slate-950">
                  {adminPasswordSecret}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  `.env`의 `ADMIN_PASSWORD_SECRET` 값이 관리자 비밀번호 해시에
                  사용됩니다.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50/70 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    관리자 비밀번호 설정
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    관리자 비밀번호는 DB에 직접 평문 저장하지 않고, 해시 형태로
                    저장됩니다.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  마지막 변경 {formatDate(adminSecuritySettings.updatedAt)}
                </p>
              </div>

              <AdminPasswordForm />
            </div>
          </section>
        ) : null}

        {activeTab === "usage" ? (
          <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                함포 사용이력
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                전체 회원의 서비스별 함포 사용과 차감 전·후 잔액, 환불 상태를
                조회합니다.
              </p>
            </div>

            <form
              method="get"
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
            >
              <input type="hidden" name="tab" value="usage" />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    회원 이메일
                  </span>
                  <input
                    name="usageEmail"
                    type="email"
                    defaultValue={usageEmail}
                    placeholder="조회할 회원 이메일"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    사용 서비스
                  </span>
                  <select
                    name="usageServiceSiteId"
                    defaultValue={usageServiceSiteId}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  >
                    <option value="">전체 서비스</option>
                    {serviceSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    환불 상태
                  </span>
                  <select
                    name="usageRefundStatus"
                    defaultValue={usageRefundStatus}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  >
                    <option value="">전체 상태</option>
                    <option value="available">환불 가능</option>
                    <option value="pending">환불 요청중</option>
                    <option value="partial">부분 환불</option>
                    <option value="full">환불 완료</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="cursor-pointer rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  조회
                </button>
                {usageEmail || usageServiceSiteId || usageRefundStatus ? (
                  <Link
                    href="/admin?tab=usage"
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    초기화
                  </Link>
                ) : null}
              </div>
            </form>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>총 {usageHistories.length.toLocaleString("ko-KR")}건</span>
              <span>
                {currentUsagePage} / {usageTotalPages} 페이지
              </span>
            </div>

            {pagedUsageHistories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                조회된 함포 사용이력이 없습니다.
              </div>
            ) : (
              <AdminHampoUsageTable
                histories={pagedUsageHistories}
                refundPreviews={usageRefundPreviews}
              />
            )}

            {usageTotalPages > 1 ? (
              <nav
                className="flex flex-wrap justify-center gap-2"
                aria-label="함포 사용이력 페이지"
              >
                {Array.from(
                  { length: usageTotalPages },
                  (_, index) => index + 1,
                ).map((page) => {
                  const query = new URLSearchParams({
                    tab: "usage",
                    usagePage: String(page),
                  });
                  if (usageEmail) query.set("usageEmail", usageEmail);
                  if (usageServiceSiteId) {
                    query.set("usageServiceSiteId", usageServiceSiteId);
                  }
                  if (usageRefundStatus) {
                    query.set("usageRefundStatus", usageRefundStatus);
                  }
                  return (
                    <Link
                      key={page}
                      href={`/admin?${query.toString()}`}
                      aria-current={
                        page === currentUsagePage ? "page" : undefined
                      }
                      className={`inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold ${
                        page === currentUsagePage
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </section>
        ) : null}

        {activeTab === "hampo" ? (
          <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                함포 충전이력
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                사용자별 함포 충전 내역과 충전 전·후 잔액을 조회합니다.
              </p>
            </div>

            <form
              method="get"
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
            >
              <input type="hidden" name="tab" value="hampo" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 space-y-2">
                  <span className="text-sm font-medium text-slate-900">
                    이메일
                  </span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={searchedEmail}
                    placeholder="조회할 회원 이메일을 입력하세요"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  조회
                </button>
                {searchedEmail ? (
                  <Link
                    href="/admin?tab=hampo"
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    초기화
                  </Link>
                ) : null}
              </div>
            </form>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>총 {hampoHistories.length.toLocaleString("ko-KR")}건</span>
              <span>
                {currentHampoPage} / {hampoTotalPages} 페이지
              </span>
            </div>

            {pagedHampoHistories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                조회된 충전이력이 없습니다.
              </div>
            ) : (
              <AdminHampoChargeTable histories={pagedHampoHistories} />
            )}

            {hampoTotalPages > 1 ? (
              <nav
                className="flex flex-wrap justify-center gap-2"
                aria-label="충전이력 페이지"
              >
                {Array.from(
                  { length: hampoTotalPages },
                  (_, index) => index + 1,
                ).map((page) => {
                  const query = new URLSearchParams({
                    tab: "hampo",
                    hampoPage: String(page),
                  });
                  if (searchedEmail) query.set("email", searchedEmail);
                  return (
                    <Link
                      key={page}
                      href={`/admin?${query.toString()}`}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold ${page === currentHampoPage ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      {page}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
