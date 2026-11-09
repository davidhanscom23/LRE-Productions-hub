import { ForYouSectionCta } from "@/components/for-you/for-you-section-cta";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getForYouQueue } from "@/lib/for-you/queue";
import { redirect } from "next/navigation";

export default async function ForYouPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const { sections, totalActionable } = await getForYouQueue(profile);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">For You</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Everything waiting on you across the Hub — approvals, tasks, packets,
          training, and more.
        </p>
      </header>

      {totalActionable === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">
            You&apos;re all caught up. Nice work.
          </p>
        </div>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {section.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {section.items.map((item, i) => (
                  <li key={`${item.label}-${i}`} className="text-sm">
                    <span className="text-[var(--foreground)]">{item.label}</span>
                    {item.sub ? (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {item.sub}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <ForYouSectionCta
              href={section.href}
              cta={section.cta}
              tone={section.tone}
              dismissKey={section.dismissKey}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
