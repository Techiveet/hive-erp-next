// lib/auth.ts

import { hash as bcryptHash, compare } from "bcryptjs";

import { betterAuth } from "better-auth";
import { prisma } from "@/lib/prisma";
import { prismaAdapter } from "better-auth/adapters/prisma";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

function originFromRequest(req?: Request): string | null {
  if (!req) return null;
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const host = req.headers.get("host");
  if (!host) return null;

  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${scheme}://${host}`;
}

export const auth = betterAuth({
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: BASE_URL,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: async (password) => bcryptHash(password, 10),
      verify: async ({ password, hash }) => compare(password, hash),
    },
  },

  trustedOrigins: async (request?: Request) => {
    const allow: string[] = [];
    if (BASE_URL) allow.push(BASE_URL);

    const raw = originFromRequest(request);
    if (!raw) return allow;

    try {
      const url = new URL(raw);
      const hostname = url.hostname;

      if (
        process.env.NODE_ENV !== "production" &&
        (hostname === "localhost" || hostname.endsWith(".localhost"))
      ) {
        allow.push(url.origin);
        return Array.from(new Set(allow));
      }

      const exists = await prisma.tenantDomain.findUnique({
        where: { domain: hostname },
        select: { domain: true },
      });

      if (exists) allow.push(url.origin);

      return Array.from(new Set(allow));
    } catch {
      return allow;
    }
  },
});
