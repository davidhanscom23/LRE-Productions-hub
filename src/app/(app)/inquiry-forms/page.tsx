import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hubAdapter as adapter } from "@/lib/inquiry-forms/server/adapter";
import { STARTER_FORMS } from "@/lib/inquiry-forms/server/presets";
import { FormsList } from "@/components/inquiry-forms/admin/forms-list";
import { LoadErrorNotice, MigrationNotice } from "@/components/inquiry-forms/admin/list-migration-notice";
import type { StarterFormSummary } from "@/components/inquiry-forms/admin/list-types";
import { listForms } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inquiry Forms",
};

export default async function InquiryFormsPage() {
  // Page gate follows the view-as role (house rule); every action re-checks the REAL admin.
  const role = await adapter.viewerRole();
  if (!role) redirect("/login");
  if (role !== "admin") redirect("/");

  const result = await listForms();
  if (result.needsMigration) return <MigrationNotice />;
  if (result.error) return <LoadErrorNotice message={result.error} />;

  const brands = adapter.brands.map((b) => ({ key: b.key, name: b.name, accentColor: b.accentColor }));
  const brandName = new Map(brands.map((b) => [b.key, b.name]));
  const starters: StarterFormSummary[] = STARTER_FORMS.map((p) => ({
    slug: p.slug,
    name: p.name,
    brandName: brandName.get(p.brand) ?? p.brand,
    stepCount: p.definition.steps.length,
  }));

  return (
    <FormsList forms={result.forms} brands={brands} defaultBrand={adapter.defaultBrand} starters={starters} />
  );
}
