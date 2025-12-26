"use client";

import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { userHasTwoFactorEnabled } from "../_actions";

/* -------------------------------------------------------------------------- */
/* Rate limiter                                                               */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "hive_login_limiter";
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

type LoginLimiterState = {
  attempts: number;
  lockedUntil: number; // ms timestamp, 0 = not locked
};

const DEFAULT_LIMITER: LoginLimiterState = { attempts: 0, lockedUntil: 0 };

function readLimiter(): LoginLimiterState {
  if (typeof window === "undefined") return DEFAULT_LIMITER;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIMITER;

    const parsed = JSON.parse(raw) as Partial<LoginLimiterState>;
    const attempts = Number(parsed.attempts ?? 0);
    const lockedUntil = Number(parsed.lockedUntil ?? 0);

    // heal invalid
    if (!Number.isFinite(attempts) || !Number.isFinite(lockedUntil)) return DEFAULT_LIMITER;

    // auto-unlock if time passed
    if (lockedUntil && Date.now() >= lockedUntil) return DEFAULT_LIMITER;

    return { attempts, lockedUntil };
  } catch {
    return DEFAULT_LIMITER;
  }
}

function writeLimiter(state: LoginLimiterState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetLimiter() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function secondsRemaining(lockedUntil: number) {
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

/* -------------------------------------------------------------------------- */

type SignInClientProps = {
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    faviconUrl?: string | null;
  } | null;
};

export function SignInClient({ brand }: SignInClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ------------------------------------------------------------------------ */
  /* Branding                                                                 */
  /* ------------------------------------------------------------------------ */

  const appTitle = brand?.titleText?.trim() || "Hive";
  const logoLight = brand?.logoLightUrl || null;
  const logoDark = brand?.logoDarkUrl || null;
  const hasLight = !!logoLight;
  const hasDark = !!logoDark;

  const rawCallback = searchParams.get("callbackURL")?.toString() ?? null;
  const callbackURL = !rawCallback || rawCallback === "/" ? "/dashboard" : rawCallback;

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limiter, setLimiter] = useState<LoginLimiterState>(DEFAULT_LIMITER);
  const [tick, setTick] = useState(() => Date.now());

  // UI only
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Init limiter + timer                                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    // load limiter once
    const initial = readLimiter();
    setLimiter(initial);

    // 1s ticker for countdown
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // auto-reset limiter when lock expires (so you don't stay stuck)
  useEffect(() => {
    if (limiter.lockedUntil && Date.now() >= limiter.lockedUntil) {
      setLimiter(DEFAULT_LIMITER);
      resetLimiter();
    }
  }, [tick, limiter.lockedUntil]);

  // sign-out + limiter reset when ?switch=1
  useEffect(() => {
    if (searchParams.get("switch") !== "1") return;

    (async () => {
      try {
        await authClient.signOut();
      } catch (e) {
        console.error(e);
      } finally {
        setLimiter(DEFAULT_LIMITER);
        resetLimiter();

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("switch");
          window.history.replaceState(null, "", url.toString());
        }
      }
    })();
  }, [searchParams]);

  /* ------------------------------------------------------------------------ */
  /* Validation + limiter computed                                            */
  /* ------------------------------------------------------------------------ */

  const isLocked = useMemo(() => limiter.lockedUntil > 0 && limiter.lockedUntil > tick, [
    limiter.lockedUntil,
    tick,
  ]);

  const remainingSeconds = useMemo(() => {
    if (!isLocked) return 0;
    return secondsRemaining(limiter.lockedUntil);
  }, [isLocked, limiter.lockedUntil, tick]);

  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(form.email.trim()), [form.email]);
  const passwordValid = useMemo(() => form.password.trim().length >= 8, [form.password]);
  const formValid = emailValid && passwordValid && !isLocked;

  function bumpLimiterFailure() {
    setLimiter((prev) => {
      // heal expired lock in state
      const healed = prev.lockedUntil && Date.now() >= prev.lockedUntil ? DEFAULT_LIMITER : prev;

      const attempts = healed.attempts + 1;

      // lock exactly when attempts hits MAX_ATTEMPTS
      const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_SECONDS * 1000 : 0;

      const next: LoginLimiterState = { attempts, lockedUntil };
      writeLimiter(next);
      return next;
    });
  }

  function clearLimiterSuccess() {
    setLimiter(DEFAULT_LIMITER);
    resetLimiter();
  }

  /* ------------------------------------------------------------------------ */
  /* Submit                                                                   */
  /* ------------------------------------------------------------------------ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // hard block
    if (isLocked) {
      setError(`Too many attempts. Please wait ${remainingSeconds}s before trying again.`);
      return;
    }

    if (!emailValid || !passwordValid) {
      setError("Please provide a valid email and password.");
      return;
    }

    const email = form.email.trim().toLowerCase();

    // check 2FA flag (server action)
    let needsTwoFactor = false;
    try {
      needsTwoFactor = await userHasTwoFactorEnabled(email);
    } catch (err) {
      console.error("Failed to determine 2FA status:", err);
    }

    const nextUrl = needsTwoFactor
      ? `/two-factor?callbackURL=${encodeURIComponent(callbackURL)}`
      : callbackURL;

    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password: form.password,
        callbackURL: nextUrl, // BetterAuth will redirect
      });

      if (res?.error) {
        const msg = String(res.error.message || "").toUpperCase();

        if (msg.includes("USER_INACTIVE")) setError("Your account is disabled. Contact your administrator.");
        else if (msg.includes("USER_DELETED") || msg.includes("NOT_FOUND")) setError("Account not found.");
        else if (msg.includes("INVALID_CREDENTIALS") || msg.includes("CREDENTIALS")) setError("Invalid email or password.");
        else if (msg.includes("TOO_MANY_ATTEMPTS")) setError("Too many login attempts.");
        else setError("Unable to sign in. Please try again.");

        bumpLimiterFailure();
        return;
      }

      // ✅ success
      clearLimiterSuccess();

      // Some auth clients may not redirect automatically in dev – safe fallback:
      router.replace(nextUrl);
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-60 dark:opacity-50 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.20),transparent_40%),radial-gradient(circle_at_40%_95%,rgba(34,197,94,0.16),transparent_45%)]" />
        <div className="absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
          <div className="absolute inset-0 opacity-[0.10] dark:opacity-[0.14] bg-[linear-gradient(to_right,rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.35)_1px,transparent_1px)] bg-[size:28px_28px]" />
        </div>
        <div className="absolute -left-20 top-[-6rem] h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-[20%] h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-[30%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-40 md:right-8 md:top-8">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid min-h-screen max-w-[1200px] items-stretch gap-8 px-4 py-10 lg:grid-cols-2 lg:px-8">
        {/* LEFT */}
        <div className="relative hidden overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-xl shadow-black/5 backdrop-blur lg:flex lg:flex-col">
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.16),_transparent_55%)]" />
          <div className="relative z-10 flex items-center gap-3">
            {hasLight || hasDark ? (
              <>
                {hasDark ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoDark!} alt={appTitle} className="h-10 w-auto object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoLight!} alt={appTitle} className="h-10 w-auto object-contain" />
                )}
              </>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-sm font-bold text-white shadow-md shadow-indigo-500/30">
                {appTitle.charAt(0)}
              </div>
            )}

            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight">{appTitle}</div>
              <div className="text-xs text-muted-foreground">ERP • Multi-tenant • RBAC • Audit</div>
            </div>
          </div>

          <div className="relative z-10 mt-10 space-y-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/40 px-3 py-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Secure workspace access
            </div>

            <h2 className="text-3xl font-semibold tracking-tight">Operate your ERP with confidence.</h2>

            <p className="max-w-md text-sm text-muted-foreground">
              One sign-in to manage tenants, modules, users, approvals, and files — with consistent
              permissions and traceable activity.
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border bg-background/35 p-4">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Security-first access</div>
                  <div className="text-xs text-muted-foreground">2FA-ready, role-aware routes, tenant isolation.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border bg-background/35 p-4">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Rate-limit protection</div>
                  <div className="text-xs text-muted-foreground">Blocks brute-force attempts with timed lockout.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border bg-background/35 p-4">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Modern UX</div>
                  <div className="text-xs text-muted-foreground">Fast forms, clear errors, clean visuals.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-6 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tip:</span> Use your organization email.
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              {hasLight || hasDark ? (
                <>
                  {hasLight && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoLight!} alt={appTitle} className="h-9 w-auto dark:hidden" />
                  )}
                  {hasDark && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDark!} alt={appTitle} className="hidden h-9 w-auto dark:block" />
                  )}
                </>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500 text-sm font-bold text-white">
                  {appTitle.charAt(0)}
                </div>
              )}

              <div className="leading-tight">
                <div className="text-base font-semibold">{appTitle}</div>
                <div className="text-[11px] text-muted-foreground">ERP workspace sign-in</div>
              </div>
            </div>

            <div className="rounded-3xl border bg-card/70 p-6 shadow-2xl shadow-black/10 backdrop-blur">
              <div className="mb-5 space-y-1">
                <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                  Secure sign-in • Role-aware access
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-xs text-muted-foreground">
                  Sign in to continue to <span className="font-medium text-foreground">{appTitle}</span>.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-xs">Email</Label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      placeholder="you@company.com"
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect="off"
                      disabled={loading || isLocked}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-11 bg-background pl-9 text-sm"
                    />
                  </div>

                  {!emailValid && form.email.length > 0 && (
                    <p className="text-[11px] text-destructive">Please enter a valid email address.</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-[11px] text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={passwordRef}
                      id="password"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      disabled={loading || isLocked}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                      className="h-11 bg-background pl-9 pr-10 text-sm"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      disabled={loading || isLocked}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {capsOn && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">Caps Lock is ON.</p>
                  )}

                  {form.password.length > 0 && !passwordValid && (
                    <p className="text-[11px] text-destructive">Password must be at least 8 characters.</p>
                  )}
                </div>

                {isLocked && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
                    Too many attempts. Please wait{" "}
                    <span className="font-semibold">{remainingSeconds}s</span> before trying again.
                  </div>
                )}

                {error && !isLocked && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                    {error}
                  </div>
                )}

                <Button disabled={loading || !formValid || isLocked} className="h-11 w-full rounded-2xl text-sm font-semibold">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-muted-foreground">
                  <div className="rounded-2xl border bg-background/40 px-3 py-2 text-center">2FA ready</div>
                  <div className="rounded-2xl border bg-background/40 px-3 py-2 text-center">RBAC</div>
                  <div className="rounded-2xl border bg-background/40 px-3 py-2 text-center">Audit</div>
                </div>
              </form>

              <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
                <div>
                  Don&apos;t have an account?{" "}
                  <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
                    Request access
                  </Link>
                </div>
                <div className="text-[11px] leading-relaxed">
                  By continuing, you agree to our{" "}
                  <Link href="/terms" className="underline underline-offset-2 hover:text-primary">Terms</Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-primary">Privacy Policy</Link>.
                </div>
              </div>
            </div>

            <div className="mt-5 text-center text-[11px] text-muted-foreground">
              Need help? Contact your system administrator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
