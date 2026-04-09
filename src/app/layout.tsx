import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";

import "./globals.css";
import { AuthStoreHydrator } from "./components/auth-store-hydrator";

export const metadata: Metadata = {
  title: "YUMMYNAIL SHOP",
  description: "Next.js로 이식한 네일샵 쇼케이스와 관리자 화면",
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
