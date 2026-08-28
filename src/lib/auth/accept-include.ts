function getAcceptedEmails() {
  const rawValue = process.env.NEXT_PUBLIC_ACCEPT_INCLUDE?.trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (Array.isArray(parsedValue)) {
      return parsedValue.filter(
        (value): value is string => typeof value === "string",
      );
    }
  } catch {
    // 쉼표로 구분한 환경변수 형식도 지원합니다.
  }

  return rawValue.split(",");
}

const acceptedEmails = getAcceptedEmails().map((email) =>
  email.trim().toLowerCase(),
);

export function isAcceptIncluded(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return acceptedEmails.includes(email.trim().toLowerCase());
}
