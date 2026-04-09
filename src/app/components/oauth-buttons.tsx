import { FcGoogle } from "react-icons/fc";
import { SiKakao, SiNaver } from "react-icons/si";

const providers = [
  {
    provider: "google",
    label: "Google로 로그인",
    tone: "border border-border bg-white text-slate-900 hover:bg-slate-50",
    icon: FcGoogle,
  },
  {
    provider: "naver",
    label: "Naver로 로그인",
    tone: "bg-[var(--color-naver,#03c75a)] text-white hover:brightness-95",
    icon: SiNaver,
  },
  {
    provider: "kakao",
    label: "Kakao로 로그인",
    tone: "bg-[var(--color-kakao,#fee500)] text-[var(--color-kakao-ink,#181600)] hover:brightness-95",
    icon: SiKakao,
  },
] as const;

export function OAuthButtons() {
  return (
    <div className="space-y-4 rounded-4xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5 md:p-7">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">소셜 로그인</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          가입된 계정이면 바로 로그인되고, 처음이면 회원가입 페이지로 이동합니다.
        </p>
      </div>

      <div className="grid gap-3">
        {providers.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.provider}
              href={`/auth/${item.provider}`}
              className={`flex items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-center text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
