import { parseContractBlocks } from "@/lib/project-contracts/blocks";

/** Branded, paper-style contract text for the public signing page. */
export function ContractView({ body }: { body: string }) {
  const blocks = parseContractBlocks(body);
  return (
    <div className="text-[13.5px] leading-relaxed text-neutral-800">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return (
            <h2 key={i} className="mb-2 mt-7 border-l-[3px] border-[#c9a05c] pl-3 text-[13px] font-bold uppercase tracking-wide text-neutral-900 first:mt-0">
              {b.text}
            </h2>
          );
        }
        if (b.kind === "details") {
          return (
            <dl key={i} className="my-3 overflow-hidden rounded-lg border border-neutral-200">
              {b.rows.map((r, j) => (
                <div key={j} className="grid grid-cols-[7.5rem_1fr] border-b border-neutral-200 last:border-b-0 sm:grid-cols-[9rem_1fr]">
                  <dt className="bg-[#f6f3ee] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{r.label}</dt>
                  <dd className="px-3 py-2">{r.value}</dd>
                </div>
              ))}
            </dl>
          );
        }
        if (b.kind === "bullets") {
          return (
            <ul key={i} className="my-3 space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a05c]" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          );
        }
        const caps = b.text.length > 120 && b.text === b.text.toUpperCase();
        return (
          <p key={i} className={`my-2 whitespace-pre-line ${b.kind === "clause" ? "pl-4" : ""} ${caps ? "text-[12px] leading-snug" : ""}`}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
