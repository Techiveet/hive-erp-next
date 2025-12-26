// lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/react";

function getBaseURL() {
  if (typeof window !== "undefined") return `${window.location.origin}/api/auth`;

  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  return `${env.replace(/\/$/, "")}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});
