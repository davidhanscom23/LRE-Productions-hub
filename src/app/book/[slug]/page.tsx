import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingClient } from "@/components/scheduling/booking-client";
import { COMPANY } from "@/lib/company";
import { loadMeetingType } from "@/lib/scheduling/server";
import { addDays, dateInTz } from "@/lib/scheduling/slots";

function todayIn(tz: string): string {
  return dateInTz(Date.now(), tz);
}

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: `Book a meeting | ${COMPANY.displayName}`,
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const type = await loadMeetingType(slug);
  if (!type) notFound();
  const today = todayIn(type.timezone);
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{COMPANY.displayName}</p>
      <BookingClient
        slug={type.slug}
        title={type.title}
        description={type.description}
        durationMin={type.durationMin}
        location={type.location}
        timezone={type.timezone}
        minDate={today}
        maxDate={addDays(today, type.maxDaysAhead)}
      />
    </main>
    </div>
  );
}
