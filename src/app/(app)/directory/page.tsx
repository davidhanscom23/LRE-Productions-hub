import { getCurrentProfile } from "@/lib/auth/profile";
import { normalizeHexColor } from "@/lib/people/color";
import { createClient } from "@/lib/supabase/server";
import { normalizeDepartments } from "@/lib/types/database";
import { redirect } from "next/navigation";

type DirEntry = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  title: string | null;
  role: string;
  color: string | null;
  departments: string[];
  reports_to: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleBadge(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "trainer") return "Trainer";
  if (role === "staff") return "Staff";
  return role;
}

function PersonCard({ p }: { p: DirEntry }) {
  const color = normalizeHexColor(p.color) ?? "var(--brand)";
  const name = p.full_name?.trim() || p.email;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.avatar_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {name}
          </span>
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
            {roleBadge(p.role)}
          </span>
        </div>
        {p.title ? (
          <p className="text-sm text-[var(--muted)]">{p.title}</p>
        ) : null}
        {p.departments.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {p.departments.map((d) => (
              <span
                key={d}
                className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]"
              >
                {d}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
          {p.email ? (
            <a href={`mailto:${p.email}`} className="hover:text-[var(--brand)]">
              {p.email}
            </a>
          ) : null}
          {p.phone ? (
            <a href={`tel:${p.phone}`} className="hover:text-[var(--brand)]">
              {p.phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function renderTree(
  ids: string[],
  byId: Map<string, DirEntry>,
  childrenOf: Map<string, string[]>,
  depth: number,
): React.ReactNode {
  const people = ids
    .map((id) => byId.get(id))
    .filter((p): p is DirEntry => Boolean(p))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <ul className={depth > 0 ? "space-y-3 border-l border-[var(--border)] pl-4 sm:pl-6" : "space-y-3"}>
      {people.map((p) => {
        const kids = childrenOf.get(p.id) ?? [];
        return (
          <li key={p.id} className="space-y-3">
            <PersonCard p={p} />
            {kids.length > 0
              ? renderTree(kids, byId, childrenOf, depth + 1)
              : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function DirectoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, avatar_url, title, role, color, departments, reports_to, is_active",
    )
    .eq("is_active", true);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load the directory: {error.message}
      </div>
    );
  }

  const people: DirEntry[] = (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: (r.full_name as string) ?? "",
    email: (r.email as string) ?? "",
    phone: (r.phone as string) ?? null,
    avatar_url: (r.avatar_url as string) ?? null,
    title: (r.title as string) ?? null,
    role: (r.role as string) ?? "staff",
    color: (r.color as string) ?? null,
    departments: normalizeDepartments((r as { departments?: unknown }).departments),
    reports_to: (r.reports_to as string) ?? null,
  }));

  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const rootIds: string[] = [];
  for (const p of people) {
    // A person is a root if they report to nobody or to someone inactive/unknown.
    if (p.reports_to && byId.has(p.reports_to)) {
      const list = childrenOf.get(p.reports_to) ?? [];
      list.push(p.id);
      childrenOf.set(p.reports_to, list);
    } else {
      rootIds.push(p.id);
    }
  }

  const hasReporting = childrenOf.size > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Company Directory
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {hasReporting
            ? "Who reports to whom, drawn from People. Set a person’s manager on their People profile to shape this."
            : "Everyone on the team. Set a manager on People profiles to build the reporting tree."}
        </p>
      </header>

      {people.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active staff yet.</p>
      ) : (
        renderTree(rootIds, byId, childrenOf, 0)
      )}
    </div>
  );
}
