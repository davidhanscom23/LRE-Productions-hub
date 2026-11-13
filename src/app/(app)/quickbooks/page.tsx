import { QuickBooksClient } from "@/components/quickbooks/quickbooks-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { qbConfig, qbConnection } from "@/lib/quickbooks/client";
import { invoicesNeedingSync } from "@/lib/quickbooks/sync";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ connected?: string; error?: string }> };

export default async function QuickBooksPage({ searchParams }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/pipeline");
  const sp = await searchParams;
  const cfg = qbConfig();
  const connection = await qbConnection().catch(() => null);
  const pending = connection ? await invoicesNeedingSync(50).catch(() => []) : [];
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <a href="/pipeline" className="text-xs text-[var(--muted)] underline">← Pipeline</a>
        <h1 className="text-xl font-semibold">QuickBooks sync</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Send Hub invoices and payments to QuickBooks Online so your bookkeeping stays in one place.
        </p>
      </div>
      {sp.connected && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">QuickBooks connected.</p>}
      {sp.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Couldn’t connect: {sp.error}</p>}
      <QuickBooksClient
        configured={cfg.configured}
        production={cfg.production}
        connection={connection}
        pending={pending}
      />
    </div>
  );
}
