import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

const applyDisplay = Syne({
  subsets: ["latin"],
  variable: "--font-apply-display",
  weight: ["600", "700", "800"],
});

const applyBody = DM_Sans({
  subsets: ["latin"],
  variable: "--font-apply-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Apply — Vident Productions",
  description:
    "Join the Vident Productions crew. Apply for AV, corporate, wedding, golf, and office roles in Northeast Florida.",
  openGraph: {
    title: "Apply — Vident Productions",
    description:
      "Join the Vident Productions crew producing unforgettable events across Northeast Florida.",
    images: [{ url: "/apply-hero.jpg" }],
  },
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${applyDisplay.variable} ${applyBody.variable} apply-page min-h-full`}
    >
      {children}
    </div>
  );
}
