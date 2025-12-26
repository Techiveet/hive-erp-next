"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { requestPasswordResetAction } from "../_actions";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email.trim().toLowerCase()), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalized = email.trim().toLowerCase();

    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordResetAction(normalized);

      // Always show success (avoid user enumeration)
      setSuccess("If that email exists, a reset link was sent.");
    } catch {
      // Still show success (avoid user enumeration)
      setSuccess("If that email exists, a reset link was sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we’ll send you a reset link.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            disabled={loading}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email.length > 0 && !emailValid && (
            <p className="text-[11px] text-destructive">Please enter a valid email.</p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border p-3 text-xs">
            {success}
          </div>
        )}

        <Button className="w-full" disabled={loading || !emailValid}>
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
