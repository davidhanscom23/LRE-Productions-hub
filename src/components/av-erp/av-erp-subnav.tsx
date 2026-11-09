"use client";

import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/rentals", label: "Overview", exact: true },
  { href: "/rentals/quotes", label: "Estimates" },
  { href: "/rentals/invoices", label: "Invoices" },
  { href: "/rentals/costs", label: "Costs" },
  { href: "/rentals/reports", label: "Reports" },
  { href: "/rentals/developer", label: "Developer" },
  { href: "/rentals/warehouse", label: "Warehouse" },
  { href: "/rentals/stock", label: "Stock" },
  { href: "/rentals/calendar", label: "Calendar" },
  { href: "/rentals/planner", label: "Planner" },
  { href: "/rentals/travel", label: "Travel" },
  { href: "/rentals/activities", label: "Activities" },
  { href: "/rentals/customers", label: "Customers" },
  { href: "/rentals/venues", label: "Venues" },
  { href: "/rentals/suppliers", label: "Suppliers" },
  { href: "/rentals/crew", label: "Crew" },
  { href: "/rentals/catalog", label: "Catalog" },
];

/** Full-bleed within AppShell main; links wrap so every tab stays visible. */
export function AvErpSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Vident AV sections"
      className="mb-6 -mx-4 w-[calc(100%+2rem)] border-b border-[var(--border)] px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:-mx-8 lg:w-[calc(100%+4rem)] lg:px-8"
    >
      <div className="flex flex-wrap gap-x-1 gap-y-0">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            // Plain <a> (not next/link): full navigation so Costs/Reports always
            // resolve even if client soft-nav / stale PWA chunks misbehave.
            <a
              key={link.href}
              href={link.href}
              className={
                active
                  ? "border-b-2 border-[var(--brand)] px-2.5 py-2 text-sm font-semibold text-[var(--foreground)] sm:px-3"
                  : "border-b-2 border-transparent px-2.5 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] sm:px-3"
              }
            >
              {link.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
