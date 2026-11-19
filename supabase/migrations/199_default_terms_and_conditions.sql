-- Standard Terms and Conditions for the LRE Productions Event Agreement.
-- Adds a "contract" document template kind (shown to staff as "Agreement").
-- Its default template's terms print only on the Event Agreement (PDF and
-- signing page), not on estimates. Staff can edit the text any time on
-- Rentals > Templates. Safe to run more than once.
alter table public.av_document_templates
  drop constraint if exists av_document_templates_kind_check;
alter table public.av_document_templates
  add constraint av_document_templates_kind_check
  check (kind in ('estimate', 'invoice', 'contract', 'other'));

do $do$
declare
  terms_text text := $terms$ENGAGEMENT; SERVICES
(a) Engagement. The Client retains LRE Productions to provide the rental products and services listed above, and LRE Productions shall provide the rental products and services listed above.
(b) LRE Productions' Obligations. LRE Productions shall: (i) devote as much productive time, energy, and ability to the performance of its duties under this agreement as may be necessary to provide the required Services in a timely and productive manner; (ii) perform the Services in a safe, good, and workmanlike manner by fully trained, skilled, competent, and experienced personnel using at all times adequate equipment in good working order. LRE Productions may delegate incidental responsibilities to the staff, but the primary responsibility for fulfilling the Services remains with LRE Productions; (iii) provide all equipment and supplies required to perform the Services; and (iv) consult with the Client about the specific services, moments, or individuals to be covered at the Event.
(c) Client's Obligations. The Client shall: (i) make timely payments of amounts earned by LRE Productions under this agreement; (ii) obtain permits and necessary permission for all locations at which LRE Productions will be providing Services; and (iii) provide relevant information to assist the production staff with the performance of the Services.

COMPENSATION
(a) Fee. As full compensation for the Services, the Client shall pay LRE Productions the sum of GRAND TOTAL (listed above), to be paid as follows:

PAYMENT
The first payment of 50% of the total fee is to be paid within 7 days of signing this agreement and the final balance payment no later than 7 days after the event has concluded. If there are any Client approved change orders (additional charges for service and/or equipment), the approved charges will be added to the final balance due.
(b) No Payments in Certain Circumstances. No payment will be payable to LRE Productions under any of the following circumstances:
(i) if prohibited under applicable government law, regulation, or policy; or
(ii) if LRE Productions did not directly perform or complete the Services;
(c) No Other Compensation. The compensation set out above will be LRE Productions' sole compensation under this agreement.
(d) Except as otherwise provided herein, all payments are not refundable.

EVENT
(a) Schedule. The Client is obligated to confirm the schedule of activities at the event at least one week prior to the event start date.
(b) Venue and Location Limitations. LRE Productions may offer technical recommendations but is not responsible for negotiation or additional outside equipment.
(c) Limitation of Liability. LRE Productions will endeavor to produce and deliver the production of the event, but is not responsible for requested audio, lighting, or video services or coverage that is not performed or is missed, lack of coverage or service resulting from poor internet service, internet outages, power outages, weather conditions, lack of available light, location restrictions, interference from other audio, lighting, or video equipment, other videographers, photographers, or flashes, or other conditions beyond the control of LRE Productions.

MATERIAL EVENT CHANGES
The Client acknowledges that any change to the time, date, or location of the Event (each a "Material Event Change") made after the effective date of this agreement may
(a) cause LRE Productions to become unable or unavailable to provide the Services,
(b) impact the quality of the Services, or
(c) result in a need for the provision of services in addition to the Services.
LRE Productions shall make reasonable efforts to accommodate a Material Event Change.

ADDITIONAL RENTAL ITEMS AND/OR SERVICES
If the Client asks to supplement the rental items and/or services with the purchase of additional rental items and/or services offered by LRE Productions, and LRE Productions agrees and can fulfill that request, LRE Productions will bill those additional rental items and/or services to the Client at then agreed-on rates.

EXCLUSIVITY
LRE Productions will be the only event audiovisual production service provider retained by the Client at the Event. Guests and attendees from the event may take informal videos during the Event for non-commercial purposes, provided those individuals do not interfere with LRE Productions staff's duties or equipment. If in LRE Productions' staff's opinion, those individuals are interfering with LRE Productions' provision of its Services, the Client shall require those individuals interfering with LRE Productions to stop all further recording or filming. The Client may use a photographer at the event, which will not violate this agreement.

COMPANY RIGHTS
(a) Ownership Rights. LRE Productions will be the sole and exclusive owner of the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event and all rights with respect to the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event (collectively, "Rights"), including all rights in and to the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event created by LRE Productions, in all media and all forms of exploitation whether now known or hereafter devised, including all allied and subsidiary rights, such as merchandising rights, non-interactive and interactive electronic publication rights, multimedia rights, publication rights including for publicity and advertising purposes.
(b) Creative Rights. LRE Productions may edit the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event at its discretion, and may not offer all footage or recordings captured to the Client. LRE Productions reserves the right to edit and release only the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event deemed creditable as professional in quality and within LRE Productions' artistic standards.
(c) License. LRE Productions grants the Client a nonexclusive, nontransferable license to use the graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event for unlimited personal use only.

PROMOTIONAL RIGHTS
The Client hereby grants LRE Productions the limited perpetual right to use, publish, and exhibit, on the Internet and in other publications, any graphics, videos, audio, lighting designs and programming, and any other necessary materials for the production of the event to promote LRE Productions' business, upon client's consent.

TERM, CANCELLATION, AND RESCHEDULING
(a) Term. This agreement will become effective as described in the EFFECTIVENESS section below. Unless it is terminated earlier in accordance with subsection (b), this agreement will continue until the rental items and/or services have been satisfactorily completed and LRE Productions has been paid in full for those rental items and/or services (the "Term").
(b) Cancellation by Client. If for any reason Client cancels this Agreement more than 60 days before the event date, LRE Productions will keep all monies paid by the client as liquidated damages, but Client will not be responsible for any remainder due. Cancellation must be made in writing, signed by the signing party, and sent via email to LRE Productions at the email address shown on this agreement. If Client fails to supply written cancellation as specified before the event date or cancels within 60 days of the event date, Client shall be required to pay the full balance due.
(c) Rescheduling by Client. In the event that Client reschedules the event and LRE Productions is able to rebook the original event date for the fee Client agreed to under this Agreement or any amount above that fee, Client will receive credit for all monies already paid. Notification of rescheduling must be made in writing by Client and sent via email to LRE Productions at the email address shown on this agreement. Confirmation of receipt of notification email by LRE Productions must be obtained. Credit may be applied only to event coverage within one year (12 months) of the original event date, provided LRE Productions is available. In the event that Client reschedules the event and LRE Productions is not able to rebook the original date, Client forfeits the first payment. If Client fails to supply a written rescheduling notification 30 days before the event date, Client shall be required to pay the full balance due.

INDEMNIFICATION
Each Party's Responsibility. Each party to this Agreement agrees to be fully responsible for its acts or omissions, or its agent's acts or omissions when acting within the scope of employment or agency and agrees to be liable for any damage resulting from said acts or omissions.

FORCE MAJEURE
Neither party is responsible for delays resulting from causes beyond its reasonable control, including without limitation fire, explosion, flood, war, strike, or riot, provided that the nonperforming party uses commercially reasonable efforts to avoid or remove those causes of nonperformance and continues performance under this Agreement with reasonable dispatch whenever the causes are removed.

GOVERNING LAW
This Agreement is governed and construed in accordance with the laws of the State of Rhode Island. LRE Productions and client have all remedies afforded each by Rhode Island law. The venue in any action or litigation commenced enforcing this Agreement is the State of Rhode Island.

AMENDMENTS
No amendment to this agreement will be effective unless it is in writing and signed by both parties.

ASSIGNMENT AND DELEGATION
(a) No Assignment. Neither party may assign any of its rights under this agreement, except with the prior written consent of the other party. All voluntary assignments of rights are limited by this subsection.
(b) No Delegation. Neither party may delegate any performance under this agreement, except with the prior written consent of the Client.
(c) Enforceability of an Assignment or Delegation. If a purported assignment or purported delegation is made, or if both are made, in violation of this section, it is void and they are void.

ENTIRE CONTRACT
This Agreement constitutes the complete understanding of the Parties and supersedes any prior contracts, arrangements, or communications, whether oral or written, with respect to the subject matter of this Agreement.

SEVERABILITY
If any provision in this agreement is, for any reason, held to be invalid, illegal, or unenforceable in any respect, that invalidity, illegality, or unenforceability will not affect any other provisions of this agreement, but this agreement will be construed as if the invalid, illegal, or unenforceable provisions had never been contained in this agreement unless the deletion of those provisions would result in such a material change that would cause completion of the transactions contemplated by this agreement to be unreasonable.

MODIFICATIONS & WAIVER
The Parties may only modify this Agreement in writing and signed by both Parties. The waiver by either party of any default under this Agreement is not a waiver of any other or subsequent default and is not effective unless it is set forth in a document signed by the Party against which the waiver is asserted.

ENTIRE AGREEMENT
This agreement constitutes the final agreement of the parties. It is the complete and exclusive expression of the parties' agreement with respect to the subject matter of this agreement. All prior and contemporaneous communications, negotiations, and agreements between the parties relating to the subject matter of this agreement are expressly merged into and superseded by this agreement. The provisions of this agreement may not be explained, supplemented, or qualified by evidence of trade usage or a prior course of dealings. Neither party was induced to enter this agreement by, and neither party is relying on, any statement, representation, warranty, or agreement of the other party except those set forth expressly in this agreement. Except as set forth expressly in this agreement, there are no conditions precedent to this agreement's effectiveness.

HEADINGS
The descriptive headings of the sections and subsections of this agreement are for convenience only and do not affect this agreement's construction or interpretation.

EFFECTIVENESS
This agreement will become effective when all parties have signed it. The date this agreement is signed by the last party to sign it (as indicated by the date associated with that party's signature) will be deemed the date of this agreement.

NECESSARY ACTS; FURTHER ASSURANCES
Each party shall use all reasonable efforts to take, or cause to be taken, all actions necessary or desirable to consummate and make effective the transactions this agreement contemplates or to evidence or carry out the intent and purposes of this agreement.

COUNTERPARTS; FACSIMILE SIGNATURES
A copy of this Agreement may be executed by each individual/entity separately, and when each has executed a copy thereof, such copies, taken together, shall be deemed to be a full and complete agreement between the Parties. The Parties agree that a facsimile copy (electronic copy) of this Agreement, which contains the Parties' signatures, shall be used as the original and deemed valid.$terms$;
begin
  -- Safe to run more than once: refresh the text if the template exists,
  -- otherwise add it as the default Agreement (contract) template.
  update public.av_document_templates
     set terms = terms_text
   where kind = 'contract'
     and name = 'LRE Productions Terms and Conditions';
  if not found then
    insert into public.av_document_templates (name, kind, terms, is_default, is_active)
    select 'LRE Productions Terms and Conditions', 'contract', terms_text, true, true
    where not exists (
      select 1 from public.av_document_templates
      where kind = 'contract' and is_default and is_active
    );
  end if;
end
$do$;
