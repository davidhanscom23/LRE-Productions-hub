import { redirect } from "next/navigation";
import { PageMapClient } from "@/components/page-map/page-map-client";
import { getCurrentProfile } from "@/lib/auth/profile";

export const metadata = { title: "Page Map" };

export default async function PageMapPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return <PageMapClient />;
}
