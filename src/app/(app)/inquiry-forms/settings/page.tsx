import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hubAdapter as adapter } from "@/lib/inquiry-forms/server/adapter";
import { DEPARTMENTS } from "@/lib/types/database";
import { BusinessSettingsForm } from "@/components/inquiry-forms/admin/business-settings-form";
import { LoadErrorNotice, MigrationNotice } from "@/components/inquiry-forms/admin/list-migration-notice";
import { getBusinessSettings } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inquiry Forms settings",
};

const TITLE = "Inquiry Forms: business settings";

export default async function InquiryFormsSettingsPage() {
  // Page gate follows the view-as role (house rule); every action re-checks the REAL admin.
  const role = await adapter.viewerRole();
  if (!role) redirect("/login");
  if (role !== "admin") redirect("/");

  const result = await getBusinessSettings();
  if (result.needsMigration) return <MigrationNotice title={TITLE} />;
  if (result.error) return <LoadErrorNotice title={TITLE} message={result.error} />;

  return (
    <BusinessSettingsForm
      initial={result.settings}
      departments={DEPARTMENTS}
      turnstileAvailable={result.turnstileAvailable}
      googleMapsAvailable={result.googleMapsAvailable}
    />
  );
}
