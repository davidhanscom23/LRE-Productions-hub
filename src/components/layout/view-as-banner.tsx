"use client";

import { Eye } from "lucide-react";
import { stopViewAsStaffAction } from "@/lib/auth/view-as-actions";

/** Shown to a real admin while previewing the hub as a staff member. */
export function ViewAsBanner() {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-3 py-1.5 text-center text-xs font-medium text-amber-950"
    >
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        You&apos;re viewing the hub as a staff member. Menus and pages match
        what staff see; saved data still reflects your admin access.
      </span>
      <button
        type="button"
        onClick={async () => {
          await stopViewAsStaffAction();
          window.location.reload();
        }}
        className="rounded-md bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-50 hover:opacity-90"
      >
        Exit staff view
      </button>
    </div>
  );
}
