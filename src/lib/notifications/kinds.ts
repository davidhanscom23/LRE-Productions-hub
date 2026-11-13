/** User-configurable notification kinds (matches hub_notifications.kind).
 * `mandatory` kinds are admin-originated and cannot be muted by non-admins.
 * `adminOnly` kinds are only ever sent to admins, so only admins see their toggle. */
export const NOTIFICATION_KINDS: {
  kind: string;
  label: string;
  description: string;
  mandatory: boolean;
  adminOnly?: boolean;
}[] = [
  { kind: "announcement", label: "Announcements", description: "New company announcements.", mandatory: true },
  { kind: "time_off", label: "Time off", description: "Approve / deny outcomes on your requests.", mandatory: true },
  { kind: "expense", label: "Expenses", description: "Outcomes on your expense submissions.", mandatory: true },
  { kind: "contractor_pay", label: "Contractor Pay", description: "Outcomes on your contractor payment requests.", mandatory: true },
  { kind: "quoting", label: "Quoting", description: "Quote discount approval outcomes.", mandatory: true },
  { kind: "review", label: "Performance reviews", description: "When a review is shared with you.", mandatory: true },
  { kind: "action", label: "Task assignments", description: "Action Center tasks assigned to you.", mandatory: true },
  { kind: "howto_pending", label: "How-to videos owed", description: "Daily note to admins while a staff how-to video is waiting to be recorded.", mandatory: true },
  { kind: "action_overdue", label: "Overdue tasks", description: "Daily reminders for overdue Action Center tasks.", mandatory: true },
  { kind: "gear_checklist", label: "Gear checklist alerts", description: "When gear is still not checked out or back in after the scheduled time.", mandatory: true },
  { kind: "kudos", label: "Kudos", description: "When a teammate recognizes you.", mandatory: false },
  { kind: "av_portal", label: "AV event portals", description: "When a client finishes their AV planning checklist.", mandatory: false },
  { kind: "invoice_overdue", label: "Overdue invoices", description: "When an overdue invoice reminder is emailed to a customer.", mandatory: false },
  { kind: "poll", label: "Polls", description: "When a new team poll is posted.", mandatory: false },
  {
    kind: "web_inquiry",
    label: "Website inquiries",
    description:
      "When someone sends a website Inquiry Form (including waitlist requests) and it lands on the Pipeline board.",
    mandatory: false,
    adminOnly: true,
  },
  {
    kind: "web_inquiry_unfinished",
    label: "Unfinished website inquiries",
    description:
      "When a visitor gives an email or phone on a website Inquiry Form but leaves before sending it.",
    mandatory: false,
    adminOnly: true,
  },
];

export const NOTIFICATION_KIND_SET = new Set(
  NOTIFICATION_KINDS.map((k) => k.kind),
);

export const MANDATORY_NOTIFICATION_KINDS = new Set(
  NOTIFICATION_KINDS.filter((k) => k.mandatory).map((k) => k.kind),
);
