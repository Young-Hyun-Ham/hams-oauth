"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { getAdminUserSummaries } from "@/app/actions/admin";
import { AdminUnlockModal } from "@/app/components/admin-unlock-modal";

type AdminUserSummary = Awaited<
  ReturnType<typeof getAdminUserSummaries>
>[number];
const USERS_PER_PAGE = 10;

export function HomeClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const handleAdminResult = useCallback(async (success: boolean) => {
    if (!success) {
      setIsAdmin(false);
      return;
    }
    try {
      setUsers(await getAdminUserSummaries());
      setIsAdmin(true);
      setIsAdminModalOpen(false);
      setMessage("");
    } catch {
      setIsAdmin(false);
      setMessage("관리자 데이터를 불러오지 못했습니다.");
    }
  }, []);
  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const pagedUsers = useMemo(
    () => users.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE),
    [page, users],
  );

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
            로그인과 SSO 연결은 로그인 화면에서 진행합니다.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              로그인 화면 이동
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              관리자 로그인
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {message ? (
            <p className="mt-4 text-sm font-medium text-red-600">{message}</p>
          ) : null}
        </div>
      </section>
      {isAdmin ? (
        <section className="mx-auto mt-6 w-full max-w-5xl rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
                Admin
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                가입 사용자 목록
              </h2>
            </div>
            <Link
              href="/admin"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              관리 페이지
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {pagedUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-950">
                    {user.nickname}
                  </span>
                  <span className="text-xs uppercase text-primary">
                    {user.provider}
                  </span>
                </div>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {user.loginId} · {user.email}
                </p>
              </div>
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="mt-5 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setPage(number)}
                    className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold ${number === page ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {number}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      {isAdminModalOpen ? (
        <AdminUnlockModal
          onClose={() => setIsAdminModalOpen(false)}
          onResult={handleAdminResult}
        />
      ) : null}
    </main>
  );
}
