import type { Profile } from "@/lib/types/database";
import { ROLE_LABELS } from "@/lib/types/database";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  profile?: Profile | null;
};

export function ModulePlaceholder({
  title,
  description,
  profile,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-medium text-[var(--brand)]">Coming soon</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </p>

      {profile && (
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--muted)]">Signed in as</p>
          <p className="mt-1 text-base font-medium text-[var(--foreground)]">
            {profile.full_name || profile.email}
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {ROLE_LABELS[profile.role]} · {profile.email}
          </p>
        </div>
      )}
    </div>
  );
}
