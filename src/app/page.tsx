import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { isUsingFirestore, listUsers } from "@/lib/store/user-store";

const USERS_PER_PAGE = 10;

function getAllowedAdminEmails() {
  const rawValue = (process.env.NEXT_PUBLIC_ACCEPT_INCLUDE ?? "").trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {
    // Fallback to comma-separated values.
  }

  return rawValue
    .split(",")
    .map((value) => value.replace(/^\[?"?/, "").replace(/"?\]?$/, "").trim().toLowerCase())
    .filter(Boolean);
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ko-KR");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const viewer = session?.user ?? null;
  const allowedAdminEmails = getAllowedAdminEmails();
  const viewerEmail = viewer?.email.trim().toLowerCase() ?? "";
  const isAdmin = viewer ? allowedAdminEmails.includes(viewerEmail) : false;
  const users = isAdmin && isUsingFirestore() ? await listUsers() : [];
  const requestedPage = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;
  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const currentPage =
    Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = Math.min(startIndex + USERS_PER_PAGE, users.length);
  const pagedUsers = users.slice(startIndex, endIndex);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.12),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#fff7ed_42%,_#ffffff_100%)] px-6 py-10 md:px-10">
      <section className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center">
        <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
            HAMS OAuth
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            통합 로그인으로 이동하는 화면입니다.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 md:text-base">
            실제 로그인과 SSO 연결은 아래 버튼을 통해 `/login` 화면에서 진행됩니다.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            로그인 화면으로 이동
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {isAdmin ? (
        <section className="mx-auto mt-6 w-full max-w-5xl rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
                Admin
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                가입 사용자 목록
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                관리자 계정으로 로그인되어 있어 사용자 데이터를 확인할 수 있습니다.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              총 {users.length}명
            </div>
          </div>

          {!isUsingFirestore() ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Firebase Admin 설정이 없어 사용자 목록을 불러올 수 없습니다.
            </div>
          ) : users.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
              현재 등록된 사용자가 없습니다.
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <p>
                  {startIndex + 1}-{endIndex} / {users.length}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={currentPage > 1 ? `/?page=${currentPage - 1}` : "/?page=1"}
                    aria-disabled={currentPage === 1}
                    className={`rounded-full px-3 py-1.5 transition ${
                      currentPage === 1
                        ? "pointer-events-none bg-slate-100 text-slate-400"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    이전
                  </Link>
                  <Link
                    href={currentPage < totalPages ? `/?page=${currentPage + 1}` : `/?page=${totalPages}`}
                    aria-disabled={currentPage === totalPages}
                    className={`rounded-full px-3 py-1.5 transition ${
                      currentPage === totalPages
                        ? "pointer-events-none bg-slate-100 text-slate-400"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    다음
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {pagedUsers.map((user) => (
                  <details
                    key={user.id}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950">
                            {user.nickname}
                          </h3>
                          <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold uppercase text-primary">
                            {user.provider}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {user.loginId} · {user.email}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500">
                        가입일 {formatDate(user.createdAt)}
                      </div>
                    </summary>

                    <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm text-slate-700 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          User ID
                        </p>
                        <p className="mt-2 break-all">{user.id}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Updated
                        </p>
                        <p className="mt-2">{formatDate(user.updatedAt)}</p>
                      </div>
                    </div>

                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
                      {JSON.stringify(
                        {
                          ...user,
                          passwordHash: user.passwordHash ? "[redacted]" : null,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {pageNumbers.map((pageNumber) => (
                    <Link
                      key={pageNumber}
                      href={`/?page=${pageNumber}`}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        pageNumber === currentPage
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {pageNumber}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
