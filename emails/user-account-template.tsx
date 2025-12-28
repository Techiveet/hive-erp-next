// emails/user-account-template.tsx

import * as React from "react";

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

export type UserStatus = "ACTIVE" | "INACTIVE";
export type UserAccountKind = "created" | "updated" | "deactivated";

export interface UserAccountEmailProps {
  kind: UserAccountKind;
  name?: string | null;
  email: string;

  /**
   * ❗Avoid sending passwords by email in production.
   * Keep for dev/testing only.
   */
  password?: string;

  status: UserStatus;

  roleName?: string;
  tenantName?: string;

  /** Where the CTA should go (tenant login URL or central panel URL) */
  loginUrl?: string;

  /** Optional display */
  tenantDomain?: string;

  /** Only used for `kind === "updated"` */
  changedName?: boolean;
  changedPassword?: boolean;
  changedRole?: boolean;
}

/* ------------------------------------------------------------------
 * Subject helper
 * ------------------------------------------------------------------ */

export function getUserAccountSubject(
  kind: UserAccountKind,
  tenantName?: string
): string {
  const prefix = tenantName ? `Hive • ${tenantName}` : "Hive";

  switch (kind) {
    case "created":
      return `${prefix} • Your account is ready`;
    case "updated":
      return `${prefix} • Account updated`;
    case "deactivated":
      return `${prefix} • Account deactivated`;
    default:
      return `${prefix} • Account notification`;
  }
}

/* ------------------------------------------------------------------
 * Internal helpers
 * ------------------------------------------------------------------ */

function stripTrailingSlashes(url: string) {
  return url.replace(/\/+$/, "");
}

function getBaseAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  );
}

function buildAssetUrl(path: string) {
  const base = stripTrailingSlashes(getBaseAppUrl());
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function getCtaLabel(kind: UserAccountKind, status: UserStatus) {
  if (status !== "ACTIVE") return "Contact your administrator";
  if (kind === "created") return "Set your password";
  return "Open Admin Panel";
}

function getTitleAndIntro(
  kind: UserAccountKind,
  tenantName?: string
): { title: string; intro: string } {
  const t = tenantName || "Hive";

  if (kind === "created") {
    return {
      title: `Welcome to ${t}`,
      intro:
        "Your admin account is ready. Use the button below to finish setup and sign in.",
    };
  }

  if (kind === "updated") {
    return {
      title: "Your account was updated",
      intro:
        "An administrator updated your account details. If you didn’t request this change, contact your admin immediately.",
    };
  }

  return {
    title: "Your account was deactivated",
    intro:
      "Your access has been disabled. You won’t be able to sign in until an administrator re-activates your account.",
  };
}

/* ------------------------------------------------------------------
 * Email component
 * ------------------------------------------------------------------ */

export const UserAccountEmail = ({
  kind,
  name,
  email,
  password,
  status,
  roleName,
  tenantName,
  loginUrl,
  tenantDomain,
  changedName,
  changedPassword,
  changedRole,
}: UserAccountEmailProps) => {
  const displayName = (name || email || "there").trim();
  const displayTenant = tenantName || "Hive";
  const statusIsActive = status === "ACTIVE";

  const { title, intro } = getTitleAndIntro(kind, tenantName);

  const ctaHref = loginUrl || getBaseAppUrl();
  const ctaLabel = getCtaLabel(kind, status);

  const logoUrl = buildAssetUrl("/logo/logo.png");

  const hasUpdateDetails =
    kind === "updated" && Boolean(changedName || changedPassword || changedRole);

  const showPasswordBlock = Boolean(password);
  const showRoleBlock = Boolean(roleName);

  const year = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>{getUserAccountSubject(kind, tenantName)}</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* TOP BAR */}
          <Section style={styles.topBar}>
            <Row>
              <Column style={styles.logoCol}>
                <Img
                  src={logoUrl}
                  alt={`${displayTenant} logo`}
                  width="40"
                  height="40"
                  style={styles.logo}
                />
              </Column>
              <Column>
                <Text style={styles.brandName}>{displayTenant}</Text>
                <Text style={styles.brandTagline}>
                  Security • Roles • Access Control
                </Text>
              </Column>
            </Row>
          </Section>

          {/* HERO */}
          <Section style={styles.hero}>
            <Text style={styles.heroPill}>Security &amp; Access</Text>
            <Heading as="h1" style={styles.h1}>
              {title}
            </Heading>
            <Text style={styles.lead}>
              Hi <span style={styles.strong}>{displayName}</span>, {intro}
            </Text>

            {/* INFO STRIP */}
            <Section style={styles.infoStrip}>
              <Row>
                <Column>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={styles.infoValue}>
                    <span
                      style={{
                        ...styles.statusPill,
                        ...(statusIsActive
                          ? styles.statusPillActive
                          : styles.statusPillInactive),
                      }}
                    >
                      {status}
                    </span>
                  </Text>
                </Column>

                {showRoleBlock && (
                  <Column>
                    <Text style={styles.infoLabel}>Role</Text>
                    <Text style={styles.infoValue}>
                      <span style={styles.rolePill}>{roleName}</span>
                    </Text>
                  </Column>
                )}

                {tenantDomain && (
                  <Column>
                    <Text style={styles.infoLabel}>Workspace</Text>
                    <Text style={styles.infoValue}>
                      <span style={styles.domainPill}>{tenantDomain}</span>
                    </Text>
                  </Column>
                )}
              </Row>
            </Section>

            {/* CTA */}
            {statusIsActive && (
              <Section style={{ textAlign: "left", marginTop: 16 }}>
                <Button href={ctaHref} style={styles.ctaButton}>
                  {ctaLabel}
                </Button>
                <Text style={styles.ctaHint}>
                  If the button doesn’t work, copy and paste this link:
                  <br />
                  <span style={styles.monoLink}>{ctaHref}</span>
                </Text>
              </Section>
            )}

            {!statusIsActive && (
              <Text style={styles.warningNote}>
                If you believe this is a mistake, contact your administrator.
              </Text>
            )}
          </Section>

          {/* DETAILS */}
          <Section style={styles.section}>
            <Heading as="h2" style={styles.h2}>
              Account details
            </Heading>

            <Section style={styles.card}>
              <Row>
                <Column>
                  <Text style={styles.kvLabel}>Email</Text>
                  <Text style={styles.kvValue}>{email}</Text>
                </Column>
                <Column>
                  <Text style={styles.kvLabel}>Tenant / Workspace</Text>
                  <Text style={styles.kvValue}>{displayTenant}</Text>
                </Column>
              </Row>
            </Section>

            {/* WHAT CHANGED */}
            {hasUpdateDetails && (
              <Section style={styles.card}>
                <Text style={styles.cardTitle}>What changed?</Text>

                <ul style={styles.ul}>
                  {changedName && (
                    <li style={styles.li}>
                      Your display <strong>name</strong> was updated.
                    </li>
                  )}
                  {changedRole && roleName && (
                    <li style={styles.li}>
                      Your assigned <strong>role</strong> is now{" "}
                      <strong>{roleName}</strong>.
                    </li>
                  )}
                  {changedPassword && (
                    <li style={styles.li}>
                      Your <strong>sign-in password</strong> was updated.
                    </li>
                  )}
                </ul>

                <Text style={styles.smallMuted}>
                  If you didn’t request these changes, contact your admin now.
                </Text>
              </Section>
            )}

            {/* PASSWORD (DEV ONLY) */}
            {showPasswordBlock && (
              <Section style={styles.card}>
                <Text style={styles.cardTitle}>Credentials</Text>
                <Text style={styles.smallMuted}>
                  For production, do <strong>not</strong> send passwords by
                  email. Prefer a “set password” link.
                </Text>

                <Section style={styles.credentialBox}>
                  <Text style={styles.kvLabel}>
                    {kind === "created" ? "Temporary password" : "New password"}
                  </Text>
                  <Text style={styles.code}>{password}</Text>
                </Section>
              </Section>
            )}

            <Text style={styles.disclaimer}>
              If you did not expect this email, you can ignore it. If you suspect
              suspicious activity, contact your administrator.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.footerMeta}>
              This message was generated automatically by{" "}
              <span style={styles.strong}>{displayTenant}</span>.
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You’re receiving this email because your address is linked to an
              admin account in {displayTenant}.
            </Text>
            <Text style={styles.footerTextMuted}>
              © {year} Hive. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default UserAccountEmail;

/* ------------------------------------------------------------------
 * Styles (inline for email client compatibility)
 * ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#f5f7fb",
    margin: 0,
    padding: "28px 0",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  container: {
    maxWidth: "640px",
    width: "100%",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e6eaf2",
    boxShadow:
      "0 22px 28px -10px rgba(15, 23, 42, 0.12), 0 10px 14px -10px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },

  topBar: {
    padding: "18px 22px",
    borderBottom: "1px solid #eef2f7",
    backgroundColor: "#ffffff",
  },

  logoCol: {
    width: 52,
    verticalAlign: "middle",
  },

  logo: {
    borderRadius: 999,
    display: "block",
    border: "1px solid #eef2f7",
  },

  brandName: {
    margin: "0 0 2px",
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },

  brandTagline: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
  },

  hero: {
    padding: "22px 22px 18px",
    backgroundColor: "#ffffff",
  },

  heroPill: {
    display: "inline-block",
    margin: 0,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    color: "#3730a3",
  },

  h1: {
    margin: "10px 0 8px",
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  },

  lead: {
    margin: "0 0 12px",
    fontSize: 14,
    lineHeight: 1.7,
    color: "#334155",
  },

  strong: { fontWeight: 800 },

  infoStrip: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid #eef2f7",
    backgroundColor: "#f8fafc",
    padding: "12px 12px",
  },

  infoLabel: {
    margin: "0 0 2px",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  infoValue: {
    margin: 0,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 700,
  },

  statusPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  statusPillActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  statusPillInactive: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  rolePill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    fontSize: 11,
    fontWeight: 900,
  },

  domainPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    color: "#075985",
    border: "1px solid #bae6fd",
    fontSize: 11,
    fontWeight: 900,
  },

  ctaButton: {
    display: "inline-block",
    padding: "11px 18px",
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "none",
    boxShadow: "0 14px 22px -12px rgba(79,70,229,0.55)",
  },

  ctaHint: {
    margin: "10px 0 0",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#64748b",
  },

  monoLink: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 11,
    color: "#0f172a",
    backgroundColor: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    display: "inline-block",
    marginTop: 4,
  },

  warningNote: {
    margin: "14px 0 0",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#b45309",
    backgroundColor: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: "10px 12px",
  },

  section: {
    padding: "0 22px 10px",
  },

  h2: {
    margin: "10px 0 10px",
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  card: {
    border: "1px solid #eef2f7",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: "12px 12px",
    marginBottom: 10,
  },

  cardTitle: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  kvLabel: {
    margin: "0 0 3px",
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  kvValue: {
    margin: 0,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 700,
  },

  ul: {
    margin: "0 0 8px 18px",
    padding: 0,
    fontSize: 13,
    color: "#334155",
  },

  li: {
    marginBottom: 6,
    lineHeight: 1.5,
  },

  smallMuted: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#64748b",
  },

  credentialBox: {
    marginTop: 10,
    padding: "10px 10px",
    borderRadius: 12,
    backgroundColor: "#0f172a",
    border: "1px solid #0b1220",
  },

  code: {
    margin: 0,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 14,
    fontWeight: 900,
    color: "#f8fafc",
    letterSpacing: "0.03em",
  },

  disclaimer: {
    margin: "12px 0 0",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#64748b",
  },

  hr: {
    marginTop: 14,
    marginBottom: 10,
    borderColor: "#eef2f7",
  },

  footerMeta: {
    margin: 0,
    fontSize: 11,
    color: "#94a3b8",
  },

  footer: {
    padding: "14px 22px 18px",
    borderTop: "1px solid #eef2f7",
    backgroundColor: "#f8fafc",
  },

  footerText: {
    margin: "0 0 4px",
    fontSize: 11,
    color: "#64748b",
  },

  footerTextMuted: {
    margin: 0,
    fontSize: 11,
    color: "#94a3b8",
  },
};
