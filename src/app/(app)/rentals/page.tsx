import Link from "next/link";
import { AvErpPage } from "@/components/av-erp/av-erp-page";
import { HubOverview } from "@/components/av-erp/hub-overview";
import { LoadDemoShopButton } from "@/components/av-erp/load-demo-shop-button";
import { getCurrentProfile } from "@/lib/auth/profile";
import { demoShopAlreadyLoaded } from "@/lib/av-erp/demo-shop";
import { loadHubOverviewStats } from "@/lib/av-erp/overview";
import { createClient } from "@/lib/supabase/server";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = {
  title: "Vident AV",
};

export default async function RentalsPage() {
  const profile = await getCurrentProfile();

  if (!canAccessVidentAv(profile)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Vident AV
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Vident AV is only available to admins and team members assigned to the
          AV department. Ask an admin to update your profile if you need access.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [hubStats, productCountRes, demoLoaded] = await Promise.all([
    loadHubOverviewStats(supabase),
    supabase
      .from("av_products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    demoShopAlreadyLoaded(supabase),
  ]);

  const productCount = productCountRes.count ?? 0;
  const emptyShop =
    !demoLoaded && hubStats.openTotal === 0 && productCount === 0;

  return (
    <AvErpPage maxWidthClassName="max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Vident AV
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          Overview
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Hub estimates, warehouse, invoices, and activities — system of record for
          day-to-day AV ops.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/rentals/costs"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-medium hover:border-[var(--brand)]/40"
          >
            Costs &amp; margin →
          </Link>
          <Link
            href="/rentals/reports"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-medium hover:border-[var(--brand)]/40"
          >
            Reports →
          </Link>
          <Link
            href="/rentals/quotes"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-medium hover:border-[var(--brand)]/40"
          >
            Estimates →
          </Link>
          <Link
            href="/rentals/warehouse"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-medium hover:border-[var(--brand)]/40"
          >
            Warehouse →
          </Link>
        </div>
        <LoadDemoShopButton emptyShop={emptyShop} demoLoaded={demoLoaded} />
      </div>
      <HubOverview stats={hubStats} />
    </AvErpPage>
  );
}
