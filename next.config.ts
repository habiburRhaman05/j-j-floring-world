import type { NextConfig } from "next";

/**
 * Who may show this app inside an iframe: GoHighLevel's custom menu links
 * load it there. GHL_FRAME_ANCESTORS adds a white-label domain (space
 * separated, e.g. "https://app.youragency.com") on top of GHL's own.
 */
const frameAncestors = [
  "'self'",
  "https://app.gohighlevel.com",
  "https://*.gohighlevel.com",
  "https://*.leadconnectorhq.com",
  "https://*.msgsndr.com",
  ...(process.env.GHL_FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean),
].join(" ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }],
      },
    ];
  },
};

export default nextConfig;
