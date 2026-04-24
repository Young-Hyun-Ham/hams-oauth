export type AuthProvider = "password" | "google" | "naver" | "kakao";
export type OAuthProvider = Exclude<AuthProvider, "password">;
export type AIChatType = "gpt" | "gemini" | "claude";

export type AuthUser = {
  id: string;
  loginId: string;
  loginIdLower: string;
  email: string;
  emailLower: string;
  passwordHash: string | null;
  nickname: string;
  phoneNumber: string;
  aiEnabled: boolean;
  aiChatType: AIChatType | null;
  apiKey: string | null;
  chatModel: string | null;
  provider: AuthProvider;
  providerSubject: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = Pick<
  AuthUser,
  | "id"
  | "loginId"
  | "email"
  | "nickname"
  | "provider"
  | "createdAt"
  | "updatedAt"
  | "aiEnabled"
  | "aiChatType"
  | "apiKey"
  | "chatModel"
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
  return {
    id: user.id,
    loginId: user.loginId,
    email: user.email,
    nickname: user.nickname,
    provider: user.provider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    aiEnabled: user.aiEnabled,
    aiChatType: user.aiChatType,
    apiKey: user.apiKey,
    chatModel: user.chatModel,
  };
}
