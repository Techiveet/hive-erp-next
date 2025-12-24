"use client";

import {
  Activity,
  ArrowRight,
  Code2,
  Command,
  Fingerprint,
  Globe,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);

    const onMove = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        setMouse({ x: e.clientX, y: e.clientY });
        raf.current = null;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const navItems = useMemo(
    () => [
      { label: "Platform", href: "#platform" },
      { label: "Workflow", href: "#workflow" },
      { label: "Enterprise", href: "#enterprise" },
    ],
    []
  );

  return (
    <main className="hive-noise relative min-h-screen overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 hive-mesh-bg" />
        <div className="absolute inset-0 hive-grid-mask" />

        {!reduceMotion && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-700"
            style={{
              background: `radial-gradient(560px circle at ${mouse.x}px ${mouse.y}px, oklch(0.70 0.19 162 / 0.07), transparent 78%)`,
            }}
          />
        )}
      </div>

      {/* Nav */}
      <nav
        className={[
          "fixed top-0 z-50 w-full transition-all duration-500",
          scrolled ? "glass-panel py-3 shadow-2xl" : "py-6",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background transition-transform group-hover:scale-110">
              <Command className="h-6 w-6" />
              <div className="absolute inset-0 rounded-xl bg-brand-primary/20 blur-lg opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <span className="text-2xl font-black tracking-tighter">Hive</span>
          </Link>

          <div className="hidden items-center gap-1 rounded-full border border-border/40 bg-background/20 p-1 backdrop-blur-md md:flex">
            {navItems.map((i) => (
              <a
                key={i.href}
                href={i.href}
                className="rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-foreground/5 hover:text-foreground"
              >
                {i.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" className="hidden rounded-full sm:flex">
              Login
            </Button>

            <Button className="rounded-full bg-brand-primary px-6 font-bold text-white shadow-[0_12px_32px_-18px_rgba(0,0,0,0.6)] hover:shadow-[0_18px_42px_-18px_rgba(0,0,0,0.7)]">
              Deploy OS <Zap className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* spacer for fixed nav */}
      <div className="pt-[92px] md:pt-[104px]" />

      {/* HERO */}
      <section className="relative flex flex-col items-center px-6 pb-20 pt-14 md:pt-24 text-center">
        <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-5xl">
          <motion.div variants={fadeUp}>
            <Badge
              variant="outline"
              className="mb-8 rounded-full border-brand-primary/20 bg-brand-primary/5 px-4 py-1.5 text-brand-primary"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5 animate-pulse" />
              V4.0: Now with Regional Hot-Swapping
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-balance text-6xl font-extrabold tracking-tighter leading-[0.92] sm:text-8xl lg:text-9xl"
          >
            The ERP for the <br />
            <span className="bg-gradient-to-b from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              Hyperscale Era
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Provision infrastructure, manage RBAC, and monitor real-time tenant flows from
            one high-performance cockpit. Built on Next.js + Prisma.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-12 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-full bg-foreground px-10 text-lg font-bold text-background transition-transform hover:scale-[1.03]"
            >
              <Link href="/dashboard" className="inline-flex items-center">
                Open Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full px-10 text-lg glass-panel hover:bg-muted/40"
            >
              <a href="#enterprise">Request Demo</a>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground"
          >
            <InlineCheck text="Tenant isolation" />
            <InlineCheck text="RBAC policies" />
            <InlineCheck text="Audit logs" />
            <InlineCheck text="Realtime-ready" />
          </motion.div>
        </motion.div>

        {/* HERO MOCKUP */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.9, ease: easeOutExpo }}
          className="relative mt-20 w-full max-w-6xl px-4"
        >
          <div className="group relative rounded-[2.5rem] border border-white/10 bg-card/40 p-2 backdrop-blur-xl shadow-[0_0_110px_-28px_rgba(0,0,0,0.55)]">
            <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-background/50">
              <div className="flex h-12 items-center justify-between border-b border-white/5 bg-muted/20 px-6">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full border border-red-500/50 bg-red-500/25" />
                  <div className="h-3 w-3 rounded-full border border-amber-500/50 bg-amber-500/25" />
                  <div className="h-3 w-3 rounded-full border border-brand-primary/50 bg-brand-primary/25" />
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Fingerprint className="h-3 w-3" /> Core Kernel : Active
                </div>
                <div className="w-16" />
              </div>

              <div className="relative aspect-[21/9] overflow-hidden p-8 md:p-12">
                <div className="grid h-full grid-cols-12 gap-6 opacity-70 transition-opacity duration-700 group-hover:opacity-100">
                  <div className="col-span-3 rounded-2xl border border-brand-primary/10 bg-brand-primary/5" />
                  <div className="col-span-9 space-y-4">
                    <div className="h-1/3 rounded-2xl bg-muted/40" />
                    <div className="h-2/3 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent" />
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              </div>
            </div>

            <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-brand-primary/10 blur-[95px] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 hive-shine" />
          </div>
        </motion.div>
      </section>

      {/* PLATFORM / BENTO */}
      <section id="platform" className="border-y border-border/50 bg-muted/5 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl">Infrastructure as Logic</h2>
            <p className="mt-4 text-lg text-muted-foreground">Ship enterprise features without the boilerplate.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <BentoCard
              className="md:col-span-8 md:row-span-2"
              icon={<ShieldCheck className="text-brand-primary" />}
              title="Identity-First Security"
              description="Automated tenant isolation with signed mutations and auditable access paths."
              visual={<SecurityVisual />}
            />

            <BentoCard
              className="md:col-span-4"
              icon={<Code2 className="text-violet-500" />}
              title="Modular Architecture"
              description="Enable Finance, Inventory, HR, CRM per tenant instantly."
              visual={<CodePreview />}
            />

            <BentoCard
              className="md:col-span-4"
              icon={<Network className="text-brand-secondary" />}
              title="Edge Propagation"
              description="Global routing across regions with sub-second tenant resolution."
            />

            <BentoCard
              className="md:col-span-12 lg:col-span-4"
              icon={<Activity className="text-orange-500" />}
              title="Real-time Telemetry"
              description="Per-tenant event streams and audit trails integrated into your cockpit."
              visual={<PulseVisual />}
            />
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-extrabold tracking-tighter sm:text-6xl">
              Defined in Code. Deployed to Edge.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Your lifecycle is deterministic, observable, and tenant-aware.
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
            <div className="pointer-events-none absolute left-0 top-10 hidden h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent md:block" />
            <Step num="01" title="Define Specs" body="Domains, storage policies, and compliance rules." />
            <Step num="02" title="Auto-Provision" body="Schema + edge propagation is triggered automatically." />
            <Step num="03" title="Observe" body="Monitor tenant health & security logs from one API." />
          </div>
        </div>
      </section>

      {/* ENTERPRISE CTA */}
      <section id="enterprise" className="px-6 pb-32">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[3rem] border border-white/10 bg-foreground text-background shadow-2xl dark:bg-card dark:text-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.22),transparent_70%)]" />
          <div className="relative z-10 flex flex-col items-center px-8 py-24 text-center">
            <h2 className="text-5xl font-extrabold tracking-tighter sm:text-7xl">
              Stop Building Boilerplate.
            </h2>
            <p className="mt-6 max-w-xl text-xl opacity-80">
              Focus on business logic. Hive handles infra, tenancy and observability.
            </p>

            <div className="mt-12 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="h-14 rounded-full bg-brand-primary px-10 text-lg text-white transition-transform hover:scale-[1.03]"
              >
                Start Your Workspace
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-full px-10 text-lg border-foreground/20 text-foreground hover:bg-foreground hover:text-background dark:border-white/20 dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                <Link href="/sign-in">Talk to Architect</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              <Pill text="SOC2-ready patterns" />
              <Pill text="Audit logs" />
              <Pill text="RBAC" />
              <Pill text="Tenant-aware storage" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Command className="h-5 w-5 text-foreground" />
            <span className="font-bold text-foreground">Hive OS</span>
            <span>© 2025</span>
          </div>

          <div className="flex flex-wrap justify-center gap-10">
            {["Terms", "Privacy", "Security", "GitHub", "API Status"].map((l) => (
              <Link key={l} href="#" className="transition-colors hover:text-foreground">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------ Components ------------------------------ */

function InlineCheck({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/35 px-3 py-1">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/15">
        <CheckIcon />
      </span>
      {text}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-brand-primary">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * ✅ FIXED:
 * - icon is typed as a ReactElement that accepts className
 * - cloneElement is now type-safe and will compile on `next build`
 */
type IconEl = React.ReactElement<{ className?: string }>;

function BentoCard({
  className = "",
  icon,
  title,
  description,
  visual,
}: {
  className?: string;
  icon: IconEl;
  title: string;
  description: string;
  visual?: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.18 }}
      className={`group relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/60 p-8 shadow-sm backdrop-blur-md ${className}`}
    >
      <div className="relative z-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 transition-transform group-hover:scale-110">
          {React.cloneElement(icon, {
            className: `h-7 w-7 ${icon.props.className ?? ""}`.trim(),
          })}
        </div>

        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        <p className="mt-3 text-muted-foreground leading-relaxed">{description}</p>
        {visual && <div className="mt-8">{visual}</div>}
      </div>

      <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 bg-brand-primary/5 blur-3xl opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 hive-shine" />
    </motion.div>
  );
}

function SecurityVisual() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-background/40 p-5">
      {[70, 45, 85].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-brand-primary" />
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full animate-shimmer bg-brand-primary/35" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
      <div className="mt-4 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>Isolation : Active</span>
        <span>Encryption : AES-256</span>
      </div>
    </div>
  );
}

function PulseVisual() {
  return (
    <div className="flex h-16 items-end gap-1.5 overflow-hidden pt-4">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ height: [16, 58, 16] }}
          transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
          className="w-full rounded-t-full border-t border-orange-500/30 bg-orange-500/20"
        />
      ))}
    </div>
  );
}

function CodePreview() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 p-5 font-mono text-[11px] text-zinc-400 shadow-inner">
      <div className="text-emerald-400">await hive.provision(&quot;tenant-01&quot;, &#123;</div>
      <div className="pl-4">region: &quot;us-east-1&quot;,</div>
      <div className="pl-4">modules: [&quot;HR&quot;, &quot;Billing&quot;]</div>
      <div className="text-emerald-400">&#125;);</div>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, ease: easeOutExpo }}
      className="flex flex-col items-center text-center"
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm transition-all hover:border-brand-primary hover:bg-brand-primary/5">
        <span className="text-brand-primary text-lg font-bold">{num}</span>
      </div>
      <h3 className="mb-2 text-xl font-bold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </motion.div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/35 px-3 py-1">
      {text}
    </span>
  );
}
