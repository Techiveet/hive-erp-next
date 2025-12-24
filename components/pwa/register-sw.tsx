/**
 * @file RegisterServiceWorker.tsx
 * @description Client-side component responsible for initializing the PWA lifecycle.
 * In production, it registers the service worker (`sw.js`) to enable offline
 * capabilities, background synchronization, and asset caching for the Hive ERP.
 */

"use client";

import * as React from "react";

/**
 * RegisterServiceWorker Component
 * --------------------------------------------------------------------------
 * This component renders nothing (`null`) but executes the registration logic
 * inside a `useEffect` hook to ensure it only runs in the browser environment.
 * * @returns {null}
 */
export function RegisterServiceWorker() {
  React.useEffect(() => {
    /**
     * Environment & Capability Guard
     * 1. Only register in production to avoid HMR (Hot Module Replacement) conflicts during dev.
     * 2. Verify 'serviceWorker' is supported by the user's browser (Progressive Enhancement).
     */
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    /**
     * Service Worker Initialization
     * Registers the worker located at the root public directory.
     * The scope is set to '/' to allow the worker to intercept requests 
     * for all routes within the Hive platform.
     */
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        /**
         * Error Handling
         * We catch and log errors to avoid crashing the main UI thread.
         * Common failure reasons: HTTPS not enabled, or worker file missing.
         */
        console.error("SW registration failed:", e);
      }
    };

    // Execution is deferred until after the initial paint to prioritize 
    // the Largest Contentful Paint (LCP) performance.
    register();
  }, []);

  return null;
}