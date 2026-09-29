import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hams OAuth",
    short_name: "Hams OAuth",
    description: "Hams 사이트 통합 로그인 시스템",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b172a",
    theme_color: "#0b172a",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
