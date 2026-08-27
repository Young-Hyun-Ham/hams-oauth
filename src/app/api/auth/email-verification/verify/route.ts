import { NextRequest, NextResponse } from "next/server";

import { verifyEmailCode } from "@/lib/auth/email-verification";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    code?: string;
  } | null;
  const email = body?.email?.trim() ?? "";
  const code = body?.code?.trim() ?? "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, message: "인증번호 6자리를 입력해 주세요." },
      { status: 400 },
    );
  }

  const result = await verifyEmailCode(email, code);
  return NextResponse.json(
    {
      ok: result.ok,
      message: result.ok ? "이메일 인증이 완료되었습니다." : result.error,
    },
    { status: result.ok ? 200 : 400 },
  );
}
