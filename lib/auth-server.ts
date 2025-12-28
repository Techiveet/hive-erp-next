// lib/auth-server.ts

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type CurrentSessionResult = {
  session: Awaited<ReturnType<typeof auth.api.getSession>> | null;
  user: any | null;
};

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of h.entries()) {
    if (typeof v === "string" && v.length) out[k] = v;
  }
  return out;
}

/**
 * Server-only session getter (Server Components + Server Actions only)
 */
export async function getCurrentSession(): Promise<CurrentSessionResult> {
  try {
    const h = await headers(); // Next.js 16 can await headers()
    const session = await auth.api.getSession({ headers: headersToObject(h) });

    const user = (session as any)?.user ?? null;
    return { session: session ?? null, user };
  } catch {
    return { session: null, user: null };
  }
}

/**
 * Server-only guard
 */
export async function requireUser() {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");
  return user;
}
