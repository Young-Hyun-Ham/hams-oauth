import axios from "axios";

import type { OAuthProvider, PendingOAuthSignup } from "@/lib/auth/types";

type OAuthProfile = PendingOAuthSignup;

function formatBirthDate(year: unknown, month: unknown, day: unknown) {
  const yearText = String(year ?? "").trim();
  const monthText = String(month ?? "").replace(/\D/g, "").padStart(2, "0");
  const dayText = String(day ?? "").replace(/\D/g, "").padStart(2, "0");

  if (!/^\d{4}$/.test(yearText) || !/^\d{2}$/.test(monthText) || !/^\d{2}$/.test(dayText)) {
    return null;
  }

  const value = `${yearText}-${monthText}-${dayText}`;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

async function getGoogleBirthDate(accessToken: string) {
  try {
    const response = await axios.get(
      "https://people.googleapis.com/v1/people/me?personFields=birthdays",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const birthday = Array.isArray(response.data.birthdays)
      ? response.data.birthdays.find((item: { date?: unknown }) => item?.date)?.date
      : null;
    return formatBirthDate(birthday?.year, birthday?.month, birthday?.day);
  } catch {
    return null;
  }
}

const providerLabels: Record<OAuthProvider, string> = {
  google: "Google",
  naver: "Naver",
  kakao: "Kakao",
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "naver" || value === "kakao";
}

function getClientId(provider: OAuthProvider) {
  return process.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID`];
}

function getClientSecret(provider: OAuthProvider) {
  return process.env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`];
}

function getRedirectUri(provider: OAuthProvider, origin: string) {
  return `${origin}/auth/${provider}/callback`;
}

export function getOAuthAuthorizationUrl(
  provider: OAuthProvider,
  origin: string,
  state: string,
) {
  const clientId = getClientId(provider);

  if (!clientId) {
    throw new Error(`${providerLabels[provider]} OAuth 환경변수가 없습니다.`);
  }

  const redirectUri = getRedirectUri(provider, origin);
  const params = new URLSearchParams();

  if (provider === "google") {
    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set(
      "scope",
      "openid email profile https://www.googleapis.com/auth/user.birthday.read",
    );
    params.set("state", state);
    params.set("prompt", "select_account");
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === "naver") {
    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("state", state);
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  }

  params.set("client_id", clientId);
  params.set("redirect_uri", redirectUri);
  params.set("response_type", "code");
  params.set("scope", "account_email profile_nickname birthday birthyear");
  params.set("state", state);
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForProfile(
  provider: OAuthProvider,
  code: string,
  state: string | null,
  origin: string,
) {
  if (provider === "google") {
    return getGoogleProfile(code, origin);
  }

  if (provider === "naver") {
    return getNaverProfile(code, state, origin);
  }

  return getKakaoProfile(code, origin);
}

async function getGoogleProfile(code: string, origin: string): Promise<OAuthProfile> {
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      client_id: getClientId("google") ?? "",
      client_secret: getClientSecret("google") ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri("google", origin),
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const accessToken = String(tokenResponse.data.access_token ?? "");

  const profileResponse = await axios.get(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const email = String(profileResponse.data.email ?? "");
  const providerSubject = String(profileResponse.data.sub ?? "");
  const nickname =
    String(profileResponse.data.name ?? "").trim() ||
    email.split("@")[0] ||
    "google-user";
  const birthDate = await getGoogleBirthDate(accessToken);

  if (!email || !providerSubject) {
    throw new Error("Google 계정에서 이메일 또는 식별자를 가져오지 못했습니다.");
  }

  return {
    provider: "google",
    email,
    nickname,
    providerSubject,
    birthDate,
  };
}

async function getNaverProfile(
  code: string,
  state: string | null,
  origin: string,
): Promise<OAuthProfile> {
  const tokenResponse = await axios.get("https://nid.naver.com/oauth2.0/token", {
    params: {
      grant_type: "authorization_code",
      client_id: getClientId("naver"),
      client_secret: getClientSecret("naver"),
      code,
      state: state ?? "",
      redirect_uri: getRedirectUri("naver", origin),
    },
  });

  const accessToken = String(tokenResponse.data.access_token ?? "");

  const profileResponse = await axios.get("https://openapi.naver.com/v1/nid/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = profileResponse.data.response ?? {};
  const email = String(profile.email ?? "");
  const providerSubject = String(profile.id ?? "");
  const nickname =
    String(profile.nickname ?? profile.name ?? "").trim() ||
    email.split("@")[0] ||
    "naver-user";
  const [birthMonth, birthDay] = String(profile.birthday ?? "").split("-");

  if (!email || !providerSubject) {
    throw new Error("Naver 계정에서 이메일 또는 식별자를 가져오지 못했습니다.");
  }

  return {
    provider: "naver",
    email,
    nickname,
    providerSubject,
    birthDate: formatBirthDate(profile.birthyear, birthMonth, birthDay),
  };
}

async function getKakaoProfile(code: string, origin: string): Promise<OAuthProfile> {
  const tokenResponse = await axios.post(
    "https://kauth.kakao.com/oauth/token",
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getClientId("kakao") ?? "",
      client_secret: getClientSecret("kakao") ?? "",
      redirect_uri: getRedirectUri("kakao", origin),
      code,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const accessToken = String(tokenResponse.data.access_token ?? "");

  const profileResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const account = profileResponse.data.kakao_account ?? {};
  const profile = account.profile ?? {};
  const email = String(account.email ?? "");
  const providerSubject = String(profileResponse.data.id ?? "");
  const nickname =
    String(profile.nickname ?? "").trim() || email.split("@")[0] || "kakao-user";
  const birthday = String(account.birthday ?? "");

  if (!email || !providerSubject) {
    throw new Error("Kakao 계정에서 이메일 또는 식별자를 가져오지 못했습니다.");
  }

  return {
    provider: "kakao",
    email,
    nickname,
    providerSubject,
    birthDate: formatBirthDate(
      account.birthyear,
      birthday.slice(0, 2),
      birthday.slice(2, 4),
    ),
  };
}
