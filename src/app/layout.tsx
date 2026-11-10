import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LRE Productions Hub",
  description: "Private staff portal for LRE Productions",
  applicationName: "LRE Hub",
  appleWebApp: {
    capable: true,
    title: "LRE Hub",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192-v2.png",
    apple: "/apple-touch-icon-v2.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  /** Prevent pinch / focus zoom so the hub stays fit to the iPhone screen. */
  userScalable: false,
  /** Required so env(safe-area-inset-*) is non-zero in the installed iOS app. */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full max-w-[100dvw] overflow-x-clip bg-[var(--background)] font-sans text-[var(--foreground)]">
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
