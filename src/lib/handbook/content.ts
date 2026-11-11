/**
 * LRE Productions Staff Handbook — default seed content.
 *
 * Prefer editing in the Hub (Staff Handbook → Edit) once migration 025 is applied.
 * Saved copies live in the staff_handbook table. This file is the fallback seed
 * before the first save, and HANDBOOK_IS_DRAFT_DEFAULT is used until then.
 */

export type HandbookBlock = {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  footnote?: string;
};

export type HandbookSection = {
  id: string;
  icon: HandbookIconName;
  title: string;
  blocks: HandbookBlock[];
};

export type HandbookIconName =
  | "Briefcase"
  | "Heart"
  | "Calendar"
  | "DollarSign"
  | "Users"
  | "Phone"
  | "Mail"
  | "Server"
  | "Share2"
  | "Shield"
  | "Zap"
  | "Building"
  | "Car"
  | "Cigarette"
  | "Pill"
  | "Swords"
  | "Lock"
  | "FileText";

export type HandbookContent = {
  title: string;
  subtitle: string;
  introduction: string[];
  mission: string;
  acknowledgment: string;
  companyLine: string;
  ownerLine: string;
  sections: HandbookSection[];
};

export const HANDBOOK_ICON_NAMES = [
  "Briefcase",
  "Heart",
  "Calendar",
  "DollarSign",
  "Users",
  "Phone",
  "Mail",
  "Server",
  "Share2",
  "Shield",
  "Zap",
  "Building",
  "Car",
  "Cigarette",
  "Pill",
  "Swords",
  "Lock",
  "FileText",
] as const satisfies readonly HandbookIconName[];

/**
 * Default draft flag before a row exists in staff_handbook.
 * After the first admin save, the database `is_draft` column is authoritative.
 */
export const HANDBOOK_IS_DRAFT_DEFAULT = true;

/** @deprecated Use HANDBOOK_IS_DRAFT_DEFAULT or getHandbookDocument().isDraft */
export const HANDBOOK_IS_DRAFT = HANDBOOK_IS_DRAFT_DEFAULT;

export const HANDBOOK_CONTENT = {
  "title": "Staff Handbook",
  "subtitle": "Policies & Procedures — Draft for LRE Productions",
  "introduction": [
    "Welcome to the LRE Productions Staff Handbook! This document serves as a comprehensive guide for all staff of LRE Productions and its audiovisual, corporate, wedding & social, and golf event services.",
    "At LRE Productions, we believe in fostering an inclusive, welcoming environment where everyone feels valued, respected, and empowered to contribute their unique talents. This manual outlines the policies, procedures, and expectations that promote a positive, productive, and safe workplace for everyone.",
    "By embracing our core values of Integrity, Gratitude, and Teamwork, we strive to create a culture that celebrates diversity, champions teamwork, and delivers exceptional event experiences for our clients. These values guide us as we work together, ensuring every team member has the opportunity to grow, succeed, and thrive.",
    "We are thrilled to have you as part of our dynamic team and are excited to support your journey with us. Together, we will continue to innovate and bring unforgettable experiences to life. Welcome aboard!"
  ],
  "mission": "Our mission is to deliver unforgettable event experiences with integrity, gratitude, and teamwork—creating stress-free events that leave every client feeling valued and celebrated.",
  "acknowledgment": "I acknowledge that I have read, fully understand, and agree to adhere to LRE Productions' Policies and Procedures Handbook.",
  "companyLine": "LRE Productions · Audiovisual · Corporate · Wedding & Social · Golf",
  "ownerLine": "By: David Hanscom, Owner · 1061 Fish Rd., Unit 1, Tiverton, RI 02878 · 401-816-5496 · hello@lreproductions.com",
  "sections": [
    {
      "id": "employment",
      "icon": "Briefcase",
      "title": "Employment",
      "blocks": [
        {
          "heading": "Hiring",
          "items": [
            "Staff are classified as either W-2 staff or 1099 Independent Contractors.",
            "A payroll profile is required before any payment will be processed.",
            "LRE Productions will provide necessary training and support tools."
          ]
        },
        {
          "heading": "Reviews",
          "items": [
            "**90-Day Review:** Every new staff member undergoes a probationary period starting from the date of their first event. At the end of this 90-day period, a performance and satisfaction review will take place.",
            "**Annual Review:** Each staff member will have an annual review 365 days after their first event to assess performance and satisfaction."
          ]
        },
        {
          "heading": "Termination",
          "items": [
            "LRE Productions reserves the right to terminate the staff member's agreement at any time if performance standards do not meet reasonable expectations.",
            "Final payment will be provided following the signing of a Contractor Termination Agreement."
          ],
          "footnote": "This policy ensures a structured process for hiring, reviewing, and terminating agreements with staff, maintaining clear expectations and accountability."
        }
      ]
    },
    {
      "id": "benefits",
      "icon": "Heart",
      "title": "Staff Benefits",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions is pleased to offer health, dental, and vision insurance benefits to eligible full-time W-2 staff through the company benefits provider. Participation in each plan is voluntary (opt-in)."
          ]
        },
        {
          "heading": "Eligibility",
          "items": [
            "Benefits are available to full-time W-2 staff only. 1099 Independent Contractors are not eligible.",
            "Staff become eligible to enroll after successfully completing their 90-day probationary period.",
            "Enrollment must be completed within 30 days of becoming eligible. Missed enrollment windows may result in waiting until the next open enrollment period."
          ]
        },
        {
          "heading": "Coverage Options",
          "items": [
            "Health Insurance — the company benefits provider (opt-in)",
            "Dental Insurance — the company benefits provider (opt-in)",
            "Vision Insurance — the company benefits provider (opt-in)"
          ],
          "footnote": "Specific plan details, premium rates, and contribution information will be provided during onboarding and at each annual open enrollment period. For questions about your benefits, contact David Hanscom directly."
        }
      ]
    },
    {
      "id": "scheduling",
      "icon": "Calendar",
      "title": "Scheduling & Pay Periods",
      "blocks": [
        {
          "heading": "Scheduling",
          "items": [
            "LRE Productions will provide a set schedule by the 15th of the prior month for events in the following month.",
            "Example: The December schedule will be finalized by November 15.",
            "Requested time off must be submitted at least 90 days prior to the desired date off.",
            "Time-off requests should be submitted through the Hub's Time Off page."
          ]
        },
        {
          "heading": "Peak Season Blackout Periods",
          "paragraphs": [
            "LRE Productions experiences peak demand during certain months of the year. During designated blackout periods, time-off requests will not be automatically approved and require direct written approval from David Hanscom."
          ],
          "items": [
            "**Designated Blackout Months:** May, June, October, December",
            "All time-off requests during blackout months must be submitted in writing to David Hanscom no less than 90 days in advance.",
            "Submitting a request does not guarantee approval.",
            "Staff who are unavailable during a confirmed event booking during a blackout period may be subject to disciplinary action, up to and including removal from the schedule."
          ]
        },
        {
          "heading": "Illness",
          "items": [
            "LRE Productions must be notified immediately if a staff member is ill and unable to work.",
            "The staff member is responsible for finding a suitable replacement, which must be approved by LRE Productions before the event date."
          ]
        },
        {
          "heading": "Pay Period",
          "items": [
            "Staff will receive payment for completed events on the 1st and 15th of each month, following their event, via the company payroll system."
          ]
        }
      ]
    },
    {
      "id": "travel",
      "icon": "DollarSign",
      "title": "Travel & Expenses",
      "blocks": [
        {
          "heading": "Travel",
          "items": [
            "Most travel required by LRE Productions occurs within Duval, St. Johns, and Clay counties.",
            "Travel outside these counties using a personal vehicle will be reimbursed at 58 cents per mile or the current IRS Standard Mileage Rate."
          ]
        },
        {
          "heading": "Miscellaneous Expenses",
          "items": [
            "Any purchases made on behalf of LRE Productions must be pre-approved by David Hanscom.",
            "A printed receipt is required for full reimbursement."
          ],
          "footnote": "This policy ensures fair compensation for travel and proper handling of business-related expenses."
        }
      ]
    },
    {
      "id": "meetings",
      "icon": "Users",
      "title": "Client Meetings",
      "blocks": [
        {
          "heading": "Attendance",
          "items": [
            "The lead event professional must meet with every client or couple before the assigned event.",
            "Video conferences are acceptable for clients located out of state/area or upon request."
          ]
        },
        {
          "heading": "Preparation",
          "items": [
            "Staff must arrive and be fully set up for the meeting at least 15 minutes prior to the agreed time.",
            "All planning forms and materials must be printed in advance; do not print them at the office just before the meeting."
          ]
        },
        {
          "heading": "Attire",
          "items": [
            "Business casual attire is required for all client meetings."
          ]
        }
      ]
    },
    {
      "id": "event-expectations",
      "icon": "Heart",
      "title": "Event Expectations & Behavior",
      "blocks": [
        {
          "heading": "Event Expectations",
          "paragraphs": [
            "Staff must arrive on-site with sufficient time to:"
          ],
          "items": [
            "Set up and soundcheck equipment.",
            "Clean up and change into appropriate event attire.",
            "Coordinate with other vendors on-site.",
            "Review the details and schedule for the event."
          ]
        },
        {
          "heading": "Professional Behavior",
          "items": [
            "Staff must maintain professional conduct at all times while representing LRE Productions.",
            "Harassment of any kind is strictly prohibited and will not be tolerated."
          ]
        },
        {
          "heading": "Post-Event Requirements",
          "items": [
            "Staff must complete LRE Productions' \"End of Event Form\" within 24 hours of the event.",
            "Event payment will be withheld until the form is submitted."
          ],
          "footnote": "Adherence to these policies ensures a high standard of professionalism and accountability at all events."
        }
      ]
    },
    {
      "id": "dress-code",
      "icon": "Users",
      "title": "Dress Code",
      "blocks": [
        {
          "heading": "Planning Meetings",
          "items": [
            "Business casual attire is required for all client meetings."
          ]
        },
        {
          "heading": "Weddings",
          "items": [
            "**Men:** A dry-cleaned suit, including a tie, is mandatory. During planning meetings, ask the client about the groom's attire to help make an informed clothing choice.",
            "**Women:** A nice dress or pantsuit is required; leggings or jeans are not permitted. A black dress is a popular choice among female professionals in the industry."
          ]
        },
        {
          "heading": "Other Events",
          "items": [
            "For events outside of weddings or private parties, dress codes may vary.",
            "If unsure about appropriate attire for a specific event, consult your manager in advance."
          ],
          "footnote": "This policy ensures a professional appearance and aligns with event expectations."
        }
      ]
    },
    {
      "id": "cell-phone",
      "icon": "Phone",
      "title": "Cell Phone Policy",
      "blocks": [
        {
          "paragraphs": [
            "This policy applies to all devices capable of making calls, sending messages, accessing the internet, or managing emails, whether company-supplied or personally owned."
          ]
        },
        {
          "heading": "Cell Phone Use at Work",
          "items": [
            "LRE Productions recognizes the use of personal cell phones for business purposes, particularly during events.",
            "Staff are encouraged to capture a few key event pictures for social media promotion.",
            "Cell phone usage should remain discrete and should not distract from event responsibilities.",
            "Limit usage to promotional purposes or emergencies only."
          ]
        }
      ]
    },
    {
      "id": "email",
      "icon": "Mail",
      "title": "Email Usage Policy",
      "blocks": [
        {
          "heading": "Business Use Only",
          "items": [
            "Company email is strictly for LRE Productions business purposes.",
            "Do not use company email or computers for personal business.",
            "Avoid forwarding non-business emails to associates, family, or friends as they waste company time and resources."
          ]
        },
        {
          "heading": "Confidential Information",
          "items": [
            "Do not share company confidential information outside LRE Productions without prior authorization."
          ]
        },
        {
          "heading": "Prohibited Content",
          "items": [
            "Sending or viewing pornography, or sharing inappropriate jokes or stories via email, is prohibited and will be addressed under the company's sexual harassment policy.",
            "Emails that discriminate against any individual or group based on protected classifications (e.g., race, gender, nationality, religion) are strictly prohibited."
          ]
        },
        {
          "heading": "Ownership and Monitoring",
          "items": [
            "All emails and content created or stored on company equipment are owned by LRE Productions.",
            "Management reserves the right to access and review any company email or content stored on company systems.",
            "Staff should not expect privacy for any electronic communications created or stored within the company's network."
          ]
        }
      ]
    },
    {
      "id": "server",
      "icon": "Server",
      "title": "Server Access Policy",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions provides access to a secure server for staff to store and retrieve media files, documents, and other work-related materials."
          ],
          "items": [
            "**Authorized Use Only:** Access to the server is granted solely for work-related purposes. Personal use of the server is prohibited.",
            "**Prohibited Items:** Storage of pornographic or obscene content, illegal files including pirated software or copyrighted material without authorization, or any material that violates company policies or laws is strictly forbidden.",
            "**Confidentiality:** Staff must ensure that confidential or proprietary information stored on the server is protected and not shared without proper authorization.",
            "**Data Security:** Staff are responsible for securing sensitive data. Always use strong passwords and ensure that files are stored in the appropriate, designated directories.",
            "**Remote Access:** Staff accessing the server remotely must use secure, company-approved methods to ensure data integrity and prevent unauthorized access.",
            "**Proper Storage:** Ensure files are organized and stored correctly to facilitate efficient access by others. Avoid storing unnecessary or duplicate files.",
            "**Compliance:** All users must comply with company policies regarding data protection, privacy, and legal standards. Any violation of this policy may result in disciplinary action."
          ],
          "footnote": "By using the server, staff agree to these terms and acknowledge their responsibility to protect and manage company data appropriately."
        }
      ]
    },
    {
      "id": "social-media",
      "icon": "Share2",
      "title": "Social Media Policy",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions supports staff's rights to engage in online interactions and contribute to industry discussions through social media. These guidelines ensure responsible online behavior while protecting the company's privacy, confidentiality, and reputation."
          ]
        },
        {
          "heading": "Guidelines for Online Interaction",
          "items": [
            "Staff are not authorized to speak or act on behalf of LRE Productions unless explicitly permitted by David Hanscom.",
            "Inform David Hanscom if you create a blog, site, or content that mentions LRE Productions, its products, staff, partners, customers, or competitors."
          ]
        },
        {
          "heading": "Confidentiality and Trademarks",
          "items": [
            "Do not share proprietary or confidential information, such as trademarks, product releases, financials, or company strategies.",
            "Company logos and trademarks may not be used without written permission to avoid implying official representation."
          ]
        },
        {
          "heading": "Respect and Privacy",
          "items": [
            "Speak respectfully about LRE Productions and all associated individuals or entities. Avoid defamatory, derogatory, or unprofessional remarks.",
            "Do not use copyrighted materials or engage in misrepresentation."
          ]
        },
        {
          "heading": "Professionalism and Liability",
          "items": [
            "Your online content reflects on LRE Productions. Write knowledgeably and accurately, maintaining professionalism.",
            "Staff are legally responsible for any content posted online. Violations, including defamatory, harassing, or inappropriate content, may result in disciplinary action or legal consequences.",
            "Commentary or content that creates a hostile work environment or damages the company's reputation may lead to disciplinary measures."
          ]
        },
        {
          "heading": "Personal Account Privacy",
          "paragraphs": [
            "To protect both your personal privacy and the company's reputation, all staff are strongly encouraged to set their personal social media accounts (Instagram, Facebook, TikTok, X/Twitter, etc.) to private. While we cannot require this, it is strongly recommended as a professional best practice, particularly given the public-facing nature of our work."
          ]
        },
        {
          "heading": "Professional Instagram Account",
          "paragraphs": [
            "Staff are encouraged — though not required — to create a separate, dedicated professional Instagram account for their event work."
          ],
          "items": [
            "Keep the account public and professional at all times.",
            "Content should reflect positively on you and LRE Productions.",
            "Tag @videntproductions where appropriate to cross-promote.",
            "Do not post anything that conflicts with LRE Productions' brand, mission, or values.",
            "Client photos or event footage may only be posted with client consent and in alignment with company social media standards."
          ]
        }
      ]
    },
    {
      "id": "harassment",
      "icon": "Shield",
      "title": "Policy Against Workplace Harassment",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions is committed to maintaining a work environment free from sexual harassment and other forms of discriminatory harassment. All staff and contractors must act professionally and respectfully toward colleagues. Harassment is unlawful and strictly prohibited in all work-related settings, including events and when using company property."
          ]
        },
        {
          "heading": "Sexual Harassment",
          "paragraphs": [
            "Sexual harassment includes unwelcome advances, requests for sexual favors, or other conduct of a sexual nature that conditions employment benefits, influences employment decisions, or creates a hostile, intimidating, or offensive environment."
          ],
          "items": [
            "Unwelcome touching or advances.",
            "Sexual comments, jokes, or epithets.",
            "Display of sexually suggestive materials.",
            "Sexual gestures or inquiries into private matters."
          ]
        },
        {
          "heading": "Discriminatory Harassment",
          "paragraphs": [
            "Harassment based on race, color, gender, religion, sexual orientation, age, national origin, disability, or other protected categories is also prohibited."
          ],
          "items": [
            "Slurs, stereotypes, or hostile acts.",
            "Circulation of offensive materials."
          ]
        },
        {
          "heading": "Reporting and Investigation",
          "paragraphs": [
            "Staff/contractors who experience or witness harassment should report it promptly to their supervisor or principal. LRE Productions will investigate all reports discreetly and thoroughly."
          ]
        },
        {
          "heading": "Disciplinary Action",
          "paragraphs": [
            "Violations of this policy may result in disciplinary actions, including counseling, warnings, suspension, or termination. Retaliation against individuals reporting or cooperating in harassment investigations is strictly prohibited."
          ]
        }
      ]
    },
    {
      "id": "safety",
      "icon": "Zap",
      "title": "Safety Policies & Procedures",
      "blocks": [
        {
          "heading": "Electricity",
          "items": [
            "Inspect all electrical outlets and cords before use to prevent injury or accidents. Check for exposed wires, frayed cords, or any visible damage.",
            "Understand basic electrical safety principles, such as preventing overloads and using proper grounding methods.",
            "Always use a grounded power supply for all equipment to minimize the risk of electrical shock or fire."
          ]
        },
        {
          "heading": "Wires & Cables",
          "items": [
            "Avoid running wires across high-traffic areas to reduce the risk of tripping. If necessary, use cable covers or alternative pathways.",
            "Use gaff tape to secure cables in place, except where the venue prohibits tape use or has specific requirements.",
            "Inspect all cables before use to ensure they are in good working condition. Replace any damaged or worn cables.",
            "When placing fixtures at height, always secure them with a safety cable to prevent equipment from falling."
          ]
        },
        {
          "heading": "Miscellaneous",
          "items": [
            "Use a ladder only with a second person present to act as a spotter.",
            "Never block fire exits under any circumstances. Ensure that all exit pathways remain clear.",
            "Maintain clear pathways for staff, guests, and other event vendors at all times."
          ],
          "footnote": "These policies ensure safety and compliance at all events. Adherence is mandatory for all team members."
        }
      ]
    },
    {
      "id": "office",
      "icon": "Building",
      "title": "Office Etiquette & Policies",
      "blocks": [
        {
          "items": [
            "**Door Code Security:** Your 4-digit door code is personal and confidential. Do not share it with anyone.",
            "**Cleanliness:** Clean up after yourself and ensure no mess is left for others to handle.",
            "**Equipment Returns:** All equipment must be returned to its designated location after use.",
            "**Company Vehicle Parking:** When using a company vehicle, return it to the designated parking spaces opposite the bay door."
          ],
          "footnote": "Following these guidelines ensures a safe, organized, and professional workspace for everyone."
        }
      ]
    },
    {
      "id": "vehicle",
      "icon": "Car",
      "title": "Company Vehicle Policies",
      "blocks": [
        {
          "heading": "Eligibility",
          "items": [
            "The driver must be approved and added to LRE Productions' commercial auto policy.",
            "The driver must possess a valid Florida Driver's License.",
            "The driver must have a clean driving record.",
            "If the driver's status changes at any point, they must immediately notify management."
          ]
        },
        {
          "heading": "Company Vehicle Guidelines",
          "items": [
            "**Safety:** All passengers must wear safety belts at all times.",
            "**Speed Limits:** The driver must obey speed limits at all times.",
            "**Texting:** No texting while operating the vehicle.",
            "**No Smoking:** Smoking is strictly prohibited in the vehicle.",
            "**Clearance:** The driver must be aware of the 10-foot clearance required.",
            "**Parking:** The van must not be parked in a parking garage.",
            "**Security:** The van must not be left unlocked while unattended.",
            "**Tickets:** Any tickets (parking, speeding, etc.) will be paid by the driver, not LRE Productions."
          ],
          "footnote": "This policy ensures safe and responsible use of company vehicles, protecting both the driver and LRE Productions."
        }
      ]
    },
    {
      "id": "tobacco",
      "icon": "Cigarette",
      "title": "Tobacco Free Workplace",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions is committed to providing a healthy, comfortable, and productive work environment for all staff. Recognizing the dangers of secondhand smoke and its health risks, we have implemented a tobacco-free policy for all team members."
          ]
        },
        {
          "heading": "Health Risks",
          "paragraphs": [
            "Numerous studies have shown that secondhand smoke is a major contributor to indoor air pollution and a significant cause of diseases such as heart disease, stroke, respiratory disease, and lung cancer."
          ]
        },
        {
          "heading": "Policy Details",
          "items": [
            "LRE Productions' events are entirely tobacco-free. Smoking is prohibited during working hours or on event premises at any time.",
            "This policy applies to all staff, clients, contractors, and visitors.",
            "The policy is designed to reduce the risks of health issues caused by tobacco exposure and to improve workplace productivity."
          ]
        }
      ]
    },
    {
      "id": "drug",
      "icon": "Pill",
      "title": "Drug Free Workplace",
      "blocks": [
        {
          "paragraphs": [
            "LRE Productions is dedicated to providing exceptional event production services while ensuring the health, safety, and well-being of our team."
          ]
        },
        {
          "heading": "Policy Guidelines",
          "items": [
            "**Illegal Drugs and Controlled Substances:** It is a violation of company policy for any staff member or contractor to use, possess, sell, convey, distribute, or manufacture illegal drugs, intoxicants, or controlled substances while on the clock in any capacity.",
            "**Alcohol Use:** The use or being under the influence of alcohol during an event or while using company property is prohibited.",
            "**Prescription Drug Abuse:** The illegal use of prescription drugs is prohibited. Staff are responsible for reporting the use of prescribed medications that may impair their judgment, performance, or behavior."
          ],
          "footnote": "Violations of this policy may result in disciplinary action, up to and including termination of employment or contract agreement."
        }
      ]
    },
    {
      "id": "weapons",
      "icon": "Swords",
      "title": "Weapon-Free Workplace",
      "blocks": [
        {
          "paragraphs": [
            "The purpose of this policy is to ensure that LRE Productions maintains a workplace that is safe, respectful, and free from violence for all staff and contractors."
          ]
        },
        {
          "heading": "Prohibited Items",
          "paragraphs": [
            "A license to carry a weapon does not supersede the company's policy regarding weapons. Dangerous weapons include, but are not limited to, firearms, explosives, knives, and any other items that could be considered dangerous or could potentially cause harm."
          ]
        },
        {
          "heading": "Disciplinary Action",
          "paragraphs": [
            "Any staff member or contractor found in violation of this policy will be subject to prompt disciplinary action, up to and including termination."
          ]
        },
        {
          "heading": "Right to Search",
          "paragraphs": [
            "LRE Productions reserves the right to search any company-owned or leased vehicles, as well as personal vehicles, packages, containers, briefcases, purses, lockers, desks, or any other personal items brought onto company premises, to ensure compliance with this policy. Failure or refusal to allow a search may result in disciplinary action, including termination."
          ]
        }
      ]
    },
    {
      "id": "covenants",
      "icon": "Lock",
      "title": "Restrictive Covenants Agreement",
      "blocks": [
        {
          "paragraphs": [
            "This Restrictive Covenants Agreement is entered into by and between LRE Productions, Inc. and its DBAs (collectively \"LRE\" or the \"Company\") and the Staff. LRE desires to protect its Confidential Information and its Business, Customers, and Prospective Customers through the restrictive covenants set forth below."
          ]
        },
        {
          "heading": "Nature of Company's Business",
          "paragraphs": [
            "LRE is engaged in the business of providing audiovisual and event production services for weddings, parties, corporate events, golf events, social gatherings, and other special occasions."
          ]
        },
        {
          "heading": "Confidential Information",
          "paragraphs": [
            "Staff agrees that during employment they will have access to and learn about Company's Confidential Information, which includes all information that is confidential, sensitive, or proprietary regarding the Company or that is not generally known to the public."
          ]
        },
        {
          "heading": "Non-Disclosure",
          "paragraphs": [
            "Staff agrees not to directly or indirectly use, disclose, publish, communicate, or make available any of LRE's Confidential Information. Staff's obligations with regard to maintaining confidentiality will continue indefinitely after employment ends."
          ]
        },
        {
          "heading": "Return of Company Property",
          "paragraphs": [
            "Upon termination of employment for any reason, Staff is required to return and not retain any copies of all of Company's Confidential Information in Staff's possession."
          ]
        },
        {
          "heading": "Intellectual Property",
          "paragraphs": [
            "All of the Staff's right, title, and interest in any intellectual property developed or created in connection with employment is owned by and belongs exclusively to LRE."
          ]
        },
        {
          "heading": "Non-Competition",
          "paragraphs": [
            "For a period of eighteen (18) months beginning on Staff's termination date, Staff agrees not to compete with the Company in any business which directly competes with the Business conducted by the Company anywhere within a fifty (50) mile radius of 1061 Fish Rd., Unit 1, Tiverton, RI 02878.",
            "The above restrictions are not intended to prevent staff from performing AV or event production services at club, nightlife, or festival-related events. However, staff must notify their manager and obtain the Company's permission prior to performing at such events."
          ]
        },
        {
          "heading": "Non-Solicitation",
          "items": [
            "**Customers:** For eighteen (18) months from termination, Staff agrees not to solicit any Customer or Prospective Customer, vendor, supplier, or referral source of Company with whom Staff interacted during employment.",
            "**Staff:** For eighteen (18) months from termination, Staff agrees not to solicit, hire, recruit, or attempt to solicit or hire any person who is or was employed by LRE."
          ]
        },
        {
          "heading": "Non-Interference",
          "paragraphs": [
            "For eighteen (18) months from termination, Staff agrees not to interfere or attempt to interfere with Company's Business or to disrupt the business relationship between Company and any existing Customer or Prospective Customer, vendor, supplier, or referral source."
          ]
        },
        {
          "heading": "Notice of Future Employment",
          "paragraphs": [
            "If Staff seeks employment with a competing business, Staff will notify the competing business of this Agreement. Staff further agrees that Company may notify such competing business of the existence of this Agreement."
          ]
        },
        {
          "heading": "Enforcement",
          "paragraphs": [
            "In the event of a breach, Staff agrees that LRE is entitled to seek a temporary or permanent injunction or other equitable relief. Staff also agrees to pay the Company liquidated damages in the amount of $10,000.00 for any violation of the non-competition, non-solicitation, or non-interference restrictions.",
            "This Agreement is governed by the laws of the State of Florida. Jurisdiction and venue lies exclusively in the federal and state courts located in St. Johns County, Florida."
          ]
        },
        {
          "heading": "Additional Provisions",
          "items": [
            "**Tolling:** In the event Staff breaches any restrictive covenants, the running of the period will be tolled during any such breach.",
            "**Severability:** The invalidity or unenforceability of a provision will not affect the enforcement of other provisions.",
            "**Entire Agreement:** This Agreement constitutes the entire agreement and may be amended only by mutual written consent.",
            "**Assignment:** Staff may not assign this Agreement. Company may assign it to any successor legal entity.",
            "**Survival:** The restrictions are enforceable irrespective of how long the Staff has been employed and irrespective of the reasons for termination.",
            "**Knowing and Voluntary:** Staff has read and fully understands the provisions and has been given an opportunity to obtain the advice of legal counsel prior to signing."
          ]
        }
      ]
    }
  ]
} as const satisfies HandbookContent;
