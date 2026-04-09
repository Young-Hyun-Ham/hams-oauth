import { NextRequest, NextResponse } from "next/server";

import { findPasswordUserByEmail } from "@/lib/store/user-store";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";

  if (!email) {
    return NextResponse.json(
      {
        available: false,
        message: "이메일을 입력하세요.",
      },
      { status: 400 },
    );
  }

  if (!email.includes("@")) {
    return NextResponse.json(
      {
        available: false,
        message: "유효한 이메일 형식이 아닙니다.",
      },
      { status: 400 },
    );
  }

  const existingUser = await findPasswordUserByEmail(email);

  if (existingUser) {
    return NextResponse.json({
      available: false,
      message: "이미 가입된 이메일입니다.",
    });
  }

  return NextResponse.json({
    available: true,
    message: "사용 가능한 이메일입니다.",
  });
}
