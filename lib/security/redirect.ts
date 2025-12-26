// lib/security/redirect.ts
export function safeCallbackPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw) return fallback;

  // allow only relative paths inside your app
  // disallow: https://evil.com, //evil.com, javascript:, etc.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;

  // optionally block "logout" loops or weird auth pages
  const blocked = ["/sign-in", "/forgot-password", "/reset-password"];
  if (blocked.some((p) => raw.startsWith(p))) return fallback;

  return raw;
}
