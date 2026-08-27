import { NextRequest, NextResponse } from "next/server";

import {
  clearEmailVerification,
  createEmailVerification,
} from "@/lib/auth/email-verification";
import { sendSignupVerificationCode } from "@/lib/email/mailer";
import { findUserByEmail } from "@/lib/store/user-store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, message: "유효한 이메일을 입력해 주세요." },
      { status: 400 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { ok: false, message: "중복된 사용자입니다. 이미 가입된 이메일입니다." },
      { status: 409 },
    );
  }

  const verification = await createEmailVerification(email);
  if (!verification.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `${verification.retryAfter}초 후 인증번호를 다시 요청할 수 있습니다.`,
      },
      { status: 429 },
    );
  }

  try {
    await sendSignupVerificationCode(email, verification.code);
    return NextResponse.json({
      ok: true,
      message: "인증번호 6자리를 이메일로 보냈습니다.",
    });
  } catch (error) {
    await clearEmailVerification();
    console.error("Failed to send signup verification email", error);
    return NextResponse.json(
      { ok: false, message: "인증 이메일 발송에 실패했습니다." },
      { status: 500 },
    );
  }
}
