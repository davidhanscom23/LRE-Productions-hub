import { redirect } from "next/navigation";
import { parseTagCode } from "@/lib/gear-tags/parse";

export const metadata = { title: "Gear tag — LRE" };

type Props = { params: Promise<{ tag: string }> };

/**
 * The short link a gear tag's QR code holds (hub.lreproductions.com/t/0001). Signed-in staff
 * land on the piece in Gear scan. Anyone else is sent to the login page by the middleware and
 * sees nothing about the gear.
 */
export default async function GearTagLinkPage({ params }: Props) {
  const { tag } = await params;
  const parsed = parseTagCode(decodeURIComponent(tag));
  redirect(parsed ? `/gear-scan?tag=${parsed}` : "/gear-scan");
}
