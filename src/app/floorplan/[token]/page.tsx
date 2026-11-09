import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FloorPlanSvg } from "@/components/floor-plans/floor-plan-svg";
import { COMPANY } from "@/lib/company";
import { FLOOR_TOKEN_RE, loadPublicFloorPlan } from "@/lib/floor-plans/public";
import { planInventory } from "@/lib/floor-plans/types";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: `Floor plan | ${COMPANY.displayName}`,
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PublicFloorPlanPage({ params }: Props) {
  const { token } = await params;
  if (!FLOOR_TOKEN_RE.test(token)) notFound();
  const plan = await loadPublicFloorPlan(token);
  if (!plan) notFound();
  const inventory = planInventory(plan.data);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-neutral-500">{COMPANY.displayName}</p>
        <h1 className="text-2xl font-semibold">{plan.name}</h1>
        <p className="text-sm text-neutral-600">
          {[plan.projectName, plan.spaceName].filter(Boolean).join(" · ")}
        </p>
      </header>
      <div className="overflow-auto rounded-xl border border-neutral-300 bg-white">
        <FloorPlanSvg data={plan.data} blueprintUrl={plan.blueprintUrl} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      {inventory.length > 0 && (
        <ul className="grid gap-x-8 text-sm sm:grid-cols-2">
          {inventory.map((r) => (
            <li key={r.label} className="flex justify-between border-b border-neutral-200 py-1">
              <span>{r.label}</span>
              <span className="tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-500">
        Drawing is to approximate scale. Final placement is confirmed on site.
      </p>
    </main>
  );
}
