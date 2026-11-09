import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hubAdapter as adapter } from "@/lib/inquiry-forms/server/adapter";
import type { BusinessSettings } from "@/lib/inquiry-forms/types";
import { getBusinessSettings, getFormForEdit } from "../actions";
import { FormEditor, type EditorTab } from "@/components/inquiry-forms/admin/form-editor";
import { LoadErrorNotice, MigrationNotice } from "@/components/inquiry-forms/admin/list-migration-notice";
import { NEEDS_MIGRATION_MESSAGE } from "@/components/inquiry-forms/admin/list-types";
import { Notice, PageHeader } from "@/components/inquiry-forms/admin/list-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit inquiry form",
};

const TABS: readonly EditorTab[] = ["build", "settings", "share", "submissions"];

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function BackLink() {
  return (
    <div className="mx-auto mb-3 max-w-3xl">
      <Link
        href="/inquiry-forms"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All inquiry forms
      </Link>
    </div>
  );
}

export default async function InquiryFormEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Page gate follows the view-as role (house rule); every action re-checks the REAL admin.
  const role = await adapter.viewerRole();
  if (!role) redirect("/login");
  if (role !== "admin") redirect("/");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tabParam = firstParam(query.tab);
  const initialTab: EditorTab = TABS.find((t) => t === tabParam) ?? "build";

  let loaded: Awaited<ReturnType<typeof getFormForEdit>>;
  try {
    loaded = await getFormForEdit(id);
  } catch (e) {
    const message = e instanceof Error ? e.message : undefined;
    return (
      <>
        <BackLink />
        <LoadErrorNotice title="Inquiry form" message={message} />
      </>
    );
  }

  if (!loaded.ok) {
    if (loaded.error.startsWith(NEEDS_MIGRATION_MESSAGE)) {
      return (
        <>
          <BackLink />
          <MigrationNotice title="Inquiry form" />
        </>
      );
    }
    if (/no longer exists/i.test(loaded.error)) {
      return (
        <>
          <BackLink />
          <div className="mx-auto max-w-3xl">
            <PageHeader title="Form not found" />
            <Notice tone="warn" title="This form is not here">
              <p>It may have been deleted, or the link is out of date.</p>
              <p className="mt-2">
                <Link href="/inquiry-forms" className="font-medium underline underline-offset-2">
                  Go to all inquiry forms
                </Link>
              </p>
            </Notice>
          </div>
        </>
      );
    }
    return (
      <>
        <BackLink />
        <LoadErrorNotice title="Inquiry form" message={loaded.error} />
      </>
    );
  }

  // Only used for notes on the availability step; the editor works without it.
  let business: BusinessSettings | null = null;
  try {
    const res = await getBusinessSettings();
    business = res.error ? null : res.settings;
  } catch {
    business = null;
  }

  return (
    <FormEditor
      form={loaded.form}
      brands={loaded.brands}
      publicOrigin={loaded.publicOrigin}
      business={business}
      initialTab={initialTab}
    />
  );
}
