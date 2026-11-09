import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { SmsPortalClient } from "@/components/sms/sms-portal-client";

/** SMS Portal — two-way staff texting + bulk SMS/email (admins only). */
export default async function SmsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return <SmsPortalClient />;
}
