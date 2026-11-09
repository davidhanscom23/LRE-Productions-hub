import { redirect } from "next/navigation";

/** Legacy Current RMS quote builder — Hub Quotes is SoR. */
export default function LegacyRmsQuoteRedirect() {
  redirect("/rentals/quotes");
}
