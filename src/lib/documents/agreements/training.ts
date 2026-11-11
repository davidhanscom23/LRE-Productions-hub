import type { AgreementContent } from "@/lib/documents/types";

/** Seed content — admins edit/publish in Hub Documents after migration 089. */
export const TRAINING_AGREEMENT = {
  key: "training",
  title: "Training Agreement",
  subtitle:
    "Agreement for Trainee Position at LRE Productions",
  introduction: [
    "This Training Agreement sets expectations for trainees joining LRE Productions' training program.",
  ],
  acknowledgment:
    "By signing below, you agree to all terms and conditions outlined in this Training Agreement.",
  companyLine: "LRE Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  ownerLine:
    "By: David Hanscom, Owner · 1061 Fish Rd., Unit 1, Tiverton, RI 02878 · 401-816-5496 · hello@lreproductions.com",
  signButtonLabel: "Sign Agreement",
  sections: [
    {
      id: "purpose",
      icon: "Target",
      title: "Purpose",
      blocks: [
        {
          paragraphs: [
            "The purpose of the Trainee Agreement is to identify the skill, trade, or occupation for which the trainee is being trained and confirm the qualifying trainee framework that the trainee is following.",
          ],
        },
      ],
    },
    {
      id: "general",
      icon: "BookOpen",
      title: "General",
      blocks: [
        {
          paragraphs: [
            "Company will take the trainee on board for the trainee position, where they will initially learn by observing our team and by completing the virtual foundation training program. Trainee will have the opportunity to ask questions, and Company will share useful resources that will help the trainee develop in their role.",
          ],
        },
      ],
    },
    {
      id: "objectives",
      icon: "Lightbulb",
      title: "Learning Objectives",
      blocks: [
        {
          paragraphs: [
            "Training focuses on the following objectives (within the training program timeline):",
          ],
          items: [
            "Hosting and client interaction",
            "Audio fundamentals and signal flow",
            "Proficiency with standard audio, lighting, and video equipment",
            "Proficiency with standard corporate and ceremony setups",
            "Exposure to best practices operating as a working event production technician",
          ],
          footnote: "All objectives will be within the 10-week training program.",
        },
      ],
    },
    {
      id: "terms",
      icon: "FileText",
      title: "Terms & Conditions",
      blocks: [
        {
          paragraphs: [
            "Key terms of the trainee engagement include:",
          ],
          items: [
            "Training period of approximately seventy (70) days / ten (10) weeks",
            "Minimum of five (5) wedding (or comparable event) observations",
            "Completion of the assigned module training program",
            "This is a training agreement and is **not** an employment contract",
            "Training stipends/pay (when applicable): $20 per level completed and $20 per observation, as communicated by Company",
            "Trainee must communicate promptly, show up prepared, and follow Company direction on site",
          ],
        },
        {
          heading: "Grounds for early termination may include",
          items: [
            "Lack of communication",
            "Inappropriate behavior toward clients, guests, or staff",
            "Fraud or dishonesty",
            "Repeated no-shows or chronic lateness",
            "Unsafe or unprofessional conduct",
            "Breach of confidentiality",
            "Failure to complete assigned modules or observations without good cause",
            "Misuse of Company equipment or brand",
            "Any other conduct that harms Company reputation or safety",
          ],
        },
        {
          heading: "Review criteria",
          items: [
            "Standard of work",
            "Reliability",
            "Timekeeping",
            "General conduct",
          ],
        },
      ],
    },
    {
      id: "confidentiality",
      icon: "Shield",
      title: "Proprietary Information & Confidentiality",
      blocks: [
        {
          paragraphs: [
            "Trainee may have access to technical, sales, client, and financial information. Trainee agrees to keep such information confidential and not use it outside the training program.",
            "These confidentiality provisions survive termination of this Agreement for two (2) years.",
          ],
        },
      ],
    },
    {
      id: "inventions",
      icon: "Sparkles",
      title: "Inventions & Work Product",
      blocks: [
        {
          paragraphs: [
            "All inventions, designs, materials, show files, run-of-show notes, and work product created during the engagement for Company purposes are the exclusive property of the Company.",
          ],
        },
      ],
    },
    {
      id: "disputes",
      icon: "Scale",
      title: "Disputes & Governing Law",
      blocks: [
        {
          paragraphs: [
            "This Agreement is governed by the laws of the State of Florida. Any disputes shall be resolved in the courts of St. Johns County, Florida.",
          ],
        },
      ],
    },
  ],
} as const satisfies AgreementContent;
