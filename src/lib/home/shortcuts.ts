export type ShortcutGate =
  | ""
  | "admin"
  | "calendar"
  | "videntav"
  | "meetings"
  | "marketing"
  | "handbook";

export type ShortcutDef = {
  href: string;
  label: string;
  description: string;
  gate: ShortcutGate;
};

export type ShortcutAccess = {
  isAdmin: boolean;
  showCalendar: boolean;
  showVidentAv: boolean;
  showMarketing: boolean;
  showHandbook: boolean;
};

/** Every module that can be pinned as a Home quick-link. Order is canonical. */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  { href: "/ask", label: "Ask the Hub", description: "Company Q&A assistant.", gate: "" },
  { href: "/my-week", label: "My Week", description: "Your week at a glance.", gate: "" },
  { href: "/for-you", label: "For You", description: "Everything waiting on you.", gate: "" },
  { href: "/points", label: "Hub points", description: "Streaks, tips & how to earn more.", gate: "" },
  { href: "/winners", label: "Winners", description: "Monthly trophies & Hall of Fame.", gate: "" },
  { href: "/calendar", label: "Calendar", description: "Company event calendar.", gate: "calendar" },
  { href: "/chat", label: "Chat", description: "Channels for quick team updates.", gate: "" },
  { href: "/time-off", label: "Time Off", description: "Request time off & availability.", gate: "" },
  { href: "/action-center", label: "Action Center", description: "Shared team tasks.", gate: "" },
  { href: "/expenses", label: "Expenses", description: "Submit for reimbursement.", gate: "" },
  { href: "/announcements", label: "Announcements", description: "Company notices.", gate: "" },
  { href: "/kudos", label: "Kudos", description: "Recognize a teammate.", gate: "" },
  { href: "/polls", label: "Polls", description: "Quick team polls.", gate: "" },
  { href: "/rentals", label: "LRE AV", description: "Hub AV quotes, warehouse, invoices & reports.", gate: "videntav" },
  { href: "/teams", label: "Teams", description: "Audiovisual, Corporate, Wedding & Social, and Golf.", gate: "" },
  { href: "/people", label: "People", description: "Profiles, contacts & departments.", gate: "" },
  { href: "/directory", label: "Directory", description: "Company org chart.", gate: "" },
  { href: "/reviews", label: "Performance Reviews", description: "Self-assessments & feedback.", gate: "" },
  { href: "/training-portal", label: "Training Portal", description: "Courses & lessons.", gate: "" },
  { href: "/resources", label: "Staff Resources", description: "Files & shared links.", gate: "" },
  { href: "/documents", label: "Documents", description: "Handbook & agreements.", gate: "" },
  { href: "/staff-handbook", label: "Staff Handbook", description: "Policies & handbook.", gate: "handbook" },
  { href: "/support-guide", label: "Support Guide", description: "Hub how-to playbooks.", gate: "" },
  { href: "/event-packets", label: "Event Packets", description: "Complete after events.", gate: "" },
  { href: "/client-reviews", label: "Client Reviews", description: "Website testimonials & milestones.", gate: "" },
  { href: "/social-studio", label: "Social Studio", description: "Captions & exports.", gate: "" },
  { href: "/end-of-event-report", label: "End of Event Report", description: "Post-event report.", gate: "" },
  { href: "/submit-event-photos", label: "Submit Event Photos", description: "Upload photos & videos.", gate: "" },
  { href: "/marketing", label: "Marketing Queue", description: "Schedule & approve posts.", gate: "marketing" },
  { href: "/content-sla", label: "Content SLA", description: "Post-event media & draft status.", gate: "marketing" },
  { href: "/image-studio", label: "Image Studio", description: "AI image generation.", gate: "admin" },
  { href: "/pipeline", label: "Pipeline", description: "Clients, projects & payments from CRM.", gate: "" },
  { href: "/scheduling", label: "Scheduling", description: "Booking links for client calls.", gate: "" },
  { href: "/services", label: "Services Catalog", description: "Saved services & prices.", gate: "" },
  { href: "/floor-plans", label: "Floor Plans", description: "Room layouts for projects.", gate: "" },
  { href: "/hiring", label: "Hiring", description: "Jobs & candidate pipeline.", gate: "admin" },
  { href: "/staffing", label: "Staffing", description: "Coverage & availability board.", gate: "marketing" },
  { href: "/onboarding", label: "Onboarding", description: "New-hire checklists.", gate: "marketing" },
  { href: "/reports", label: "Reports", description: "Admin snapshot.", gate: "admin" },
  { href: "/av-portals", label: "AV Event Portals", description: "Client planning links for AV shows.", gate: "videntav" },
  { href: "/av-show", label: "AV Show Control", description: "Screens and lower thirds for live shows.", gate: "videntav" },
  { href: "/venue-quotes", label: "Venue Quotes", description: "Public instant-quote pages.", gate: "marketing" },
  // Added Nov 2026 so every LRE Hub module in the sidebar can be pinned.
  { href: "/tools", label: "Tools", description: "Every Hub module, grouped by what you need to do.", gate: "" },
  { href: "/my-calendar", label: "My Calendar", description: "Your personal calendar feed.", gate: "" },
  { href: "/forum", label: "Forum", description: "Longer team discussions.", gate: "" },
  { href: "/changelog", label: "What's New", description: "What changed in the hub.", gate: "" },
  { href: "/pebbles-and-rocks", label: "Pebbles & Rocks", description: "Quarterly team goals.", gate: "" },
  { href: "/contractor-pay", label: "Contractor Pay", description: "Rates and payouts.", gate: "" },
  { href: "/quoting", label: "Quoting", description: "Build a custom event quote.", gate: "" },
  { href: "/proposals", label: "Proposals", description: "Branded proposals and PDFs.", gate: "" },
  { href: "/vendors", label: "Vendors", description: "Partner and vendor list.", gate: "" },
  { href: "/marketing-library", label: "Marketing Library", description: "Approved brand assets.", gate: "" },
  { href: "/videos", label: "Video Archives", description: "Recorded sessions and videos.", gate: "" },
  { href: "/meetings", label: "Meetings", description: "Notes and open loops.", gate: "marketing" },
  { href: "/drive", label: "Google Drive", description: "Shared Google Drive files.", gate: "marketing" },
  { href: "/sms", label: "SMS Portal", description: "Business texting.", gate: "admin" },
  { href: "/communications", label: "Communications", description: "Automated client and staff emails.", gate: "admin" },
  { href: "/inquiry-forms", label: "Inquiry Forms", description: "Website inquiry forms that feed the Pipeline board.", gate: "admin" },
  { href: "/hub-switcher", label: "Hub Switcher", description: "Choose who sees which hub.", gate: "admin" },
  { href: "/hub-health", label: "Hub Health", description: "Checks and errors.", gate: "admin" },
  { href: "/page-map", label: "Page Map", description: "Every page in the hub and who can open it.", gate: "admin" },
  { href: "/rentals/quotes", label: "AV Estimates", description: "Hub opportunities, holds, estimates, and share links.", gate: "videntav" },
  { href: "/rentals/invoices", label: "AV Invoices", description: "Draft, send, and collect on Hub AV invoices.", gate: "videntav" },
  { href: "/rentals/costs", label: "AV Costs", description: "Job costs and margin vs revenue.", gate: "videntav" },
  { href: "/rentals/reports", label: "AV Reports", description: "Profit, AR, pipeline, gear, crew, and stock reports.", gate: "videntav" },
  { href: "/rentals/developer", label: "AV Developer", description: "Terminal Mode API keys for Claude or scripts.", gate: "videntav" },
  { href: "/rentals/warehouse", label: "AV Warehouse", description: "Check gear out and back for reserved jobs.", gate: "videntav" },
  { href: "/rentals/stock", label: "AV Stock", description: "Owned qty minus gear currently out.", gate: "videntav" },
  { href: "/rentals/calendar", label: "AV Gear Calendar", description: "Month view of gear out and back windows.", gate: "videntav" },
  { href: "/rentals/planner", label: "AV Planner", description: "Four-week bars for open AV jobs.", gate: "videntav" },
  { href: "/rentals/travel", label: "AV Travel", description: "Leave and return runs for one day.", gate: "videntav" },
  { href: "/rentals/activities", label: "AV Activities", description: "Pre-job tasks due before gear out.", gate: "videntav" },
  { href: "/rentals/customers", label: "AV Customers", description: "Hub-owned AV rental customers.", gate: "videntav" },
  { href: "/rentals/venues", label: "AV Venues", description: "Job venues for AV quotes and orders.", gate: "videntav" },
  { href: "/rentals/suppliers", label: "AV Suppliers", description: "Vendors and sub-hire for AV jobs.", gate: "videntav" },
  { href: "/rentals/crew", label: "AV Crew", description: "Book people onto jobs with role and day rate.", gate: "videntav" },
  { href: "/rentals/contractors", label: "AV Contractors", description: "External freelancers for crew bookings.", gate: "videntav" },
  { href: "/rentals/serials", label: "AV Serials", description: "Serialized asset units and barcodes.", gate: "videntav" },
  { href: "/rentals/templates", label: "AV Templates", description: "Estimate and invoice terms templates.", gate: "videntav" },
  { href: "/rentals/catalog", label: "AV Catalog", description: "Products, packages, services, Comes with, and Duplicate.", gate: "videntav" },
];

export const DEFAULT_SHORTCUT_HREFS: string[] = [
  "/chat",
  "/calendar",
  "/rentals",
  "/teams",
  "/people",
  "/resources",
];

export function isShortcutAccessible(
  gate: ShortcutGate,
  a: ShortcutAccess,
): boolean {
  switch (gate) {
    case "admin":
      return a.isAdmin;
    case "calendar":
      return a.showCalendar;
    case "videntav":
      return a.showVidentAv;
    case "marketing":
      return a.showMarketing;
    case "handbook":
      return a.showHandbook;
    default:
      return true;
  }
}

/** The set of hrefs a user with these access flags is allowed to pin. */
export function accessibleShortcutHrefs(a: ShortcutAccess): Set<string> {
  return new Set(
    SHORTCUT_DEFS.filter((d) => isShortcutAccessible(d.gate, a)).map(
      (d) => d.href,
    ),
  );
}
