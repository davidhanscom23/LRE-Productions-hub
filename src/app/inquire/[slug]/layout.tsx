import type { ReactNode } from "react";
import type { Viewport } from "next";
import "@/components/inquiry-forms/public/inquiry-form.css";

/**
 * Public inquiry form shell (standalone page and the ?embed=1 iframe).
 *
 * - Overrides the hub's locked root viewport: visitors may zoom (maximumScale 5, userScalable true).
 * - Forces a LIGHT document: the hub ThemeProvider is "system", next-themes puts `.dark` and an inline
 *   `color-scheme: dark` on <html>. The !important rules below beat that inline style and the hub's
 *   body tokens, so the page (and an iframe of it on a white host page) never paints dark, and native
 *   controls (date and time pickers, select menus) render light.
 * - Everything below sits in .iqf-scope, which defines its own palette variables.
 * robots noindex is set per page by generateMetadata.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#ffffff",
  colorScheme: "light",
};

const DOCUMENT_PAINT =
  "html,body{background:#ffffff !important;color:#16181d !important;color-scheme:light !important;}";

export default function InquireLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_PAINT }} />
      <div className="iqf-scope">{children}</div>
    </>
  );
}
