import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isPushConfigured } from "@/lib/notifications/push";
import { isEmailConfigured } from "@/lib/email/send";
import { CommunicationsClient } from "@/components/communications/communications-client";

/** Communications control center — channel status + a test center (admins only). */
export default async function CommunicationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );

  return (
    <CommunicationsClient
      pushConfigured={isPushConfigured()}
      emailConfigured={isEmailConfigured()}
      smsConfigured={smsConfigured}
      adminEmail={profile.email}
    />
  );
}
