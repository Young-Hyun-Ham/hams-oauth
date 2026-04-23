import { redirect } from "next/navigation";

import { ProfileForm } from "@/app/components/profile-form";
import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/store/user-store";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  const user = await findUserById(session.userId);

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-border/60 bg-white/85 p-8 shadow-sm backdrop-blur-sm md:p-10">
          <div className="space-y-6">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              PROFILE
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              회원정보를 직접 수정할 수 있습니다.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              현재 계정의 로그인 ID, 닉네임, 전화번호를 변경하고 바로 반영할 수 있습니다.
            </p>
          </div>
        </div>

        <ProfileForm user={user} />
      </section>
    </main>
  );
}
