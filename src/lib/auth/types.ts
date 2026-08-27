export type AuthProvider = "password" | "google" | "naver" | "kakao";
export type OAuthProvider = Exclude<AuthProvider, "password">;
export type AIChatType = "gpt" | "gemini" | "claude";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type ServicePlan = "basic" | "standard" | "premium";

export type ServiceMembership = {
  serviceSiteId: string;
  clientId: string;
  serviceName: string;
  plan: ServicePlan;
  monthlyPrice: number;
  joinedAt: string;
};

export type AuthUser = {
  id: string;
  loginId: string;
  loginIdLower: string;
  email: string;
  emailLower: string;
  passwordHash: string | null;
  nickname: string;
  phoneNumber: string;
  birthDate: string | null;
  gender: Gender | null;
  hampoBalance: number;
  serviceMemberships: ServiceMembership[];
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
  | "phoneNumber"
  | "birthDate"
  | "gender"
  | "hampoBalance"
  | "serviceMemberships"
  | "termsVersion"
>;

export type SessionUser = Omit<PublicUser, "apiKey">;

export type PendingOAuthSignup = {
  provider: OAuthProvider;
  email: string;
  nickname: string;
  providerSubject: string;
  birthDate: string | null;
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
    phoneNumber: user.phoneNumber,
    birthDate: user.birthDate,
    gender: user.gender,
    hampoBalance: user.hampoBalance,
    serviceMemberships: user.serviceMemberships,
    termsVersion: user.termsVersion,
  };
}

export function toSessionUser(
  user: AuthUser | PublicUser | SessionUser,
): SessionUser {
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
    chatModel: user.chatModel,
    phoneNumber: user.phoneNumber,
    birthDate: user.birthDate,
    gender: user.gender,
    hampoBalance: user.hampoBalance,
    serviceMemberships: user.serviceMemberships,
    termsVersion: user.termsVersion,
  };
}
