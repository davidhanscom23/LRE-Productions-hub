import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LRE Productions Hub",
    short_name: "LRE Hub",
    description: "Private staff portal for LRE Productions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192-v3.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512-v3.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable-v3.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
