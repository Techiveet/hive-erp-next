// app/(auth)/reset-password/[token]/reset-password-client.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { resetPasswordAction } from "../../_actions";
import { useState } from "react";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (password.trim().length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordAction(token, password.trim());
      setMsg("Password updated. You can now sign in.");
    } catch {
      setErr("Reset link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}
        {msg && (
          <div className="rounded-xl border p-3 text-xs">
            {msg}{" "}
            <Link href="/sign-in" className="underline underline-offset-2">
              Sign in
            </Link>
          </div>
        )}

        <Button className="w-full" disabled={loading}>
          {loading ? "Saving..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
