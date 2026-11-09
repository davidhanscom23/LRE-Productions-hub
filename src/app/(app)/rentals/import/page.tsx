import { redirect } from "next/navigation";

/** Current RMS Import retired — Hub is SoR; catalog/customers are Hub-owned. */
export default function AvImportRetiredPage() {
  redirect("/rentals");
}
