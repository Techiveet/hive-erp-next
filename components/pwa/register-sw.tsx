"use client";

import * as React from "react";

export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        // swallow in prod, don’t break UI
        console.error("SW registration failed", e);
      }
    };

    register();
  }, []);

  return null;
}
