"use client";

import { useState } from "react";
import { EventReportForm } from "@/components/event-reports/event-report-form";
import { EventReportList } from "@/components/event-reports/event-report-list";
import type { EventReport } from "@/lib/types/event-reports";

type EventReportsPageClientProps = {
  reporterName: string;
  reporterEmail: string;
  currentUserId: string;
  reports: EventReport[];
  canSeeAll: boolean;
  isAdmin: boolean;
};

type Tab = "new" | "list";

export function EventReportsPageClient({
  reporterName,
  reporterEmail,
  currentUserId,
  reports,
  canSeeAll,
  isAdmin,
}: EventReportsPageClientProps) {
  const [tab, setTab] = useState<Tab>("new");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          End of Event Report
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Fill this out after each event so the team has a clear record.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        <TabButton active={tab === "new"} onClick={() => setTab("new")}>
          New report
        </TabButton>
        <TabButton active={tab === "list"} onClick={() => setTab("list")}>
          Submitted ({reports.length})
        </TabButton>
      </div>

      {tab === "new" ? (
        <EventReportForm
          reporterName={reporterName}
          reporterEmail={reporterEmail}
        />
      ) : (
        <EventReportList
          reports={reports}
          canSeeAll={canSeeAll}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] text-[var(--brand)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
