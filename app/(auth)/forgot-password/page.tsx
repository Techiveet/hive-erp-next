// app/(auth)/forgot-password/page.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { requestPasswordResetAction } from "../_actions";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setErr("Enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetAction(normalized);
      setMsg("If that email exists, a reset link was sent.");
    } catch (e: any) {
      setErr("Unable to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We’ll email you a link to reset your password.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
            disabled={loading}
          />
        </div>

        {err && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}
        {msg && <div className="rounded-xl border p-3 text-xs">{msg}</div>}

        <Button className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>

        <div className="text-center text-xs text-muted-foreground">
          <Link href="/sign-in" className="hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
