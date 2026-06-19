import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "*.supabase.co" },
  { protocol: "https", hostname: "*.supabase.in" },
  { protocol: "http", hostname: "127.0.0.1", port: "54321" },
  { protocol: "http", hostname: "localhost", port: "54321" },
];

// Also allow the configured Supabase host explicitly (covers self-hosted).
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supaUrl) {
  try {
    const u = new URL(supaUrl);
    remotePatterns.push({
      protocol: (u.protocol.replace(":", "") as "http" | "https"),
      hostname: u.hostname,
      port: u.port || undefined,
    });
  } catch {
    /* ignore */
  }
}

const nextConfig: NextConfig = {
  images: { remotePatterns },
  // Clean slug for the static pitch deck (public/presentazione.html).
  async rewrites() {
    return [{ source: "/presentazione", destination: "/presentazione.html" }];
  },
};

export default nextConfig;
