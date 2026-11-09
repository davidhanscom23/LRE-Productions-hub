import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/admin";
import { normalizePhone, formatPhone } from "@/lib/sms/twilio";

/** Active staff for the SMS/email recipient pickers (admins only). */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, departments")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const recipients = (data ?? []).map((p) => {
    const e164 = normalizePhone((p.phone as string) ?? null);
    const email = typeof p.email === "string" ? p.email : "";
    return {
      id: p.id as string,
      name: (p.full_name as string) ?? "",
      phone: e164 ? formatPhone(e164) : null,
      hasPhone: Boolean(e164),
      email: email || null,
      hasEmail: Boolean(email),
      departments: Array.isArray(p.departments) ? (p.departments as string[]) : [],
    };
  });

  return NextResponse.json({ recipients });
}
