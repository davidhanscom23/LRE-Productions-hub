import { redirect } from "next/navigation";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { CrewBookingsClient } from "@/components/av-erp/crew-bookings-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  bookingOverlapsDateKey,
  isIsoDateKey,
} from "@/lib/av-erp/crew-date-filter";
import type { AvContractorBooking } from "@/lib/av-erp/types";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "Crew — LRE AV" };

type Props = {
  searchParams: Promise<{ opportunity?: string; date?: string }>;
};

export default async function AvCrewPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessVidentAv(profile)) redirect("/rentals");

  const { opportunity: preselect, date: dateRaw } = await searchParams;
  const filterDate = isIsoDateKey(dateRaw) ? dateRaw!.trim() : null;
  const supabase = await createClient();

  type BookingQueryRow = {
    id: string;
    opportunity_id: string;
    profile_id: string | null;
    contractor_id?: string | null;
    role_label: string | null;
    starts_at: string;
    ends_at: string;
    day_rate: number | null;
    status: string;
    notes: string | null;
    roll_into_costs: boolean | null;
    created_at: string;
    updated_at: string;
    profiles:
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
    av_contractors?: { name: string } | { name: string }[] | null;
    av_opportunities: { reference: string } | { reference: string }[] | null;
  };

  const bookingsRes = await supabase
    .from("av_contractor_bookings")
    .select(
      "id, opportunity_id, profile_id, contractor_id, role_label, starts_at, ends_at, day_rate, status, notes, roll_into_costs, created_at, updated_at, profiles!av_contractor_bookings_profile_id_fkey ( full_name, email ), av_contractors ( name ), av_opportunities!av_contractor_bookings_opportunity_id_fkey ( reference )",
    )
    .order("starts_at", { ascending: true });

  let bookingRows: BookingQueryRow[] | null =
    (bookingsRes.data as BookingQueryRow[] | null) ?? null;
  let bookingsError = bookingsRes.error;

  // Pre-151 DBs lack contractor_id / av_contractors — fall back without them.
  if (bookingsError) {
    const fallback = await supabase
      .from("av_contractor_bookings")
      .select(
        "id, opportunity_id, profile_id, role_label, starts_at, ends_at, day_rate, status, notes, roll_into_costs, created_at, updated_at, profiles!av_contractor_bookings_profile_id_fkey ( full_name, email ), av_opportunities!av_contractor_bookings_opportunity_id_fkey ( reference )",
      )
      .order("starts_at", { ascending: true });
    bookingRows = (fallback.data as BookingQueryRow[] | null) ?? null;
    bookingsError = fallback.error;
  }

  const [peopleRes, oppsRes, contractorsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("av_opportunities")
      .select("id, reference, subject, gear_starts_at, gear_ends_at")
      .in("status", ["draft", "quotation", "order"])
      .order("reference"),
    supabase
      .from("av_contractors")
      .select("id, name, day_rate")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (bookingsError) {
    return (
      <AvErpPage maxWidthClassName="max-w-4xl">
        <div className="max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Crew bookings need a database update</p>
          <p className="mt-2">
            Run <code>145_av_job_costs_crew.sql</code> (and{" "}
            <code>151_av_km_gaps.sql</code> for external contractors), then
            refresh. ({bookingsError.message})
          </p>
        </div>
      </AvErpPage>
    );
  }

  const bookings = (bookingRows ?? [])
    .map((row) => {
      const person = row.profiles;
      const contractor = row.av_contractors ?? null;
      const opp = row.av_opportunities;
      const p = Array.isArray(person) ? person[0] : person;
      const c = Array.isArray(contractor) ? contractor[0] : contractor;
      const o = Array.isArray(opp) ? opp[0] : opp;
      return {
        id: row.id,
        opportunity_id: row.opportunity_id,
        profile_id: row.profile_id ?? null,
        contractor_id: row.contractor_id ?? null,
        role_label: row.role_label || "",
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        day_rate: row.day_rate == null ? null : Number(row.day_rate),
        status: row.status as AvContractorBooking["status"],
        notes: row.notes || "",
        roll_into_costs: row.roll_into_costs !== false,
        created_at: row.created_at,
        updated_at: row.updated_at,
        person_name: p?.full_name || p?.email || c?.name || "Unknown",
        opportunity_reference: o?.reference ?? "—",
      };
    })
    .filter((b) =>
      filterDate
        ? bookingOverlapsDateKey(b.starts_at, b.ends_at, filterDate)
        : true,
    );

  return (
    <CrewBookingsClient
      bookings={bookings}
      people={(peopleRes.data ?? []) as {
        id: string;
        full_name: string | null;
        email: string | null;
      }[]}
      contractors={(contractorsRes.error ? [] : contractorsRes.data ?? []).map(
        (c) => ({
          id: c.id as string,
          name: c.name as string,
          day_rate: c.day_rate == null ? null : Number(c.day_rate),
        }),
      )}
      opportunities={(oppsRes.data ?? []).map((o) => ({
        id: o.id as string,
        reference: o.reference as string,
        subject: (o.subject as string) || "Untitled",
        gear_starts_at: (o.gear_starts_at as string | null) ?? null,
        gear_ends_at: (o.gear_ends_at as string | null) ?? null,
      }))}
      preselectOpportunityId={preselect ?? null}
      filterDate={filterDate}
    />
  );
}
