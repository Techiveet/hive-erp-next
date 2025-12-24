/**
 * @file app/layout.tsx
 * @description The primary entry point for the Hive ERP platform. 
 * This file defines the global HTML structure, manages the PWA Service Worker 
 * lifecycle, and injects global context providers for theming and state.
 */

import "./globals.css";

import type { Metadata } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme/theme-provider";

/**
 * Global Metadata Configuration
 * --------------------------------------------------------------------------
 * Configures the base SEO, branding, and PWA manifest.
 * The %s template allows child pages (e.g., Tenants or Modules) to 
 * prefix the title (e.g., "Dashboard • Hive").
 */
export const metadata: Metadata = {
  title: {
    default: "Hive | Enterprise Resource Planning",
    template: "%s • Hive",
  },
  description: "A modern, high-performance multi-tenant ERP SaaS platform built with Next.js and Prisma.",
  applicationName: "Hive",
  icons: {
    icon: "/icon",
  },
  manifest: "/manifest.json",
};

/**
 * RootLayout Component
 * --------------------------------------------------------------------------
 * @param children - The active page component being rendered.
 * @returns The base HTML skeleton with essential context providers.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /**
     * suppressHydrationWarning is required when using next-themes or 
     * light/dark mode logic to prevent mismatch errors between 
     * server-side rendered HTML and client-side theme application.
     */
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* ThemeProvider manages light/dark mode state and CSS variable injection */}
        <ThemeProvider>
          
          {/* PWA Service Worker Registration 
            Ensures offline capabilities and background sync for enterprise users.
          */}
          <RegisterServiceWorker />

          {/* Main Viewport Content */}
          {children}
          
        </ThemeProvider>
      </body>
    </html>
  );
}