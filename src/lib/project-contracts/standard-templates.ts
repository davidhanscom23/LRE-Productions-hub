import { AV_CLAUSES as AV, DMC_CANCELLATION, DMC_TERMS, numberedSections } from "./standard-terms";

export const DMC_TEMPLATE_NAME = "Services Agreement - DMC (non-AV)";
export const AV_TEMPLATE_NAME = "AV Agreement - Audio Visual only";
export const COMBINED_TEMPLATE_NAME = "Services and AV Agreement - DMC plus AV";

const details = `Client | {{client_name}}
Email | {{client_email}}
Phone | {{client_phone}}
Address | {{client_address}}
Event | {{project_name}}
Event date | {{event_date}}
Location | {{location}}`;

const dmcPayment = `Fees | {{fee_total}}
Payment terms | 50% payment is due upon booking and remaining balance is due 30 days prior to event.

{{payment_schedule}}`;

const dmcIntro = `This statement of work ("Statement of Work") and the Service Terms and Conditions attached hereto (collectively, the "Agreement") is entered into by and between the client specified in the Statement of Work ("Client") and {{company_name}} ("Provider"). Any capitalized terms used but not defined in this Statement of Work have the meaning set forth in the Service Terms and Conditions.

Accepted and agreed by their duly authorized representatives of the parties as of the Effective Date.`;

/** 1. DMC (non-AV): Statement of Work + Service Terms. */
export const DMC_BODY = `## STATEMENT OF WORK
${details}

## TERM
Start date | {{event_date}}
End date | {{event_date}}

## FEES AND PAYMENT
${dmcPayment}

## RESCHEDULING AND CANCELLATION POLICY
${DMC_CANCELLATION}

## SERVICES
{{services_list}}

## ADDITIONAL TERMS
${dmcIntro}

## SERVICE TERMS AND CONDITIONS
${DMC_TERMS}`;

const avAll = (effective: string) =>
  numberedSections([
    ["ENGAGEMENT; SERVICES", AV.engagement],
    ["COMPENSATION", `${AV.compensationIntro}\n\nPayment. ${AV.compensationPayment}\n\n${AV.compensationRest}`],
    ["EVENT", AV.event],
    ["MATERIAL EVENT CHANGES", AV.materialChanges],
    ["ADDITIONAL RENTAL ITEMS AND/OR SERVICES", AV.additional],
    ["EXCLUSIVITY", AV.exclusivity],
    ["COMPANY RIGHTS", AV.companyRights],
    ["PROMOTIONAL RIGHTS", AV.promotional],
    ["TERM, CANCELLATION, AND RESCHEDULING", AV.term.replace("{{effective}}", effective)],
    ["INDEMNIFICATION", AV.indemnification],
    ["FORCE MAJEURE", AV.forceMajeure],
    ["GOVERNING LAW", AV.governingLaw],
    ["ASSIGNMENT AND DELEGATION", AV.assignment],
    ["SEVERABILITY", AV.severability],
    ["MODIFICATIONS & WAIVER", AV.modifications],
    ["ENTIRE AGREEMENT", AV.entireAgreement],
    ["HEADINGS", AV.headings],
    ["EFFECTIVENESS", AV.effectiveness],
    ["NECESSARY ACTS; FURTHER ASSURANCES", AV.furtherAssurances],
    ["COUNTERPARTS; FACSIMILE SIGNATURES", AV.counterparts],
  ]);

/** 2. AV only: rental products and services + the 22 AV terms. */
export const AV_BODY = `## AGREEMENT DETAILS
${details}

## RENTAL PRODUCTS AND SERVICES
{{services_list}}

Grand total | {{fee_total}}

All final bills will include a 23% service charge.

## TERMS AND CONDITIONS
${avAll("section 18")}

I, the undersigned, accept the terms and conditions of rental.`;

/** Part B of the combined contract: the AV clauses that are specific to AV work (the boilerplate is covered by Part A). */
const avPartB = numberedSections(
  [
    ["ENGAGEMENT; SERVICES", AV.engagement],
    [
      "NO PAYMENT IN CERTAIN CIRCUMSTANCES",
      `(a) No payment will be payable to LRE Productions under any of the following circumstances:
(i) if prohibited under applicable government law, regulation, or policy; or
(ii) if LRE Productions did not directly perform or complete the Services;
(b) No Other Compensation. The compensation set out in the Statement of Work will be LRE Productions' sole compensation under this agreement.
(c) Except as otherwise provided herein, all payments are not refundable.
If there are any Client approved change orders (additional charges for service and/or equipment), the approved charges will be added to the final balance due.`,
    ],
    ["EVENT", AV.event],
    ["MATERIAL EVENT CHANGES", AV.materialChanges],
    ["ADDITIONAL RENTAL ITEMS AND/OR SERVICES", AV.additional],
    ["EXCLUSIVITY", AV.exclusivity],
    ["COMPANY RIGHTS", AV.companyRights],
    ["PROMOTIONAL RIGHTS", AV.promotional],
    ["TERM, CANCELLATION, AND RESCHEDULING", AV.term.replace("{{effective}}", "Part A, Section 1 (the Effective Date)")],
    ["INDEMNIFICATION", AV.indemnification],
    ["GOVERNING LAW", AV.governingLaw],
    ["ASSIGNMENT AND DELEGATION", AV.assignment],
  ],
  1,
  "B",
);

/** 3. DMC plus AV: one Statement of Work, general terms (Part A), AV terms (Part B). */
export const COMBINED_BODY = `## STATEMENT OF WORK
${details}

## TERM
Start date | {{event_date}}
End date | {{event_date}}

## SERVICES AND EQUIPMENT
{{services_list}}

## FEES AND PAYMENT
${dmcPayment}

All final bills will include a 23% service charge.

## RESCHEDULING AND CANCELLATION POLICY
${DMC_CANCELLATION}

## HOW THESE TERMS FIT TOGETHER
This Agreement covers both event coordination services and audio visual (AV) services and equipment. Part A applies to all of the Services. Part B applies in addition to Part A to the AV services and equipment. If Part A and Part B conflict about the AV services and equipment, Part B controls. For all other Services, Part A controls. The payment schedule in this Statement of Work applies to all fees under this Agreement.

## ADDITIONAL TERMS
${dmcIntro}

## PART A: GENERAL SERVICE TERMS AND CONDITIONS
${DMC_TERMS}

## PART B: AUDIO VISUAL SERVICES TERMS AND CONDITIONS
These AV terms apply to the audio visual products, equipment and services in the Statement of Work (the "AV Services"). In this Part B, "Client" and "LRE Productions" have the same meaning as "Client" and "Provider" in Part A.

${avPartB}`;

export const STANDARD_CONTRACT_TEMPLATES: { name: string; body: string }[] = [
  { name: DMC_TEMPLATE_NAME, body: DMC_BODY },
  { name: AV_TEMPLATE_NAME, body: AV_BODY },
  { name: COMBINED_TEMPLATE_NAME, body: COMBINED_BODY },
];
