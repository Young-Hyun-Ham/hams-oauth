import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";

import "./globals.css";
import { AuthStoreHydrator } from "./components/auth-store-hydrator";

export const metadata: Metadata = {
  title: "Hams OAuth",
  description: "Hams 사이트 통합 로그인 시스템",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">  
        <AuthStoreHydrator viewer={user} pendingOAuthSignup={null} />
        {children}
      </body>
    </html>
  );
}
