import type { NextConfig } from "next";

/**
 * The Inquiry Forms admin pages never render inside another site's frame. The brand sites that embed
 * the public form are same-site with the hub, so the hub's Lax session cookies reach frames they make
 * (clickjacking Publish, Pause or Delete). /inquire/* (the form and embed.js) stays framable.
 */
const NO_FOREIGN_FRAMES = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // The service worker must never be served from a stale cache, or offline fixes would not reach phones.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/inquiry-forms", headers: NO_FOREIGN_FRAMES },
      { source: "/inquiry-forms/:path*", headers: NO_FOREIGN_FRAMES },
    ];
  },
  // Ask the Hub PDF/Word uploads go through Server Actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // HEIC decode (libheif) should stay external for reliable server conversion.
  serverExternalPackages: ["heic-convert", "heic-decode", "libheif-js"],
};

export default nextConfig;
