// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "Hive | Enterprise Resource Planning",
    template: "%s • Hive",
  },
  description:
    "A modern, high-performance multi-tenant ERP SaaS platform built with Next.js and Prisma.",
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
      <body className="antialiased">
        <ThemeProvider>
          <RegisterServiceWorker />
          {children}

          {/* ✅ required for AppToast */}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
