import type { AgreementContent } from "@/lib/documents/types";

/** Seed content — admins edit/publish in Hub Documents after migration 089. */
export const INDEPENDENT_CONTRACTOR_AGREEMENT = {
  key: "independent-contractor",
  title: "Independent Contractor Agreement",
  subtitle:
    "Vident Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  introduction: [
    'This Independent Contractor Agreement ("Agreement") is entered into by and between Vident Productions, LLC and its DBAs (collectively "Company") and the undersigned Contractor ("Contractor").',
  ],
  acknowledgment:
    "By signing below, you agree to all terms and conditions outlined in this Independent Contractor Agreement.",
  companyLine: "Vident Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  ownerLine:
    "By: David Hanscom, Owner · 101 Marketside Avenue #404-123, Ponte Vedra, FL 32081 · 904-834-1216 · hello@videntproductions.com",
  signButtonLabel: "Sign Agreement",
  sections: [
    {
      id: "services",
      icon: "Briefcase",
      title: "1. Services",
      blocks: [
        {
          paragraphs: [
            "Contractor agrees to provide professional entertainment and/or production services (including but not limited to audiovisual, production, MC, and event-support services) for Company events as mutually scheduled.",
            "Contractor will perform services in a professional, timely, and competent manner consistent with Company standards and client expectations.",
          ],
        },
      ],
    },
    {
      id: "status",
      icon: "Scale",
      title: "2. Independent Contractor Status",
      blocks: [
        {
          paragraphs: [
            "Contractor is engaged as an independent contractor and not as an employee of Company. Nothing in this Agreement creates an employer-employee relationship, partnership, or joint venture.",
            "Contractor is responsible for their own taxes, insurance, and any applicable business licenses. Company will not withhold taxes or provide employee benefits. Contractor has no authority to bind Company to any agreement or obligation.",
          ],
        },
      ],
    },
    {
      id: "compensation",
      icon: "DollarSign",
      title: "3. Compensation",
      blocks: [
        {
          paragraphs: [
            "Contractor is paid on a per-event basis at rates agreed in advance for each engagement. Payment is issued after event completion according to Company payroll processes.",
            "Travel fees, overtime, and any additional compensation must be pre-approved by Company.",
          ],
        },
      ],
    },
    {
      id: "performance",
      icon: "AlertTriangle",
      title: "4. Performance Expectations",
      blocks: [
        {
          paragraphs: ["Contractor agrees to:"],
          items: [
            "Arrive 60–90 minutes early (or as otherwise directed) and be fully prepared",
            "Bring required equipment, music, and materials for the engagement",
            "Dress appropriately for the event and Company brand standards",
            "Follow event timelines and run-of-show instructions",
            "Maintain clear, timely communication with Company and on-site contacts",
            "Conduct themselves professionally with clients, guests, and venue staff",
            "Refrain from alcohol or substances before or during Company engagements",
          ],
        },
      ],
    },
    {
      id: "equipment",
      icon: "Wrench",
      title: "5. Equipment",
      blocks: [
        {
          paragraphs: [
            "Unless otherwise arranged, Contractor provides their own equipment and is responsible for its function, backup, and transport.",
            "When Company provides equipment, Contractor will handle it with care, use it only as directed, and promptly report damage or loss.",
          ],
        },
      ],
    },
    {
      id: "client-protection",
      icon: "Shield",
      title: "6. Non-Solicitation & Client Protection",
      blocks: [
        {
          paragraphs: [
            "Leads, clients, and opportunities introduced through Company belong to Company. Contractor will not solicit Company clients for personal services or competing work.",
            "**Protection window:** For twenty-four (24) months following the last event performed under this Agreement, Contractor agrees not to directly solicit or accept work from Company clients for personal or competing services arising from Company introductions.",
          ],
        },
      ],
    },
    {
      id: "staff-nonsolicit",
      icon: "Users",
      title: "7. Non-Solicitation of Staff",
      blocks: [
        {
          paragraphs: [
            "For twelve (12) months after termination of this Agreement, Contractor agrees not to recruit or solicit Company staff or contractors to leave Company for a competing business.",
          ],
        },
      ],
    },
    {
      id: "cancellation",
      icon: "Clock",
      title: "8. Cancellation & Availability",
      blocks: [
        {
          paragraphs: [
            "Contractor must honor confirmed bookings. Cancellation requires a minimum of seventy-two (72) hours' notice except for a documented emergency.",
            "Unapproved replacements are not permitted. Company may reassign or cancel an engagement when necessary to protect client service.",
          ],
        },
      ],
    },
    {
      id: "brand",
      icon: "Megaphone",
      title: "9. Brand Representation",
      blocks: [
        {
          paragraphs: [
            "Contractor represents the Company brand at Company events. Personal business cards, personal branding, or solicitation of personal services at Company events is not allowed without written approval.",
          ],
        },
      ],
    },
    {
      id: "term",
      icon: "FileText",
      title: "10. Term & Termination",
      blocks: [
        {
          paragraphs: [
            "This Agreement is ongoing and may be terminated by either party at any time with written notice. Outstanding compensation for completed events remains due upon termination.",
            "Company may terminate immediately for unprofessional conduct, no-show to a confirmed event, breach of confidentiality or non-solicitation, or damage to Company reputation or equipment.",
          ],
        },
      ],
    },
    {
      id: "media",
      icon: "Camera",
      title: "11. Media Release",
      blocks: [
        {
          paragraphs: [
            "Contractor grants Company permission to use photos and video from Company events that include Contractor, for marketing and internal training purposes, without additional compensation.",
          ],
        },
      ],
    },
    {
      id: "confidentiality",
      icon: "Lock",
      title: "12. Confidentiality",
      blocks: [
        {
          paragraphs: [
            "Contractor agrees to keep Company business practices, pricing, client information, and internal processes confidential, and not to use them outside Company engagements.",
          ],
        },
      ],
    },
    {
      id: "governing-law",
      icon: "Scale",
      title: "13. Governing Law & Entire Agreement",
      blocks: [
        {
          paragraphs: [
            "This Agreement is governed by the laws of the State of Florida. Any disputes shall be resolved in the courts of St. Johns County, Florida, unless the parties agree otherwise in writing.",
            "This Agreement supersedes all prior agreements on the same subject matter between the parties.",
          ],
        },
      ],
    },
  ],
} as const satisfies AgreementContent;
