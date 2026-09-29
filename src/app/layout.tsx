import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";

import "./globals.css";
import { AuthStoreHydrator } from "./components/auth-store-hydrator";

export const metadata: Metadata = {
  title: "Hams OAuth",
  description: "Hams 사이트 통합 로그인 시스템",
  applicationName: "Hams OAuth",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
