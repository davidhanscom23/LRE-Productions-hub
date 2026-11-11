import type { AgreementContent } from "@/lib/documents/types";

/** Seed content — admins edit/publish in Hub Documents after migration 089. */
export const SUBCONTRACTOR_AGREEMENT = {
  key: "subcontractor",
  title: "Subcontractor Agreement",
  subtitle:
    "Independent Contractor Agreement — LRE Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  introduction: [
    'This Subcontractor Agreement ("Agreement") is entered into by and between LRE Productions, Inc. and its DBAs (collectively "Company") and the undersigned Subcontractor ("Subcontractor").',
  ],
  acknowledgment:
    "By signing below, you agree to all terms and conditions outlined in this Subcontractor Agreement.",
  companyLine: "LRE Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  ownerLine:
    "By: David Hanscom, Owner · 1061 Fish Rd., Unit 1, Tiverton, RI 02878 · 401-816-5496 · hello@lreproductions.com",
  signButtonLabel: "Sign Agreement",
  sections: [
    {
      id: "relationship",
      icon: "Briefcase",
      title: "Independent Contractor Relationship",
      blocks: [
        {
          paragraphs: [
            "The Subcontractor is engaged as an independent contractor and not as an employee of LRE Productions. Nothing in this Agreement creates an employer-employee relationship, partnership, or joint venture.",
            "The Subcontractor is responsible for their own taxes, insurance, and any applicable business licenses. The Company will not withhold taxes or provide employee benefits.",
          ],
        },
      ],
    },
    {
      id: "scope",
      icon: "ClipboardList",
      title: "Scope of Work",
      blocks: [
        {
          paragraphs: [
            "The Subcontractor agrees to provide event entertainment and/or production services as mutually agreed upon for each engagement. Specific details including date, time, location, and service requirements will be communicated prior to each event.",
            "The Subcontractor agrees to perform services in a professional manner consistent with the Company's standards, brand, and client expectations.",
          ],
        },
      ],
    },
    {
      id: "compensation",
      icon: "DollarSign",
      title: "Compensation & Payment",
      blocks: [
        {
          paragraphs: [
            "Compensation for each event will be agreed upon in advance and communicated via the Company's scheduling and management platform. Payment will be issued within seven (7) business days following the completed event, unless otherwise agreed.",
            "The Subcontractor is responsible for invoicing if required. Travel fees, overtime, and any additional compensation must be pre-approved by the Company.",
          ],
        },
      ],
    },
    {
      id: "conduct",
      icon: "AlertTriangle",
      title: "Professional Conduct & Standards",
      blocks: [
        {
          paragraphs: ["The Subcontractor agrees to:"],
          items: [
            "Arrive on time and prepared for all scheduled events",
            "Maintain a professional appearance consistent with event requirements",
            "Represent the Company's brand positively at all times",
            "Communicate promptly regarding scheduling, availability, and any issues",
            "Handle all Company equipment with care and report any damage immediately",
            "Refrain from soliciting Company clients for personal services",
          ],
          footnote:
            "Failure to meet these standards may result in termination of this Agreement and/or forfeiture of compensation for the event in question.",
        },
      ],
    },
    {
      id: "confidentiality",
      icon: "Shield",
      title: "Confidentiality & Non-Solicitation",
      blocks: [
        {
          paragraphs: [
            "The Subcontractor acknowledges access to client information, pricing, vendor relationships, and proprietary business processes. All such information is confidential and shall not be disclosed or used outside of Company engagements.",
            "The Subcontractor agrees not to directly solicit or accept work from Company clients for a period of one (1) year following the last event performed under this Agreement. Violation of this clause may result in legal action and liability for damages.",
          ],
        },
      ],
    },
    {
      id: "cancellation",
      icon: "Clock",
      title: "Cancellation & Availability",
      blocks: [
        {
          paragraphs: [
            "Once the Subcontractor confirms availability for an event, cancellation must be communicated at least fourteen (14) days in advance. Late cancellations without a valid emergency may result in a reduction in future bookings or termination of this Agreement.",
            "The Company reserves the right to cancel or reassign an event at any time. If Company cancels within forty-eight (48) hours of the event (other than for Subcontractor breach), the Subcontractor will receive a cancellation fee equal to fifty percent (50%) of the agreed compensation.",
          ],
        },
      ],
    },
    {
      id: "termination",
      icon: "Scale",
      title: "Termination & Governing Law",
      blocks: [
        {
          paragraphs: [
            "Either party may terminate this Agreement at any time with written notice. Outstanding compensation for completed events remains due upon termination.",
            "Grounds for immediate termination by the Company include, but are not limited to: unprofessional conduct, no-show to a confirmed event, breach of confidentiality, or damage to Company reputation or equipment.",
            "This Agreement is governed by the laws of the State of Florida. Any disputes shall be resolved in the courts of St. Johns County, Florida.",
          ],
        },
      ],
    },
  ],
} as const satisfies AgreementContent;
