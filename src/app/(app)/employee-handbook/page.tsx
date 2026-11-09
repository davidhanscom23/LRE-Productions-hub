import { redirect } from "next/navigation";

/** Legacy path — redirects after handbook rename to Staff Handbook. */
export default function LegacyHandbookRedirect() {
  redirect("/staff-handbook");
}
