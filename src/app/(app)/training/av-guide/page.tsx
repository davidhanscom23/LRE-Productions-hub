import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MonitorSpeaker } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isGuestRole } from "@/lib/auth/guest";
import { AvResourceGuide } from "@/components/teams/av-resource-guide";
import { AV_GUIDE_BRAND_VARS } from "@/lib/teams/department-meta";

export const metadata: Metadata = {
  title: "AV Fundamental Resource Guide",
};

export default async function AvGuidePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (isGuestRole(profile.role)) redirect("/");

  return (
    <div className={["mx-auto max-w-5xl space-y-6", AV_GUIDE_BRAND_VARS].join(" ")}>
      <div>
        <Link
          href="/teams"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Teams
        </Link>
        <section className="mt-3 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--brand-soft)] via-[var(--surface)] to-[var(--surface)] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm">
              <MonitorSpeaker className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--brand)]">Pro AV</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                Fundamental Resource Guide
              </h1>
              <p className="mt-0.5 max-w-2xl text-sm text-[var(--muted)]">
                Connectors and signal types, IP ratings, microphone patterns,
                signal flow, wireless RF, DMX lighting, networked AV, and a full
                definitions glossary.
              </p>
            </div>
          </div>
        </section>
      </div>

      <AvResourceGuide />
    </div>
  );
}
