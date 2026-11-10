import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";

export function BusinessDetails() {
  return (
    <section className="overflow-hidden rounded-[var(--panel-radius)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Business Details
        </h2>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Company
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
              {COMPANY.legalName}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--muted)]">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Address
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">
              {COMPANY.address}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--muted)]">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Phone
            </p>
            <a
              href={COMPANY.officePhoneHref}
              className="mt-0.5 block text-sm font-medium text-[var(--foreground)] hover:text-[var(--brand)]"
            >
              Office: {COMPANY.officePhone}
            </a>
            <a
              href={COMPANY.cellPhoneHref}
              className="block text-sm font-medium text-[var(--foreground)] hover:text-[var(--brand)]"
            >
              Cell: {COMPANY.cellPhone}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--muted)]">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Email
            </p>
            <a
              href={COMPANY.emailHref}
              className="mt-0.5 block truncate text-sm font-medium text-[var(--foreground)] hover:text-[var(--brand)]"
            >
              {COMPANY.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
