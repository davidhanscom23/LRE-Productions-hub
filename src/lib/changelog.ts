/**
 * Hub changelog ("What's New").
 *
 * REQUIRED for every user-facing change (see AGENTS.md): whoever ships a
 * change adds an entry here IN THE SAME COMMIT. Newest entries first.
 * Write for staff, not developers: what changed, and how to use it if that
 * isn't obvious. Keep each entry to a sentence or two.
 */

export type ChangelogCategory = "new" | "improved" | "fixed" | "removed";

export type ChangelogEntry = {
  /** YYYY-MM-DD (deploy date) */
  date: string;
  category: ChangelogCategory;
  /** Module or area, e.g. "Forum", "Email", "Navigation" */
  area: string;
  title: string;
  /** Plain-English description of what changed. */
  description: string;
  /** Optional: how to use it, when not obvious. */
  howTo?: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-09",
    category: "new",
    area: "Vident AV",
    title: "Catalog shows where each item was last used",
    description:
      "Every item in the AV Catalog now shows the last event it went out to, who checked it out, and the date. It updates itself whenever someone checks the item out on a gear checklist.",
    howTo: "Open Catalog in Vident AV and look under the item name for Last out.",
  },
  {
    date: "2026-11-09",
    category: "new",
    area: "Gear checklist",
    title: "Yearly checklist history backup",
    description:
      "Every Dec 31 the hub saves the year's gear checklist history and photos to the Vident Hub Backup drive. The History list on a checklist now shows the last 90 days, and photos older than that are cleaned out once they are backed up.",
  },
  {
    date: "2026-11-09",
    category: "improved",
    area: "Gear checklist",
    title: "Gear checklist video now shows working offline",
    description:
      "The how-to video for the gear checklist has a new scene on using it with no signal, and what Waiting to sync means.",
  },
  {
    date: "2026-11-09",
    category: "new",
    area: "Gear checklist",
    title: "The gear checklist now works with no signal",
    description:
      "Open an event's gear checklist once, and you can reopen it at the warehouse or venue with no signal, keep checking gear out and in, and everything syncs by itself when the signal returns.",
    howTo:
      "Open the checklist while you have signal. If you go offline, a yellow banner appears and each change shows Waiting to sync. Tap Sync now to push changes early. Anything that cannot be saved shows under Needs attention.",
  },
  {
    date: "2026-11-09",
    category: "new",
    area: "Gear checklist",
    title: "How-to video for the event gear checklist",
    description:
      "A short video now walks through the gear checklist: checking gear out and back in, flagging damaged or missing items, adding extras, and setting the schedule.",
    howTo: "Open any event gear checklist and click Watch how-to video at the top of the page. It is also a lesson in the Training Portal.",
  },
  {
    date: "2026-11-10",
    category: "fixed",
    area: "Gear checklist",
    title: "Items added by hand now start as Our gear",
    description:
      "When you add an item to a gear checklist yourself, it now starts as Our gear instead of Client supplied. You can still change it on the line.",
  },
  {
    date: "2026-11-10",
    category: "new",
    area: "Gear checklist",
    title: "Alerts when gear is not fully checked after its scheduled time",
    description:
      "When the scheduled leave time or due-back time passes and the gear checklist is under 100%, the assigned staff and admins get a popup in the Hub, a notification, and a text message. Nothing is sent when everything is already checked.",
    howTo:
      "Set the leave and due-back times under Schedule on the gear checklist, and make sure your phone number is saved on your profile to get texts. Tap Open checklist on the popup to finish the check.",
  },
  {
    date: "2026-11-09",
    category: "improved",
    area: "Gear checklist",
    title: "Contacts, venue, load-in details and floor plans on the gear checklist",
    description:
      "The gear checklist now opens from the calendar card, the Event Packet and the event card. It shows who to call or email, the venue and room with a maps link, load-in details that stay with the venue, and the event's floor plans you can pinch to zoom. You can also add gear straight from the inventory list.",
    howTo:
      "Tap Gear checklist on a calendar card, Event Packet or event card. Under Event details, tap a phone number to call, tap the address for directions, and use Edit venue and load-in details to save dock, parking and power notes for next time.",
  },
  {
    date: "2026-11-08",
    category: "new",
    area: "Gear checklist",
    title: "Gear checklist for every event",
    description:
      "Every event now has a gear checklist with two progress bars: one for gear leaving the warehouse and one for gear coming back. The list follows the linked AV estimate by itself, and every check records who did it and when.",
    howTo:
      "On an AV estimate, pick the event under Event (for the gear checklist). Then open /event-checklist/<event> as someone assigned to the event, tap items to check them out, and tap Check back in when the gear returns.",
  },
  {
    date: "2026-11-08",
    category: "new",
    area: "Navigation",
    title: "Hub switcher in the top bar",
    description:
      "The four-square button at the top now opens a panel of company hub logos so you can jump between hubs in one click. Admins choose who sees each hub on the new Hub switcher page.",
    howTo:
      "Click the four-square button at the top and pick a hub. Admins: open Hub switcher in the sidebar to set links, logos and who can see each hub.",
  },
  {
    date: "2026-11-08",
    category: "new",
    area: "Vident AV",
    title: "HoneyBook services are now pick-list items on estimates",
    description:
      "When you build an estimate, you can now pick any saved HoneyBook service (rentals, DMC, golf and tournament items, transportation and more) right from the item picker, the same way you pick equipment and services. The name and price fill in for you and you can still change them on the line. Admins and Leads can edit a catalog item, move it to another category, or add a new category without leaving the estimate.",
    howTo:
      "On an estimate, open Find an item, set Type to HoneyBook services (or just use the HoneyBook service box), choose a category, pick the item, set the quantity and click Add line. Admins and Leads see an Edit this catalog item link under the pick to change its price, category, or add a new category.",
  },
  {
    date: "2026-11-08",
    category: "improved",
    area: "Estimates & Invoices",
    title: "Sections, search and category tools; customer copies show section totals",
    description:
      "Estimates and HoneyBook invoices can now be built in sections you rename and move, with items you can reorder or move between sections and a search picker. Customer copies show each section's total with item names and quantities only, no per-item prices. Documents are titled Event Estimate, Event Invoice, Event Receipt and Event Agreement. You can also create, rename and delete item categories (for DMC items, for example), and HoneyBook invoices have branded PDF and receipt downloads.",
    howTo:
      "On an estimate or a HoneyBook invoice, rename a section by clicking its name, use the arrows to move sections or items, and use Move to section on an item. Use Find an item to search by name or type. In the Services catalog, click Categories to add your own.",
  },
  {
    date: "2026-11-08",
    category: "improved",
    area: "Vident AV",
    title: "Branded estimates, invoices and receipts",
    description:
      "Estimates, invoices and the new receipt now use the same Vident look as the contracts: logo header, grouped items with subtotals, clear totals and a signature box. What used to be called a quote is now called an estimate throughout Vident AV.",
    howTo:
      "On an estimate, pick How this is billed: Direct (we bill the client, so the surcharge shows) or Venue partner (the venue pays us, so there is no surcharge row and the paperwork says the venue may add a service charge and taxes). It carries to the invoice. After a payment is recorded, click Download receipt PDF on the invoice.",
  },
  {
    date: "2026-11-08",
    category: "new",
    area: "HoneyBook",
    title: "Three Vident contracts, with a new look",
    description:
      "Contracts now come in three versions: AV only, DMC without AV, and DMC plus AV. They use your existing contract wording and fill in the client, event, fees, services and payment schedule from the project. The signing page and the PDF now carry the Vident logo and a cleaner layout. The old starter contract is gone.",
    howTo:
      "On a project, open Contracts, pick one of the three templates, press New contract, check the filled-in details, then Send for signature. Build the invoice first so the fees and services fill in.",
  },
  {
    date: "2026-11-07",
    category: "improved",
    area: "Scheduling",
    title: "Easier booking page: pick a day from a calendar",
    description:
      "Clients now choose a day from a pop-up calendar instead of typing it, and the booking and cancel pages are easier to read, with clear dark text on a light background.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Send Hub invoices and payments to QuickBooks",
    description:
      "Admins can connect QuickBooks Online and send invoices and the payments recorded against them across, so the books match without retyping.",
    howTo: "Admins: open HoneyBook, click QuickBooks sync, connect, then click Sync all.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Move HoneyBook history into the Hub and download backups",
    description:
      "A new Archive and backup page lets you drop in the contracts, invoices and proposals you downloaded from HoneyBook; the Hub matches each to its project from the file name. Admins can also download spreadsheet backups of projects, clients, payments, invoices, contracts and notes.",
    howTo:
      "On the HoneyBook page click Archive and backup. Choose your files, check the project each one matched to, and click Upload. Filed documents show on each project under Archived HoneyBook documents.",
  },
  {
    date: "2026-11-07",
    category: "improved",
    area: "HoneyBook",
    title: "One client page for signing, paying and planning",
    description:
      "The client's project link now shows everything in one place: contracts to sign, invoices to pay, floor plans you have published, and your booking links, with a Needs your attention box at the top. There is also a new Send the client portal link email template.",
    howTo:
      "On a project, make sure the client link is on, then use Email client and pick Send the client portal link.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Send contracts for e-signature from a project",
    description:
      "Project cards now have a Contracts box. Start from a template, edit the wording, and email the client a link to read and sign with their finger or mouse. A signed PDF is saved on the project and emailed to both of you.",
    howTo:
      "Open a project, scroll to Contracts, pick a template, click New contract, Edit wording, then Send for signature. Admins and Leads only. Have your attorney review the starter wording first.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Send invoices and take payments from a project",
    description:
      "Every project card now has an Invoices box. Build an invoice from the Services Catalog, pick a payment plan, email the client a link, and they can pay online by card. Check and cash payments can be recorded by hand.",
    howTo:
      "Open a project, scroll to Invoices, click New invoice, add items, choose a plan (50% retainer, pay in full, or three payments), Save, then Send. Admins and Leads only.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "Scheduling",
    title: "Clients can book a call with you from a link",
    description:
      "Scheduling lets admins and Leads make booking pages. Set the hours you take calls, send the link, and clients pick an open time. Both of you get an email with a calendar invite, and clients can cancel from the email.",
    howTo: "Open Scheduling, click New booking page, set your hours, save, then Copy link and send it.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "Services Catalog",
    title: "Your saved services and prices now live in the Hub",
    description:
      "The Services Catalog holds the 134 services and prices that were saved in HoneyBook (rentals, planning fees, transportation, golf event items). Search by name or category; admins and Leads can edit prices, add services, and archive old ones.",
    howTo: "Open Services Catalog from the sidebar. Admins and Leads: click Import from HoneyBook once to load the list.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Automatic client emails (admins)",
    description:
      "Admins can switch on three emails the Hub sends for you each day: a thank you and review request after an event, a check-in 90 days later, and a nudge when a proposal has gone quiet. They all start Off, send once per client, and can be edited.",
    howTo: "On the HoneyBook page, admins click Email automations, edit the wording and timing, turn one On, and use Preview to see who would get it.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Sales reports: booking rate and where leads come from",
    description:
      "A new Sales reports page shows how many leads become booked events, the booking rate by lead source and project type, booked value, how many days it takes to book, and a month-by-month view.",
    howTo: "On the HoneyBook page, admins and Leads click Sales reports, then switch between 90 days, 12 months, and all time.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Email a client right from the project card",
    description:
      "Project pages now have an Email client box with ready-made messages (new inquiry reply, proposal follow-up, contract reminder, planning details, thank you). Replies come straight to you, and each email is saved in Notes and trail.",
    howTo:
      "Open a project, click Write an email, pick a template, check it over, and press Send. Only admins, Leads, and people assigned to the project can send.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "Floor Plans",
    title: "Draw floor plans for your projects",
    description:
      "You can now lay out a room with tables, chairs, stage, screens, speakers and other gear, and attach the plan to a HoneyBook project. Upload the venue's blueprint, set its scale, save layouts as templates, share a link with the client, or download a PDF.",
    howTo:
      "Open a project, find Floor plans, and click New floor plan. Pick items from the left list and drag them into place. Use Publish to client to get a link, or PDF to print.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Edit payments right in the table",
    description:
      "Admins can now fix any payment in HoneyBook Payments: the date, amount, client, project and note. Payments that pointed at a merged project now show the project it was merged into.",
    howTo: "Open HoneyBook, then Payments, click Edit on a row, change what you need and click Save. Refunds can be negative.",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Hub suggests projects for unmatched payments",
    description:
      "Payments that are not linked to a project now appear in a Needs review box on the HoneyBook Payments tab, with the Hub's best guesses. A count shows on the Payments tab and the Overview.",
    howTo:
      "Admins: open HoneyBook, then Payments. Click Approve on the right project, Reject on a wrong guess, or pick another project yourself.",
  },
  {
    date: "2026-11-07",
    category: "improved",
    area: "HoneyBook",
    title: "Full payment history, with refunds",
    description:
      "The HoneyBook Payments tab now holds every payment from your HoneyBook report, back to 2024, with real dollar amounts. Refunds show as negative amounts instead of \"Amount not sent\".",
  },
  {
    date: "2026-11-07",
    category: "fixed",
    area: "HoneyBook",
    title: "Payments with no amount now say so instead of showing $0.00",
    description:
      "When HoneyBook's payment trigger doesn't send a dollar amount, the Payments tab now shows \"Amount not sent\" instead of $0.00, the Overview tile explains it, and admins see a warning in webhook activity. The Zapier setup tab also has the exact payment fields to send.",
    howTo:
      "Admins: in the New Payment Paid Zap, send a payment object with Payment Amount, Payment ID and Payment Date (see the Payment Zap sample on Zapier setup).",
  },
  {
    date: "2026-11-07",
    category: "new",
    area: "HoneyBook",
    title: "Partnerships tab for venue and vendor deals",
    description:
      "Track partnerships that are not events on their own Partnerships tab, with five stages: Prospect, In Talks, Agreement Sent, Active Partner, and Not Moving Forward. Partnership cards are always gold, you can assign a lead and support staff, and open to-dos show up in the daily update emails. Everyone can see them, but deal value and financial notes are visible to admins only.",
    howTo:
      "Open HoneyBook, click the Partnerships tab, then New partnership (admins and Leads). Click a card to add notes and to-dos.",
  },
  {
    date: "2026-11-07",
    category: "fixed",
    area: "Calendar",
    title: "Staff assigned on the HoneyBook board now show on the Calendar",
    description:
      "If you assigned a lead or support staff on a HoneyBook card, those people now also appear as Assigned Staff on that event in the Calendar and in Staff Availability. You no longer have to assign them twice.",
  },
  {
    date: "2026-11-07",
    category: "removed",
    area: "HoneyBook",
    title: "Archived column removed from the Projects board",
    description:
      "The board now has seven columns: Inquiry, Proposal Sent, Contract Sent, Retainer Paid, Paid in Full, Completed, and Lost. Finished projects go in Completed.",
  },
  {
    date: "2026-11-07",
    category: "removed",
    area: "HoneyBook",
    title: "Show empty stages checkbox removed",
    description:
      "The Projects board always shows all of its columns now, so the Show empty stages checkbox is gone.",
  },
  {
    date: "2026-11-07",
    category: "improved",
    area: "HoneyBook",
    title: "New board columns: Contract Sent, Lost, and Archived",
    description:
      "The Projects board now runs Inquiry, Proposal Sent, Contract Sent, Retainer Paid, Paid in Full, Completed, Lost, and Archived. Booked, In Progress, and Not Booked are gone, and projects that were Not Booked are now in Lost.",
    howTo: "If a column looks missing or out of order, click Reset column order above the board.",
  },
  {
    date: "2026-11-07",
    category: "improved",
    area: "HoneyBook",
    title: "Updated HoneyBook how-to video",
    description:
      "The HoneyBook video now covers the new board columns, Paid in Full, Notes and trail, and how to merge duplicate cards.",
    howTo: "Open HoneyBook and click Watch how-to video at the top of the page.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "New Paid in Full stage on the Projects board",
    description:
      "The Projects board now has a Paid in Full column between Retainer Paid and Completed. The board opens with these columns in order: Inquiry, Proposal Sent, Retainer Paid, Paid in Full, Completed and Not Booked. A Paid in Full project counts as a booked date.",
    howTo:
      "HoneyBook \u2192 Projects \u2192 Board. Pick Paid in Full from the stage menu on a card. Turn on Show empty stages to also see Contract Sent, Booked and In Progress. If your columns are in a different order, press Reset column order.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "Spot and merge duplicate HoneyBook cards",
    description:
      "Cards that look like the same event now show a Possible duplicate chip, creating a project that looks like an existing one warns you first, and admins and Leads can merge two cards into one. Notes, files, payments, email threads and staff all move to the card you keep.",
    howTo:
      "Click the Possible duplicate chip on a card, or open a card and choose Merge with…. Pick which card to keep and which details win. The other card is archived, and an admin can open it and choose Undo merge.",
  },
  {
    date: "2026-11-06",
    category: "improved",
    area: "Branding",
    title: "New Vident app icon",
    description:
      "The Hub's browser tab icon and home-screen icon now use the white and gold Vident mark on a black background.",
    howTo:
      "If you installed the Hub on your phone or computer, you may need to remove it and add it again to see the new icon.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "My projects or Everyone on the Projects tab",
    description:
      "The Projects tab now has a switch to show only the projects you are on, or everyone's. Staff start on My projects and admins start on Everyone, and the Hub remembers your choice on each device. Admins can also filter by person or by unassigned projects.",
    howTo:
      "On HoneyBook, open Projects and click My projects or Everyone above the board. Click the unassigned count to see projects nobody is on yet. Admins: with Everyone selected, use the people menu to look at one person's projects.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "Not a lead button for cards made from email",
    description:
      "If the Hub turns an email into an inquiry card by mistake, click Not a lead on the card. It removes the card and the Hub skips that sender and email thread from then on. The email reader is also stricter now about vendors and partnership requests.",
    howTo:
      "Open the project card, then click Not a lead next to Share link. It only appears on cards created from email, for admins and the people assigned to the card.",
  },
  {
    date: "2026-11-06",
    category: "improved",
    area: "Tools",
    title: "NEW tags on the Tools page",
    description:
      "Tools that are new or recently updated since the last time you were on the Hub now show a red NEW tag next to their name on the Tools page, so you can spot what changed without hunting. The tag disappears once you open that tool.",
  },
  {
    date: "2026-11-06",
    category: "improved",
    area: "HoneyBook",
    title: "Marketplace leads get a cleaner placeholder name",
    description:
      "When a GigSalad or The Knot lead does not include the client's name, the new card is titled \"New lead (GigSalad)\" with the marketplace spelled correctly. Rename it from Quick edit once you learn who the client is.",
  },
  {
    date: "2026-11-06",
    category: "fixed",
    area: "HoneyBook",
    title: "Email inquiries no longer repeat to-dos or mix up GigSalad leads",
    description:
      "Project cards created from email no longer pile up the same to-do twice, and leads that arrive through GigSalad, The Knot and similar sites now get their own card instead of being merged under the site's name. Vague \"check the inbox\" to-dos are gone.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "Daily project update by email, plus one team email for admins",
    description:
      "Every morning each person assigned to HoneyBook projects gets an email with their events, what stage each one is in, and what needs doing next. Admins get one combined email covering the whole team, including inquiries nobody owns yet, instead of a copy of every person's email.",
    howTo:
      "Nothing to set up. To clear an item from your update, add a note or move the project to its next stage on the project page.",
  },
  {
    date: "2026-11-06",
    category: "new",
    area: "HoneyBook",
    title: "Notes and trail on every project",
    description:
      "Each project page now has a Notes and trail section. Anyone assigned can add notes and flag something that needs action, and mark it done later, so a teammate can pick up exactly where someone else left off. When admins turn on email monitoring, new inquiries sent to a team Gmail inbox create a project card automatically, and follow-up emails add short notes to the same card.",
    howTo:
      "Open a project from the HoneyBook Projects tab and scroll to Notes and trail. Check Someone needs to act on this to put a note on the Needs action list.",
  },
  {
    date: "2026-11-06",
    category: "removed",
    area: "Hub cleanup",
    title: "Leftover Y? Entertainment items removed",
    description:
      "Inquiry Forms no longer offer the DJ Event Planner copy option or the Y? Entertainment brand look, the People page no longer shows a \"Missing calendar feed\" badge, new people default to a neutral gray color, new venue quote pages no longer start with DJ / photo booth interest items, and the Music Charts points task is gone.",
  },
  {
    date: "2026-11-05",
    category: "improved",
    area: "Home shortcuts",
    title: "Every Hub module can now be a Home shortcut",
    description:
      "Customize shortcuts now lists every Vident Hub module you have access to, including Tools, Quoting, Proposals, Vendors, Forum, What's New and all the Vident AV pages. The leftover Music Charts shortcut, guest tile and Ask the Hub example questions were removed.",
    howTo: "Home → Customize → pick from Add more → Save.",
  },
  {
    date: "2026-11-05",
    category: "new",
    area: "What's New",
    title: "Change Log Videos: watch what changed each month",
    description:
      "Each month of What's New now has a short video above its written entries, and a Change Log Videos page keeps every video in one place. Older videos are hidden automatically when a newer one covers the same changes, and new team members see the videos from the two months before they started onward. The AV team and Leads also get a video on the changes only they can open.",
    howTo:
      "Open What's New and press play above the month you want, or tap Change Log Videos at the top for the full list.",
  },
  {
    date: "2026-11-05",
    category: "new",
    area: "Training Portal",
    title: "How-to videos",
    description:
      "Short how-to videos are coming for every Hub module. The first one, Event Packets, is live: look for the Watch how-to video link at the top of the page, or find it in the new How-to videos course in the Training Portal. Earn 5 points for each video you watch and a 100-point bonus when you finish them all.",
    howTo:
      "Open Event Packets → Watch how-to video. Or Training Portal → How-to videos and play any lesson to at least 90%.",
  },
  {
    date: "2026-11-04",
    category: "new",
    area: "Inquiry Forms",
    title: "Website inquiry forms that land on the HoneyBook board",
    description:
      "Admins can build multi-step inquiry forms for videntproductions.com and videntaudiovisual.com. Visitors give their contact details first, answer a few short steps and see a soft 'your date looks open' check. Every finished form becomes an Inquiry project on the HoneyBook board with a Website badge, all the answers in its details and a fit score, and admins get a Website inquiries alert. When someone leaves an email or phone but does not finish, admins get an Unfinished website inquiries alert instead.",
    howTo:
      "Admins: Tools, Quotes & Proposals, Inquiry Forms. Click Add the starter forms (Get a Quote and Request AV), adjust the questions and wording, then copy the embed snippet from a form's Share tab into the website. Business settings (date check, blackout dates, spam limits) are under Inquiry Forms, Business settings.",
  },
  {
    date: "2026-11-03",
    category: "improved",
    area: "Vident AV",
    title: "Package prices from included items on quotes",
    description:
      "Packages that are $0 in the catalog but have Comes-with gear now show a rolled-up price in the quote product list. Adding the package puts that total on the package line and keeps included items at $0. You can edit Unit $ before adding, or use Price from items on an existing package line.",
    howTo:
      "Vident AV → Quotes → open a quote → pick a package (label may say “from items”) → adjust Unit $ if needed → Add line. For an old $0 package already on the quote, click Price from items on that line.",
  },
  {
    date: "2026-11-03",
    category: "fixed",
    area: "Vident AV",
    title: "Quote qty accepts whole numbers again",
    description:
      "Adding or editing a quote line no longer blocks quantity 1 (and other whole numbers) with a browser “nearest valid values are 0.01 and 1.01” error.",
  },
  {
    date: "2026-11-03",
    category: "improved",
    area: "Vident AV",
    title: "Add customer or venue from a quote",
    description:
      "On an AV quote, you can create a new customer or venue right in the header when they are not already in the lists. That also adds them under Customers and Venues for next time.",
    howTo:
      "Vident AV → Quotes → open a quote → New customer or New venue next to the dropdown → fill the form → Create. They are saved under Customers/Venues and selected on the quote.",
  },
  {
    date: "2026-11-02",
    category: "improved",
    area: "HoneyBook",
    title: "Reorder board stage columns",
    description:
      "On the HoneyBook Projects board, drag a stage column header left or right to set your preferred order. The layout is saved in this browser; use Reset column order to go back to the default.",
    howTo:
      "HoneyBook → Projects → Board → drag the ⋮⋮ grip on a column header. Reset column order appears once you’ve customized it.",
  },
  {
    date: "2026-11-02",
    category: "improved",
    area: "HoneyBook",
    title: "Project lead and support staff",
    description:
      "Admins can set one project lead and additional support staff on board cards or the project page. Card color follows the lead. Hub edits still do not write back to HoneyBook (HoneyBook has no public API).",
    howTo:
      "HoneyBook → open a project or use Board → Project lead… / Add support…. Run migration 166_honeybook_assignee_roles.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-02",
    category: "new",
    area: "HoneyBook",
    title: "Open a project from the board",
    description:
      "Click a HoneyBook board card (or Open on List) to go to that project’s page — edit details, assign staff, share the client link, and see questionnaire answers and files.",
    howTo:
      "HoneyBook → Projects → Board → click a card. Or List → Open. Back to Projects returns to the board.",
  },
  {
    date: "2026-11-02",
    category: "improved",
    area: "HoneyBook",
    title: "Assign staff on the project board",
    description:
      "Admins can assign people directly on HoneyBook board cards (and List). Only admins and people assigned to a project can change stage or edit that card — everyone else sees a read-only view.",
    howTo:
      "HoneyBook → Projects → Board → Assign staff… on a card. Assigned teammates get edit/move; unassigned staff stay view-only.",
  },
  {
    date: "2026-11-02",
    category: "improved",
    area: "HoneyBook",
    title: "Cleaner project stage names and a denser board",
    description:
      "HoneyBook stages from Zapier that looked like _RETAINER_PAID_ now show as Retainer Paid (and match Proposal Sent with proposal_sent). The Projects board hides empty columns by default so you scroll less; turn on Show empty stages to see them at half width.",
    howTo:
      "HoneyBook → Overview for stage counts, or Projects → Board. Use Show empty stages when you want every pipeline column visible.",
  },
  {
    date: "2026-11-02",
    category: "new",
    area: "HoneyBook",
    title: "Client questionnaire on shared CRM projects",
    description:
      "Share-enabled projects include a planning questionnaire (guest count, style, ceremony/reception, vendors, special requests). Clients save answers on the share link; staff read them on HoneyBook → Projects → List.",
    howTo:
      "Share link → /project/… → Project questionnaire → Save answers. Staff: List → Client questionnaire. Run migration 165_honeybook_project_questionnaire.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "HoneyBook",
    title: "Client file uploads on shared CRM projects",
    description:
      "When a project has a client share link, clients can upload files (inspiration, timeline, floor plan, contracts, other). Staff download them from HoneyBook → Projects → List.",
    howTo:
      "Share link on a project, open /project/… as the client, upload under Share files with us. Staff: List → Client files → Download. Run migration 164_honeybook_project_files.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "HoneyBook",
    title: "Project assignees, card colors, and assign approval",
    description:
      "Assign multiple staff to a CRM project. Board cards use Team colors. Admins and Leads assign freely; staff can edit only projects they’re on (others are view-only). If staff request adding someone else, admins get a notification and For You approval.",
    howTo:
      "HoneyBook → Projects → List → Assigned staff. Staff: Request add (admin approves on Overview/Projects). Run migration 163_honeybook_project_assignees.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "HoneyBook",
    title: "Client share link for CRM projects",
    description:
      "Admins and Leads can share a read-only client page for a Hub CRM project (name, stage, date, details). Stop sharing anytime. Still no write-back to HoneyBook.",
    howTo:
      "HoneyBook → Projects → List → Share link (copies URL). Open /project/… as the client. Run migration 162_honeybook_project_share.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "HoneyBook",
    title: "Leads can edit and delete Hub CRM clients and projects",
    description:
      "Admins and Leads can edit client and project details and delete Hub CRM rows. Stage changes from Edit still keep history. Still no write-back to HoneyBook.",
    howTo:
      "HoneyBook → Clients or Projects (List) → Edit / Delete. Run migration 161_honeybook_lead_edit_delete.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "HoneyBook",
    title: "Projects Board — pipeline by stage",
    description:
      "HoneyBook → Projects opens as a Board (kanban by stage). Switch to List anytime. Change stage on a card; Hub-only — still no write-back to HoneyBook.",
    howTo:
      "Tools → HoneyBook → Projects. Use Board / List. Pick a new stage on a card to move it. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "HoneyBook",
    title: "Create Hub clients and projects; stage history",
    description:
      "Admins and Leads can add clients and projects in the Hub CRM (marked Hub). Stage changes keep a short history on each project. Still no write-back to HoneyBook.",
    howTo:
      "HoneyBook → Clients → New client, or Projects → New project. Run migration 160_honeybook_hub_create.sql. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "HoneyBook",
    title: "Leads can open the HoneyBook CRM mirror",
    description:
      "Leads (trainer) can view clients, projects, and payments and update Hub project stage. Zapier setup, CSV import, deletes, and webhook logs stay admin-only. Stage changes still do not write back to HoneyBook.",
    howTo:
      "Tools → HoneyBook (admins & Leads). Run migration 159_honeybook_lead_access.sql in Supabase. Rebuild Ask the Hub index after deploy.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Staffing",
    title: "Needs crew on Staffing and For You",
    description:
      "Staffing days show open AV quotations/orders that still need confirmed crew. Admins and Leads also get a For You card for gaps in the next 14 days.",
    howTo:
      "Staffing → Needs crew on each day (links to AV Crew). For You → Jobs needing crew. Confirm bookings on Vident AV → Crew to clear the gap.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Event Packets",
    title: "Wedding day-of checklist on Wedding packets",
    description:
      "Wedding Event Packets show a short day-of coordinator checklist (times, power, mics, dances, consent) as a quick reference.",
    howTo: "Open a Wedding Event Packet — the checklist appears under the title.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Teams",
    title: "Wedding, Corporate, and AV planning links on Teams",
    description:
      "Teams tabs now show Hub playbook links when no custom department links exist yet — Wedding & Social (packets, calendar, quoting), Corporate (quoting, Vident AV, portals, Show Control, venue quotes), and Audiovisual (AV tools).",
    howTo:
      "Open Teams → pick your department. Admins/Leads can still add custom links and training videos that replace the defaults.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Event Packets",
    title: "Event Packets link to HoneyBook CRM projects",
    description:
      "When a packet’s date and client match a mirrored HoneyBook project, the Hub links them. Admins and Leads see the CRM project on the packet; HoneyBook → Projects shows linked Event Packets.",
    howTo:
      "Open a packet after migration 158_lanes_packet_hb_staffing.sql. Matching is automatic when date + client are unambiguous.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Staffing",
    title: "Leads on Staffing, 28-day horizon, AV Crew day links",
    description:
      "Leads can open Staffing and mark/clear unavailable. Default view is 28 days with week step and horizon picker. Each day links to AV Crew bookings for that date.",
    howTo:
      "Tools → Staffing (admins & Leads). Use Prev/Next week or Horizon. AV crew this day opens /rentals/crew?date=…. Run migration 158 for Lead write access.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Quoting",
    title: "Wedding quoting defaults and Quoting vs Vident AV guide",
    description:
      "Wedding & Social pricing notes seed ceremony, reception, and deposit checklists. Ask the Hub explains when to use Quoting versus Vident AV rental quotes.",
    howTo:
      "Quoting → Wedding & Social notes. Ask the Hub: “When should I use Quoting vs Vident AV?” (Rebuild index after deploy). Migration 158 seeds the notes.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Vident AV",
    title: "Venue catalog maps, overdue invoice reminders, Show Control show-day polish",
    description:
      "Hyatt and Starter venue packages/add-ons map to Hub catalog products/services so Create Hub quote carries catalog IDs. Overdue invoices have a list filter, Overview tile, Send reminder on the invoice, and a daily Resend cron. Show Control adds Open all three outputs, Hub remote session expiry + Extend, and a richer phone remote (Panic, timer ±, take by item).",
    howTo:
      "Venue Quotes editor shows Hub catalog maps (Starter/Hyatt prefilled after migration 157). Invoices → Overdue, or Overview → Overdue invoices; open an invoice → Send reminder. AV Show Control → Open all three / Start Hub remote → Extend before long shows; phone → /av-show/remote. Run migration 157_venue_catalog_invoice_reminders.sql in Supabase.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Vident AV",
    title: "Invoice pay email, venue deposit on invoice, catalog map, Show Control remote",
    description:
      "Mark sent on an invoice auto-enables the customer pay link and emails it (Resend). Enable / re-email pay link does the same. Drafting an invoice from a venue Book Now quote copies the paid deposit as the first payment. Venue packages and add-ons can map to Hub catalog products/services so Create Hub quote carries those IDs. AV Show Control can start a Hub remote session for phone and Stream Deck.",
    howTo:
      "Invoice → Mark sent (pay link emails when Resend is configured). Venue Quotes editor → map Hub catalog on packages/add-ons → Requests → Create Hub quote → Invoice from quote. AV Show Control → Launch → Start Hub remote → open /av-show/remote with the PIN. Run migration 156_invoice_pay_catalog_show_remote.sql in Supabase.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Venue Quotes",
    title: "Create Hub quote from a venue request, starter portal, invoice pay link",
    description:
      "Venue Quotes → Requests can Create Hub quote (customer + draft lines from the estimate). Add a second venue with Starter catalog (spaces, package, add-ons, techs). On a sent invoice, Enable customer pay link opens a public Stripe Checkout page for the balance due.",
    howTo:
      "Requests → Create Hub quote. Venue Quotes → Starter catalog → edit → Publish. Invoice → Mark sent → Enable customer pay link → share /invoice/…. Run migration 155_venue_convert_invoice_pay.sql in Supabase. Stripe keys required for checkout.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Vident AV",
    title: "Signed PDF resend, estimate tax, and richer change orders",
    description:
      "Quotes show when a signed PDF was emailed and let staff Resend signed PDF. Estimates and contracts now include shop sales tax (respecting customer tax-exempt). Change orders can adjust qty or remove an existing quote line—not only add. Signed PDFs are archived immutably for download and resend.",
    howTo:
      "On a signed quote: use Resend signed PDF under the estimate/contract banner. Set Default sales tax rate on Templates. On Change orders: Action → Adjust qty or Remove line, pick the quote line. Run migration 154_av_signed_pdf_archive.sql in Supabase.",
  },
  {
    date: "2026-11-01",
    category: "fixed",
    area: "Vident AV",
    title: "Production deploys failed after recent AV document updates",
    description:
      "Vercel builds were failing on duplicate change-order helpers and a sample PDF script type error. Production deploys again.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Appearance",
    title: "The Hub dresses up for 16 holidays",
    description:
      "On New Year's Day, MLK Day, Valentine's Day, St. Patrick's Day, Easter, Cinco de Mayo, Mother's Day, Memorial Day, Father's Day, the 4th of July, Halloween, Veterans Day, Thanksgiving, Christmas Eve, Christmas Day and New Year's Eve, the whole Hub switches to a full-screen holiday theme with a matching Home greeting and a short splash. The Vident logo stays.",
    howTo:
      "Nothing to turn on; it changes by itself at midnight New York time. Admins can preview any holiday from Hub health (Holiday themes card).",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Vident AV",
    title: "Invoice sales tax, change-order lines, and stamped signed PDFs",
    description:
      "Invoices now calculate sales tax from a shop default rate (Templates) with customer tax-exempt and per-draft override. Change orders support real line items that sync into the quote when the customer e-signs accept. Signed estimate, contract, and change-order PDFs stamp the drawn signature and email a copy to the customer (Hub pad only — no DocuSign).",
    howTo:
      "Set Default sales tax rate on Vident AV → Templates; mark customers Tax exempt when needed. On a quote: Change orders → add lines → Share for e-sign. After Accept, check email for the stamped PDF. Run migration 153_av_tax_co_lines_signed.sql in Supabase.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Vident AV",
    title: "Customer e-sign on estimates, contracts, and change orders",
    description:
      "Customers accept estimates and contracts with the same drawn electronic signature pad used for staff documents (name, signature, IP, browser, timestamp). Decline still works with an optional note. Staff can create change orders on a quote, share a public link, and collect the same e-sign acceptance.",
    howTo:
      "Share or email the estimate link — Accept requires a drawn signature, then Sign contract appears on the same page. On the quote, use Change orders → Create → Share for e-sign. Run migration 152_av_customer_esign.sql in Supabase.",
  },
  {
    date: "2026-11-01",
    category: "improved",
    area: "Vident AV",
    title: "Estimates, contracts, and invoices match Current RMS layout",
    description:
      "Customer PDFs and the public estimate page now follow the Current RMS document chrome: company header, Client and Venue blocks, ship/return dates, Type/Qty/Description/Rate/Ext line tables, totals with sales tax and balance due, terms, and a signature block on quotes and contracts.",
    howTo:
      "On a Quote: Download estimate PDF or Download contract PDF. On an Invoice: Download invoice PDF. Shared estimate links use the same layout in the browser.",
  },
  {
    date: "2026-11-01",
    category: "fixed",
    area: "Vident AV",
    title: "Crew page type error blocked production deploy",
    description:
      "A TypeScript mismatch on the Crew page fallback query was failing the Vercel build after the KM gaps release. Production deploys again.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Vident AV",
    title: "KM gaps closed: estimates, reports, contractors, serials",
    description:
      "Customers can accept or decline a shared estimate; staff can email the link. Reports now include payment ledger, partial invoices, never-booked catalog, sales stock, stock movements, and sub-hire/subcontract cost views. Contractors CRM, document templates, quote discussion notes, serial units, warehouse scan filter, and cost tax fields land too.",
    howTo:
      "Run migration 151_av_km_gaps.sql in Supabase if Hub Health flags it. Share or Email estimate on a quote; open Reports and search KM names like payments or neverBooked; manage Contractors, Templates, and Serials from the sidebar.",
  },
  {
    date: "2026-11-01",
    category: "new",
    area: "Vident AV",
    title: "AV Show Control",
    description:
      "Run the full-screen graphics, green lower thirds and stage timer for a live show from one control page. Build a run of show, import speakers from a spreadsheet, add sponsor logos with an airtime report, and print a cue sheet.",
    howTo:
      "Open AV Show Control in the sidebar and click Launch. Open the three outputs, drag each window to its display, then click an item and press Space to take it live.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Tools",
    title: "Tools page deploys again after search update",
    description:
      "A type error from the Tools search update was blocking the production build. Deploying Tools works again.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Tools",
    title: "Search Tools; AV Developer listed; new modules auto-group",
    description:
      "Tools has a search box at the top so you can find a module by name or short description without scrolling. Vident AV → Developer (Terminal Mode API keys) now appears under Vident AV. New Hub modules are tied to a Tools section when they ship, so they land in the right group automatically.",
    howTo:
      "Open Tools, type in Search tools (e.g. warehouse or points). AV Developer is under Vident AV.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "KM debug-log parity: catalog, overview tiles, confirm anyway",
    description:
      "Catalog Edit scrolls to the form and focuses the name; Comes with rows can be edited or removed; Duplicate copies a product (including Comes with) or service. Overview tiles open Quotes / Warehouse / Activities / Invoices already filtered to what the tile counts. Confirm and reserve gear blocks on a rental shortage and offers Confirm anyway — free qty is reserved, short items stay open, and a staff note records who confirmed and when.",
    howTo:
      "Vident AV → Catalog (Edit / Duplicate / Comes with). Overview tiles. On a quote with shortages: Confirm and reserve gear → Confirm anyway.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Venue Quotes",
    title: "Stripe deposit webhook reachable without login",
    description:
      "Stripe can now notify the Hub when a Book Now deposit is paid. The webhook URL was incorrectly sending Stripe to the login page.",
    howTo:
      "No staff action needed after deploy. Book Now deposits mark paid automatically.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Clear sample shop when practice is done",
    description:
      "On Overview, when the sample shop is loaded you can Clear sample shop to remove the demo quotes, catalog, customers, venues, and any invoices drafted from those sample jobs. Your real rows stay.",
    howTo: "Vident AV → Overview → Clear sample shop (confirm).",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Venue Quotes",
    title: "Book Now collects a Stripe deposit",
    description:
      "On a public Instant AV Quote page, Book Now saves the request and opens Stripe Checkout for the venue’s deposit percent (default 50% of the estimated total after savings). Staff see deposit status on Venue Quotes → Requests.",
    howTo:
      "Needs STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET. Run migration 150. Point the Stripe webhook to /api/webhooks/stripe.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Edit draft invoices before Mark sent",
    description:
      "On a draft invoice you can change the subject and dates, edit line description/qty/price, add or remove lines, and the total recalculates. Mark sent still locks the invoice.",
    howTo:
      "Vident AV → Invoices → open a Draft → edit header or lines → Save → Mark sent when ready.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Vident AV",
    title: "Warehouse Check out qty step (missed in prior fix)",
    description:
      "The Ready to check out qty field still used step=1 with min=0.01, so whole numbers like 8 failed validation. Check out now matches Check back.",
    howTo: "Vident AV → Warehouse → Ready to check out → qty → Check out.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Vident AV",
    title: "Warehouse check-out qty accepts whole numbers",
    description:
      "Check out / Check back qty fields no longer reject values like 8 with a browser “nearest valid values are 7.01 and 8.01” error.",
    howTo: "Vident AV → Warehouse → enter qty → Check out.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Sample shop control always on Overview",
    description:
      "Load sample shop stays visible on Vident AV → Overview even when you already have catalog or quotes, so you can find it without clearing the shop first.",
    howTo: "Vident AV → Overview (first page of the AV module) → Load sample shop.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Load sample shop for day-to-day practice",
    description:
      "On Vident AV Overview you can load a sample catalog, customers, venues, a draft quote, and a reserved quotation with holds so Warehouse and Reports have real rows to walk.",
    howTo:
      "Vident AV → Overview → Load sample shop. Safe to click once; it will not duplicate.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Venue plan on quotes (photo, markers, AI render)",
    description:
      "On a quote you can upload a room photo, click to place gear markers, and generate an AI layout render from the photo plus markers (needs GEMINI_API_KEY).",
    howTo:
      "Open a quote → Venue plan. Upload a room photo, click to place markers, then Generate render. Run migration 149_av_text_kind_venue_plan_terminal.sql if Hub Health shows it missing.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Terminal write API + text rental vs sale",
    description:
      "Developer API keys can allow write: create/update customers and draft quotes via POST/PATCH. Free-text quote lines are tagged rental or sale, and Reports splits Text item rentals vs Text item sales.",
    howTo:
      "Quotes: add a free-text line and pick Rental or Sale. Developer: check Allow write when minting a key. Reports: filter textRentals or textSales.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Income, text-item, and contacts reports",
    description:
      "Vident AV → Reports now includes customer income, product rental/sale income, service income, free-text quote lines, and contacts linked to customers or venues — covering the remaining KM report names with real Hub tables.",
    howTo: "Open Vident AV → Reports and filter by customer, rental, sale, service, text, or contacts.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Developer API keys (Terminal Mode)",
    description:
      "Vident AV → Developer lets you mint and revoke shop API keys for Claude or scripts (KM Terminal Mode). Keys are shown once; use them as Bearer tokens on the read API.",
    howTo:
      "Vident AV → Developer → Create key. Call GET /api/av/terminal/v1/opportunities (also /customers, /catalog) with Authorization: Bearer avk_live_…. Run migration 148_av_integration_tokens.sql if Hub Health shows it missing.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Reports lists all 19 KM report names",
    description:
      "Vident AV → Reports now indexes every KM Reports menu name. Search by Hub title or a KM key/label (whatsOut, oppCosts, profit, …) to jump to the closest Hub section; names without a Hub equivalent stay listed with a short note instead of empty pages.",
    howTo:
      "Open Vident AV → Reports, use the filter, or scan the KM report names list under the jump links.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Crew day rate rolls into job costs",
    description:
      "Confirmed crew bookings with a day rate can add a labor cost on the quote automatically (Eastern calendar days × rate). Cancel or decline removes the synced cost; leave the checkbox off when booking if you only want the schedule.",
    howTo:
      "Vident AV → Crew → Book crew (Add labor cost when confirmed is on by default). See Costs & margin on the quote. Run migration 147_av_crew_cost_rollup.sql if Hub Health shows it missing.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Invoice credit notes",
    description:
      "On a sent AV invoice you can issue a credit note (CN-####) for returns or adjustments. Credits reduce outstanding balance and Open AR the same way payments do.",
    howTo:
      "Vident AV → Invoices → open an invoice → Issue credit. Run migration 146_av_invoice_credits.sql in Supabase if Hub Health shows it missing.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Tools",
    title: "Vident AV tools listed on the Tools page",
    description:
      "Tools now has a Vident AV section with Overview, Quotes, Invoices, Costs, Reports, Warehouse, Stock, gear Calendar/Planner/Travel, Activities, Customers, Venues, Suppliers, Crew, Catalog, and Event Portals — same access rules as before.",
    howTo:
      "Open Tools (sidebar). Scroll to Vident AV. Hub Health also checks migration 145 and whether Ask the Hub’s AV guide needs Rebuild index.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Vident AV tabs wrap instead of sideways scroll",
    description:
      "The Vident AV section links (Overview through Catalog) wrap onto a second row when they don’t fit, so you can see and tap every tab without scrolling sideways.",
    howTo: "Open any Vident AV page — the tab bar at the top shows every section.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Vident AV",
    title: "Costs and Reports load faster; tabs no longer clip",
    description:
      "Costs and Reports load open jobs in a few database queries instead of one round-trip per job, so the pages open much quicker. The Vident AV tab bar spans the full content width so labels are not cut off mid-word.",
    howTo: "Open Vident AV → Costs or Reports.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "More shop reports on Reports",
    description:
      "Reports now includes job profit, costs by category, open AR and invoice aging, open pipeline, gear still out / overdue, checkout ready, low stock, upcoming crew, open activities, and gear windows for the next 14 days — all from Hub data.",
    howTo:
      "Vident AV → Reports, then jump to a section from the links under the title.",
  },
  {
    date: "2026-10-31",
    category: "removed",
    area: "Vident AV",
    title: "Current RMS Import retired",
    description:
      "The Import tab and Current RMS day-to-day connection are gone. Customers, Venues, Catalog, and Quotes are Hub-owned — add or edit them in Vident AV. CURRENT_RMS_* env vars are no longer used.",
    howTo:
      "Use Vident AV → Customers / Venues / Catalog / Quotes. Old /rentals/import links go to Overview. You can remove CURRENT_RMS_SUBDOMAIN and CURRENT_RMS_API_KEY from Vercel.",
  },
  {
    date: "2026-10-31",
    category: "fixed",
    area: "Vident AV",
    title: "Costs and Reports tabs open reliably",
    description:
      "Vident AV section tabs (including Costs and Reports) use full page links and scroll horizontally so they always navigate. Overview also has direct Costs & Reports buttons.",
    howTo:
      "Open Vident AV → Overview and use the Costs & margin or Reports buttons, or the Costs / Reports tabs in the section bar.",
  },
  {
    date: "2026-10-31",
    category: "improved",
    area: "Vident AV",
    title: "Hub Overview and Reports; Current RMS off the floor",
    description:
      "Overview is Hub-only (quotes, warehouse, invoices, activities) — live Current RMS inventory tiles are gone. Reports shows job profit, open AR, gear still out, and upcoming crew. The old Current RMS Build a quote path now opens Hub Quotes. Admins can still Import from Current RMS when seeding.",
    howTo:
      "Vident AV → Overview for Hub tiles. Reports for profit / AR / gear / crew. Import stays under Vident AV → Import (admins).",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Job costs, margin, and crew bookings",
    description:
      "Phase 3 finishes: book costs against a Hub quote (labor, sub-hire, transport, and more), see revenue vs costs vs margin on the quote and on Costs, and book crew from People onto jobs with role, Eastern window, day rate, and status.",
    howTo:
      "Vident AV → Costs for the board, or open a Quote → Costs & margin to add rows. Crew → Book crew (or Crew on this job from a quote). Needs migration 145.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Invoices, suppliers, and crew links",
    description:
      "Phase 3 money starts: draft invoices from Hub quotes (customer prices with venue markup folded in), mark sent, record payments, and void. Suppliers are a Hub CRM list. Crew points to Staffing, Contractor Pay, and People until job crew bookings land.",
    howTo:
      "Vident AV → Invoices → pick a quotation/order → Draft invoice. Suppliers and Crew are in the Vident AV tabs. Needs migration 144.",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Gear calendar, planner, travel, and activities",
    description:
      "Phase 2 floor ops finish: Calendar shows Hub jobs out across the month, Planner is a four-week gear grid, Travel lists leave/return for a day, and Activities tracks pre-job tasks with settle/reopen. Overview adds activity due-today and overdue tiles.",
    howTo:
      "Vident AV → Calendar / Planner / Travel / Activities. Activities need migration 143. Gear views use quote gear windows (Eastern).",
  },
  {
    date: "2026-10-31",
    category: "new",
    area: "Vident AV",
    title: "Warehouse check-out / check-back and Hub Stock",
    description:
      "Phase 2 floor ops start: Warehouse lists reserved gear ready to leave and gear still out (with overdue), and records check-out and check-back. Stock shows owned vs currently out from Hub movements. Overview adds Still out and Overdue tiles.",
    howTo:
      "Reserve gear on a Quote, then open Vident AV → Warehouse to Check out. When it returns, Check back. Stock is under Vident AV → Stock. Needs migration 142.",
  },
  {
    date: "2026-10-30",
    category: "improved",
    area: "Vident AV",
    title: "Quote windows use Eastern time; accessories auto-nest",
    description:
      "Gear and charge date fields on Quotes are America/New_York wall times (saved correctly even on UTC servers). Adding a catalog product also adds its accessory child lines. Shortage checks include each product’s turnaround hours after gear-back. Catalog import pulls product accessories from Current RMS when available.",
    howTo:
      "Vident AV → Quotes: set Gear out/back in Eastern. Re-run Import catalog to refresh accessories, then add a product on a quote to see nested accessory lines.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Hub quotes summary on Vident AV Overview",
    description:
      "Overview now shows Hub open-quote counts by status, active gear holds, and quotes with gear going out in the next 14 days — above the Current RMS live tiles.",
    howTo:
      "Open Vident AV → Overview. Use the Hub quotes cards or upcoming list to jump into Quotes.",
  },
  {
    date: "2026-10-30",
    category: "fixed",
    area: "Vident AV",
    title: "Imported quotes no longer stuck on Q-####",
    description:
      "Opportunity import always sets a Current RMS-based reference. If Current RMS has no quote number yet, Hub uses RMS-<id> instead of leaving a Hub Q-####. Re-run Import opportunities to update existing imports.",
    howTo:
      "Vident AV → Import → Import opportunities. Hub-only quotes you created in the Hub (no Current RMS link) correctly keep Q-####.",
  },
  {
    date: "2026-10-30",
    category: "improved",
    area: "Vident AV",
    title: "Imported quotes keep Current RMS quote numbers",
    description:
      "When you import opportunities from Current RMS, Hub now uses that job’s Current RMS quote number as the quote reference (instead of assigning a new Q-####). Re-running import updates already-imported quotes to match.",
    howTo:
      "Vident AV → Import → Import opportunities. Quotes that already came from Current RMS will renumber to the Current RMS number on the next import.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Import open opportunities from Current RMS",
    description:
      "Admins can pull open Current RMS jobs into Hub Quotes, including line items matched to the Hub catalog. Re-running updates matches by Current RMS ID. Gear holds are not created automatically.",
    howTo:
      "Import catalog first (Vident AV → Import). Then click Import opportunities. Review under Quotes and use Confirm and reserve when you want Hub holds.",
  },
  {
    date: "2026-10-30",
    category: "improved",
    area: "Vident AV",
    title: "Delete AV quotes",
    description:
      "You can delete a Hub AV quote from the Quotes list or the quote editor. Deleting removes its lines and gear holds.",
    howTo:
      "Vident AV → Quotes → Delete on a row, or open the quote and use Delete quote. Quote numbers (Q-0001…) keep counting up after deletes.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Shareable estimate PDF and link for AV quotes",
    description:
      "From any Hub AV quote you can download a customer-facing estimate PDF or turn on a private share link. Venue markup stays hidden — customers only see marked-up prices and the total.",
    howTo:
      "Open Vident AV → Quotes → a quote. Use Download estimate PDF, or Share estimate link to copy a /estimate/… URL. Revoke link turns the public page off. Needs migration 141.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Hub quotes with holds and hidden venue markup",
    description:
      "Vident AV now has Quotes: build opportunities with customers, venues, gear/charge windows, line items, totals, and hidden venue markup. Confirm and reserve gear creates holds and shows shortages against owned stock.",
    howTo:
      "Open Vident AV → Quotes → New quote. Add products, set gear out/back, then Confirm and reserve gear. Totals show the customer total and a staff-only markup row when enabled.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Import customers, venues, and catalog from Current RMS",
    description:
      "Admins can pull organisations, contacts, venues, and products from Current RMS into the Hub’s Customers, Venues, and Catalog tabs. Re-running updates matches by Current RMS ID instead of creating duplicates.",
    howTo:
      "Open Vident AV → Import, confirm Current RMS is connected, then click Import now. Review the lists afterward.",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "Hub catalog, customers, and venues",
    description:
      "Vident AV now has Hub-owned Customers, Venues, and Catalog pages (products, packages, services, and sections). These sit beside the Current RMS overview and are the start of replacing Current RMS with our own rental system.",
    howTo:
      "Open Vident AV in the sidebar, then use the Customers, Venues, or Catalog tabs. Same access as Vident AV (admins and Audiovisual staff).",
  },
  {
    date: "2026-10-30",
    category: "new",
    area: "Vident AV",
    title: "AV Event Portals",
    description:
      "Every AV show can now have one private link for the client. They send the floor plan, run of show, headcount, day-of contact, load-in details and presentation files in one place, with no login. The hub checks each item off as it arrives, shows how ready the show is, and emails the client at 30, 14, 7 and 3 days out with only what is still missing.",
    howTo:
      "Open AV Event Portals in the sidebar, click New event portal, and enter the client, date and venue. Copy the client link or send the first check-in right away.",
  },
  {
    date: "2026-10-20",
    category: "new",
    area: "Admin",
    title: "View the hub as a staff member",
    description:
      "Admins can switch to a staff-member view to see exactly which pages, menus and Tools a regular staff member gets. A banner stays at the top while you preview, with a button to switch back. Admin-only actions are paused during the preview so nothing is changed by accident.",
    howTo:
      "Click View as staff in the top bar. Click Back to admin in the banner when you are done.",
  },
  {
    date: "2026-10-20",
    category: "new",
    area: "Admin",
    title: "Page Map",
    description:
      "A new admin page lists every page in the hub, who can open it, whether it is linked in the sidebar, reachable from another page, a redirect, or public. Handy for checking that nothing is orphaned or showing to the wrong people.",
    howTo:
      "Open Tools > Admin > Page Map. Search by name or path, or use the filters for Linked in nav, Reachable and Redirects.",
  },
  {
    date: "2026-10-20",
    category: "new",
    area: "Navigation",
    title: "New Tools page and a shorter sidebar",
    description:
      "The sidebar now shows just your everyday links plus Tools. Click Tools to see every hub tool grouped by what you are doing (events, quotes, staffing, people, learning, marketing, communication, admin), each with a short description. Search at the top still jumps to any tool.",
    howTo:
      "Click Tools in the sidebar. Anything you used to find in a collapsed section (Work, People, Learn, Field tools, Marketing, Admin) is on that page now.",
  },
  {
    date: "2026-10-20",
    category: "improved",
    area: "Home",
    title: "Quick tools and a Needs your attention row",
    description:
      "Your pinned shortcuts now show as large icon tiles on Home and at the top of Tools. Below them, Needs your attention shows counts of what is waiting on you, with a link to see everything. Admins also see new venue quote requests there.",
    howTo: "Use Customize on Home to choose and reorder your quick tools.",
  },
  {
    date: "2026-10-20",
    category: "new",
    area: "Venue Quotes",
    title: "Password-protected venue savings for coordinators",
    description:
      "Venue savings are now hidden from the public quote page. A venue's event coordinator enters that venue's password to see and get the savings; clients never see them.",
    howTo:
      "In Venue Quotes, open a venue and set the Coordinator password. With no password set, the savings are not offered to anyone. Run migration 138 first.",
  },
  {
    date: "2026-10-20",
    category: "improved",
    area: "Venue Quotes",
    title: "Multiple technicians, hourly or daily rates",
    description:
      "Venue quote pages can now include several technician roles (for example Audio and Video), each billed per hour or per day, and each package can include any of them.",
    howTo:
      "In Venue Quotes, open a venue, add roles under Technicians, then check them on the packages that include them. Run migration 137 first.",
  },
  {
    date: "2026-10-20",
    category: "new",
    area: "Venue Quotes",
    title: "Instant AV quote pages for venues",
    description:
      "Each venue now gets its own public instant-quote page (shareable link, no login needed). Planners and venue coordinators pick spaces, packages and add-ons, see a live estimate, and send the request to us.",
    howTo:
      "Admins: open Venue Quotes in the sidebar, create or duplicate a venue, fill in rates, spaces, packages and add-ons, then Publish and share the link. New requests appear under Requests.",
  },
  {
    date: "2026-10-13",
    category: "improved",
    area: "Brand",
    title: "App icon sits on a white background",
    description:
      "The home-screen and browser icon now uses a white square behind the black and bronze VP mark, so both colors stay clear.",
  },
  {
    date: "2026-10-13",
    category: "improved",
    area: "Brand",
    title: "New logo, app icon, and black & bronze colors",
    description:
      "The hub now uses the updated Vident Productions wordmark and VP monogram icon. Buttons, links, and accents follow the logo’s charcoal black and bronze brown instead of the old red.",
  },
  {
    date: "2026-10-02",
    category: "improved",
    area: "Resources",
    title: "Any staff member can add a resource",
    description:
      "The Add resource button is now available to Staff, Leads, and Admins. Share a link or upload a file from Resources. Editing a resource is still limited to Leads and Admins, and only Admins can delete one.",
    howTo:
      "Open Resources and click Add resource. Choose a link or a file, set who can see it, and save.",
  },
  {
    date: "2026-09-02",
    category: "removed",
    area: "PLAUD",
    title: "PLAUD meetings module removed",
    description:
      "The PLAUD recordings module (summaries, transcripts, and its daily sync) has been removed from the hub, along with its For You section, search entries, and Hub Health checks.",
  },
  {
    date: "2026-09-02",
    category: "new",
    area: "Action Center",
    title: "Comments, multiple assignees, and per-person check-offs",
    description:
      "Tasks can now be assigned to more than one person, and each assignee checks off their own part — the task completes when everyone has. Anyone on a task (creator or assignees) can also leave comments, and new comments notify the others on the task.",
    howTo:
      "When creating or editing a task, tap one or more names to assign it. Use the 💬 link on a task to read or add comments. Your checkbox marks your part done; with several assignees you'll see progress like 1/3 done.",
  },
  {
    date: "2026-09-01",
    category: "improved",
    area: "Event Media",
    title: "Photo galleries load much faster",
    description:
      "Gallery grids now show lightweight thumbnails instead of downloading every full-size photo, and new uploads are automatically optimized to a sensible size. Pages feel snappier and the hub uses a fraction of the bandwidth it did before.",
    howTo:
      "Nothing changes for you — upload and browse like always. Click any photo to see it at full size.",
  },
  {
    date: "2026-09-01",
    category: "fixed",
    area: "Winners",
    title: "August trophies re-awarded to the right winner",
    description:
      "A setup leftover made David eligible for the monthly Hub Points trophies he's meant to sit out. The August Overall Leader and Monthly MVP awards now correctly go to Kristin Thompson, and David is excluded from winning going forward.",
  },
  {
    date: "2026-08-21",
    category: "new",
    area: "What's New",
    title: "This page — a live hub changelog",
    description:
      "The hub now keeps a running log of every change, fix, and new feature, written in plain English. Whenever something ships, an entry lands here automatically.",
    howTo:
      "Open What's New from the sidebar. A red NEW tag appears on the link whenever there are entries you haven't seen yet.",
  },
  {
    date: "2026-08-21",
    category: "fixed",
    area: "General",
    title: "Double scrollbar eliminated",
    description:
      "Pages no longer show two overlapping scrollbars. The content area is now the only thing that scrolls.",
  },
  {
    date: "2026-08-17",
    category: "improved",
    area: "Email",
    title: "Hub emails now come from videntproductions.com",
    description:
      "All hub emails (password resets, invites, notifications) now send from hub@videntproductions.com on the company's own domain, improving deliverability and trust.",
  },
  {
    date: "2026-08-17",
    category: "improved",
    area: "Navigation",
    title: "Sidebar reorganized and tidier",
    description:
      "Marketing tools (Social Studio, Image Studio, Marketing Queue, Content SLA) moved into their own Marketing section, and all sidebar sections now start collapsed so the menu stays compact.",
    howTo:
      "Click a section name to expand it. The section for the page you're on opens automatically.",
  },
  {
    date: "2026-08-15",
    category: "fixed",
    area: "Accounts",
    title: "Password reset and invite links work on any device",
    description:
      "Reset-password and invitation emails previously only worked in the browser that requested them (or pointed to the wrong address). The links now open the proper hub page on any device.",
    howTo:
      "Use \"Forgot password\" on the login page; the email link takes you straight to the set-new-password form.",
  },
  {
    date: "2026-08-15",
    category: "new",
    area: "Forum",
    title: "Hub Bugs and Hub Wishlist topics",
    description:
      "Two new Forum topics for feedback about the hub itself: report anything broken in Hub Bugs, and pitch ideas or feature requests in Hub Wishlist.",
    howTo:
      "Forum → pick Hub Bugs or Hub Wishlist → New discussion. We review both regularly.",
  },
  {
    date: "2026-08-14",
    category: "new",
    area: "Notifications",
    title: "App icon badge for unread notifications",
    description:
      "If you've added the hub to your phone's home screen, the app icon now shows a badge with your unread notification count, alongside the existing push banners.",
    howTo:
      "Enable notifications from Communications; make sure badges are allowed for the app in your phone's notification settings.",
  },
  {
    date: "2026-08-14",
    category: "removed",
    area: "Time Off",
    title: "Weekly availability section removed",
    description:
      "The \"My weekly availability\" section was removed from Time Off to keep the module focused on requesting and tracking time off.",
  },
  {
    date: "2026-08-13",
    category: "new",
    area: "Meetings",
    title: "Zoom huddles and meeting recordings",
    description:
      "The hub is connected to Zoom: start a team huddle from the home page, and cloud recordings of meetings import automatically into Meetings.",
    howTo:
      "Use \"Start team huddle\" at the top of the home page. Recordings appear in Meetings after Zoom finishes processing them.",
  },
  {
    date: "2026-08-13",
    category: "new",
    area: "Admin",
    title: "Automatic Google Drive backups",
    description:
      "Hub data now backs up automatically to the \"Vident Hub Backup\" shared Google Drive. Admins can check backup status on Hub health.",
  },
  {
    date: "2026-08-12",
    category: "fixed",
    area: "Ask the Hub",
    title: "Ask the Hub answers restored",
    description:
      "Ask the Hub's knowledge base was rebuilt and it now answers questions about hub features and company info reliably again.",
    howTo:
      "Open Ask the Hub from the sidebar and ask in plain English — the example prompts show what it's good at.",
  },
  {
    date: "2026-08-12",
    category: "improved",
    area: "Client Reviews",
    title: "Client Reviews connected to the Vident sheet",
    description:
      "Client Reviews now syncs from Vident's own review spreadsheet (no more leftover data sources from the old setup).",
  },
  {
    date: "2026-08-11",
    category: "new",
    area: "Vident AV",
    title: "Gear catalog and bookings (Current RMS)",
    description:
      "Vident AV is connected to Current RMS: browse the gear catalog and see bookings directly in the hub.",
  },
];

/**
 * Changes whenever an entry is added — used by the sidebar NEW badge.
 * Compared against localStorage on the client.
 */
export const CHANGELOG_STAMP = `${CHANGELOG.length}:${CHANGELOG[0]?.date ?? ""}`;

export const CHANGELOG_SEEN_KEY = "vident-hub.changelog.seen";
