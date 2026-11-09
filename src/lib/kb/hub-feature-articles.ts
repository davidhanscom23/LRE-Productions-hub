/**
 * Canonical Hub feature knowledge base.
 *
 * These articles sync into `kb_documents` (source_type: "hub_guide") whenever an
 * admin runs Rebuild index on Ask the Hub. They power Ask the Hub answers about
 * what users can do in the product.
 *
 * WHEN ADDING A NEW USER-FACING FEATURE:
 * 1. Add (or update) an entry in HUB_FEATURE_ARTICLES below.
 * 2. Use a stable `slug` (never reuse a slug for a different topic).
 * 3. Write plain, practical copy: what it is, who can use it, how to do the
 *    main tasks, and any role/department gotchas.
 * 4. Ask an admin to click Rebuild index on /ask (or do it yourself in preview)
 *    so embeddings pick up the new article.
 *
 * Cloud agents: treat this file as required deliverable for any new Hub module
 * or meaningful user-facing capability. See AGENTS.md.
 */

export type HubFeatureArticle = {
  /** Stable id stored as kb_documents.source_id */
  slug: string;
  title: string;
  /** Plain text body indexed for Ask the Hub retrieval. */
  body: string;
};

export const HUB_FEATURE_ARTICLES: HubFeatureArticle[] = [
  {
    slug: "event-gear-checklist",
    title: "Event gear checklist (check out and check back in)",
    body: `Every event can have a gear checklist (/event-checklist/<event>). It shows two progress bars: Out of the warehouse and Back in the warehouse. The checklist is the list of equipment for that event, and it is built from the AV estimate linked to the event, so the estimate stays the source of truth. When the estimate changes (an item is added, removed or its quantity changes), the checklist updates by itself. Items already checked stay checked, and anything new shows as unchecked.

Linking: on an AV estimate (Vident AV > Quotes), pick the event in Event (for the gear checklist). Without a link, the checklist starts empty and you can add items by hand with Add an item.

Who can use it: admins and Leads can open every checklist. Other staff can open and check items only on events they are assigned to on the event card. Everyone else sees a message that the checklist is for the assigned team.

Checking items: choose Check out when gear leaves the warehouse and Check back in when it returns. Tap the box to check a whole line, or use plus and minus for part of a quantity (for example 6 of 8 speakers). Every check records who did it and when. Sold or used-up items only need the Out check and do not appear on the way back. Use Only what's still needed to see just the gear still missing for the step you are on.

Where gear comes from: each line is tagged Our gear, Client supplied or Sub-rented. Our gear returns to the warehouse. Client supplied and sub-rented gear is marked Received or Picked up on the way out, and Returned to client or Returned to vendor on the way back.

Damaged or missing: on any line, tap Damaged or missing, choose which, add a note and an optional photo, and save. This goes into the history and does not change the counts.

Schedule: set when the gear leaves the warehouse and when it is due back (approximate is fine; Eastern time). For a multi-day event, gear goes out on the first day and is due back at the end of the last day.

History: the page lists the last 90 days of checks with the person, time, quantity, note and photo. The Warehouse page under Vident AV also reflects checklist check-outs and check-ins for AV events.

Opening it: tap Gear checklist on a calendar card, on an Event Packet, or on the event card (Events board). From a calendar card or packet the hub finds the matching event by its date and client; if two events match you are asked which one.

Event details (top of the checklist): Contacts lists the client, the estimate contact, the venue contact and the assigned crew with their roles. Tap a phone number to call and Email to write. Venue shows the venue, the room and a link that opens the address in maps. Load-in details (dock or door, path to the room, load-in hours, parking, power, access, venue rules) are saved with the venue, so the next event at that venue starts with what was saved last time. Use Edit venue and load-in details to update them; the date of the last update is shown. Floor plans attached to the event card show as buttons; tap one to open it, pinch to zoom, drag to move, and double-tap to reset.

Non-AV events: in Add an item, start typing and pick from the inventory list (the same internal inventory the AV estimates use), or type anything that is not on the list.

Alerts: when the scheduled leave time (for the Out step) or the due-back time (for the Back step) passes and that step is under 100%, the assigned staff and all admins get three things: a popup in the Hub, a notification (with a phone push if they turned push on), and a text message to the phone number saved on their profile. If everything is already checked at that time, nothing is sent. Each alert is sent once. Changing the schedule times re-arms the alerts. Alerts are only sent for times that passed within the last 12 hours, so setting an old date does not send anything. The popup stays on screen until dismissed and shows for up to 48 hours.

Working offline: open the checklist once while you have signal and the hub keeps a copy on that phone or tablet. With no signal you can still reopen it, check items out and in, change quantities, change where gear comes from, add or remove items you added by hand, flag damaged or missing gear (with a photo) and set the schedule. A yellow banner says you are offline, each change shows Waiting to sync, and the page lists how many are waiting. When the signal returns everything syncs by itself, in the order you did it; tap Sync now to force it. Nothing is counted twice. If something cannot be saved (for example someone removed that item meanwhile), it appears under Needs attention with what happened. Venue and load-in details need a signal to save. Signing out clears the saved copy from the device and warns you if changes have not synced. Open the checklist once on each device before heading to a venue with weak signal.

History and backups: the History list on a checklist shows the last 90 days. Every Dec 31 the hub zips the year's checklist history (a spreadsheet of every check with who, when, quantities, flags and notes, plus the photos) into the Vident Hub Backup shared drive, in the Event Checklist History folder. After that, photos older than 90 days are removed from the hub to save space; the copies stay in the backup zip. The totals on each checklist are kept. Each inventory item in Vident AV Catalog also shows Last out: the last event it went to, who checked it out and when, and that never expires.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "page-map-and-view-as-staff",
    title: "Page Map and View as staff (admins)",
    body: `Page Map (Tools > Admin > Page Map, /page-map) is an admin-only list of every page in the hub. Summary tiles show total pages, how many are linked in the sidebar, how many are reachable from another page, how many are public or token links, and how many are admin only. Search by name, path or note, or filter by Linked in nav, Reachable or Redirects. Pages are grouped (Daily, Work, People & culture, Learn & refs, Field tools, Marketing, Admin, Personal, Redirects, Public) and each card shows who can open it, its path, an Open link, and where people reach it from.

View as staff: admins see a View as staff button in the top bar. Clicking it shows the hub the way a regular staff member sees it: the sidebar, Tools page and page access follow the staff role. A banner stays at the top with a Back to admin button. While previewing, admin-only actions are paused so nothing is changed by accident. Only real admins can use it, and it never changes anyone's actual role.`,
  },
  {
    slug: "tools-launcher",
    title: "Tools page, short sidebar, quick tools and Needs your attention",
    body: `The sidebar is short on purpose: Home, For You, My Calendar, Chat, Ask the Hub, Teams, People, Resources, and Tools. Everything else in the hub lives on the Tools page (/tools), grouped into cards: For Me, Events & Production, Vident AV (Overview, Quotes, Invoices, Costs, Reports, Developer / Terminal API, Warehouse, Stock, gear Calendar/Planner/Travel, Activities, Customers, Venues, Suppliers, Crew, Catalog, Event Portals), Quotes & Proposals, Staffing & Pay, People & Culture, Learn & Resources, Marketing, Communication, and Admin. Each tool shows an icon and a one-line description. You only see tools your role and department can use (for example Vident AV tools for the Audiovisual department and admins, Venue Quotes and Reports for admins, Staffing and HoneyBook for admins and Leads). New Hub modules are registered into these Tools sections when they ship. On Tools itself, use Search tools at the top of the page to filter by name or description. The Tools link in the sidebar lights up on any tool that is not pinned in the sidebar, and shows a NEW tag when there are unseen What's New entries. The hub-wide search box at the top of the app also jumps to any tool.

My quick tools: the Home page shows your pinned shortcuts as large icon tiles, and the same tiles appear at the top of the Tools page. Click Customize on Home to add, remove or reorder them; the choice is saved to your account.

Needs your attention: Home shows up to three cards with a count of things waiting on you (for example overdue Event Packets, approvals, assigned tasks, or acknowledgements), with a View all link to For You. Admins also see a card for new venue quote requests, linking to Venue Quotes > Requests.`,
  },
  {
    slug: "venue-quotes",
    title: "Venue Quotes (public instant AV quote pages)",
    body: `Venue Quotes lets admins give each venue a public instant-quote page at /quote/<venue-link-name>. Anyone with the link (no login) can walk through a wizard: who they are, event details, spaces, AV packages, à la carte add-ons, optional enhancements, and contact info. A live estimate updates as they choose, and they can press Send a Quote or Book Now. Book Now also opens Stripe Checkout for the venue's deposit percent (default 50% of the estimated total after savings); Requests show deposit pending/paid. Send a Quote only saves the request. Totals are always recalculated on the server from the venue's own rates. Needs Stripe env keys and migrations 150_venue_portal_stripe_deposit.sql, 155_venue_convert_invoice_pay.sql, 156_invoice_pay_catalog_show_remote.sql, and 157_venue_catalog_invoice_reminders.sql.

Admins only manage it: open Venue Quotes in the sidebar. Create a blank venue, use Starter catalog (spaces + Complete Meeting package + add-ons + technicians ready to edit, with Hub catalog maps prefilled), or duplicate an existing one (copies rates, spaces, packages, add-ons and enhancement cards as an unpublished draft). Hyatt Place Vilano Beach seed packages/add-ons are mapped to the Venue quote catalog products after migration 157. In the editor set the headline, intro, hero image and logo, accent color, event types, default times, delivery fee, technician roles with hourly or daily rates, savings label and percent, and the email that receives requests. Add spaces (with capacity or custom-quote only), packages (price, setup fee, included items, technician included, most-popular badge, optional Hub catalog product/service), add-ons (priced per item, flat, or per hour, with minimum and maximum quantities, optional Hub catalog map) and enhancement cards. Upload photos with the Upload buttons. Use the arrows to reorder.

Venue savings are protected: when someone chooses "I'm the venue's event coordinator", they must enter that venue's coordinator password (set in the venue editor) before continuing, and only then does the savings line appear and apply. Clients planning their own event never see the savings. If a venue has no coordinator password, the savings are not offered to anyone. A venue is a draft until you press Publish; admins can preview drafts (submissions are saved but no emails go out). Unpublish any time to take the link offline. Requests land under Venue Quotes > Requests, where you can set status: new, contacted, quoted, booked, lost — and Create Hub quote to turn a request into a draft Vident AV quote (customer + lines from the estimate, with catalog product/service IDs when packages/add-ons are mapped). When you later draft an invoice from that quote, a paid Book Now deposit becomes the first invoice payment. A venue with requests cannot be deleted, only unpublished.

Pricing: equipment is package price plus add-ons; setup fee is charged once per space per package; technician roles (for example Audio Technician and Video Technician) are set per venue, each billed hourly (rate times event hours) or daily (rate times event days), and charged for every space whose package includes that role; delivery is a flat fee once per quote; the venue savings percent applies to equipment only, not hourly labor.`,
  },
  {
    slug: "inquiry-forms",
    title: "Inquiry Forms: website inquiry forms that land on the HoneyBook board",
    body: `Inquiry Forms (/inquiry-forms, admin-only, listed in Tools under Quotes & Proposals) builds the multi-step inquiry forms for the videntproductions.com and videntaudiovisual.com websites. A visitor answers a few short steps, the form checks the event date, and every finished inquiry is added to the HoneyBook board as an Inquiry project. Only admins can open it; Leads and staff never see the forms or the submissions (they see the projects on the board as usual).

Getting started: on the empty Inquiry Forms page click Add the starter forms. That creates two live forms: Get a Quote (Vident Productions, /inquire/get-a-quote: event type with wedding planning and golf follow-ups, date, area, guests, services, budget range and event details) and Request AV (Vident Audiovisual, /inquire/request-av: event type, date and times, venue, attendees, AV services, rental only or full production, and the request). The list shows each form with its status and its views, starts and finished inquiries. Click a form to open its four tabs. Build edits the steps and questions: add, remove or drag questions, change labels, choices, required and half width, and show a question only when an earlier answer matches; the checking step runs the date check, so keep it after the step that asks for the date. Edits are saved as a draft: visitors keep seeing the published version until you publish, and you can try the draft first (a preview saves nothing). Settings holds the brand and accent color, button labels, the thank-you message, what to offer when a date is blocked (pick another date or send the request anyway), staff email recipients (the starter forms email hello@videntproductions.com and David), the confirmation email to the visitor (on in the starter forms; replies go to the brand's hello@ inbox), who owns each event type, and copies to other systems. Get a Quote sends Corporate Event, Incentive Trip, Team Building, Game Show, Tradeshow and Virtual or Hybrid to Natalie McBride, Wedding and Social Celebration to Kallie Sango, and Golf Experience to Kristin Thompson: that person also gets the staff email and is added as the project's lead assignee when they have a Hub login. Both forms send a copy of each finished inquiry to GoHighLevel the same way the website contact forms do, so GoHighLevel follow-ups keep running; each copy shows in the submission's history and is retried for 24 hours if it does not go through. Share gives the form's link and the one embed snippet for the website: paste it into a custom code block on the page and the form sizes itself on phones and computers. Submissions lists every visitor's run with their answers, the date result, a high, medium or low fit score, where they came from (UTM, ad click or website), and the stage (in progress, completed, waitlisted, abandoned or spam).

What visitors see: a short form with a progress bar, then a checking-the-calendar moment. Vident takes several events a day, so the date check is set to Always open: the visitor reads that the date looks open and that the team will confirm. A date is only held back by a blackout date or a minimum notice that an admin adds in Business settings. There is no travel check (the area is a question on the form). Visitors never see bookings, counts or who is working. Bots get a normal thank-you, but nothing reaches the board and nobody is alerted.

Where inquiries land: each finished inquiry becomes a project at stage Inquiry on the HoneyBook board (/honeybook) with a Website badge, named after the person and event type (for example Jane Smith - Corporate Event). The project gets the event date (so it also shows on the Calendar), the event type, the area or venue as its location, the low end of the budget range, and details that start with the form name and the fit line, then every answer. The client is matched by exact email or created; a client the website did not create is never changed (the name and phone the visitor typed are in the project details), and a blank name or phone is filled in only on a client an earlier website inquiry made. The project lives in the Hub only: HoneyBook has no API, so it is not added to the HoneyBook app itself. Admins get an in-app alert and a push (Website inquiries in Notification preferences); the alert opens the project.

Unfinished inquiries: when a visitor gives an email or phone and then leaves partway, admins get an Unfinished website inquiries alert about 10 minutes later. Those partial answers stay in Submissions and do not go to the board unless you open the submission and click Add to HoneyBook.

Business settings (/inquiry-forms/settings) apply to every form: the date check (Always open by default; Check our bookings compares HoneyBook projects on that date that are Booked, Retainer Paid, Paid in Full, Planning or In Progress with a fixed daily number or the active people in chosen departments minus approved time off), blackout dates, minimum notice, the messages visitors see, the unfinished-inquiry delay, and spam limits. The optional Cloudflare Turnstile bot check needs both Turnstile keys. Requires migration 167_inquiry_forms.sql (Hub health shows whether it has run).`,
  },
  {
    slug: "hub-overview",
    title: "Vident Productions Hub — overview",
    body: `The Vident Productions Hub is the private staff portal for Vident Productions.

Who can use it: anyone with an invite (roles are admin, Lead, or staff). Public signup is off — an admin invites you in Supabase Auth, then finishes your People profile. Colleagues without a staff invite can use Guest access (/guest) with a shared access code for a read-only browse of non-confidential pages.

What you can do here: ask company questions, plan your week, check the calendar, chat with the team, browse Resources, read the Staff Handbook, manage People (admins), open department Teams pages, use field tools after events, and (if you’re in the Audiovisual department or an admin) use Vident AV for gear and bookings.

Appearance: use the sun/moon control in the top bar to choose Light, Dark, or System (follow your device). Your choice is saved to your account so it follows you across devices.

Sign in at the login page with the email you were invited with. Use Forgot password if you need a reset. Open the invite link from your email the first time so you can set a password. Have an access code? Use Guest access for read-only browsing.`,
  },
  {
    slug: "guest-access",
    title: "Guest access — read-only Hub browse",
    body: `Guest access lets colleagues browse a limited, read-only slice of the Hub with a shared access code (no staff invite required).

Open /guest (or Guest access from the login page), enter the code, and Enter Hub. Guests can open Home (no feed, birthdays, or field-tool shortcuts), Resources marked visibility everyone, published Training Portal courses (no Mark complete), and a filtered Support Guide.

Guests cannot open People, Chat, Calendar, My Week, Notifications, Ask the Hub, Teams, Staff Handbook, Vident AV, Event Packets, Social Studio, Image Studio, Marketing Queue, or other field tools. Writes are blocked in the app and at the database. Sign out when finished; staff should use their invite email to sign in for full access.

Admins configure GUEST_ACCESS_CODE plus a shared guest Auth user (role guest) in environment variables — never paste the code into public Resources titles if it must stay private.`,
  },
  {
    slug: "home",
    title: "Home — feed, shortcuts, and business details",
    body: `Home is the Hub landing page.

You’ll see a greeting, local weather, shortcut tiles to main modules, a Hub points strip (your score, streak, and a scrolling top-three leaderboard), upcoming team birthdays and work anniversaries (next 14 days when dates are set), The Feed (company posts with comments), business contact details, and quick links to Submit Event Photos and End of Event Report.

Opening Home once per day (America/New_York) awards daily check-in points and advances your login streak (milestones at 3, 7, 14, 30, 60, and 100 days). Visiting modules for the first time awards discovery points — easy modules give fewer points; rarer modules give more. Admins can award any teammate any point amount from their People card. Guests do not earn points.

“What needs you” on Home summarizes your personal For You inbox (approvals, tasks, reviews, acknowledgements, polls, overdue packets, handbook signature, training, onboarding checklist, and your pending requests) and links straight to /for-you — that page is the canonical personal queue.

Anyone signed in can post and comment on The Feed. Admins can delete any post; trainers can delete their own posts; staff can post but not delete posts; anyone can delete their own comments (admins can delete any). On someone’s birthday or company anniversary (hire date), their People card shows a celebration badge and Home auto-posts a Feed announcement so the team can leave comments.

Use the top-bar search to find pages, people, resources, event packets, and published training courses you can access. Type at least two characters; arrow keys and Enter navigate results. Open People → Birthdays or Anniversaries (or Home’s View all on People) for the full lists.`,
  },
  {
    slug: "for-you",
    title: "For You — personal inbox",
    body: `For You (/for-you) is your personal Hub inbox: everything waiting on you in one place.

It groups approvals (time off, expenses, contractor payments, quote discounts, reimbursement/paid stamps, and marketing posts when you’re an admin), Action Center tasks assigned to you, performance reviews (self-assessment due and shared manager feedback), announcement acknowledgements, open polls, overdue Event Packets, Staff Handbook signature when needed, annual 1099 acknowledgment and W-9 when missing, Training Portal courses still open, your linked onboarding checklist, your own pending time-off, expense, or contractor-pay requests, and — for admins and Leads — AV jobs in the next 14 days that still need confirmed crew.

Home’s “What needs you” teaser always deep-links here. Prefer For You over hunting across modules when something is waiting on you. My Week is for your calendar and private personal tasks only.

When Resend email is configured, a daily Field digest cron emails you a short summary if you have actionable items (open For You in the Hub to clear them).`,
  },
  {
    slug: "hub-points",
    title: "Hub points — streaks, discovery, and leaderboard",
    body: `Hub points reward exploring and using the staff Hub.

Daily check-in: opening Home once per day (America/New_York calendar day) awards easy points and builds a streak. Streak milestones unlock bigger awards at 3, 7, 14, 30, 60, and 100 consecutive days. Keeping For You empty (“You’re all caught up. Nice work.”) through end of day also builds a separate clean streak with hard awards at 3, 7, 10, 14, and 30 days.

Discovery: the first time you open many Hub modules (Ask, Chat, Training, Event Packets, Client Reviews, Marketing Queue, and others), you earn one-time discovery points. Easy, common pages award fewer points; harder-to-reach or admin-heavy modules award more.

Earn by doing real work: sign the Staff Handbook; finish Training Portal courses (once per course); create Action Center items (daily cap); complete actions assigned to you; acknowledge required announcements; finish personal My Week to-dos (daily cap, separate from Action Center); ask Ask the Hub (daily cap); submit End of Event Reports and Submit Event Photos; complete Event Packets within 24 hours of assignment; collect website Client Reviews credited to you (milestones at 1 / 3 / 5 / 10 / 25 / 50 / 100 reviews); and open/play video Resources in the Hub player (once per video). Chat has a sliding daily scale (1st / 5th / 15th real message, max 20 pts/day) plus a weekly bonus for five active days.

Social: giving your first kudos awards a medium one-time bonus.

Home shows your total points, current streak, and a scrolling top-three leaderboard with a How to earn more link. Open Hub points (/points) anytime from the sidebar or search for How to earn, Standings (team totals plus David’s separate Mark to beat score — he’s not eligible for monthly trophies), and Activity (staff see only their own awards; trainers and admins see the full team ledger — David’s Activity entries stay admin-only). Monthly trophies (Overall Leader = highest total; Monthly MVP = most points earned that month) are awarded on the 1st for the prior month; David is excluded from monthly wins. See current and past monthly winners on Winners, Home’s Winners of the Month strip, People badges, and the winner’s For You (the trophy card clears once dismissed). Admins can open any person on People and use Award Hub points to grant (or subtract) any amount with a required reason; the teammate gets an in-app notification. Guests cannot earn points. Run migrations 075–088 in Supabase as needed (including 084 website reviews, 085 Client Reviews milestones, 087 For You dismissals, and 088 points Activity staff-own RLS). After docs change, Ask Hub → Rebuild index.`,
  },
  {
    slug: "ask-the-hub",
    title: "Ask the Hub — company Q&A assistant",
    body: `Ask the Hub answers questions using our indexed company knowledge (policy articles, hub how-tos, Resource metadata, Vendors, and Google Drive Docs/Sheets/PDF/Word files from the company Drive folder when Sync Drive / the nightly cron has run).

Anyone signed in can ask a question in the Ask a question section. Answers may list source article titles as chips — Hub feature guides link into Support Guide (/support-guide?topic=…). Custom admin articles stay as plain labels. Use Clear conversation when you’ve finished reviewing a thread so the chat starts fresh.

If you’re stuck, open the Example questions panel on the same page. It lists ready-made questions about Hub features (Calendar, Vident AV, People, field tools, and more). Tap a question to ask it.

Admins manage knowledge lower on the page: add articles, edit existing articles, delete articles, upload PDF or Word (.docx) files to extract and index their text, Rebuild index after Hub/Resource/vendor guide changes, and Sync Drive to crawl the company Google Drive folder (Google Docs, Sheets, PDF, and .docx). Drive indexing also runs on a nightly cron when CRON_SECRET is set. Uploaded files appear in the same saved articles list, so admins can edit the extracted text or delete them anytime. Rebuild refreshes automatic Hub feature guides from the product and does not re-crawl Drive (use Sync Drive for that). Uploaded PDFs need selectable text (scanned image-only PDFs won’t work). Old .doc Word files aren’t supported — use .docx. Event media / Social Studio style folders are skipped during Drive crawl to reduce noise.

Anything indexed from Drive is searchable by all signed-in staff (same as other Ask knowledge). Keep sensitive HR-only material out of the shared company Drive root, or in a folder the Hub service account cannot see.

Needs migration 126_kb_drive_sync.sql for incremental Drive sync state. The assistant needs OPENAI_API_KEY configured. If it isn’t connected, ask an admin. If an answer isn’t documented yet, ask a manager and consider adding an article.`,
  },
  {
    slug: "team-huddle",
    title: "Team huddle — Zoom start and schedule",
    body: `Admins can start a live Zoom team huddle or schedule one from the huddle bar at the top of the Hub (personal Zoom meeting link / PMI).

When scheduling, the Hub checks the shared HoneyBook calendar for overlaps in an assumed 60-minute window. If something conflicts, you’ll see the overlapping events and can pick another time or choose Schedule anyway. Live huddles still auto-end after about two hours unless ended sooner. Staff see scheduled and live huddles on the home banner and get notifications; the join link posts when the huddle actually starts.`,
  },
  {
    slug: "my-week",
    title: "My Week — quotes, events, and private tasks",
    body: `My Week is your personal dashboard for the next several days.

It shows a daily quote (“Today’s spark”), upcoming events from your calendar feed, private Hub tasks only you can see, and HoneyBook tasks assigned to you (when Zapier pushes them and your Hub email matches the HoneyBook assignee). Add a Hub task with an optional due date; complete or delete when done. HoneyBook tasks can be checked off in the Hub for your own tracking — that does not write back to HoneyBook; complete them there to sync status.

Approvals, overdue Event Packets, handbook acknowledgement, and unfinished training live on For You (/for-you) — the canonical personal inbox — not on My Week.

Events come from the shared HoneyBook→Google work calendar. If you see no events, ask an admin to set the company Calendar feed.`,
  },
  {
    slug: "notifications",
    title: "Notifications — bell inbox and /notifications",
    body: `The top-bar bell shows your recent Hub alerts: new Event Packet assignments, overdue packet reminders, marketing approval requests or decisions, time-off requests and their approve/deny outcomes, tasks assigned to you in Action Center, expense submissions and their approve/deny/reimbursed outcomes, new company announcements, kudos when a teammate recognizes you, and when a performance review is shared with you.

Unread items are highlighted. Open one to mark it read and jump to the linked page. Use Mark all read to clear the badge. Each row shows a relative timestamp (for example “2 hours ago”).

For a longer history, open View all notifications (or /notifications / search “Notifications”). The inbox lists up to the latest 100 items with the same mark-read controls. Notifications are private to you — other staff cannot see your list.`,
  },
  {
    slug: "calendar",
    title: "Calendar — company events",
    body: `Calendar shows the shared HoneyBook→Google work calendar and HoneyBook projects that have a project date, with Day, Week, Month, and Year views. Use the view tabs to switch, the arrows to step through time, Today to return to now, and Go to to jump to a specific date. Use the Upcoming Events search box to find events by client, venue, staff, status, or date — opening a match jumps the calendar to that day and shows details.

Click an event for details (venue, client, staff, status, client phone/email, and any Related Files / planning URLs when the feed includes them). From the event detail popup you can open the venue in Google Maps, open any planning/file links that appear in the feed, and Copy details to put a plain-text summary on your clipboard. Day/Week list cards show client phone and email when the feed includes client contact details. Related Files only appear if the feed includes them on the event. HoneyBook CRM projects (Zapier/CSV) fill in stage, client, and project type on matching calendar events; if no live iCal is configured, dated CRM projects still show on the calendar with their CRM stage as the status.

Admins always have Calendar access. Staff and trainers see Calendar when an admin has connected the shared HoneyBook calendar; otherwise the nav link is hidden. Personal calendar links are not used.

Calendar includes Day, Week, Month, and Year views. Week view lists each day as a horizontal block (same event cards as Day view).

Admins paste the HoneyBook→Google Calendar secret iCal URL on Calendar (Google Calendar → Settings and sharing → Integrate calendar → Secret address in iCal format — not the @group.calendar.google.com email). That shared feed is what the whole team sees. The Hub merges it with HoneyBook CRM projects from Zapier/CSV so cards keep client, project type, and CRM stage (status always comes from CRM when matched). CRM projects with a project date that do not match an iCal event still appear on the calendar.

Staff Availability (below the calendar) shows who’s free, booked, or on approved time off for the week. People default to Available every day unless they customize weekly days on Time Off, have approved time off, or are assigned to an event. HoneyBook does not send who is working an event — admins and trainers assign staff on the event detail card; those people show as Booked and on Conflicts when double-booked or overlapping time off. Requires migration 112_calendar_event_assignments.sql.`,
  },
  {
    slug: "chat",
    title: "Chat — team channels",
    body: `Chat is realtime messaging in team channels.

You only see channels you’re allowed to join. Channels can be open to everyone, or restricted to selected people. Admins set access when creating or editing a channel (Everyone vs Selected people). Admins always retain access so they can manage channels.

Anyone with access can send messages. You can delete your own messages; admins can delete any message. Admins create, rename, and delete channels (deleting a channel removes its messages). The channel list shows the latest message preview and relative time, and sorts channels by recent activity.

If you don’t see a channel you need, ask an admin to add you.`
  },
  {
    slug: "vident-av",
    title: "Vident AV — gear, bookings, and estimates",
    body: `Vident AV (route /rentals) is the Hub AV rental workspace (system of record for day-to-day ops). Customers, Venues, Catalog, Estimates, Warehouse, Stock, Calendar/Planner/Travel, Activities, Invoices, Costs, Crew, and Reports are Hub-owned.

Who can open it: admins, or anyone with Audiovisual in their People departments. Everyone else sees Access restricted, and the nav link is hidden.

Overview: Hub estimates by Draft/Quotation/Order/Closed, gear holds, still-out / overdue (Warehouse), activities due/overdue, open/unpaid invoices, and gear-out in the next 14 days (Estimates). Every tile is a link into the matching list already filtered (status, holds, warehouse tab, activities due/overdue, open/unpaid invoices). If the shop is empty, Load sample shop adds demo catalog, customers, venues, a draft estimate, and a reserved quotation with holds so you can practice Estimates → Warehouse → Invoices. Clear sample shop removes those demo rows (and invoices drafted from them) when you are done practicing. Current RMS is no longer used for day-to-day AV ops (Import tab retired).

Customers / Venues / Catalog: add and edit Hub records. Catalog supports sections, rental/package/sale/consumable products, and crew/transport/fee services. Edit opens the form and scrolls/focuses the name field. Duplicate copies a product (price, section, Comes with list; qty owned starts at 0) or service. On an existing product, Comes with lets you add, edit qty/required, or remove nested gear that auto-inserts on estimates. Job venues are separate from Event Packet venue folders. Needs migration 140_av_erp_core.sql.

Quotes: Vident AV → Estimates is the Hub opportunity editor (Draft, Quotation, Order, Closed). Create an estimate, set customer/venue (or use New customer / New venue on the estimate header to add them to the system if they are missing), gear out/back and optional charge window (all as America/New_York / Eastern wall times), add product, service, or free-text lines in sections (free-text lines take a text_kind rental/sale tag), and use Totals for surcharge, discount, and hidden venue markup (customer sees marked-up prices; staff see real unit prices and a staff-only markup row). Adding a catalog product also inserts its accessory child lines (indented under the parent). Package products with a $0 catalog rental price roll up Comes-with item prices into the package Unit $ (included accessories nest at $0); edit Unit $ before Add line, or use Price from items on an existing package line. Confirm and reserve gear writes holds for rental lines over the gear window; if any rental line is short it blocks and offers Confirm anyway — free qty is reserved, short qty stays unreserved, and a staff note records who confirmed past the shortage and when. Shortage badges still show owned qty minus buffer, other holds, and turnaround hours. Clear holds removes this estimate’s reservations. Overview tiles link into Estimates filtered by status or gear holds. Delete estimate (list or editor) removes the estimate plus its lines and holds; Q-#### numbers keep counting up and are not reused.

Venue plan: on an estimate, upload a room photo, click to place gear markers, and optionally generate an AI layout render (GEMINI_API_KEY / Nano Banana). Approve or reject renders from the same panel. Needs migration 149_av_text_kind_venue_plan_terminal.sql.

Estimate / contract / invoice / receipt PDFs: Download estimate PDF and Download contract PDF on an estimate, Download invoice PDF on an invoice, and Download receipt PDF on an invoice once a payment is recorded. All use the same branded look as the Vident contracts (black logo band, bronze accents, grouped items with subtotals, totals, and a signature box on estimates and contracts). Two billing types, chosen once on the estimate under How this is billed and carried to the invoice: Direct (we bill the client, so the surcharge shows) and Venue partner (the venue pays us and bills the client on its master bill, so there is no surcharge row and the paperwork says the venue may add a service charge and taxes to the final bill). Venue markup is never labeled. Share estimate link opens /estimate/<token> with the same layout. Needs migration 187_av_billing_type.sql for the venue option. Revoke link disables the public page. Needs migrations 140 and 141.

Warehouse / Stock (Phase 2): after Confirm and reserve on an estimate, Vident AV → Warehouse shows remaining qty ready to Check out. Checking out writes a Hub gear movement and can promote the estimate to Order. Still-out lines support Check back; overdue means still out past gear-back. Stock shows owned qty from Catalog minus qty currently out from movements (packages hidden). Needs migration 142_av_gear_movements.sql.

Gear calendar / Planner / Travel: Calendar is a month diary of Hub jobs spanning gear out→back (Eastern days). Planner is a four-week bar per job colored by status. Travel lists leave and return for one day in clock order (reserved quotations, orders, still-out). These are Hub read-only views over Estimates — separate from the staff Calendar tool.

Activities: Vident AV → Activities for pre-job tasks (subject, kind, due Eastern, optional estimate). Settle when done; Show settled too to reopen. Overview tiles link due-today and overdue. Needs migration 143_av_activities.sql.

Invoices / Suppliers (Phase 3): Vident AV → Invoices drafts from a quotation or order using customer-facing line prices (venue markup folded in; staff never put markup on the invoice). While draft, edit subject/dates, change line description/qty/price, or add/remove lines (total recalculates). Mark sent locks the invoice, auto-enables the customer pay link, and emails /invoice/… via Resend when the customer has an email. Enable / re-email pay link and Send reminder do the same later (reminder bumps last_reminded_at). Filter Overdue (past due_at with a balance) or open Overview → Overdue invoices. A daily cron emails overdue customers (deduped ~20h) when Resend is configured. Stripe Checkout on the pay link records the payment via webhook. Drafting from a venue Book Now estimate with a paid deposit copies that deposit as the first payment. Suppliers is Hub CRM for vendors/sub-hire. Needs migrations 144_av_invoices.sql, 146_av_invoice_credits.sql, 155_venue_convert_invoice_pay.sql, 156_invoice_pay_catalog_show_remote.sql, and 157_venue_catalog_invoice_reminders.sql.

Costs & margin / Crew bookings (Phase 3): Vident AV → Costs lists open jobs with revenue (non-void invoice totals, else estimate customer total), booked costs, and margin. On an Estimate, Costs & margin adds cost rows (category, amount, optional tax, optional supplier, Eastern cost date). Crew books Hub people or external contractors onto a job (role, Eastern start/end, optional day rate, offered/confirmed/declined/cancelled). Confirmed bookings with a day rate can sync a labor cost (Eastern calendar days × rate) when “Add labor cost when confirmed” is checked — cancel/decline removes that linked cost. Staffing, Contractor Pay, and People still handle coverage and pay. Needs migrations 145_av_job_costs_crew.sql, 147_av_crew_cost_rollup.sql, and 151_av_km_gaps.sql for contractors/tax.

Reports (Phase 4+): Vident AV → Reports covers customer income, product rental/sale income, service income, text item rentals vs text item sales (free-text lines by text_kind), contacts with organizations, job profit, costs by category, product sub rents, opportunity sub rents, service sub contracts, open AR, payment transactions, partially invoiced jobs, invoice aging, open pipeline, gear still out / overdue, checkout ready, low stock, sales stock, never rented or sold, stock transactions, upcoming crew, open activities, and gear windows in the next 14 days. The page lists all 19 KM Reports menu names; every KM key maps to a Hub section. Filter accepts Hub titles or any KM key/label. Hub data only.

Estimate share / email / e-sign: On an estimate, Share estimate link, Email estimate (sends the public link to the customer email), Download estimate PDF or Download contract PDF (stamped when already signed; prefers the immutable archived copy). Customers open /estimate/… and Accept with the Hub drawn e-signature pad (name, signature, IP/browser/timestamp — same pad as Staff Handbook / Documents; no DocuSign), or Decline with an optional note. After accept, Hub archives and emails a stamped signed PDF to the customer email. The same page then offers Sign contract (also stamped + emailed). Accepting a Quotation can move it to Order. Staff see signer name, response, signed-PDF emailed-at, and Resend signed PDF on the estimate. Change orders: create on the estimate, add / adjust qty / remove against existing estimate lines, Share for e-sign → /change-order/…; on accept, lines sync into the estimate and a stamped PDF is archived + emailed. Sales tax: set Default sales tax rate on Templates; mark customers Tax exempt — rate applies to invoices and to estimate/contract PDFs and the public estimate page. Needs migrations 151, 152, 153_av_tax_co_lines_signed.sql, and 154_av_signed_pdf_archive.sql.

Contractors / Serials / Templates: Vident AV → Contractors is freelancers without Hub login for crew bookings. Serials tracks individual asset serial/barcode units; Warehouse has a scan/filter box for product code or name. Templates holds estimate/invoice terms. Needs migration 151_av_km_gaps.sql.

Developer and API (Terminal Mode): Vident AV → Developer mints shop API keys for Claude or scripts (KM Settings → Developer and API). Keys are shown once; revoke anytime. Read: GET /api/av/terminal/v1/opportunities, /customers, /catalog. Write (optional scope): POST/PATCH /customers, POST/PATCH /opportunities, DELETE /customers (soft-retire). Catalog stays read-only. Authorization: Bearer avk_live_…. Needs migrations 148_av_integration_tokens.sql and 149_av_text_kind_venue_plan_terminal.sql.`,
  },
  {
    slug: "teams",
    title: "Teams — department hubs and AV time clock",
    body: `Teams has department tabs for Audiovisual, Corporate, Wedding & Social, and Golf with planning links, tutorial videos, and shortcuts.

Staff only see departments assigned on their People profile. Admins and trainers see all tabs and can add, edit, or delete department links and videos. Office is not a Teams tab.

When no admin-managed links exist yet, each tab shows Hub defaults: Wedding & Social (Event Packets, Calendar, Quoting, My Week, Support Guide), Corporate (Quoting, Vident AV, Event Portals, Show Control, Venue Quotes, Calendar), and Audiovisual (Vident AV, Show Control, Event Portals). Admins/Leads can replace those with custom department links and training videos anytime.

On the Audiovisual tab, the AV Time Tracker lets you clock in From Calendar (upcoming calendar events for the next two weeks — events assigned to you and AV-looking titles first) or Manual Entry (type an event name), add notes, optionally capture GPS, clock out, and review recent AV time entries. Admins need the company Calendar feed; staff/trainers need a personal calendar link on People. Admins and trainers also see Team hours (last 7 days): per-person closed-shift totals and a recent team shifts list (staff only see their own tracker).`,
  },
  {
    slug: "training-portal",
    title: "Training Portal — courses & progress",
    body: `Training Portal is self-paced written courses with personal progress.

Staff see New Hire Onboarding (All staff) plus only courses whose Audience matches a department checked on their People profile (Audiovisual, Corporate, Wedding & Social, Golf, Office). Admins and trainers see the full catalog. Use the search box to filter by title, blurb, or audience. Open a published course, expand each lesson, follow any Hub links, and click Mark complete. Lessons that include a quiz require a passing score (70%+) before completion is recorded — answers are graded on the server. Progress shows on the catalog and on For You. Top-bar search only returns courses you can open.

Admins and trainers see Tracking (per-staff progress) and Manage (create/edit courses and lessons, quiz questions, reorder lessons, set Audience to a department or All staff, set status to Available / Coming soon / Draft). Only admins can delete courses or lessons. Staff only update their own lesson completions. Use Teams for department tutorial videos. Quizzes need migration 064_training_quizzes.sql applied in Supabase.`,
  },
  {
    slug: "resources",
    title: "Resources — shared files and links",
    body: `Resources is the shared library of files and links, with search and category filters.

Everyone can browse items their visibility allows (everyone, staff, or admin-only). Any staff member (Staff, Lead, or Admin) can add resources — upload a file or paste a link. Leads and admins can edit title, category, description, visibility, and link URL. File uploads stay as-is when editing — replace a file by deleting and adding a new resource. Only admins can delete resources. Guests can browse but cannot add.

The page also links to the Staff Handbook. Resource titles and descriptions are included when an admin rebuilds the Ask the Hub index, so the assistant can mention them.`,
  },
  {
    slug: "staff-handbook",
    title: "Documents — handbook and agreements",
    body: `Documents (/documents) is the Hub home for the Staff Handbook and company agreements (Independent Contractor, Subcontractor, and Training). Sidebar label is Documents (Learn & refs).

Staff Handbook: while still in draft, only admins can open it. Admins edit on the page (Edit handbook → Save updates) and publish when ready. After publish, all signed-in staff can read and digitally acknowledge it (name, email, drawn signature; IP/browser/timestamp recorded). Admins and trainers see an acknowledgement roster for the current revision.

Agreements work the same way: each starts as a draft (seed content adapted for Vident Productions). Admins open Documents → agreement → Edit → Save updates → Publish for all staff. Until published, only admins see that agreement. Staff sign published agreements with the same e-sign pad. Requires migration 095_hub_documents.sql. After docs change, Ask Hub → Rebuild index.`,
  },
  {
    slug: "hub-documents-agreements",
    title: "Documents — contractor and training agreements",
    body: `Open Documents from the sidebar. Cards list the Staff Handbook plus Independent Contractor, Subcontractor, and Training agreements. Draft cards are admin-only until Publish. Signing records name, email, drawn signature, IP, browser, and timestamp per document revision (draft vs live).`,
  },
  {
    slug: "people",
    title: "People — directory, org chart, and onboarding",
    body: `People is the team directory with Directory, Birthdays, Anniversaries, Org Chart, and Onboarding tabs.

Anyone signed in can view people and click a card to open full details. Anyone can edit their own phone, avatar URL, bio, and Facebook / Instagram / LinkedIn / X (Twitter) profile links from that popup. Admins edit full profiles (including those social links), run Add person (opens Supabase Auth invite, then activate the profile), set departments, set a manager per department for the org chart (so multi-department staff can report to different people in, say, Audiovisual vs Corporate), identity color, birthday, start date, and personal calendar iCal URL. Home shows upcoming birthdays and work anniversaries for the next 14 days with links to People → Birthdays (/people?tab=birthdays) and People → Anniversaries (/people?tab=anniversaries).

Admins see a Directory banner and card badge when active staff/trainers are missing a calendar link (needed for Calendar and My Week events). Use Show only missing calendar, then Edit person to paste the feed URL.

Org Chart is split by department. People in multiple departments appear in each chart using that department’s manager assignment.

Departments control Teams visibility and Vident AV access (Audiovisual department). Onboarding cards on People: Corporate, Weddings & Social, Golf, AV, and Office forms, plus Interview Questions - AV (admin-only). Staff and trainers only see forms for their assigned departments after an admin pastes a Google URL from Vident Google Drive. Admins see every card (including missing links) with a banner counting unset URLs, and paste Form/Sheet/Doc URLs via Add link / Edit link.`,
  },
  {
    slug: "vendors",
    title: "Vendors — preferred suppliers directory",
    body: `Vendors (/vendors) is the Hub directory of suppliers Vident uses (balloons, catering, florals, lighting, and more).

Anyone on staff can search, add, and update vendors (category, company, contact, phone, email, website, notes, preferred flag, departments). Deletes require admin approval: staff/Lead request a delete; admins Approve or Decline from the Vendors page. Every change is written to an audit log (who/when/what). Hub is the source of truth and syncs to a Vident Google Sheet (Vendors) under the company Drive folder when Drive credentials are set. After vendor changes, admins should Rebuild index on Ask the Hub so questions like “Who do we use for balloons?” pull from the live directory.`,
  },
  {
    slug: "support-guide",
    title: "Support Guide — Hub how-to playbooks",
    body: `Support Guide is a browsable set of Hub how-to playbooks (Getting started, Day to day, Field tools, People & teams, Access).

Anyone signed in can open Support Guide from the sidebar, search topics, and open an article. Share a topic with /support-guide?topic=slug (Ask the Hub source chips use these links). Many topics link straight into the related module. For free-form questions use Ask the Hub; for files and shared links use Resources. Admins can still add custom knowledge articles on Ask the Hub.`,
  },
  {
    slug: "event-packets",
    title: "Event Packets — calendar-assigned wrap-up + media",
    body: `Event Packets are calendar-driven end-of-event checklists. After Sync from calendar, each assigned staff member gets a packet for past/day-of calendar events.

Open Event Packets from Field tools or Home. Statuses: Needs completion, In progress, Completed. On My packets, use the search box to filter by client, venue, team member, date, or event type. If Sync didn’t auto-create a packet, open Create packet from a past event to pick a calendar event from the past 24 months through today, or open the event on Calendar and use Create Event Packet in the detail popup. Open a packet to fill Event details & recap (including memorable moment). When a HoneyBook CRM project matches the packet’s event date and client name, an admin or Lead opening the packet auto-links it (migrations 158–159). Admins and Leads see the CRM project on the packet; HoneyBook → Projects shows linked Event Packets. Wedding event types also show a day-of coordinator checklist (reference only). Photos & videos tags always mirror that recap — team member, location, date, client, and event type stay locked to the recap. Opening a packet, saving the recap, or clicking Sync tags from Event details updates tags, Library folder paths, and storage filenames on media already uploaded whenever they don’t match the recap. Mark complete when done. Completing also creates a linked End of Event Report with the same memorable moment field. Uploaded media shows as thumbnails — click a photo or video to open a full preview; use the trash icon to delete an upload (assignee, trainer, or admin).

Files are renamed like “Location - Team member - Date - 01.jpg” and tagged with a folder path under a master venue. The Library tab lists tagged uploads by venue → event folder — staff see only media they uploaded; admins see everyone’s uploads. Admins manage Venue masters + aliases (so “The Treasury” and “The Treasury on the Plaza” share one parent folder), sync the company calendar for everyone, and use the Tracking tab for per-staff progress, overdue packets, and packets flagged for follow-up (count tile, staff column, Needs follow-up filter, notes preview). Tracking also has a search box (client, venue, staff, date, event type) that works with those filters.

Incomplete packets become overdue the calendar day after the event. Assignees see an overdue strip on Event Packets and My Week, and get a daily bell reminder (deduped ~once per day) via /api/cron/remind-overdue-packets when CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY are set. Optional archive packets (created from website-review backfill) never go overdue, never appear on For You, never send overdue reminders, and never earn packet_24h — they stay available if a team member wants to upload archive photos later.

When Sync from calendar (or the daily packet sync cron) creates a new packet, the assignee also gets a one-time bell notification with a deep link — updates to existing packets do not re-notify.

If you mark Follow-up needed by admin on a packet (and it was not already flagged), admins get a bell notification with a deep link. Assignees see a Follow-up badge and strip on My packets; admins triage on Tracking. When event type is Other, staff must describe the specific event type in a free-text box — lists, tags, and captions show that description only (not “Other — …”).

Packet photo/video uploads use the Supabase Storage bucket event-media (or Bunny when configured). Migration 128 creates that bucket and its policies if missing.

Completed packets feed Social Studio for captions and image exports. Admins can also Backup to Drive when Google Drive env vars are configured.

Website testimonials sync from the Vident Client Reviews Google Sheet (including Event_ID). Browse them on Client Reviews (/client-reviews). Admins sync from Client Reviews or Event Packets, or via daily cron /api/cron/sync-sheet-reviews. Sync can create optional archive Event Packets for review event IDs (last 24 months). Rows removed from the sheet are pruned from the Hub. Requires migrations 084–086 and SUPABASE_SERVICE_ROLE_KEY for cron writes.

Packets also auto-sync from the company calendar on a daily cron at /api/cron/sync-event-packets when CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY are set, and throttled when an admin opens Event Packets.

Generic End of Event Report and Submit Event Photos remain available for one-off use. The generic photo uploader now uses the same tags, rename pattern, and venue folders as packets.`,
  },
  {
    slug: "client-reviews",
    title: "Client Reviews — website testimonials in the Hub",
    body: `Client Reviews shows website testimonials synced from the Vident Client Reviews Google Sheet into the Hub.

Open Client Reviews from Field tools. Staff see only reviews credited to them. Credit comes from the sheet’s Staff Member(s) column (matched to Hub profiles) and from Event Packets matched by event ID. Admins and trainers can filter to anyone or view Everyone. Search by client, quote, staff, or date. Matched reviews link to the related Event Packet when one exists.

Hub points: opening Client Reviews awards a one-time discovery bonus. As your attributed review count grows, milestone awards unlock at 1, 3, 5, 10, 25, 50, and 100 reviews. Progress shows at the top of Client Reviews.

Admins can Sync from this page or Event Packets. Daily cron /api/cron/sync-sheet-reviews also awards milestones. After docs change, Ask Hub → Rebuild index.`,
  },
  {
    slug: "marketing-queue",
    title: "Marketing Queue — draft posts from completed packets",
    body: `Marketing Queue is an admin/trainer board for turning completed Event Packets into platform drafts.

When a packet is marked complete with social consent, drafts auto-queue for all eight networks including YouTube, Threads, and Pinterest (scheduled about 24 hours out). YouTube drafts prefer the first video on the packet; other platforms prefer an image. You can also Queue drafts manually on this page, or use Queue to Marketing from Social Studio after captions are ready. Empty draft captions are filled from Social Studio when you generate/save captions, open Marketing Queue, or click Queue drafts again (existing caption edits are not overwritten). Each draft shows a photo/video preview with multi-select thumbnails (click to toggle; numbered order is post order) up to each network’s limit — Facebook/Instagram 10, LinkedIn/Threads 20, TikTok 35 photos, X 4, YouTube 1 video, Pinterest 1 image (images are hidden on YouTube drafts). X/TikTok/Threads can’t mix photos and video in one post; Pinterest requires an image. Search packets and drafts by client, venue, caption, platform, or notes. Filter by Pending / Due / Ready / Draft / Posted / Rejected, set a schedule datetime, edit captions, copy to clipboard, and download a Post pack text file.

On Instagram drafts, add up to three Instagram usernames as Collaborators before Approve / Post. Meta sends Collab invites at publish time; each person must accept in the Instagram app before the post appears on their profile (professional accounts with collaborator tagging enabled). Facebook, LinkedIn, TikTok, Threads, Pinterest, X, and YouTube do not support the same co-post collaborator flow in the Hub. YouTube drafts use the same approval rules: trainers request approval; admins Mark posted after the video is uploaded in YouTube Studio (consent is still required).

Company social posts need admin approval when a trainer submits them: Request approval notifies all admins (bell icon in the top bar). Admins Approve (publishes via Meta for Facebook/Instagram when configured, or marks posted) or Deny with an optional reason. Admins can still post immediately without requesting approval. Drafts without social consent on the packet stay blocked with a clear warning.

With Meta / LinkedIn / TikTok / Threads / Pinterest / X / YouTube env vars set, those platforms show one-click Post (admins) or Request approval (trainers). LinkedIn, TikTok, Threads, and Pinterest publish through Post for Me (POSTFORME_API_KEY): each draft can use a Post as brand/page picker when multiple accounts are connected; leave unset to use POSTFORME_*_ACCOUNT_ID defaults. Post for Me requires a non-empty caption — empty drafts disable Post until you add one. Admins manage Pinterest boards on Marketing Queue; each Pinterest draft can pick a Board (stored as target_pinterest_board_id). Prefer generating captions in Social Studio first so Threads/Pinterest drafts are filled. YouTube uploads via the Data API when durable OAuth is set (YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REFRESH_TOKEN + YOUTUBE_CHANNEL_ID — Hub refreshes the access token on each upload) or when a short-lived YOUTUBE_ACCESS_TOKEN + CHANNEL_ID are set (default privacy unlisted; videos over ~256 MB should still use Studio + Mark posted). Without YouTube credentials, drafts use Request approval / Mark posted after Studio upload. A Vercel cron auto-publishes ready API drafts past scheduled_for several times per day (CRON_SECRET + service role; Hobby plans cannot use true hourly crons). Pending approval drafts are never auto-posted. After docs change, Ask Hub → Rebuild index.`
  },
  {
    slug: "social-studio",
    title: "Social Studio — captions, crops, and Drive backup",
    body: `Social Studio turns completed Event Packets into ready-to-post social assets.

Anyone can open their completed packets (admins/trainers see all). Use the search box on the Social Studio list to filter by client, venue, team member, date, or event type. Generate captions creates platform-native copy optimized for local SEO and AI/answer engines for Facebook, Instagram, LinkedIn, TikTok, X/Twitter, YouTube (title + description), Threads, and Pinterest using the packet’s team member, venue, date, client, memorable moment, staff feedback, and any website reviews matched by Event ID — hours worked are never used in captions. When website reviews are attached, captions may quote or paraphrase them; the model must not invent reviews. Edit captions and click Save caption edits to keep changes. Queue to Marketing creates drafts for every platform, including YouTube video uploads that still need admin approval when submitted by non-admins.

Admins and trainers can Queue to Marketing from a completed packet’s studio page (same as Queue drafts on Marketing Queue — creates platform drafts scheduled about 24 hours out when consent is on file). Open Marketing Queue from the studio toolbar to review or post.

Admins can Generate image on a packet’s Social Studio page. The default model is Google Nano Banana Pro (Gemini model gemini-3-pro-image-preview) via GEMINI_API_KEY from Google AI Studio (paid tier / billing required). Higgsfield Cloud models (Soul, Seedream, FLUX, Reve) remain selectable fallbacks with HF_API_KEY + HF_API_SECRET. Enter a prompt, pick aspect ratio, and Generate & save to packet — the still is stored as Event Packet media for crops and Marketing Queue. Only admins see this panel. If GEMINI_API_KEY is missing, Nano Banana Pro falls back to Soul Standard when Higgsfield is configured (with a clear notice). Provider API usage is billed by Google / Higgsfield — website unlimited toggles do not apply. For standalone generation, library saves, and attaching to any packet, use Image Studio (/image-studio).

Image exports let you pick a packet photo, then reframe with a clear crop box (bright area = what exports; dimmed area is cut off). Drag the photo, zoom, and pick a platform size (square feed, portrait, story/TikTok vertical, landscape link preview, X post, YouTube thumbnail). Download the crop, or Save crop to packet so Marketing Queue can post that exact framing (posts use the selected packet media as-is). Event Packet and Submit Event Photos uploads accept iPhone HEIC/HEIF files and convert them to JPEG automatically so previews and crops work in the browser.

Event Packets record social consent before public posting — Social Studio shows a consent badge. Backup to Drive mirrors the venue → event folder tree (new uploads sync automatically when Drive is configured; already-synced files are skipped). Media access works for both Supabase and Bunny-backed files. Requires GOOGLE_SERVICE_ACCOUNT_EMAIL + PRIVATE_KEY in the environment, and a root folder via GOOGLE_DRIVE_ROOT_FOLDER_ID or the admin override on /drive (paste the Vident company folder URL). Caption generation needs OPENAI_API_KEY.`,
  },
  {
    slug: "google-drive",
    title: "Google Drive — company files and root folder",
    body: `Google Drive (/drive) lets admins and trainers browse, upload, and create folders in the company Drive shared with the Hub service account.

The Hub connects with GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (Vercel env). The default company root is the Vident Productions Hub Drive folder (id 1m3XSbIg6_3_GN431KH2Iw7hjQsr_VgWF). You can override with GOOGLE_DRIVE_ROOT_FOLDER_ID or an admin paste on /drive (drive.google.com/folders/… URL). Share that folder with the service account as Editor. Client Reviews spreadsheet creation, Social Studio backup, and /drive browse all write under this root.

Admins see the connected folder on Hub Health. To change the root, open /drive?settings=1 (also linked as “Root folder settings” on Drive). Changing the root clears the Hub’s folder-path cache used for Social Studio backups.`,
  },
  {
    slug: "image-studio",
    title: "Image Studio — admin AI image generation library",
    body: `Image Studio is an admin-only field tool at /image-studio for generating stills outside a single Event Packet.

Only admins see Image Studio in the sidebar. Choose Nano Banana Pro (Google Gemini, default) or a Higgsfield Cloud fallback (Soul, Seedream, FLUX, Reve), set aspect ratio, and for Gemini pick image size 1K / 2K / 4K. Generate shows a preview, download, and a this-session history for quick re-download.

Save to Hub library stores the still in the studio_images library (same event-media storage provider as packet photos) so staff can reuse it later. Push to Social Studio packet attaches the image as Event Packet media using the same rename/tag flow as the in-packet generator — then open Social Studio to crop or queue Marketing drafts. The in-packet Generate image panel on Social Studio stays available and is unchanged.

Requires GEMINI_API_KEY for Nano Banana Pro (Google AI Studio; paid tier / billing for gemini-3-pro-image-preview). Optional HF_API_KEY + HF_API_SECRET for Higgsfield fallbacks. If Gemini is missing, Nano Banana Pro falls back to Soul when Higgsfield is configured. Guests cannot open Image Studio. Database migration 047_studio_images.sql creates the library table.`,
  },
  {
    slug: "end-of-event-report",
    title: "End of Event Report — post-event field form",
    body: `End of Event Report is a generic field tool for submitting what happened after an event. Prefer Event Packets when the job came from the calendar so media and wrap-up stay linked.

Anyone signed in can create a report: date, client, venue, event type (when Other, describe the specific type — the report shows that description only, not “Other — …”), equipment notes, memorable moment, issues, client feedback, rating, and optional Follow-up needed by admin. Event types include Wedding, Corporate, Birthday, Anniversary, School Dance, and Other. Hours worked are not collected.

Staff see their own submitted reports; admins and trainers can see everyone’s. Use All or Follow-up needed by admin above the list to triage reports marked for follow-up. Authors or admins can delete a report.`,
  },
  {
    slug: "submit-event-photos",
    title: "Submit Event Photos — upload gallery",
    body: `Submit Event Photos is the generic uploader for photos and videos when you are not completing an Event Packet. Prefer Event Packets for calendar jobs so tags, rename, and venue folders stay linked. Click a thumbnail to open a full photo/video preview; uploaders and admins can delete items from the gallery.

Anyone signed in can upload: enter location/venue, team member, date, optional client, and event type (when Other, describe the specific type — the photo tag stores that description only), then select image or video files. Only image and video types are accepted. Uploaders can delete their own media; admins can delete any.

Files are renamed like Event Packets (“Location - Team member - Date - 01.jpg”) and tagged under the venue folder. By default storage is the Supabase event-media bucket; when EVENT_MEDIA_STORAGE_PROVIDER=bunny is set (with Bunny zone + CDN env vars), new uploads go to Bunny CDN while older Supabase files keep working.`,
  },
  {
    slug: "roles-and-access",
    title: "Roles, departments, and access cheat sheet",
    body: `Hub roles: admin, Lead (internal key: trainer), staff, and guest (read-only access-code browse). Departments: Audiovisual, Corporate, Wedding & Social, Golf, Office.

Quick access rules:
- Guest: Home (stripped), Resources (everyone visibility), Training Portal (published, read-only), Support Guide (filtered). No People/Chat/Calendar/field tools/handbook/Ask.
- Ask the Hub questions: staff/Lead/admin. Manage knowledge / rebuild: admins only.
- Calendar: admins always; staff/Leads only with a personal iCal on People.
- Chat channels create/rename/delete: admins only.
- Vident AV: admins or Audiovisual department. Financials and quote builder: admins only.
- Inquiry Forms (website inquiry forms and their submissions): admins only. Finished website inquiries show on the HoneyBook board as Inquiry projects with a Website badge, with the board's usual access.
- Teams: staff see assigned departments; admins/Leads see and manage all department tabs.
- Resources: add = admin or Lead; delete = admin only. Guests only see visibility=everyone.
- People edits, invites, personal iCal URLs: admins. Guests never see the directory.
- Feed: staff/Lead/admin can post; delete = admin any, Lead own, staff none. Guests do not see the feed.
- Event reports: staff see own; admin/Lead see all.
- Event Packets: staff see own assigned packets; admin syncs company calendar, manages venues, tracks completion. Daily cron auto-sync when configured.
- Marketing Queue: admin/Lead board — schedule, Post pack, Meta post (FB/IG), LinkedIn/TikTok/Threads/Pinterest/X when configured, YouTube via Mark posted / approval. Leads request approval; admins approve/deny (notifications). Completing a packet with social consent auto-queues drafts (~24h) even for assignees.
- Image Studio: admins only — Nano Banana Pro / Higgsfield generation, Hub library, attach to packets.
- Submit Event Photos: same tagging/rename/venue folders as packets for one-off uploads.
- Training Portal: staff can take published courses and mark lessons complete; guests browse published courses only; admin/Lead use Tracking + Manage tabs (delete = admin only).
- Staff Handbook: draft = admin-only; after publish staff can read and sign. Guests cannot open the handbook.

If a module is missing from the Tools page, check your role and departments with an admin.`,
  },
  {
    slug: "time-off",
    title: "Time Off & Availability — requests and who’s out",
    body: `Time Off lets you request time off, set your weekly availability, and see who’s out.

Request time off: pick a start and end date, choose a type (Unavailable, Vacation, Personal, Sick, or Other), add an optional note, and submit. Your request stays “pending” until an admin reviews it; you can cancel a request while it’s still pending. Notes and the reason stay private to you and admins.

Weekly availability: pick typical days you’re free (defaults to every day until you save a custom pattern). Calendar Staff Availability uses this plus approved time off and event staff assignments.

Who’s off: everyone can see approved Hub time off (name, dates, and type) for scheduling. Approved Hub time off also appears on the Calendar as a neutral all-day entry spanning the date range. Admins see Hub + calendar-feed time off (de-duped) on Staffing when the company iCal includes Time Off.

Admins: review pending requests with Approve or Deny at the top of the page, see recently reviewed requests, and get a notification when a new request comes in. When you approve or deny, the staffer is notified of the outcome (in-app, plus email if configured).`,
  },
  {
    slug: "action-center",
    title: "Action Center — shared team tasks",
    body: `Action Center is a shared task board for the team. It is separate from the private to-do list in My Week (those tasks are only yours).

Create a task with a title, optional detail, one or more assignees (tap names to toggle), a due date, and a priority (Low, Normal, High). Anyone signed in can create tasks and assign them to teammates or leave them unassigned.

The board groups tasks into Assigned to me, Other open tasks, and Completed. Overdue tasks are flagged in red. Each assignee has their own checkbox: check it to mark your part done. With multiple assignees the task shows progress (e.g. 1/3 done) and completes only when everyone has checked theirs — the creator is notified when it does. The creator or an admin can also mark the whole task done or reopen it, and can edit or delete it.

Every task has comments (the 💬 link on the task). The task's creator, its assignees, and admins can comment; a new comment notifies the others on the task. You can delete your own comments; admins can delete any.

When you assign a task to someone, they get a notification (in-app, plus email if configured). Open tasks you haven't checked off also appear on For You. A daily cron reminds assignees who still have their part open about overdue tasks when CRON_SECRET and the service role key are set.`,
  },
  {
    slug: "reviews",
    title: "Performance Reviews — self-assessment and manager feedback",
    body: `Performance Reviews run in cycles created by admins. Each staffer gets one review per cycle: a self-assessment you fill out, plus a manager review written by an admin or your department manager.

Self-assessment: while a cycle is open, rate yourself 1–5 on each competency (Professionalism, Reliability & punctuality, Client experience, Technical skill, Teamwork) with optional comments, and add overall notes. Save a draft anytime; Submit locks it. For You shows a card when you have a self-assessment to complete, and again when manager feedback is shared.

Manager review: admins or your People-directory manager (legacy reports_to or department manager) open a person’s review to see their self-assessment next to rating fields, an overall rating, overall notes, and goals. Save keeps it private; Save & share releases it to the staffer, who is then notified. Manager feedback stays hidden from the staffer until shared.

Managing cycles (admins only): on the Reviews page, create a cycle (name plus optional due date), Generate reviews for all staff, and close or reopen a cycle. Department managers see only their reports and cannot create cycles.`,
  },
  {
    slug: "directory",
    title: "Company Directory — org chart and contacts",
    body: `The Directory is a read-only view of the team, shown as a reporting tree: who reports to whom, nested by manager.

Each person shows their avatar (or initials), name, role, job title, department chips, and click-to-email or click-to-call contact links. People with no manager appear at the top level, with their reports nested underneath.

The tree is built from the “reports to” field on People profiles. To shape it, an admin sets each person’s manager on their People profile. The Directory itself is read-only — there’s nothing to edit here; it always reflects the current People data.

Any signed-in staffer can view the Directory. Guests cannot.`,
  },
  {
    slug: "expenses",
    title: "Expenses — submit and reimburse",
    body: `Expenses lets staff submit costs for reimbursement and track their status. Contractor / 1099 work pay is separate — use Contractor Pay (/contractor-pay), not Expenses.

Submit an expense: enter the amount, category (Travel, Mileage, Gear / Equipment, Meals, Supplies, or Other), the expense date, an optional description, an optional receipt file upload (image or PDF stored in event-media), and/or an optional receipt link (paste a photo or Drive link). Your expense stays “pending” until an admin reviews it; you can cancel a pending expense. You only see your own expenses. Uploaded receipts and links show as View receipt for you and for admins reviewing.

Admins: new expenses appear under “To review” with Approve and Deny, and admins get a notification (plus email if configured) when one is submitted. When you approve or deny, the submitter is notified of the outcome. Approved expenses move to “Awaiting reimbursement” with a “Mark reimbursed” button; marking it paid notifies the submitter and stamps it Reimbursed. The Home page and For You show admins when expenses are waiting to review. Receipt file columns need migration 065_expense_receipts_onboarding_hire.sql.`,
  },
  {
    slug: "contractor-pay",
    title: "Contractor Pay — payments, W-9, and 1099 acknowledgment",
    body: `Contractor Pay (/contractor-pay) is for staff and independent-contractor payment requests — not out-of-pocket reimbursements (those stay on Expenses).

Who can use it: any signed-in staffer (not guests). Admins review and mark paid.

Payment requests: enter amount, category (Event day, Hourly, Flat fee, Bonus, or Other), work date, optional event/job name, optional hours, and notes. Requests stay pending until an admin Approves or Denies; you can cancel while pending. Approved items move to Awaiting payment; admins Mark paid. Admins get a Hub notification (and email when configured) on submit; you get notified on approve/deny/paid.

Mini 1099 hub: for the current tax year, upload a W-9 (PDF or image) and digitally sign the annual 1099 acknowledgment (drawn signature, name, email, IP/browser recorded). Admins see a roster of who has signed and the latest W-9 on file. Needs migration 121_contractor_pay.sql. After deploy, Rebuild index on Ask the Hub so answers mention this module.`,
  },
  {
    slug: "quoting-vs-vident-av",
    title: "Quoting vs Vident AV — which quote tool?",
    body: `The Hub has two quote paths on purpose. Pick the one that matches the job — do not rebuild the same package in both.

Use Quoting (/quoting) when you are pricing Wedding & Social, Corporate service, Golf, or Office packages that are not primarily rental gear. Build list vs quoted lines, use department pricing notes, get discount approval if needed, Mark ready, then turn it into a branded Proposal PDF (/proposals) and paste the Drive link into HoneyBook when that job lives in CRM.

Use Vident AV Estimates (/rentals/quotes) when the job needs catalog gear/services, warehouse holds, check-out/check-in, crew day rates, Hub invoices, customer e-sign estimates/contracts, or Stripe pay links. Venue Quotes (/venue-quotes) public portals Create Hub quote into this same Vident AV path.

Corporate producers often use both in one week: Quoting for talent/service packages, Vident AV for room AV gear. Wedding coordinators usually stay on Quoting + HoneyBook for sales, and Event Packets for day-of wrap-up. Ask “When should I use Quoting vs Vident AV?” on Ask the Hub after Rebuild index.`,
  },
  {
    slug: "quoting",
    title: "Quoting — pricing notes and discount approval",
    body: `Quoting (/quoting) helps staff build event/service quotes with list vs quoted pricing, plus editable department pricing notes/checklists.

Who can use it: any signed-in staffer (not guests). Admins see everyone’s quotes and review discount requests.

Pricing notes: on /quoting, add checklist or rate guidance by department (General, Audiovisual, Corporate, Wedding & Social, Golf, Office). Notes are editable by staff and show on the quote detail page for that department. Wedding & Social includes starter notes (ceremony/cocktail, reception timeline, deposit/terms) after migration 158 — edit them anytime.

Quotes: create a quote (client, event, date, department), then add line items with quantity, list/standard unit price, and quoted unit price. The Hub flags any line or the total that is more than 20% below list. You cannot Mark ready until pricing is within 20% or an admin approves the discount. Request approval with an optional reason; the quote locks for the requester while pending. Admins Approve or Deny from /quoting or the quote page — approve marks the quote ready; deny returns it to Denied so you can revise. Editing lines after Ready/Denied returns the quote to Draft.

When to use Quoting vs Vident AV: Quoting is for Wedding & Social, Corporate service, Golf, and other non-rental packages that become branded Proposals. Vident AV Estimates (/rentals/quotes) is for gear catalog lines, warehouse holds, crew day rates, Hub invoices, and Stripe pay links. Venue Quotes can Create Hub quote into Vident AV. See the “Quoting vs Vident AV” guide for the same decision tree.

Separate from Vident AV Estimates (/rentals/quotes), the Hub rental opportunity editor. Needs migration 122_quoting.sql (and 158 for Wedding defaults). After deploy, Rebuild index on Ask the Hub. Ready quotes can become branded Proposals (/proposals).`,
  },
  {
    slug: "proposals",
    title: "Proposals — branded PDF, Drive, HoneyBook link",
    body: `Proposals (/proposals) turn a Ready quote into a branded Vident PDF.

Who can use it: any signed-in staffer (not guests). Create from a Ready quote on /proposals or via Create proposal PDF on the quote page. Edit title, intro, notes, and client/event details, then Download PDF.

Google Drive: when the Hub service account is configured, Upload to Drive saves the PDF under Proposals / {client} / {event} in the company Drive root. Copy the Drive link to attach it in HoneyBook.

HoneyBook: the Hub has inbound Zapier CRM only (no HoneyBook file-upload API). Admins can Search HoneyBook projects and Write Drive link on HoneyBook project — that appends the PDF link into the mirrored project’s details in the Hub. Staff can still copy the Drive link and paste it into HoneyBook themselves.

Needs migration 123_proposals.sql plus Drive credentials for upload. After deploy, Rebuild index on Ask the Hub.`,
  },
  {
    slug: "announcements",
    title: "Announcements — company notices",
    body: `Announcements are company updates and notices. Admins and trainers post them; everyone else reads them.

Posting (admins/trainers): give it a title and body, optionally tick “Require acknowledgement,” and optionally set an expiry date. When you post, every active staffer gets a notification. If you required acknowledgement, you can see how many people have acknowledged (admins).

Reading (everyone): active announcements appear at the top of Home and on the Announcements page. If an announcement requires acknowledgement, click Acknowledge to confirm you’ve read it. Expired announcements drop off the Home banner but stay on the Announcements page.`,
  },
  {
    slug: "kudos",
    title: "Kudos — peer recognition",
    body: `Kudos let anyone on the team recognize a teammate for great work.

Give kudos: pick a teammate, optionally tag a company value (Integrity, Gratitude, or Teamwork), and write a short message. The person you recognize gets a notification. You can’t give kudos to yourself.

Everyone can see the kudos feed. You can delete a kudo you gave; admins can delete any.`,
  },
  {
    slug: "winners",
    title: "Winners — Hub points Hall of Fame",
    body: `Winners is the Hall of Fame for monthly Hub points trophies.

Current winners shows this month’s leaders at a glance. Overall Leader has the most total points. Monthly MVP earned the most that month. History lists every past month, newest first. Hub points tips shows you how to earn more.`,
  },
  {
    slug: "my-calendar",
    title: "My Calendar — Hub events in your phone",
    body: `My Calendar puts your Hub events in your own phone calendar.

Copy your private link, then paste it into your calendar app. Or tap Add to Apple Calendar, or Add to Google Calendar. Keep the link private. If it’s ever shared, Reset link makes a new one.`,
  },
  {
    slug: "forum",
    title: "Forum — questions and wins",
    body: `The Forum is where the team asks questions and shares wins.

Pick a category on the left to focus the conversation. Sort with Active, Newest, Unanswered, Following, or Mine. Tap New discussion to start a thread.`,
  },
  {
    slug: "meetings",
    title: "Meetings — transcripts to action items",
    body: `Meetings turns a transcript into a summary, a score, and action items. It is for admins and trainers.

Tap Add meeting and paste in a transcript. Use the tabs for the Dashboard, All Meetings, and Action Items. The top cards track quality score, meetings analyzed, and open or overdue action items.`,
  },
  {
    slug: "pebbles-and-rocks",
    title: "Pebbles and Rocks — quarterly priorities",
    body: `Pebbles and Rocks tracks your quarterly priorities.

Rocks are the big goals for the quarter. Pebbles are the small steps that move a rock forward. Choose the year and the board at the top.`,
  },
  {
    slug: "marketing-library",
    title: "Marketing Library — links and videos to share",
    body: `Marketing Library keeps links and videos you can share with clients.

Reviews holds Google review links to send clients. Photo Library holds event gallery links. Video Library holds highlight reels. Filter by category. Use Add link or Add video to add your own.`,
  },
  {
    slug: "video-archives",
    title: "Video Archives — recordings in one place",
    body: `Video Archives keeps training, meeting, and event recordings in one place.

Search by title, description, or tag. Narrow the list by year, category, presenter, or topic. Add a video yourself, or import a recording from Zoom.`,
  },
  {
    slug: "sms-portal",
    title: "SMS Portal — text and email staff and clients (admin)",
    body: `The SMS Portal is where admins text and email staff and clients. It is admin-only.

Send a single text, a bulk text, or a bulk email. Texting needs Twilio connected. Bulk email works without it. Conversations show on the left. Pick one to read the messages.`,
  },
  {
    slug: "communications",
    title: "Communications — how the Hub reaches staff (admin)",
    body: `Communications shows how the Hub reaches your staff. It is admin-only.

Push, email, and text each show whether they are connected. Use the test center to send yourself a push, an email, or a text.`,
  },
  {
    slug: "onboarding",
    title: "Onboarding — new-hire checklists (admin)",
    body: `Onboarding helps admins get a new hire set up. It is admin-only.

Start an onboarding: enter the new hire’s name, optionally a role and start date, and optionally link an existing profile. Creating it seeds a standard checklist across Accounts & access, Equipment, Paperwork, Training, and Other.

Hiring handoff: when you move a candidate to Hired on Hiring, the Hub auto-creates an onboarding plan for that candidate (idempotent — one plan per candidate). If the candidate has an email, the Hub invites them (or links an existing profile) and attaches the plan so they can check items off themselves. You’ll get a prompt to open Onboarding. Needs migrations 065 and 066.

Track it: open a plan to check items off (with a live progress bar), add custom tasks, or remove ones that don’t apply. Mark a plan complete, reopen it, archive it, or delete it. Use “Show archived” to see finished ones. Linked new hires see only their own checklist on Onboarding and For You.`,
  },
  {
    slug: "reports",
    title: "Reports — admin snapshot",
    body: `Reports is an admin-only, read-only dashboard that aggregates the hub.

It shows stat cards for active headcount, pending-expense dollars and count, dollars awaiting reimbursement, dollars reimbursed this month, upcoming approved time off, and open tasks in Action Center. Below that it charts headcount by department, the hiring pipeline by stage, and this month’s expenses by category. It’s all computed live from existing data — there’s nothing to edit.`,
  },
  {
    slug: "hub-switcher",
    title: "Hub switcher — jump between company hubs",
    body: `The four-square button at the top of the Hub (between View as staff and the theme button) opens the hub switcher: a small panel with a logo tile for each company hub (Vident, Y? Entertainment, High Five Guys, AI Growth Curve). Click a tile to open that hub. Hubs that are not built yet show Coming soon, and the hub you are in is marked You are here.

Who sees what: admins see every hub that is switched on. Everyone else only sees the tiles an admin ticked for them. If nobody ticked a hub for you, the button just takes you Home.

Admins manage it at Hub switcher (/hub-switcher, Admin group in the sidebar): edit each hub's name, link and logo, switch a tile on or off, and tick which people see which hub. Leave a link empty to show Coming soon. Logos load from /hub-logos/<hub>.png unless a logo link is entered.

Good to know: each hub has its own accounts and its own login. A tick here only shows the tile; the person still needs an account in the other hub, and that hub decides whether they get in. Each hub's admins manage their own switcher. Needs migration 190_hub_switcher.sql.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "hub-health",
    title: "Hub health — admin ops checklist",
    body: `Hub health (/hub-health) is an admin-only checklist for keeping the Hub operational.

It shows present/missing status (never secret values) for the company iCal feed, CRON_SECRET + service role, OpenAI, image generation (GEMINI_API_KEY / Higgsfield HF_API_KEY + HF_API_SECRET), Resend/email (RESEND_API_KEY + EMAIL_FROM), social API publish credentials, YouTube, Google Drive, event-media storage, Vident AV migrations (140+, 144, 145, 146 credits, 147 crew→labor costs), whether retired CURRENT_RMS_* env vars are still set, and whether the Ask the Hub Vident AV guide looks freshly indexed. Confirm new migrations show Ready in production after running the SQL. Rebuild index on Ask the Hub after feature-guide or Resource changes.

Use it after deploys or when Calendar, quizzes, receipts, email, integrations, or auto-publish look broken.`,
  },
  {
    slug: "polls",
    title: "Polls — quick team polls",
    body: `Polls are quick team questions with instant results.

Voting (everyone): tap an option to cast your vote; you can change it while the poll is open. Results show as live bars with counts and percentages, and your own choice is marked. Your individual vote is private — only the totals are shown, never who voted for what.

Creating (admins/trainers): add a question and two to ten options, then Create. You can close a poll (locks voting), reopen it, or delete it. Closed polls show final results, read-only.`,
  },
  {
    slug: "notification-preferences",
    title: "Notification preferences — control your alerts",
    body: `From the Notifications page, open Preferences to choose which in-app (bell) notifications you receive. Turning a type off stops new alerts of that kind from appearing.

Notifications from admins are always on and can’t be turned off by staff — that includes Announcements, time-off and expense approve/deny outcomes, shared performance reviews, and task assignments. Staff can mute optional types like Kudos. Admins can manage all of their own.

This controls in-app notifications only; email notifications, where enabled, are separate. A daily Field digest cron (/api/cron/send-field-digest) emails staff with actionable For You items when Resend is configured.`,
  },
  {
    slug: "hiring",
    title: "Hiring — jobs, pipeline, and Hub invites",
    body: `Hiring is an admin-only CRM for openings and candidates.

Job openings: create roles with a title, department (Audiovisual, Corporate, Wedding & Social, Golf, Office), and optional description. Close or reopen openings; deleting an opening leaves candidates but clears the job link.

Pipeline stages: Applied → Screening → Interview → Offer → Hired / Rejected. Add candidates manually with name, email, phone, opening, stage, and notes. Move stages from the card or edit form.

Hired → onboarding: moving a candidate to Hired creates an onboarding plan (one per candidate). If they have an email, the Hub invites them (or links an existing profile) and attaches the plan so they can check items off. You’ll get a prompt to open Onboarding. Needs migrations 065 and 066.

Public applications: anyone can open /apply (no login). Featured tracks — Audiovisual, Corporate, Wedding & Social, and Golf — each include a short multiple-choice working-style assessment (real on-site scenarios). Office and other roles use the general form at /apply/general. Applications land under Public applications on Hiring (answers shown when present). Promote to candidate creates an Applied-stage candidate (optional opening link). Reject or archive applications you won’t pursue. Needs migrations 067_hiring_applications.sql and 125_hiring_assessment_answers.sql.`,
  },
  {
    slug: "staffing",
    title: "Staffing — coverage board (admins & Leads)",
    body: `Staffing (/staffing) is a coverage board for admins and Leads (trainer role). Default horizon is 28 days (switch to 14 or 42, or step by week).

Rule: active staff default to Available for each day unless they are on Hub time off or a calendar-feed scheduled day off that day. They do not need to set a weekly availability pattern on Time Off to appear available.

Editable: admins and Leads can mark someone Unavailable on a day from the Available list. That creates an approved Hub unavailable row for that date and immediately moves them to Time off (superseding the default-available rule). Single-day Hub marks can be cleared from Staffing with Clear Hub; multi-day Hub requests are edited on Time Off, and feed day-off rows in the scheduling system that publishes the feed.

For each day it shows: who is available under that rule, who is on time off, company calendar event load when the company iCal is configured, AV quotation/order jobs that still need confirmed crew (Needs crew), and a link to AV Crew bookings for that date (/rentals/crew?date=…).

Needs crew: open Vident AV quotes in Quotation or Order status whose gear window overlaps the day and that have zero confirmed crew bookings. Links open Crew for that quote. Draft and Closed quotes are ignored. Admins and Leads also see a For You section “Jobs needing crew” for the next 14 days.

Time off merges two sources and shows each person once per day: (1) approved Hub requests from Time Off, and (2) “Scheduled Day Off” rows from the company iCal when that feed includes Time Off. Those absences are used on Staffing only — they are not shown on the Hub Calendar. Rows are matched to People by name. If the same absence exists in both, Staffing shows one line labeled Hub + Feed (Hub type wins). Unmatched feed names are counted in a warning so you can fix naming.

Use it with Time Off, Calendar, and AV Crew when scheduling field coverage. Staff still request Hub time off on Time Off; the scheduling system that publishes the feed remains the system of record for absences entered there. Needs migration 158_lanes_packet_hb_staffing.sql for Lead write access.`,
  },
  {
    slug: "content-sla",
    title: "Content SLA — post-event media follow-through",
    body: `Content SLA (/content-sla) is for admins and trainers (Field tools).

It lists Event Packets from about the last 21 days with event date, hours since the event, whether media was uploaded, social consent, packet status, and a rollup of Marketing Queue draft statuses (draft / ready / pending / posted). Links open the packet, Marketing Queue, and Social Studio.

Use it to catch missing media, missing consent, or stalled drafts after events.`,
  },
  {
    slug: "scheduling",
    title: "Scheduling — booking links for client calls",
    body: `Scheduling (/scheduling, under Tools, Quotes & Proposals) lets clients book a call with you from a link, like Calendly.

Admins and Leads: click New booking page, name it (for example Free planning call), choose the link name, call length, buffer between calls, minimum notice, how far ahead people can book, where it happens (phone, Zoom link, address), the time zone, and your hours for each day (24-hour format like 09:00-12:00, 13:00-17:00; blank means a day off). Save, then Copy link and send it. The page is /book/<link name> and needs no sign-in.

Clients pick a day and an open time, enter their name and email, and confirm. Times you already have booked, plus the buffer, are never offered. The client gets a confirmation with a calendar invite and a cancel link; you get an email with the invite too. If the client's email matches someone in HoneyBook, the booking is noted on their latest project. Upcoming bookings are listed on the Scheduling page, where admins and Leads can cancel one (contact the client yourself, since that cancel does not email them). Needs migration 181_meeting_scheduler.sql and email set up (RESEND_API_KEY, EMAIL_FROM). This checks the Hub's own bookings only, not your Google Calendar, so set your hours around anything else you have.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "honeybook-archive",
    title: "HoneyBook archive and backup — keep your history in the Hub",
    body: `On the HoneyBook page, admins and Leads can click Archive and backup. Step 1 is for documents: download your signed contracts, invoices and proposals from HoneyBook as PDFs, then drop them all on the page. The Hub guesses the project from the file name (for example a file named Smith Wedding Signed Contract matches the Smith Wedding project) and the document type. Anything it is unsure about is marked as a best guess, and anything it cannot match asks you to choose the project. Check each line, fix any wrong ones, and click Upload. Filed documents then appear on each project under Archived HoneyBook documents, where you can open or remove them.

Step 2 is for admins: download spreadsheet (CSV) backups of projects, clients, payments, invoices, contracts, and notes. They include money and client details, so keep them somewhere private. Files up to 12 MB each; PDFs, images, Word, Excel, CSV and text are accepted. Needs migration 184_honeybook_archive.sql.`,
  },
  {
    slug: "quickbooks-sync",
    title: "QuickBooks sync — send Hub invoices and payments to QuickBooks",
    body: `Admins only. On the HoneyBook page click QuickBooks sync. First time: click Connect QuickBooks and sign in with the QuickBooks account that owns your books. The page shows Test (sandbox) until the site is switched to live books, so a first connect never touches real data. After that, the Waiting to sync list shows every sent Hub invoice (and any new payments) that QuickBooks does not have yet. Click Sync on one, or Sync all. Each invoice becomes a QuickBooks invoice for the client (the client is created if missing) and each payment is recorded against it. If one fails, the reason shows on the invoice and you can try again. Disconnect any time; what is already in QuickBooks stays. Needs migration 185_quickbooks_sync.sql and the QuickBooks keys in Vercel.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "client-portal",
    title: "Client portal — one link for everything on a project",
    body: `Each HoneyBook project has a private client link (the same one used for the planning questionnaire and file uploads). It is now a full client portal. At the top, a Needs your attention box lists what the client still has to do: contracts waiting for a signature and invoices with a balance (marked past due when an installment is late). Below it the client sees their contracts, invoices, any floor plans you have published, and your booking links for a call, plus the project details, questionnaire and file uploads.

To use it: open the project, make sure the client link is switched on, then use Email client and pick Send the client portal link. Only things that have been sent show up: drafts, void invoices and unpublished floor plans stay hidden. Booking links shown are all your active pages in Scheduling. No sign-in is needed, so treat the link like a key and send it only to the client.`,
  },
  {
    slug: "project-contracts",
    title: "Project contracts — e-sign from a HoneyBook project",
    body: `Every HoneyBook project page has a Contracts box. Admins and Leads pick one of the three Vident templates and click New contract: Services Agreement - DMC (non-AV) for event coordination, AV Agreement - Audio Visual only for AV rentals and services, or Services and AV Agreement - DMC plus AV when one client books both (it has general terms in Part A and AV terms in Part B). The client's name, email, phone and address, the event name, date and location, plus the fees, services and payment schedule from the project's latest invoice, are filled in for you, so build the invoice first. Anything missing shows as "to be confirmed". Click Edit wording to change anything, or Save as template to keep your edited version for next time.

Send for signature emails the client a link to /sign/<code>. They read the agreement and sign by drawing with a finger or mouse; no account is needed. Once sent, the wording is locked. If it needs changing, Void it and make a new one. When the client signs, the contract shows Signed, a signed PDF (with the signature, time, IP address and a document fingerprint) is saved on the project and emailed to the client and to whoever made the contract, and the project's trail records it. Use Signed PDF any time to download it.

The signing page and the PDF carry the Vident logo and layout. The wording is Vident's existing DMC and AV contracts; have your attorney review the combined version before first use. Needs migrations 183_project_contracts.sql and 186_standard_contract_templates.sql, and email set up (RESEND_API_KEY, EMAIL_FROM).`,
  },
  {
    slug: "project-invoices",
    title: "Project invoices — bill a client and take payment",
    body: `Every HoneyBook project page has an Invoices box. Admins and Leads can click New invoice and build it in sections. Use Add section, rename a section by clicking its name, and use the arrows to move a section or an item up or down. Each item has a Move to menu to send it to another section. To add items, search the Services Catalog by name, narrow by category, pick which section it goes in, and click Add (or type a line yourself). Set a tax rate if needed, and choose a payment plan: 50% retainer with the balance due 14 days before the event, pay in full, or three equal payments 30 days apart. The total and the schedule always add up to the cent.

Save keeps it as a draft that only staff can see. Click Send to email the client a link to /pay/<code>; the invoice then shows as Sent. The client sees each section with its total and the items by name and quantity (no per-item prices), the schedule, and a Pay button that opens Stripe Checkout for the next amount due, so they pay the retainer first and the balance later from the same link. Paid online amounts are recorded automatically and the project's trail notes it. For checks, cash, Venmo or Zelle, click Record payment and enter the amount and date. Status moves from Sent to Partial to Paid on its own.

Invoices can be edited until a payment is recorded. After that, or once it has been sent, Void it (the link stops working) and make a new one. Only drafts can be deleted. Download invoice PDF and Download receipt PDF (after a payment) give a branded Event Invoice or Event Receipt. Sections need migration 188_service_categories_invoice_sections.sql. Needs migration 182_project_invoices.sql, plus Stripe set up (STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET with the checkout.session.completed event) and email set up (RESEND_API_KEY, EMAIL_FROM). This is separate from the Vident AV invoices.`,
  },
  {
    slug: "services-catalog",
    title: "Services Catalog — saved services and prices",
    body: `The Services Catalog (/services, under Tools, Quotes & Proposals) is the Hub's version of HoneyBook's saved services: 134 items with prices, grouped into Planning & coordination, Transportation & delivery, Event rentals, Kitchen & serving, Golf & tournament events, Decor & signage, Experiences & production, and Other.

Everyone on staff can search it by name, description, or category. Admins and Leads can add a service, edit its name, description, category and price, and archive one (archived items are hidden unless you tick Show archived). The first time, an admin or Lead clicks Import from HoneyBook to load the list; running it again only adds items that are missing. Categories were assigned automatically, so change any that look wrong. Admins and Leads can also click Categories to add their own (for example DMC categories), rename one (its items move with it), or delete one that no item uses; the item form has a + New category option too. Custom categories need migration 188_service_categories_invoice_sections.sql. Needs migration 180_service_catalog.sql.

You can also drop catalog items onto a Vident AV estimate: in the estimate's item picker, set Type to HoneyBook services (or use the HoneyBook service box), choose a category and an item, and click Add line. Rental categories (Event rentals, Kitchen & serving) come in as rental lines and everything else as sale lines; change the kind on the line if needed. Admins and Leads can use Edit this catalog item under the pick to change the name, price or category, or choose + New category, and the change is saved to the catalog for every estimate and invoice.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "floor-plans",
    title: "Floor Plans — room layouts for projects",
    body: `Floor Plans (/floor-plans, under Tools, Quotes & Proposals) is a drawing tool for laying out a room: tables and chairs, stage, dance floor, bar, screens, LED wall, speakers, truss, FOH position, cameras and more. Everything is drawn in feet.

Who can use it: admins, Leads, and staff can open it. Admins and Leads can edit any plan and build templates. Staff can create and edit plans on projects they are assigned to; everyone else can view.

Start a plan: open a HoneyBook project (/honeybook/projects/<id>), find the Floor plans section, optionally pick a template, and click New floor plan. Plans autosave a moment after each change.

Build the layout: click an item in the left list to add it, then drag it into place (it snaps to half a foot). Shift-click to select several. Use the right panel to set the label, width, depth, rotation, color, and the number of seats at a table (chairs are drawn for you). Arrow keys nudge, Ctrl or Command with Z undoes, Delete removes. Duplicate, Bring forward, Send back, and Lock are in the same panel. Room width and length, and a 5 ft grid, are set under Room.

Blueprint: upload a PNG, JPG or WebP image of the venue's plan (for a PDF, screenshot or export the page as an image first). Click Set scale, click two points on the plan whose real distance you know, type that distance in feet, and Apply scale. After that, items are placed at true size on top of it. Opacity controls how faint it looks.

Share and print: Preview shows the plan without editing handles. Publish to client creates a link (/floorplan/<token>) that works without signing in and shows the plan, the blueprint, and a count of what is on it; Unpublish turns the link off. PDF downloads a one-page landscape print with the contents list.

Templates: admins and Leads click Save as template on a project plan to reuse the layout (the blueprint image is not copied), or build one from Floor Plans, New template. Pick a template when you start a new plan on a project. Needs migration 178_floor_plans.sql.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "honeybook",
    title: "HoneyBook — clients, projects, and payments",
    body: `HoneyBook (/honeybook) is a CRM mirror of your HoneyBook account for admins and Leads (trainer). HoneyBook has no public API the Hub can call directly, so data arrives through Zapier webhooks (and optional CSV import for history).

Who can use it: admins, Leads, and staff. Admins and Leads create/edit/delete clients and projects and share client links. Admins assign one project lead plus support staff on Board cards or the project page. Only admins and people assigned to a project can edit or move that card; everyone else is view-only. Assigned staff can request adding support (admin approves via notification + For You). Shared project links also let clients fill a planning questionnaire and upload files. Sync is one-way: Zapier pushes HoneyBook → Hub. HoneyBook has no public API, so Hub stage/assignee edits do not update HoneyBook. Zapier setup, CSV import, and webhook activity stay admin-only. Needs migrations 159–166.

What you see: Overview (counts + projects by stage; assignment approval queue for admins; admins also see webhook activity), Projects with Board (a My projects / Everyone switch above the board shows only the projects you are lead or support on, or everyone's; staff start on My projects, admins on Everyone, and the choice is remembered on that device; with Everyone selected, admins get a people menu to see one person's projects or the unassigned ones, and anyone can click the unassigned count to find projects nobody is on yet; click a card to open it; assign on cards; drag stage column headers to reorder — saved in this browser; kanban colored by assignee Team color) or List (Open / assignees / files), project detail at /honeybook/projects/<id>, Clients, Payments, and (admins) Zapier setup. Client share pages live at /project/<token> (details view-only + questionnaire + file uploads).

Going forward: create Zaps for Project Stage Changed (most important — covers all statuses), New Project Booked, Client Created / New Inquiry, New Payment Paid, and Task Created/Updated/Completed. Each Zap POSTs JSON to /api/webhooks/honeybook with Authorization: Bearer <HONEYBOOK_WEBHOOK_SECRET>. Map client and project fields (and payment/task fields for those triggers). Include project/client/task external IDs when Zapier exposes them so updates upsert instead of duplicating. Task assignee email must match a Hub People email so the task appears on that person’s My Week.

Website inquiries: finished website Inquiry Forms (Tools, Quotes & Proposals, Inquiry Forms, admin-only) add a project at stage Inquiry with a Website badge (source web_form), the same way Hub-created projects show a Hub badge. They exist in the Hub only and are not sent to HoneyBook.

Email automations: admins click Email automations at the top of HoneyBook (/honeybook/automations) to turn on emails the Hub sends once a day: a thank you and review request (default 3 days after the event), a check-in (default 90 days after the event), and a proposal nudge (default 5 days after a project enters Proposal Sent). Each starts Off. Each client gets each email once, only for projects that became due in the last 14 days (so switching one on never emails old events), at most 25 per automation per day, and only to booked projects with a client email. Edit the subject, message, and timing on the page; Preview shows who would get an email today without sending. Each send is saved in Notes and trail; replies go to hello@videntproductions.com (or AUTOMATION_REPLY_TO). Needs migration 179_honeybook_automations.sql, RESEND_API_KEY, EMAIL_FROM, SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET.

Sales reports: admins and Leads click Sales reports at the top of HoneyBook (/honeybook/reports) to see leads, booking rate (booked divided by booked plus lost), booked value, average days from inquiry to booked, and breakdowns by lead source, project type, and month. Booked means Retainer Paid, Paid in Full, or Completed. Partnerships are not counted. Lead source uses HoneyBook's own lead-source field when it came across, otherwise how the card was created (email, website form, Hub, import). Switch between last 90 days, last 12 months, and all time.

Email a client: every project page has an Email client box. Admins, Leads, and people assigned to the project click Write an email, optionally pick a template (new inquiry reply, proposal follow-up, contract reminder, planning details, thank you and review request), review the message, and press Send. The client's first name, project name, date, and your name are filled in for you. Replies go to your own email address, up to five recipients per send, and each send is saved as an Email entry in Notes and trail. Needs RESEND_API_KEY and EMAIL_FROM set in Vercel.

Notes and trail: every project page (/honeybook/projects/<id>) has a Notes and trail section. Admins and people assigned to the project can add notes, flag a note as needing action, and mark it done later. Everyone with HoneyBook access can read it. It is the handoff record, so write down what was discussed, promised, or changed. Needs migration 172_honeybook_gmail_inbox.sql.

Email monitoring (admin setup): when turned on, the Hub reads staff Gmail inboxes (read-only, @videntproductions.com people only) about every 10 minutes. A new email from someone outside Vident asking about an event creates a client and a project at stage Inquiry, assigns the person who received it as project lead, and adds a note plus a to-do to reply. Later emails to or from that client add short summary notes to the same project, record changes such as a new date or location, and flag anything that needs action. A date, location, or budget is only filled in when blank; if an email disagrees with what the project says, it becomes a to-do to confirm instead of overwriting anything. Leads that come through marketplaces such as GigSalad or The Knot are kept apart: each lead gets its own client and card, matched by email thread rather than by the marketplace's address. If the Hub makes a card from an email that was not a real inquiry (for example a vendor or partnership pitch), open the card and click Not a lead: the card is removed, that sender and email thread are skipped from then on, and the Hub learns from the example. The button shows only on cards made from email, to admins and the people assigned to the card. Needs migration 173_honeybook_gmail_not_leads.sql. A to-do that is already open on a card is never added again, and "check the inbox" style to-dos are not created. Automated mail, newsletters, and mail only between Vident staff are skipped, and email text is never stored, only the short summary note. Admin steps: a Google Workspace super admin authorizes the Hub service account for the read-only Gmail scope (domain-wide delegation), then set HONEYBOOK_GMAIL_ENABLED=true in Vercel. It also needs GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, OPENAI_API_KEY, and SUPABASE_SERVICE_ROLE_KEY. Optional: HONEYBOOK_GMAIL_MAILBOXES (comma list to limit who is read) and HONEYBOOK_GMAIL_LOOKBACK_DAYS (first run, default 3).

Daily update: each morning every person assigned to projects gets an email with their events, stage, latest note, and what needs doing next (open to-dos from notes, plus nudges such as an inquiry with no reply, a proposal or contract quiet for days, or an event date close with the project not yet booked). Admins get one combined email covering the whole team, unassigned inquiries, and any mailbox problems, instead of a copy of each person's email. Needs RESEND_API_KEY and EMAIL_FROM.

Duplicate cards and merging: when two cards look like the same event (same client with the same or a similar name, or the same name and date), both show a Possible duplicate chip on the Board and list. A card from email also gets a to-do note saying which card it may duplicate. Two cards with different dates are never flagged, so a yearly event is safe. When an admin or Lead creates a project by hand and a similar card already exists, the form warns first and offers Create anyway. To combine two cards, click the chip (or open a card and click Merge with…), pick the card to merge it with, choose which card to keep, and for each detail that differs choose which value to keep. The card you do not keep is archived, not deleted; its notes, client files, questionnaire answers (when the kept card has none), payments, tasks, proposals, event packets, email threads and assigned staff move onto the kept card (the kept card keeps its own project lead). An admin can open the archived card and click Undo merge to bring everything back. Only admins and Leads can merge. Needs migration 175_honeybook_merge_projects.sql.

Board columns: the board always shows Inquiry, Proposal Sent, Contract Sent, Retainer Paid, Paid in Full, Completed, and Lost in that order, even when a column is empty. The old Booked, In Progress, and Not Booked stages are gone; projects that were Not Booked were moved to Lost, and a Not Booked stage arriving from HoneyBook or a CSV import is filed under Lost. Any other stage name appears only while a project is in it. If you reordered columns before and a stage looks missing, click Reset column order to go back to the default order.

Historical data: Zapier only fires on new events. Export existing projects from HoneyBook (or a spreadsheet) and paste CSV on the Zapier setup tab (headers like Project Name, Project Stage, Client Full Name, Client Email).

Reports: admin Reports includes HoneyBook project counts, payments this month, and a stage breakdown once migration 111_honeybook_crm.sql is applied and data is synced. Needs HONEYBOOK_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY in the environment. HoneyBook tasks need migration 124_honeybook_tasks.sql.

Calendar: connect the HoneyBook→Google Calendar secret iCal URL on Calendar (team-wide) so everyone sees the live work feed. The Hub merges that feed with CRM projects from Zapier/CSV — matched events keep iCal times and use the CRM stage as status, plus client/type details. CRM projects with a Project Date that do not match an iCal event still appear on the calendar. HoneyBook does not provide a direct public iCal subscribe link; use Google’s secret ICS address.

Editing payments: admins click Edit on any row of the Payments tab to change its date, amount, client, project, or note, then Save. Refunds can be entered as negative amounts. Edits stay in the Hub (HoneyBook is a one-way sync) and show up on the project page and Reports.

Payments needing a project: admins see a Needs review box at the top of the Payments tab (and a count on the tab and the Overview) listing payments that are not linked to a project. For each one the Hub suggests up to three likely projects, with the reasons (same name, same client, event date near the payment). Approve links the payment to that project, Reject hides that wrong guess, Pick another project lets you choose any project yourself, and No project for this payment takes it out of the list. Nothing is linked until an admin approves it. New payments from Zapier that do not match a project land here automatically.

Partnerships: the Partnerships tab (/honeybook?tab=partnerships) tracks venue, vendor, and other partner deals that are not events. It has its own five columns: Prospect, In Talks, Agreement Sent, Active Partner, and Not Moving Forward. Partnership cards are always gold with a Partnership badge, whoever is assigned. Admins and Leads add one with New partnership (pick Venue, Vendor, or Other). Assign a lead and support staff the same way as on events; admins and the people assigned can edit details, move the stage, and add notes and to-dos. Everyone with HoneyBook access can see partnerships, but money details (deal value and financial notes) are visible to admins only; staff see a blurred placeholder. Partnerships do not count in event totals, the Calendar, or event-date nudges. Open to-dos on a partnership appear in the daily update emails, and admins also see partnerships with open to-dos that nobody is assigned to. Partnerships are created in the Hub only, not from HoneyBook. Needs migration 177_honeybook_partnerships.sql.

Calendar staff: staff assigned on a HoneyBook board card (lead and support) now also show as Assigned Staff on that event in the Calendar, so you only assign once. Admins and Leads can still add more people from the Calendar event itself.

A short how-to video is linked at the top of the page: click Watch how-to video, watch it, then close it.`,
  },
  {
    slug: "av-event-portals",
    title: "AV Event Portals — client planning links for AV shows",
    body: `AV Event Portals (sidebar, path /av-portals) gives every booked AV show one private link the client uses to send everything we need before load-in.

Who can use it: admins and anyone in the Audiovisual department. Clients never log in; the link itself is the key, so share it only with the client.

How it works: click New event portal, enter the event name, date, client name and email (plus optional CC emails, venue, load-in time and a note), and create it. The client's portal lists six items: floor plan or room diagram, event timeline / run of show, final headcount, day-of contact (name and cell), load-in / dock / parking, and presentation files. Uploads are matched to an item by file name (for example "Gala run of show.pdf" lands on Run of show); anything the hub cannot place goes under Anything else, where the client can move it to the right item. Files can be up to 50 MB each.

Emails: the hub sends a check-in automatically at 30, 14, 7 and 3 days before the show, listing only what is still missing. A show booked inside a window gets one catch-up check-in. When all six items are in, the client gets a thank-you and no more check-ins, and the person who created the portal gets a notification. Send check-in now sends one on demand.

Readiness: the list shows items received out of six for every show. Open a show to see the cue sheet, download the files, see which emails went out, edit details, pause the portal, or delete it.

Gotchas: pausing a portal stops emails and blocks uploads. Changing the event date moves the schedule. The client email needs RESEND_API_KEY and EMAIL_FROM set in Vercel. Replying to a check-in email with attachments is not read by the hub; clients should use the portal button.`,
  },
  {
    slug: "holiday-themes",
    title: "Holiday themes — the Hub dresses up for 16 holidays",
    body: `On 16 holidays the whole Hub changes into a full-screen holiday theme: a photo-style backdrop fills the screen behind the menu and pages, the colors of the sidebar, top bar and cards match the holiday, the motto bar shows a holiday line, and Home opens with a holiday greeting plus a short splash that fades after a few seconds (once per holiday per browser). The Vident logo stays; it is only tinted to match the theme.

The holidays (dates use New York time so the whole team sees the same day): New Year's Day (Jan 1), Martin Luther King Jr. Day (3rd Monday of January), Valentine's Day (Feb 14), St. Patrick's Day (Mar 17), Easter Sunday, Cinco de Mayo (May 5), Mother's Day (2nd Sunday of May), Memorial Day (last Monday of May), Father's Day (3rd Sunday of June), Independence Day (July 4), Halloween (Oct 31), Veterans Day (Nov 11), Thanksgiving (4th Thursday of November), Christmas Eve (Dec 24), Christmas Day (Dec 25) and New Year's Eve (Dec 31).

Guests never see holiday themes. Staff and trainers get the real holiday on the real day, and there is nothing to turn on: the Hub switches by itself at midnight New York time.

Admins can preview any holiday on any day by adding ?holiday= and the holiday name to a Hub address, for example ?holiday=halloween, ?holiday=christmas-eve, ?holiday=independence-day. Add &holidayPopup=1 to replay the Home splash. Names: new-years-day, mlk-day, valentines-day, st-patricks-day, easter-sunday, cinco-de-mayo, mothers-day, memorial-day, fathers-day, independence-day, halloween, veterans-day, thanksgiving, christmas-eve, christmas-day, new-years-eve. Admins can also open Hub health, find the Holiday themes card, and click any holiday to preview it across the whole Hub for their own admin session (click it again or press Turn preview off to stop). Staff never see the preview.`,
  },
  {
    slug: "whats-new-changelog",
    title: "What's New — the hub changelog",
    body: `What's New (under Tools, path /changelog) is the hub's running changelog: every change, fix, new feature, and removal, listed newest first in plain English.

Who can use it: all staff. Guests do not see it.

Each entry shows a category chip (New, Improved, Fixed, or Removed), the module it affects, a short description, and — when a change needs explaining — a "How to use it" note.

The What's New link in the sidebar shows a NEW tag whenever there are entries you haven't seen on this device. Opening the page clears the tag until the next change ships. On the Tools page, any tool that is new or was updated since the last time you were on the Hub has its own red NEW tag next to its name; it clears once you open that tool on this device.

Entries are added automatically as part of every hub update, so the page is always current — there is nothing to maintain manually. If you spot something that changed but isn't listed, post it in the Forum's Hub Bugs topic.

Change Log Videos: each month has a short What's New video above its entries (press play, then read the details below). The Change Log Videos button at the top lists every video in one place. When a newer video covers the same changes, the older one is hidden automatically. New team members see the videos from the two months before their start date onward. The Vident AV team and Leads also get a video on the changes only they can open. Needs migration 171_changelog_videos.sql.`,
  },
  {
    slug: "av-show-control",
    title: "AV Show Control — on-screen graphics for live AV shows",
    body: `AV Show Control (sidebar, path /av-show) runs the full-screen graphics, lower thirds and stage timer for a live show from one control page.

Who can use it: admins and anyone in the Audiovisual department. Everyone else sees Access restricted, and the nav link is hidden.

How it works: open the page and click Launch AV Show Control. In the control page click the three Open output buttons (full screen, lower third, stage timer), drag each window to its display, then double-click it for full screen. The full-screen window goes to the stage TVs or projector. The lower-third window is solid green so a video mixer (for example the Roland V-160HD) can key it over the camera. The stage timer goes to the presenter's confidence monitor.

Run of show: build the list of items (name, big line, second line, small line, lower-third label, planned minutes). Click an item to stage it and press Space or Take to send it live. Import a speaker CSV (name, title, company, session) to create a lower third for every speaker. Hotkeys: Space take, arrow keys change the staged item, Esc clear lower third, B back to logo, X panic blackout, T test patterns, S sponsor loop, L slideshow.

Also in the control page: a stage timer with quick messages (5 MIN, WRAP UP and so on), a sponsor loop with an airtime log you can export as a CSV for the sponsor, backgrounds and a full-screen slideshow from your own images and videos, a printable cue sheet, three lower-third styles (bar, slim, ticker), auto-advance when an item's timer reaches zero, and show file export and import.

Gotchas: keep the control page and the three output windows in the same Chrome window group on one computer. Shows, logos and media are saved in that browser, so export the show file before an event as a backup and keep the computer awake and plugged in. Use Test patterns (T) the day before to line up the green key. Avoid pure green in lower-third colors because it keys out.

Phone / Stream Deck remote (Hub): on the control page click Start Hub remote to get a PIN (session shows time left; Extend session adds another ~12 hours). On a phone open /av-show/remote (no login) and enter the PIN — Panic is highlighted, timer supports custom minutes / ±1, and you can Take by item. Stream Deck / Bitfocus Companion can HTTP GET /api/av-show/cmd?pin=PIN&c=takestaged (and other commands: take, stage, next, prev, clearlt, logo, panic, test, loop, slideshow, tmmsg, tmclear, tmstart, tmstop, tmplus, tmminus). Use Open all three to launch the output windows together. Keep the control page open while the remote is in use. Needs migrations 156_invoice_pay_catalog_show_remote.sql and 157_venue_catalog_invoice_reminders.sql.`,
  },
];
