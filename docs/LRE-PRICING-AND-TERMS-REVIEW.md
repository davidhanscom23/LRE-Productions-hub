# LRE Productions Hub: pricing and terms review

Prepared Nov 13, 2026 for David and Luke. Everything below was copied from the Vident Hub when this hub was built. **None of it is approved for LRE.** Each row needs a decision: Keep, Change, or Remove. After you decide, send the list back and the hub gets updated in one pass.

Where each item lives: "Hub setting" means it can be changed inside the hub; "Code" means it is written into the hub's code and needs a developer change (I make it).

## A. Prices and money settings

| # | Item | Current value | Where it lives | Decision |
|---|------|---------------|----------------|----------|
| 1 | Direct-billing surcharge | The contract text says "All final bills will include a 23% service charge." The estimate editor has a per-estimate Surcharge % box that starts at 0 and shows on direct-billed estimates and invoices (not on venue-partner jobs). | Contract wording: Code (`standard-templates.ts`, two places). Surcharge box: Hub setting per estimate. | |
| 2 | Venue partner billing | The venue pays LRE and adds its own charge on its master bill. LRE shows no surcharge on those jobs. | Code (`billing-type.ts`) | |
| 3 | Default sales tax | 0% today. | Hub setting (`av_default_sales_tax_rate_pct`) | Rhode Island rate to be set by your accountant |
| 4 | Rental rate rules | 7 rules: Daily, Weekly, Monthly, Hourly, Flat, 3 Day Week, Daily capped at 4 days. Daily is the default. | Hub setting (AV rate definitions) | |
| 5 | Equipment prices | 201 products copied from the live Vident catalog with Vident's rates. | Hub setting (catalog) | LRE rates, or a markup, per owner tag (Vident / LukesENT / LRE Pro) |
| 6 | Startup rental discount | 50% equipment rental discount for the first 6 months (from Jan 1, 2027). Not built into the hub yet. | Decision needed | How to apply it: a line on each estimate, or a rate rule |
| 7 | Deposit and payment schedule (AV agreement) | 50% due within 7 days of signing; balance due within 7 days AFTER the event. | Code (`standard-terms.ts`, compensationPayment) | |
| 8 | Deposit and payment schedule (DMC agreements) | 50% payment due on booking; balance due 30 days before the event. 50% non-refundable deposit. | Code (`standard-templates.ts`, `DMC_CANCELLATION`) | |
| 9 | Cancellation by client | More than 60 days out: LRE keeps money paid, client owes nothing more. Inside 60 days or no written notice: full balance due. | Code | |
| 10 | Rescheduling | Credit for money paid if LRE can rebook the date; credit valid 12 months. | Code | |
| 11 | Reductions on DMC orders | Rental items can be cut by 50% until 30 days before the event. | Code | |
| 12 | Staff mileage | 58 cents per mile or the IRS rate, outside the home counties. | Code (handbook) | |
| 13 | Small solo-signing limit | Planned for the startup period. Not in the hub. | Decision needed | Dollar limit and who it applies to |

## B. Contract wording (AV-only, DMC non-AV, DMC plus AV)

| # | Item | What it says now | Problem for LRE |
|---|------|------------------|-----------------|
| 14 | Governing law and venue | Laws of the State of Florida; venue is "Saint Johns, Florida." | LRE is a Rhode Island corporation and does no work in Florida. Needs a Rhode Island attorney. |
| 15 | Government client clause | Refers to "the State of Florida" sovereign immunity. | Same. |
| 16 | Exclusivity | LRE is the only event audiovisual provider the client retains at the event. | Business decision. |
| 17 | Ownership, license and promotional rights | LRE owns materials; client gets a personal-use license; LRE may use event material to promote itself with client consent. | Attorney review. |
| 18 | Remaining clauses | Indemnification, force majeure, assignment, amendments, entire agreement, severability, counterparts. | Attorney review. |
| 19 | Company name on agreements | Reads "LRE Productions, Inc." The incorporation is still in progress. | Confirm the exact legal name before anything is signed. |

## C. Staff handbook and staff agreements (in `src/lib/handbook/content.ts`)

| # | Item | Note |
|---|------|------|
| 20 | Restrictive Covenants Agreement | Includes non-compete, non-solicit and non-interference terms and **$10,000 liquidated damages**. Governed by Florida law, venue St. Johns County, Florida. Rhode Island law on non-competes differs. Attorney review before any staff member signs. |
| 21 | Service area and travel | Says travel is mostly within Duval, St. Johns and Clay counties (Florida). |
| 22 | Driver rule | Requires a valid Florida driver's license. |
| 23 | Contractor and training agreements, Privacy Policy, SMS terms | Copied from Vident. Attorney review. |

The handbook and agreements are not stored in the database (0 handbook rows, 0 document templates), so they all change through code.

## D. Florida and Vident leftovers that are visible to staff or the public

| # | Where | Leftover |
|---|-------|----------|
| 24 | Inquiry form preset (`inquiry-forms/server/presets.ts`) | Business address "101 Marketside Avenue, Ponte Vedra, FL 32081," and an area list of Ponte Vedra, St. Augustine, Northeast Florida, Central Florida. |
| 25 | Staff application page (`apply/layout.tsx`, `hiring/apply-tracks.ts`) | "Northeast Florida" in the page description and a sample question. Also mentions wedding, golf and office roles (LRE is audiovisual only). |
| 26 | Social caption writer (`social/generate-captions.ts`) | Tells the writer to focus on Northeast Florida / Jacksonville. |
| 27 | Venue quotes screen (`venue-quotes-list.tsx`) | Placeholder name "Ponte Vedra Meeting Center." |
| 28 | Demo data (`av-erp/demo-shop.ts`) | Florida sample locations. |
| 29 | Calendar, staffing and review code | About 90 mentions of DJEP (the DJ event planner Vident used). Most are internal names, but they pull in a DJEP feed that LRE does not have. |
| 30 | Internal names | `canAccessVidentAv` and `videntAvAccess` appear in about 25 files. Staff do not see them, but they are Vident wording. |
| 31 | `AGENTS.md` | Still says Y? / Vident in a few lines and mentions the Vident site URL as the default. |
| 32 | Owner line | Company details list David as "Owner" only. LRE is 50/50 with Luke. |

## Suggested order

1. Items 14, 15, 20, 21, 22: nothing should be signed with Florida terms. Send the contracts and handbook to the Rhode Island attorney.
2. Items 1, 3, 5, 6, 7: you and Luke decide the money rules. Items 7 and 8 disagree with each other today (balance after the event vs. 30 days before), so pick one for LRE.
3. Items 24 to 32: I can clean these up in one pass once you say go. It touches about 30 files, mostly wording.


## Update, Nov 13, 2026: wording cleanup round 2

Done in code: Florida law and venue now read Rhode Island in the contract terms, handbook and the three agreements. The Florida travel counties, the Florida driver's license rule, DJEP names, Vident function names, the second inquiry form and the starter services button are all changed or removed.

**Still needs the Rhode Island attorney (items 14, 15, 20, 21, 22):** the new Rhode Island wording is a plain swap, not legal advice. The handbook covenant still carries the $10,000 liquidated damages clause. Do not sign with these terms until the attorney has read them.

One Vident word stays on purpose: the saved audience value `vident-av` in the database. Renaming it needs a migration and does nothing staff can see.
