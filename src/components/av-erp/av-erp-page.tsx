import type { ReactNode } from "react";
import { AvErpSubnav } from "@/components/av-erp/av-erp-subnav";

/** Full-width subnav + constrained body — keeps tabs from clipping inside max-w pages. */
export function AvErpPage({
  children,
  maxWidthClassName = "max-w-5xl",
}: {
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className="pb-16">
      <AvErpSubnav />
      <div className={`mx-auto ${maxWidthClassName}`}>{children}</div>
    </div>
  );
}
