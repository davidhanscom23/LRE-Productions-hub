import type { Viewport } from "next";

// The hub locks pinch-zoom for the installed staff app. This page is for
// clients on any device, so restore normal zoom for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#ffffff",
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
