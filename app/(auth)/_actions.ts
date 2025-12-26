// app/(auth)/_actions.ts
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Build-safe absolute base URL for server-to-server fetch calls.
 */
function serverBaseUrl() {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return env.replace(/\/$/, "");
}

/**
 * Better Auth mounted at /api/auth
 */
function authBaseUrl() {
  return `${serverBaseUrl()}/api/auth`;
}

export async function userHasTwoFactorEnabled(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // No twoFactorEnabled field in your schema yet → always false
  await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  return false;
}

export async function requestPasswordResetAction(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const res = await fetch(`${authBaseUrl()}/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("FORGOT_PASSWORD_FAILED");
  return { ok: true };
}

export async function resetPasswordAction(token: string, newPassword: string) {
  const res = await fetch(`${authBaseUrl()}/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password: newPassword }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("RESET_PASSWORD_FAILED");
  return { ok: true };
}

/**
 * ✅ Logout action (Better Auth requires request headers to clear cookies)
 */
export async function logoutAction() {
  const h = await headers(); // ✅ must await in Next 16.1.x here

  // ReadonlyHeaders supports entries()
  const headersInit = Object.fromEntries(h.entries());

  await auth.api.signOut({
    headers: headersInit,
  });

  return { ok: true };
}
