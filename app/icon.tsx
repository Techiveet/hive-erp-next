import { ImageResponse } from "next/og";
import { getBrandForRequest } from "@/lib/brand-server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function absoluteUrlFromRequest(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;

  const h = await headers(); // ✅ Must await in Next.js 16
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export default async function Icon() {
  try {
    const brand = await getBrandForRequest();
    const iconSource = (brand?.faviconUrl || brand?.sidebarIconUrl || "").trim();

    // 1) Base64 data URI
    if (iconSource.startsWith("data:")) {
      const comma = iconSource.indexOf(",");
      if (comma !== -1) {
        const base64 = iconSource.slice(comma + 1);
        return new Response(Buffer.from(base64, "base64"), {
          headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }
    }

    // 2) URL or local path
    if (iconSource && (iconSource.startsWith("/") || iconSource.startsWith("http"))) {
      const url = await absoluteUrlFromRequest(iconSource);
      const res = await fetch(url, { cache: "no-store" });

      if (res.ok) {
        return new Response(await res.arrayBuffer(), {
          headers: { 
            "Content-Type": res.headers.get("content-type") || "image/png", 
            "Cache-Control": "no-store" 
          },
        });
      }
    }

    // 3) Fallback
    const letter = (brand?.titleText || "H").trim().charAt(0).toUpperCase();
    return new ImageResponse(
      (
        <div style={{
          fontSize: 20,
          background: "linear-gradient(to bottom right, #4f46e5, #9333ea)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: 8,
          fontWeight: 700,
        }}>
          {letter}
        </div>
      ),
      size
    );
  } catch {
    // ✅ Silenced error log for cleaner terminal
    return new ImageResponse(
      (
        <div style={{
          background: "linear-gradient(to bottom right, #4f46e5, #9333ea)",
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 16, color: "white", fontWeight: 700 }}>H</div>
        </div>
      ),
      size
    );
  }
}