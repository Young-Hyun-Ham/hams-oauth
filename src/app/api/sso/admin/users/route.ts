import { NextResponse } from "next/server";

import { verifySsoClientCredentials } from "@/lib/auth/sso";
import { listUsers } from "@/lib/store/user-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = request.headers.get("x-hams-client-id")?.trim() ?? "";
  const clientSecret =
    request.headers.get("x-hams-client-secret")?.trim() ?? "";
  if (!(await verifySsoClientCredentials(clientId, clientSecret))) {
    return NextResponse.json(
      { ok: false, error: "invalid_client_credentials" },
      { status: 401 },
    );
  }

  const query =
    new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const users = (await listUsers())
    .filter((user) => {
      if (!query) return true;
      return `${user.nickname} ${user.phoneNumber} ${user.loginId} ${user.email}`
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 50)
    .map((user) => ({
      id: user.id,
      name: user.nickname || user.loginId,
      phone: user.phoneNumber,
      memberNumber: user.loginId || user.id,
      email: user.email,
    }));

  return NextResponse.json(
    { ok: true, users },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
