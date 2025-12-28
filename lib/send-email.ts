// src/lib/send-email.ts
"use server";

/**
 * CENTRAL-ONLY email sender (env-based).
 * - No Prisma EmailSettings (your schema doesn't have it)
 * - Lazy-imports nodemailer/resend so Turbopack won't crash if not installed
 * - Supports RESEND or SMTP via env
 */

import * as React from "react";
import fs from "fs";
import path from "path";
import { render } from "@react-email/components";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type EmailProvider = "RESEND" | "SMTP";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
  fromOverride?: string;
};

type EmailConfig = {
  provider: EmailProvider;
  from: string;
  replyTo?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  };
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function getEnv(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function resolveProvider(): EmailProvider {
  // Priority: explicit provider
  const p = (getEnv("EMAIL_PROVIDER") || "").toUpperCase();
  if (p === "SMTP" || p === "RESEND") return p as EmailProvider;

  // Auto: if Resend key exists => RESEND else SMTP
  if (getEnv("RESEND_API_KEY")) return "RESEND";
  return "SMTP";
}

function resolveFrom(): { from: string; replyTo?: string } {
  const fromName = getEnv("EMAIL_FROM_NAME") || "Hive";
  const fromEmail =
    getEnv("EMAIL_FROM_ADDRESS") ||
    getEnv("RESEND_FROM") || // optional alias
    "onboarding@resend.dev";

  const replyTo = getEnv("EMAIL_REPLY_TO");
  return { from: `${fromName} <${fromEmail}>`, replyTo };
}

async function resolveEmailConfig(): Promise<EmailConfig | null> {
  const provider = resolveProvider();
  const { from, replyTo } = resolveFrom();

  if (provider === "SMTP") {
    const host = getEnv("SMTP_HOST");
    const port = Number(getEnv("SMTP_PORT") || 587);
    const user = getEnv("SMTP_USER");
    const pass = getEnv("SMTP_PASSWORD");
    const secure = (getEnv("SMTP_SECURE") || "").toLowerCase() === "true" || port === 465;

    if (!host || !user || !pass) {
      console.error("❌ [EMAIL] SMTP config incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD");
      return null;
    }

    return {
      provider,
      from,
      replyTo,
      smtp: { host, port, user, pass, secure },
    };
  }

  // RESEND
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("⚠️ [EMAIL] RESEND selected but RESEND_API_KEY is missing");
    return null;
  }

  return { provider, from, replyTo };
}

/* ------------------------------------------------------------------ */
/* Core sendEmail */
/* ------------------------------------------------------------------ */

export async function sendEmail({
  to,
  subject,
  react,
  html,
  text,
  fromOverride,
}: SendEmailArgs): Promise<void> {
  const config = await resolveEmailConfig();
  if (!config) return;

  const recipients = Array.isArray(to) ? to : [to];
  const from = fromOverride ?? config.from;

  let finalHtml = html;

  if (!finalHtml && react) {
    finalHtml = await render(react);
  }

  // Always ensure we have something to send
  if (!finalHtml && !text) {
    console.warn("⚠️ [EMAIL] No html/react/text provided; skipping send.");
    return;
  }

  /* -------------------------------------------------------------- */
  /* RESEND (lazy import) */
  /* -------------------------------------------------------------- */
  if (config.provider === "RESEND") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY!);

      await resend.emails.send({
        from,
        to: recipients,
        subject,
        html: finalHtml,
        text,
        react,
        replyTo: config.replyTo,
      });

      console.log("✅ [EMAIL] Sent via Resend", { to: recipients });
    } catch (err: any) {
      // If package missing, you'll see "Cannot find module 'resend'"
      console.error("❌ [EMAIL] Resend failed", err?.message || err);
    }
    return;
  }

  /* -------------------------------------------------------------- */
  /* SMTP (lazy import) */
  /* -------------------------------------------------------------- */
  try {
    const nodemailer = (await import("nodemailer")).default;

    const transporter = nodemailer.createTransport({
      host: config.smtp!.host,
      port: config.smtp!.port,
      secure: config.smtp!.secure,
      auth: {
        user: config.smtp!.user,
        pass: config.smtp!.pass,
      },
    });

    const attachments: any[] = [];

    // Optional: inline logo replacement (CID)
    if (finalHtml?.includes("/logo/logo.png")) {
      const logoPath = path.join(process.cwd(), "public", "logo", "logo.png");

      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: "logo.png",
          path: logoPath,
          cid: "hive-logo",
        });

        finalHtml = finalHtml.replace(
          /src="[^"]*\/logo\/logo\.png"/g,
          'src="cid:hive-logo"'
        );
      }
    }

    await transporter.sendMail({
      from,
      to: recipients,
      subject,
      html: finalHtml,
      text,
      replyTo: config.replyTo,
      attachments,
    });

    console.log("✅ [EMAIL] Sent via SMTP", { to: recipients });
  } catch (err: any) {
    // If package missing, you'll see "Cannot find module 'nodemailer'"
    console.error("❌ [EMAIL] SMTP failed", err?.message || err);
  }
}

/* ------------------------------------------------------------------ */
/* Optional helper for account emails (keep if you use it) */
/* ------------------------------------------------------------------ */

import {
  UserAccountEmail,
  getUserAccountSubject,
  type UserAccountKind,
  type UserStatus,
} from "@/emails/user-account-template";

type SendAccountEmailArgs =
  | {
      to: string;
      type: "account_created";
      payload: { name?: string | null; email: string; tempPassword?: string };
    }
  | {
      to: string;
      type: "account_updated";
      payload: { name?: string | null; email: string };
    }
  | {
      to: string;
      type: "account_status_changed";
      payload: { name?: string | null; email: string; isActive: boolean };
    };

export async function sendAccountEmail(args: SendAccountEmailArgs): Promise<void> {
  let kind: UserAccountKind;
  let status: UserStatus;
  let password: string | undefined;

  switch (args.type) {
    case "account_created":
      kind = "created";
      status = "ACTIVE";
      password = args.payload.tempPassword;
      break;
    case "account_updated":
      kind = "updated";
      status = "ACTIVE";
      break;
    case "account_status_changed":
      kind = args.payload.isActive ? "updated" : "deactivated";
      status = args.payload.isActive ? "ACTIVE" : "INACTIVE";
      break;
  }

  await sendEmail({
    to: args.to,
    subject: getUserAccountSubject(kind),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: args.payload.name || args.payload.email,
      email: args.payload.email,
      password,
      status,
    }),
  });
}
