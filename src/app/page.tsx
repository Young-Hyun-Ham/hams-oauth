// src/app/page.tsx
"use client";

import { useAuthStore } from "@/lib/store/auth-store";

export default function Page() {
  const {
    viewer,
  } = useAuthStore();
  console.log("Current user:", viewer);

  return (
    <div className="p-4">
      <h1>Welcome to the App</h1>
      <p>Current user: {viewer?.nickname || "Guest"}</p>
      <p>{JSON.stringify(viewer)}</p>
    </div>
  );
}
