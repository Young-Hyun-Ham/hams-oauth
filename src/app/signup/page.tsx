import { redirect } from "next/navigation";

import { AuthStoreHydrator } from "@/app/components/auth-store-hydrator";
import { SignupForm } from "@/app/components/signup-form";
import { getPendingOAuthSignup, getSession } from "@/lib/auth/session";

export default async function SignupPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/");
  }

  const pendingOAuthSignup = await getPendingOAuthSignup();

  return (
    <main className="flex-1 bg-linear-to-b from-background via-rose-50/30 to-background px-6 py-10 md:px-10">
      <AuthStoreHydrator viewer={null} pendingOAuthSignup={pendingOAuthSignup} />

      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-border/60 bg-white/85 p-8 shadow-sm backdrop-blur-sm md:p-10">
          <div className="space-y-6">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">SIGN UP</div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              회원가입은 별도 페이지에서 처리합니다
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              일반 가입은 이메일과 비밀번호를 사용하고, OAuth 첫 로그인 사용자는 이 화면에서 로그인 ID와
              닉네임을 입력해 가입을 완료합니다.
            </p>
          </div>
        </div>

        <SignupForm />
      </section>
    </main>
  );
}
