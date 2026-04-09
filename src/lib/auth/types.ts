export type AuthProvider = "password" | "google" | "naver" | "kakao";
export type OAuthProvider = Exclude<AuthProvider, "password">;

export type AuthUser = {
  id: string;
  loginId: string;
  loginIdLower: string;
  email: string;
  emailLower: string;
  passwordHash: string | null;
  nickname: string;
  provider: AuthProvider;
  providerSubject: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = Pick<
  AuthUser,
  "id" | "loginId" | "email" | "nickname" | "provider" | "createdAt" | "updatedAt"
>;

export type SessionUser = PublicUser;

export type PendingOAuthSignup = {
  provider: OAuthProvider;
  email: string;
  nickname: string;
  providerSubject: string;
};

export type PendingSSORequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
};

export function toPublicUser(user: AuthUser): PublicUser {
  const { id, loginId, email, nickname, provider, createdAt, updatedAt } = user;

  return {
    id,
    loginId,
    email,
    nickname,
    provider,
    createdAt,
    updatedAt,
  };
}
