// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "Hive",
    template: "%s • Hive",
  },
  description: "Multi-tenant ERP SaaS platform built with Next.js + Prisma.",
  applicationName: "Hive",
  icons: {
    icon: "/icon",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {/* Register SW only in production (component handles that internally) */}
          <RegisterServiceWorker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
