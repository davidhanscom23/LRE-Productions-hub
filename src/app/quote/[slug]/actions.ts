"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { sendEmail } from "@/lib/email/send";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { verifyCoordinatorToken } from "@/lib/venue-portals/access";
import { loadPortalBundle } from "@/lib/venue-portals/data";
import { depositAmount } from "@/lib/venue-portals/deposit";
import {
  computeQuote,
  technicianLabel,
  totalEventHours,
  type EventDay,
  type SpaceSelection,
} from "@/lib/venue-portals/pricing";
import { getStripe, siteOrigin, stripeSecretConfigured } from "@/lib/stripe/server";

export type SubmitQuoteInput = {
  slug: string;
  kind: "quote" | "book";
  role: "venue_coordinator" | "planner";
  contact: { first: string; last: string; email: string; phone: string };
  client?: { first: string; last: string; email: string; phone: string };
  eventType: string;
  guestCount: number | null;
  days: EventDay[];
  selections: { spaceId: string; packageId: string | null; addons: Record<string, number> }[];
  enhancementIds: string[];
  notes: string;
  /** Proof of the coordinator password (from verifyCoordinatorPasswordAction). */
  coordinatorToken?: string;
  /** Honeypot: real people never see or fill this. */
  website: string;
};

export type SubmitQuoteResult = {
  error: string | null;
  id?: string;
  /** True when an admin submitted against an unpublished portal (no emails sent). */
  preview?: boolean;
  /** Stripe Checkout URL for Book Now deposit (when Stripe is configured). */
  checkoutUrl?: string;
  depositAmount?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FALLBACK_NOTIFY = "hello@lreproductions.com";
const MAX_PER_HOUR = 5;

const clean = (v: unknown, max: number) =>
  (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function cleanPerson(p: SubmitQuoteInput["contact"] | undefined) {
  return {
    first: clean(p?.first, 80),
    last: clean(p?.last, 80),
    email: clean(p?.email, 200).toLowerCase(),
    phone: clean(p?.phone, 40),
  };
}

export async function submitQuoteRequestAction(
  input: SubmitQuoteInput,
): Promise<SubmitQuoteResult> {
  // Honeypot tripped: pretend success so bots learn nothing.
  if (clean(input.website, 200)) return { error: null };

  if (!isServiceRoleConfigured()) {
    return { error: "Quotes aren't available right now. Please email us instead." };
  }

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const loaded = await loadPortalBundle(clean(input.slug, 80), {
    includeUnpublished: isAdmin,
  });
  if (!loaded) return { error: "This quote page is no longer available." };
  const { bundle, notifyEmail, hasCoordinatorPassword } = loaded;
  const preview = !bundle.portal.isPublished;

  const contact = cleanPerson(input.contact);
  if (!contact.first || !contact.last) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(contact.email)) return { error: "Please enter a valid email address." };

  const role = input.role === "venue_coordinator" ? "venue_coordinator" : "planner";
  const kind = input.kind === "book" ? "book" : "quote";
  const client = role === "venue_coordinator" ? cleanPerson(input.client) : null;
  if (client && client.email && !EMAIL_RE.test(client.email)) {
    return { error: "The client's email address doesn't look right." };
  }

  // Event days
  const days: EventDay[] = (Array.isArray(input.days) ? input.days : [])
    .slice(0, 14)
    .map((d) => ({
      date: clean(d?.date, 10),
      startTime: clean(d?.startTime, 5),
      endTime: clean(d?.endTime, 5),
    }));
  if (days.length === 0) return { error: "Please add your event date." };
  for (const d of days) {
    if (!DATE_RE.test(d.date ?? "") || !TIME_RE.test(d.startTime) || !TIME_RE.test(d.endTime)) {
      return { error: "Please check your event date and times." };
    }
  }

  // Selections: rebuilt from the database so nothing the browser says about
  // prices, names, or availability is trusted.
  const spacesById = new Map(bundle.spaces.map((s) => [s.id, s]));
  const packageIds = new Set(bundle.packages.map((p) => p.id));
  const addonsById = new Map(bundle.addons.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const selections: SpaceSelection[] = [];
  for (const raw of Array.isArray(input.selections) ? input.selections : []) {
    const space = spacesById.get(String(raw?.spaceId));
    if (!space || seen.has(space.id)) continue;
    seen.add(space.id);
    const packageId =
      !space.isCustomQuote && raw.packageId && packageIds.has(raw.packageId)
        ? raw.packageId
        : null;
    const addons: Record<string, number> = {};
    if (!space.isCustomQuote) {
      for (const [id, q] of Object.entries(raw.addons ?? {})) {
        const addon = addonsById.get(id);
        const qty = Math.floor(Number(q) || 0);
        if (!addon || !addon.isOrderable || qty <= 0) continue;
        addons[id] = Math.min(qty, addon.maxQuantity ?? 99);
      }
    }
    selections.push({ spaceId: space.id, spaceName: space.name, packageId, addons });
  }
  if (selections.length === 0) return { error: "Please choose at least one space." };

  const enhancementIds = [
    ...new Set(
      (Array.isArray(input.enhancementIds) ? input.enhancementIds : []).filter(
        (id) => bundle.enhancements.some((e) => e.id === id),
      ),
    ),
  ];

  const guestCount =
    input.guestCount && input.guestCount > 0
      ? Math.min(Math.floor(input.guestCount), 5000)
      : null;
  const eventType = clean(input.eventType, 60);
  const notes = (typeof input.notes === "string" ? input.notes : "").trim().slice(0, 2000);

  // Savings apply only to coordinators who proved the venue password.
  // With no password set, the savings are never offered.
  const discountOk =
    role === "venue_coordinator" &&
    hasCoordinatorPassword &&
    verifyCoordinatorToken(bundle.portal.id, input.coordinatorToken);
  if (role === "venue_coordinator" && hasCoordinatorPassword && !discountOk) {
    return { error: "Please re-enter the coordinator password to continue." };
  }

  const quote = computeQuote({
    rates: discountOk
      ? bundle.portal.rates
      : { ...bundle.portal.rates, savingsPct: 0 },
    packages: bundle.packages,
    addons: bundle.addons,
    technicians: bundle.technicians,
    selections,
    days,
  });

  const db = createServiceClient();

  // Light abuse guard: same email + portal, last hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("venue_portal_quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", bundle.portal.id)
    .eq("contact_email", contact.email)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return { error: "We already have several requests from you. We'll be in touch shortly." };
  }

  const depositPct = bundle.portal.depositPct;
  const depositDue =
    kind === "book" ? depositAmount(quote.total, depositPct) : 0;

  const { data: row, error } = await db
    .from("venue_portal_quote_requests")
    .insert({
      portal_id: bundle.portal.id,
      submit_kind: kind,
      requester_role: role,
      contact_first: contact.first,
      contact_last: contact.last,
      contact_email: contact.email,
      contact_phone: contact.phone,
      client_first: client?.first ?? "",
      client_last: client?.last ?? "",
      client_email: client?.email ?? "",
      client_phone: client?.phone ?? "",
      event_type: eventType,
      guest_count: guestCount,
      event_days: days,
      selection: selections,
      enhancement_ids: enhancementIds,
      notes,
      totals: {
        ...quote,
        eventHours: totalEventHours(days),
        preview,
        depositPct,
        depositAmount: depositDue,
      },
      deposit_amount: depositDue,
      deposit_status: kind === "book" && depositDue > 0 ? "pending" : "none",
    })
    .select("id")
    .single();
  if (error || !row) {
    return { error: "We couldn't save your request. Please try again in a moment." };
  }

  const requestId = String(row.id);

  if (preview) return { error: null, id: requestId, preview: true };

  let checkoutUrl: string | undefined;
  if (kind === "book" && depositDue > 0 && stripeSecretConfigured()) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const origin = siteOrigin();
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: contact.email,
          client_reference_id: requestId,
          metadata: {
            venue_quote_request_id: requestId,
            venue_portal_id: bundle.portal.id,
            venue_portal_slug: bundle.portal.slug,
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(depositDue * 100),
                product_data: {
                  name: `${bundle.portal.name} — ${depositPct}% deposit`,
                  description: `Booking deposit for estimated total ${usd(quote.total)}`,
                },
              },
            },
          ],
          success_url: `${origin}/quote/${bundle.portal.slug}/book/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/quote/${bundle.portal.slug}/book/cancel?request_id=${requestId}`,
        });
        if (session.url) {
          checkoutUrl = session.url;
          await db
            .from("venue_portal_quote_requests")
            .update({
              stripe_checkout_session_id: session.id,
              deposit_status: "pending",
            })
            .eq("id", requestId);
        }
      } catch {
        // Request is saved; staff can collect deposit offline.
        await db
          .from("venue_portal_quote_requests")
          .update({ deposit_status: "failed" })
          .eq("id", requestId);
      }
    }
  }

  // Emails are best-effort: the saved request is the source of truth.
  const dayLines = days.map(
    (d, i) => `  Day ${i + 1}: ${d.date}, ${d.startTime}-${d.endTime}`,
  );
  const spaceLines = quote.spaces.flatMap((s) => [
    `  ${s.spaceName}`,
    s.packageLine ? `    - ${s.packageLine.label}: ${usd(s.packageLine.amount)}` : "    - No package",
    ...s.addonLines.map(
      (l) => `    - ${l.label}${l.detail ? ` (${l.detail})` : ""}: ${usd(l.amount)}`,
    ),
  ]);
  const interested = bundle.enhancements
    .filter((e) => enhancementIds.includes(e.id))
    .map((e) => e.name);
  const totalsText = [
    `  Delivery: ${usd(quote.delivery)}`,
    `  Setup & strike: ${usd(quote.setup)}`,
    ...quote.technicians.map((t) => `  ${technicianLabel(t)}: ${usd(t.amount)}`),
    `  Subtotal: ${usd(quote.subtotal)}`,
    quote.savings > 0 ? `  ${quote.savingsLabel}: -${usd(quote.savings)}` : null,
    `  Estimated total: ${usd(quote.total)}`,
  ].filter(Boolean) as string[];

  const who = `${contact.first} ${contact.last}`;
  const depositLine =
    kind === "book" && depositDue > 0
      ? `  Deposit (${depositPct}%): ${usd(depositDue)}${checkoutUrl ? " — Checkout started" : " — collect offline (Stripe not configured)"}`
      : null;
  await sendEmail({
    to: notifyEmail || process.env.VENUE_PORTAL_NOTIFY_EMAIL?.trim() || FALLBACK_NOTIFY,
    subject: `${kind === "book" ? "Booking request" : "Quote request"}: ${bundle.portal.name} - ${who}`,
    text: [
      kind === "book" ? "READY TO BOOK" : "Quote request",
      `Venue: ${bundle.portal.name}`,
      "",
      `Contact: ${who} (${role === "venue_coordinator" ? "venue coordinator" : "planning their own event"})`,
      `Email: ${contact.email}`,
      contact.phone ? `Phone: ${contact.phone}` : "",
      client && (client.first || client.email)
        ? `Client: ${client.first} ${client.last} ${client.email} ${client.phone}`.trim()
        : "",
      "",
      `Event: ${eventType || "n/a"}${guestCount ? `, ${guestCount} guests` : ""}`,
      ...dayLines,
      "",
      "Selections:",
      ...spaceLines,
      "",
      ...totalsText,
      depositLine,
      interested.length ? `\nInterested in: ${interested.join(", ")}` : "",
      notes ? `\nNotes: ${notes}` : "",
      "",
      "Open the hub to follow up. Estimates exclude tax and are not a final quote.",
    ].filter((l) => l !== "" && l != null).join("\n"),
  });

  await sendEmail({
    to: contact.email,
    subject: `We received your request - ${bundle.portal.name}`,
    text: [
      `Hi ${contact.first},`,
      "",
      kind === "book"
        ? checkoutUrl
          ? `Thank you! Continue to Stripe to pay your ${depositPct}% deposit (${usd(depositDue)}). Our team will confirm availability after payment.`
          : "Thank you! We received your booking request and our team will confirm availability and next steps shortly."
        : "Thank you! We received your quote request and will confirm availability and send your official quote shortly.",
      "",
      `Venue: ${bundle.portal.name}`,
      `Estimated total: ${usd(quote.total)} (an estimate only; delivery and labor are calculated for your event)`,
      depositDue > 0 ? `Deposit due: ${usd(depositDue)}` : "",
      "",
      "LRE Productions",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  });

  return {
    error: null,
    id: requestId,
    checkoutUrl,
    depositAmount: depositDue > 0 ? depositDue : undefined,
  };
}
