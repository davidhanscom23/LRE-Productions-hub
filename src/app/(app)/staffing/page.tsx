import { StaffingClient } from "@/components/staffing/staffing-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessStaffing } from "@/lib/staffing/access";
import { buildStaffingCoverage } from "@/lib/staffing/coverage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ days?: string; from?: string }>;
};

const DEFAULT_DAYS = 28;
const MAX_DAYS = 56;

export default async function StaffingPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessStaffing(profile.role)) redirect("/");

  const params = await searchParams;
  const parsedDays = Number.parseInt(params.days ?? "", 10);
  const dayCount =
    Number.isFinite(parsedDays) && parsedDays >= 7 && parsedDays <= MAX_DAYS
      ? parsedDays
      : DEFAULT_DAYS;

  const fromRaw = params.from?.trim() ?? "";
  const fromDate =
    /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : undefined;

  const supabase = await createClient();
  const { days, icalConfigured, icalError, unmatchedFeedTimeOff } =
    await buildStaffingCoverage(supabase, {
      days: dayCount,
      fromDate,
    });

  return (
    <StaffingClient
      days={days}
      dayCount={dayCount}
      fromDate={fromDate ?? days[0]?.dateKey ?? null}
      icalConfigured={icalConfigured}
      icalError={icalError}
      unmatchedFeedTimeOff={unmatchedFeedTimeOff}
      canEdit={profile.role === "admin" || profile.role === "trainer"}
      isAdmin={profile.role === "admin"}
    />
  );
}
