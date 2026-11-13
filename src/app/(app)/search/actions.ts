"use server";

import { SEARCH_NAV_TARGETS } from "@/lib/search/nav-targets";
import { isSharedCalendarConfigured } from "@/lib/calendar/settings";
import { canAccessAv } from "@/lib/av-access";
import { createClient } from "@/lib/supabase/server";
import { canViewTrainingCourse } from "@/lib/training/audience-access";
import {
  normalizeDepartments,
  type Department,
  type UserRole,
} from "@/lib/types/database";

export type SearchHit = {
  id: string;
  group: "pages" | "people" | "resources" | "packets" | "courses";
  title: string;
  subtitle: string;
  href: string;
};

export type SearchHubResult = {
  error: string | null;
  query: string;
  hits: SearchHit[];
};

/** Strip PostgREST filter metacharacters from user input. */
function sanitizeIlike(value: string): string {
  return value.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
}

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

export async function searchHubAction(
  rawQuery: string,
): Promise<SearchHubResult> {
  const query = sanitizeIlike(rawQuery);
  if (query.length < 2) {
    return { error: null, query, hits: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", query, hits: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, departments, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { error: "Profile not found.", query, hits: [] };

  const role = profile.role as UserRole;
  if (role === "guest") {
    return {
      error: null,
      query,
      hits: [],
    };
  }
  const isAdmin = role === "admin";
  const isMarketer = role === "admin" || role === "trainer";
  const q = query.toLowerCase();
  const hits: SearchHit[] = [];

  const showCalendar =
    isAdmin || (await isSharedCalendarConfigured());
  const showAv = canAccessAv({
    role,
    departments: (profile.departments as Department[] | null) ?? [],
  });
  let showHandbook = isAdmin;
  if (!isAdmin) {
    const { data: handbook } = await supabase
      .from("staff_handbook")
      .select("is_draft")
      .limit(1)
      .maybeSingle();
    showHandbook = handbook ? !handbook.is_draft : false;
  }

  for (const item of SEARCH_NAV_TARGETS) {
    if (item.adminOnly && !isAdmin) continue;
    if (item.calendarAccess && !showCalendar) continue;
    if (item.avAccess && !showAv) continue;
    if (item.handbookAccess && !showHandbook) continue;
    if (item.marketerAccess && !isMarketer) continue;

    const haystack = [item.label, ...item.keywords].join(" ");
    if (!matchesQuery(haystack, q)) continue;

    hits.push({
      id: `nav-${item.href}`,
      group: "pages",
      title: item.label,
      subtitle: "Page",
      href: item.href,
    });
  }

  const { data: peopleRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, title, departments, role")
    .eq("is_active", true)
    .or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%,title.ilike.%${query}%`,
    )
    .order("full_name", { ascending: true })
    .limit(8);

  for (const row of peopleRows ?? []) {
    const name = String(row.full_name || row.email || "Staff");
    const depts = Array.isArray(row.departments)
      ? (row.departments as string[]).join(", ")
      : "";
    hits.push({
      id: `person-${row.id}`,
      group: "people",
      title: name,
      subtitle:
        [row.title, depts, row.role].filter(Boolean).join(" · ") || "People",
      href: "/people",
    });
  }

  const { data: resources } = await supabase
    .from("resources")
    .select("id, title, category, description, type")
    .or(
      `title.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`,
    )
    .order("title", { ascending: true })
    .limit(8);

  for (const row of resources ?? []) {
    hits.push({
      id: `resource-${row.id}`,
      group: "resources",
      title: String(row.title ?? "Resource"),
      subtitle:
        [row.category, row.type].filter(Boolean).join(" · ") || "Resource",
      href: "/resources",
    });
  }

  const { data: packets } = await supabase
    .from("event_packets")
    .select("id, client_name, venue_raw, dj_name, event_date, status")
    .or(
      `client_name.ilike.%${query}%,venue_raw.ilike.%${query}%,dj_name.ilike.%${query}%`,
    )
    .order("event_date", { ascending: false })
    .limit(8);

  for (const row of packets ?? []) {
    hits.push({
      id: `packet-${row.id}`,
      group: "packets",
      title: String(row.client_name || "Event packet"),
      subtitle: [row.event_date, row.venue_raw, row.dj_name, row.status]
        .filter(Boolean)
        .join(" · "),
      href: `/event-packets/${row.id}`,
    });
  }

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, slug, title, blurb, audience, status")
    .eq("status", "published")
    .or(`title.ilike.%${query}%,blurb.ilike.%${query}%,audience.ilike.%${query}%`)
    .order("sort_order", { ascending: true })
    .limit(8);

  const departments = normalizeDepartments(profile.departments);
  for (const row of courses ?? []) {
    if (
      !canViewTrainingCourse(String(row.audience ?? "All staff"), {
        role,
        departments,
      })
    ) {
      continue;
    }
    hits.push({
      id: `course-${row.id}`,
      group: "courses",
      title: String(row.title ?? "Course"),
      subtitle:
        [row.audience, "Training Portal"].filter(Boolean).join(" · ") ||
        "Training Portal",
      href: `/training-portal/${row.slug}`,
    });
  }

  return { error: null, query, hits };
}
