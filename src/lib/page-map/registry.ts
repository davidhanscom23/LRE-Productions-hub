/**
 * Page Map registry: one entry per route in the hub.
 *
 * REQUIRED (see AGENTS.md): when you add or remove a page under src/app,
 * add or remove its entry here in the same commit. The coverage test fails
 * if the registry and the real pages drift apart.
 *
 * Whether a page is "Linked in nav" is worked out from the sidebar's own nav
 * list, so it never goes stale. `kind` only describes pages that are NOT in
 * the nav.
 */

export type PageGroup =
  | "Daily"
  | "Work"
  | "People & culture"
  | "Learn & refs"
  | "Field tools"
  | "Marketing"
  | "Admin"
  | "Personal"
  | "Redirects"
  | "Public";

export type PageKind =
  /** A normal signed-in page. */
  | "page"
  /** Not in the nav; people get there from another page or a link. */
  | "reachable"
  /** Opens without signing in (public page or token link). */
  | "public"
  /** Sends the visitor somewhere else. */
  | "redirect";

export type PageAudience = "all" | "staff" | "admin" | "trainer" | "av";

export type PageEntry = {
  /** Route path as it appears in src/app (dynamic parts stay in brackets). */
  path: string;
  label: string;
  group: PageGroup;
  kind: PageKind;
  /** Who can open it. */
  audience?: PageAudience;
  /** "Reached from..." note, or where a redirect goes. */
  note?: string;
};

export const PAGE_GROUP_ORDER: PageGroup[] = [
  "Daily",
  "Work",
  "People & culture",
  "Learn & refs",
  "Field tools",
  "Marketing",
  "Admin",
  "Personal",
  "Redirects",
  "Public",
];

export const PAGE_REGISTRY: PageEntry[] = [
  // Daily
  { path: "/", label: "Home", group: "Daily", kind: "page", audience: "all" },
  { path: "/for-you", label: "For You", group: "Daily", kind: "page", audience: "staff" },
  { path: "/my-calendar", label: "My Calendar", group: "Daily", kind: "page", audience: "staff" },
  { path: "/my-week", label: "My Week", group: "Daily", kind: "page", audience: "staff" },
  { path: "/chat", label: "Chat", group: "Daily", kind: "page", audience: "staff" },
  { path: "/ask", label: "Ask the Hub", group: "Daily", kind: "page", audience: "all" },
  { path: "/tools", label: "Tools", group: "Daily", kind: "page", audience: "all" },
  { path: "/announcements", label: "Announcements", group: "Daily", kind: "page", audience: "staff" },
  { path: "/action-center", label: "Action Center", group: "Daily", kind: "reachable", audience: "staff", note: "Reached from Home and For You." },
  { path: "/notifications", label: "Notifications", group: "Daily", kind: "reachable", audience: "staff", note: "Reached from the bell in the top bar." },
  { path: "/forum", label: "Forum", group: "Daily", kind: "page", audience: "staff" },
  { path: "/forum/[id]", label: "Forum thread", group: "Daily", kind: "reachable", audience: "staff", note: "Reached from the Forum list." },
  { path: "/polls", label: "Polls", group: "Daily", kind: "page", audience: "staff" },
  { path: "/meetings", label: "Meetings", group: "Daily", kind: "page", audience: "staff" },
  { path: "/changelog", label: "What's New", group: "Daily", kind: "page", audience: "staff" },
  { path: "/changelog/videos", label: "Change Log Videos", group: "Daily", kind: "reachable", audience: "staff", note: "Reached from the Change Log Videos button on What's New." },

  // Work
  { path: "/calendar", label: "Calendar", group: "Work", kind: "page", audience: "staff" },
  { path: "/event-packets", label: "Event Packets", group: "Work", kind: "page", audience: "staff" },
  { path: "/event-packets/[id]", label: "Event Packet", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the Event Packets list." },
  { path: "/event-checklist/open", label: "Find an event's gear checklist", group: "Work", kind: "reachable", audience: "staff", note: "Lookup page: sends you to the right checklist from a calendar card or Event Packet." },
  { path: "/event-checklist/[projectId]", label: "Event gear checklist", group: "Work", kind: "reachable", audience: "staff", note: "Check gear out of and back into the warehouse. Assigned staff and admins only; opened from an event." },
  { path: "/end-of-event-report", label: "End-of-event report", group: "Work", kind: "page", audience: "staff" },
  { path: "/submit-event-photos", label: "Submit event photos", group: "Work", kind: "page", audience: "staff" },
  { path: "/event-media/thumbnails", label: "Event media thumbnails", group: "Work", kind: "reachable", audience: "admin", note: "Reached from event media tools." },
  { path: "/pipeline", label: "Pipeline", group: "Work", kind: "page", audience: "staff", note: "Admins, Leads, and staff (assignees edit; others read-only)." },
  { path: "/pipeline/reports", label: "Pipeline sales reports", group: "Work", kind: "reachable", audience: "trainer", note: "Booking rate, lead sources, booked value and time to book. Admins and Leads; reached from Pipeline." },
  { path: "/pipeline/automations", label: "Pipeline email automations", group: "Work", kind: "reachable", audience: "admin", note: "Turn on and edit the automatic client emails. Admin-only; reached from Pipeline. Needs migration 179_pipeline_automations.sql." },
  { path: "/pipeline/archive", label: "Pipeline archive and backup", group: "Work", kind: "reachable", audience: "trainer", note: "File exported Pipeline PDFs on their projects (auto-matched by file name); admins also download CSV backups. Reached from Pipeline. Needs migration 184_pipeline_archive.sql." },
  { path: "/quickbooks", label: "QuickBooks sync", group: "Work", kind: "reachable", audience: "admin", note: "Admin-only: connect QuickBooks Online and send Hub invoices and payments across. Reached from Pipeline. Needs migration 185_quickbooks_sync.sql and QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET." },
  { path: "/scheduling", label: "Scheduling", group: "Work", kind: "page", audience: "staff", note: "Booking pages, hours and upcoming client bookings. Admins and Leads edit. Needs migration 181_meeting_scheduler.sql." },
  { path: "/book/[slug]", label: "Book a meeting (public)", group: "Public", kind: "public", note: "Client-facing booking page from Scheduling." },
  { path: "/book/cancel/[token]", label: "Cancel a booking (public)", group: "Public", kind: "public", note: "Link in the client's confirmation email." },
  { path: "/services", label: "Services Catalog", group: "Work", kind: "page", audience: "staff", note: "Saved services and prices. Everyone reads; admins and Leads edit and import the Pipeline list. Needs migration 180_service_catalog.sql." },
  { path: "/floor-plans", label: "Floor Plans", group: "Work", kind: "page", audience: "staff", note: "Room layout designer: templates and every project plan. Needs migration 178_floor_plans.sql." },
  { path: "/floor-plans/[id]", label: "Floor plan editor", group: "Work", kind: "reachable", audience: "staff", note: "One plan's editor. Reached from a Pipeline project or Floor Plans." },
  { path: "/floorplan/[token]", label: "Floor plan (public)", group: "Public", kind: "public", note: "Client-facing share link for a published floor plan." },
  { path: "/pipeline/projects/[id]", label: "Pipeline project", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the Pipeline board and project list, and from website inquiry alerts." },
  { path: "/quoting", label: "Quoting", group: "Work", kind: "page", audience: "staff" },
  { path: "/quoting/[id]", label: "Quote", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the Quoting list." },
  { path: "/proposals", label: "Proposals", group: "Work", kind: "page", audience: "staff" },
  { path: "/proposals/[id]", label: "Proposal", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the Proposals list." },
  { path: "/venue-quotes", label: "Venue Quotes", group: "Work", kind: "page", audience: "admin" },
  { path: "/venue-quotes/[id]", label: "Venue portal editor", group: "Work", kind: "reachable", audience: "admin", note: "Reached from the Venue Quotes list." },
  { path: "/venue-quotes/requests", label: "Venue quote requests", group: "Work", kind: "reachable", audience: "admin", note: "Reached from Venue Quotes and the Home attention card." },
  { path: "/inquiry-forms", label: "Inquiry Forms", group: "Work", kind: "page", audience: "admin", note: "Multi-step website inquiry forms: starter forms, funnel numbers, publish, share and embed. Finished inquiries become Inquiry projects on the Pipeline board. Needs migration 167_inquiry_forms.sql." },
  { path: "/inquiry-forms/[id]", label: "Inquiry form editor", group: "Work", kind: "reachable", audience: "admin", note: "One form's Build, Settings, Share and Submissions tabs. Reached from Inquiry Forms." },
  { path: "/inquiry-forms/settings", label: "Inquiry Forms business settings", group: "Work", kind: "reachable", audience: "admin", note: "Date check, blackout dates, minimum notice, alerts and spam limits shared by every form. Reached from Inquiry Forms." },
  { path: "/vendors", label: "Vendors", group: "Work", kind: "page", audience: "staff" },
  { path: "/rentals", label: "LRE AV", group: "Work", kind: "page", audience: "staff", note: "Admins and Audiovisual staff only." },
  { path: "/av-show", label: "AV Show Control", group: "Work", kind: "page", audience: "staff", note: "Admins and Audiovisual staff only. Launches the standalone show tool at /av-show/index.html." },
  { path: "/rentals/quotes", label: "AV Estimates", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/quotes/[id]", label: "AV Estimate editor", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the AV Estimates list." },
  { path: "/estimate/[token]", label: "AV estimate (public)", group: "Public", kind: "public", note: "Customer-facing share link from an AV quote." },
  { path: "/rentals/customers", label: "AV Customers", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/venues", label: "AV Venues", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/catalog", label: "AV Catalog", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/import", label: "AV Import (retired)", group: "Redirects", kind: "redirect", audience: "admin", note: "Redirects to /rentals; Current RMS Import removed." },
  { path: "/av-portals", label: "AV Event Portals", group: "Work", kind: "page", audience: "staff", note: "Admins and Audiovisual staff only." },
  { path: "/av-portals/[id]", label: "AV event portal", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the AV Event Portals list." },
  { path: "/rentals/reports", label: "AV Reports", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/developer", label: "AV Developer / Terminal API", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/quote", label: "Legacy RMS quote (redirect)", group: "Redirects", kind: "redirect", audience: "staff", note: "Redirects to Hub Quotes." },
  { path: "/rentals/costs", label: "AV Costs", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/crew", label: "AV Crew", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/invoices", label: "AV Invoices", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/invoices/[id]", label: "AV Invoice detail", group: "Work", kind: "reachable", audience: "staff", note: "Reached from the AV Invoices list." },
  { path: "/rentals/warehouse", label: "AV Warehouse", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/stock", label: "AV Stock", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/calendar", label: "AV Gear calendar", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/planner", label: "AV Planner", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/travel", label: "AV Travel", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/activities", label: "AV Activities", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/suppliers", label: "AV Suppliers", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/contractors", label: "AV Contractors", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/serials", label: "AV Serials", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/rentals/templates", label: "AV Templates", group: "Work", kind: "reachable", audience: "staff", note: "Reached from LRE AV tabs." },
  { path: "/staffing", label: "Staffing", group: "Work", kind: "page", audience: "trainer", note: "Admins and Leads (trainer)." },
  { path: "/contractor-pay", label: "Contractor pay", group: "Work", kind: "page", audience: "staff" },
  { path: "/expenses", label: "Expenses", group: "Work", kind: "page", audience: "staff" },
  { path: "/time-off", label: "Time off", group: "Work", kind: "page", audience: "staff" },
  { path: "/communications", label: "Communications", group: "Work", kind: "page", audience: "admin" },
  { path: "/sms", label: "SMS", group: "Work", kind: "page", audience: "admin" },
  { path: "/drive", label: "Drive", group: "Work", kind: "page", audience: "staff" },

  // People & culture
  { path: "/people", label: "People", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/directory", label: "Directory", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/teams", label: "Teams", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/kudos", label: "Kudos", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/points", label: "Points", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/winners", label: "Winners", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/pebbles-and-rocks", label: "Pebbles & Rocks", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/reviews", label: "Reviews", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/client-reviews", label: "Client reviews", group: "People & culture", kind: "page", audience: "staff" },
  { path: "/hiring", label: "Hiring", group: "People & culture", kind: "page", audience: "admin" },
  { path: "/onboarding", label: "Onboarding", group: "People & culture", kind: "page", audience: "staff" },

  // Learn & refs
  { path: "/resources", label: "Resources", group: "Learn & refs", kind: "page", audience: "staff" },
  { path: "/documents", label: "Documents", group: "Learn & refs", kind: "page", audience: "staff" },
  { path: "/documents/[slug]", label: "Document", group: "Learn & refs", kind: "reachable", audience: "staff", note: "Reached from the Documents list." },
  { path: "/training-portal", label: "Training portal", group: "Learn & refs", kind: "page", audience: "staff" },
  { path: "/training/av-guide", label: "AV Fundamental Resource Guide", group: "Learn & refs", kind: "reachable", audience: "staff", note: "Reached from Teams > Audiovisual > Fundamental Resource Guide > Open full page." },
  { path: "/training-portal/[slug]", label: "Training course", group: "Learn & refs", kind: "reachable", audience: "staff", note: "Reached from the Training portal." },
  { path: "/staff-handbook", label: "Staff handbook", group: "Learn & refs", kind: "page", audience: "staff" },
  { path: "/videos", label: "Videos", group: "Learn & refs", kind: "page", audience: "staff" },
  { path: "/videos/[id]", label: "Video", group: "Learn & refs", kind: "reachable", audience: "staff", note: "Reached from the Videos list." },
  { path: "/support-guide", label: "Support guide", group: "Learn & refs", kind: "page", audience: "all" },

  // Field tools
  { path: "/guest", label: "Guest Hub", group: "Field tools", kind: "reachable", audience: "all", note: "Landing page for guest accounts." },

  // Marketing
  { path: "/marketing", label: "Marketing", group: "Marketing", kind: "page", audience: "trainer" },
  { path: "/marketing-library", label: "Marketing library", group: "Marketing", kind: "page", audience: "trainer" },
  { path: "/social-studio", label: "Social Studio", group: "Marketing", kind: "page", audience: "trainer" },
  { path: "/social-studio/[id]", label: "Social post", group: "Marketing", kind: "reachable", audience: "trainer", note: "Reached from Social Studio." },
  { path: "/image-studio", label: "Image Studio", group: "Marketing", kind: "page", audience: "trainer" },
  { path: "/content-sla", label: "Content SLA", group: "Marketing", kind: "page", audience: "trainer" },

  // Admin
  { path: "/reports", label: "Reports", group: "Admin", kind: "page", audience: "admin" },
  { path: "/hub-switcher", label: "Hub switcher", group: "Admin", kind: "page", audience: "admin" },
  { path: "/hub-health", label: "Hub health", group: "Admin", kind: "page", audience: "admin" },
  { path: "/page-map", label: "Page Map", group: "Admin", kind: "page", audience: "admin" },

  // Personal
  { path: "/notification-settings", label: "Notification settings", group: "Personal", kind: "reachable", audience: "staff", note: "Reached from the profile menu." },
  { path: "/set-password", label: "Set password", group: "Personal", kind: "reachable", audience: "staff", note: "Reached from the invite email and the profile menu." },

  // Redirects
  { path: "/employee-handbook", label: "Employee handbook", group: "Redirects", kind: "redirect", note: "Sends visitors to /staff-handbook." },

  // Public
  { path: "/login", label: "Sign in", group: "Public", kind: "public" },
  { path: "/forgot-password", label: "Forgot password", group: "Public", kind: "public" },
  { path: "/reset-password", label: "Reset password", group: "Public", kind: "public", note: "Opened from the reset email." },
  { path: "/auth/confirm", label: "Email confirmation", group: "Public", kind: "public", note: "Opened from the email link; signs the person in." },
  { path: "/apply", label: "Apply", group: "Public", kind: "public", note: "Public job application link." },
  { path: "/apply/[track]", label: "Apply (track)", group: "Public", kind: "public", note: "Public application form for one role." },
  { path: "/portal/[token]", label: "AV event portal (client)", group: "Public", kind: "public", note: "Private link a client uses to send AV planning details; no login." },
  { path: "/quote/[slug]", label: "Venue quote portal", group: "Public", kind: "public", note: "Public instant-quote page per venue." },
  { path: "/inquire/[slug]", label: "Website inquiry form", group: "Public", kind: "public", note: "A published Inquiry Form, opened directly or inside a website iframe (?embed=1) loaded by the /inquire/embed.js snippet from the form's Share tab. Admins can try a draft with ?preview=draft." },
  { path: "/quote/[slug]/book/success", label: "Venue quote deposit paid", group: "Public", kind: "public", note: "Where Stripe Checkout returns after a Book Now deposit." },
  { path: "/quote/[slug]/book/cancel", label: "Venue quote deposit canceled", group: "Public", kind: "public", note: "Where Stripe Checkout returns when a Book Now deposit is canceled." },
  { path: "/invoice/[token]", label: "AV invoice (public)", group: "Public", kind: "public", note: "Customer-facing link to view and pay an AV invoice." },
  { path: "/invoice/[token]/success", label: "AV invoice paid", group: "Public", kind: "public", note: "Where Stripe Checkout returns after an invoice payment." },
  { path: "/change-order/[token]", label: "AV change order (public)", group: "Public", kind: "public", note: "Customer-facing link to review an AV change order." },
  { path: "/pay/[token]", label: "Project invoice (public)", group: "Public", kind: "public", note: "Client-facing link to view and pay an invoice sent from a Pipeline project card, with Stripe Checkout and the payment plan. Needs migration 182_project_invoices.sql." },
  { path: "/sign/[token]", label: "Contract signing (public)", group: "Public", kind: "public", note: "Client-facing link to read and e-sign a contract sent from a Pipeline project card; the signed PDF is archived and emailed. Needs migration 183_project_contracts.sql." },
  { path: "/project/[token]", label: "Pipeline project (client)", group: "Public", kind: "public", note: "Client portal (private share link, no login): sign contracts, pay invoices, see floor plans, book a call, plus project details, questionnaire and file uploads." },
  { path: "/av-show/remote", label: "AV Show phone remote", group: "Public", kind: "public", note: "Phone remote for AV Show Control, opened with the PIN from the control page; no login." },
  { path: "/speaker-guide", label: "Guide to a smooth Speaker Experience", group: "Public", kind: "public", note: "Shareable guide for speakers and presenters at LRE events (no login). Has a Download PDF button and a print view." },
  { path: "/led-wall-guide", label: "LED Wall Layouts guide", group: "Public", kind: "public", note: "Shareable page showing seven ways to arrange 64 LED tiles with metric and imperial sizes (no login). Has a print view." },
  { path: "/privacy", label: "Privacy policy", group: "Public", kind: "public" },
  { path: "/sms-terms", label: "SMS terms", group: "Public", kind: "public" },
];
