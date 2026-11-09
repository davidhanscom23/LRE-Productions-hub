"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRealProfile } from "@/lib/auth/profile";
import { VIEW_AS_COOKIE, VIEW_AS_STAFF } from "@/lib/auth/view-as";

/** Admins only: start previewing the hub as a staff member (8 hours). */
export async function startViewAsStaffAction(): Promise<{ ok: boolean }> {
  const real = await getRealProfile();
  if (!real || real.role !== "admin") return { ok: false };
  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, VIEW_AS_STAFF, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Back to the normal admin view. Safe to call by anyone (just clears the cookie). */
export async function stopViewAsStaffAction(): Promise<{ ok: boolean }> {
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
