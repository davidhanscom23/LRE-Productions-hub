/**
 * Public /apply tracks — scenario assessments by department
 * (Vident DJ / Photobooth / AV assessments).
 */

export type ApplyTrackSlug =
  | "av"
  | "corporate"
  | "wedding"
  | "golf"
  | "general";

export type ApplyAssessmentOption = {
  id: string;
  label: string;
};

export type ApplyAssessmentQuestion = {
  id: string;
  prompt: string;
  options: ApplyAssessmentOption[];
};

export type ApplyTrack = {
  slug: ApplyTrackSlug;
  /** Stored on hiring_applications.role_interest */
  roleInterest: string;
  label: string;
  shortLabel: string;
  blurb: string;
  assessmentTitle: string;
  assessmentIntro: string;
  questions: ApplyAssessmentQuestion[];
};

export const APPLY_TRACK_SLUGS = [
  "av",
  "corporate",
  "wedding",
  "golf",
  "general",
] as const satisfies readonly ApplyTrackSlug[];

export function isApplyTrackSlug(value: string): value is ApplyTrackSlug {
  return (APPLY_TRACK_SLUGS as readonly string[]).includes(value);
}

const AV_QUESTIONS: ApplyAssessmentQuestion[] = [
  {
    id: "av_mentor",
    prompt:
      "A newer crew member on-site asks you a basic question you’ve answered a hundred times. What do you do?",
    options: [
      { id: "a", label: "Point them to the manual or ask them to look it up." },
      { id: "b", label: "Answer quickly and get back to my own setup." },
      { id: "c", label: "Take a minute to actually walk them through it." },
      { id: "d", label: "Tell them to ask someone else — I’m busy." },
    ],
  },
  {
    id: "av_new_gear",
    prompt:
      "You’re handed a piece of gear you’ve genuinely never used before. What best describes you?",
    options: [
      { id: "a", label: "I’d rather someone experienced run it." },
      {
        id: "b",
        label: "I’m comfortable learning it once someone trains me.",
      },
      {
        id: "c",
        label:
          "I’m curious — I want to understand it and will usually start figuring it out.",
      },
      { id: "d", label: "I stick to gear I already know." },
    ],
  },
  {
    id: "av_call_time",
    prompt: "Load-in is scheduled for 3:00 PM. What does that mean to you in practice?",
    options: [
      { id: "a", label: "I should arrive around 3:00 and start unloading." },
      {
        id: "b",
        label: "I should be fully rigged and ready to test by 3:00.",
      },
      { id: "c", label: "A little late is fine if the schedule has room." },
      { id: "d", label: "It depends on how big the load-in is." },
    ],
  },
  {
    id: "av_audio_cut",
    prompt:
      "Ten minutes before doors, the main audio feed cuts out. What’s your first move?",
    options: [
      {
        id: "a",
        label:
          "Work the signal chain methodically from source to speaker until I find it.",
      },
      { id: "b", label: "Swap cables and hope one of them was the issue." },
      {
        id: "c",
        label: "Tell the client we may need to push doors back.",
      },
      { id: "d", label: "Call for backup and wait for instructions." },
    ],
  },
  {
    id: "av_ros_change",
    prompt:
      "The producer moves the run-of-show up 30 minutes with no warning. What do you do?",
    options: [
      {
        id: "a",
        label:
          "Confirm the new plan, quickly figure out what’s affected, and adjust the build.",
      },
      {
        id: "b",
        label: "Explain that a change this size needs more lead time.",
      },
      {
        id: "c",
        label: "Do exactly what I’m told without flagging any risk.",
      },
      {
        id: "d",
        label: "Say I’ll try but can’t promise everything will be dialed in.",
      },
    ],
  },
  {
    id: "av_pre_doors",
    prompt:
      "You’re fully rigged with 30 minutes before doors. What are you most likely doing?",
    options: [
      { id: "a", label: "Relaxing nearby until it’s go time." },
      { id: "b", label: "Checking my phone since the build is done." },
      {
        id: "c",
        label: "Running the show file and cue-to-cue one more time.",
      },
      {
        id: "d",
        label:
          "Walking the room for sightlines, cable coverage, and a final gain check.",
      },
    ],
  },
  {
    id: "av_wiring_mistake",
    prompt: "You realize a wiring mistake could affect the show. What do you do?",
    options: [
      {
        id: "a",
        label: "Fix it quietly and only mention it if someone asks.",
      },
      {
        id: "b",
        label: "See if it actually causes a problem before saying anything.",
      },
      {
        id: "c",
        label:
          "Own it, figure out if I can fix it in time, and flag the producer appropriately.",
      },
      {
        id: "d",
        label: "Tell the client exactly what happened immediately, mid-build.",
      },
    ],
  },
  {
    id: "av_damaged_gear",
    prompt: "You accidentally damage a piece of company equipment. What do you do?",
    options: [
      {
        id: "a",
        label: "Report it right away with exactly what happened.",
      },
      {
        id: "b",
        label: "Try to fix or replace it before telling anyone.",
      },
      { id: "c", label: "Wait to see if it gets noticed." },
      {
        id: "d",
        label: "Mention something fell off without details.",
      },
    ],
  },
  {
    id: "av_strike",
    prompt:
      "You’re exhausted at strike after a long show day. What matters most to you?",
    options: [
      {
        id: "a",
        label: "Getting everything into cases fast so we can leave.",
      },
      {
        id: "b",
        label:
          "Everything gets packed carefully and accounted for, tired or not.",
      },
      {
        id: "c",
        label: "The expensive gear gets handled right; smaller stuff can wait.",
      },
      {
        id: "d",
        label: "Move quickly but double-check the big items.",
      },
    ],
  },
];

const CORPORATE_QUESTIONS: ApplyAssessmentQuestion[] = [
  {
    id: "corp_exec_ask",
    prompt:
      "An executive you’re not assigned to stops you in the hallway asking where breakout rooms are. What’s your instinct?",
    options: [
      {
        id: "a",
        label: "Point them vaguely and keep moving — not my lane.",
      },
      {
        id: "b",
        label: "Give a quick answer if I know it, then get back to work.",
      },
      {
        id: "c",
        label: "Walk them partway or connect them to the right person.",
      },
      {
        id: "d",
        label: "Say I only handle production and leave it there.",
      },
    ],
  },
  {
    id: "corp_call_time",
    prompt:
      "Call time is 7:00 AM for a full-day summit. What does that mean to you?",
    options: [
      { id: "a", label: "I aim to arrive right around 7:00." },
      {
        id: "b",
        label: "Being 10–15 minutes behind is fine if load-in looks light.",
      },
      {
        id: "c",
        label:
          "I’ve built enough travel buffer that being late would take something genuinely unexpected.",
      },
      {
        id: "d",
        label: "What matters is being ready before attendees arrive.",
      },
    ],
  },
  {
    id: "corp_agenda_shift",
    prompt:
      "The client moves a keynote up 25 minutes with almost no notice. What do you do?",
    options: [
      {
        id: "a",
        label:
          "Confirm the new plan, map what’s affected, and reset cues with the team.",
      },
      {
        id: "b",
        label: "Explain we need more lead time for a change that size.",
      },
      {
        id: "c",
        label: "Do exactly what’s asked without flagging risk.",
      },
      {
        id: "d",
        label: "Say I’ll try, but can’t promise everything will be ready.",
      },
    ],
  },
  {
    id: "corp_mic_fail",
    prompt:
      "Mid-panel, the presenter’s lapel cuts out. What’s your first move?",
    options: [
      {
        id: "a",
        label:
          "Stay calm, switch to a backup mic or channel, and keep the panel moving.",
      },
      {
        id: "b",
        label: "Announce there’s a technical issue and pause the session.",
      },
      {
        id: "c",
        label: "Wait to see if it comes back on its own.",
      },
      {
        id: "d",
        label: "Leave my post to diagnose at the presenter’s jacket first.",
      },
    ],
  },
  {
    id: "corp_brand_tension",
    prompt:
      "A brand manager wants a last-minute look that conflicts with the approved deck. How do you handle it?",
    options: [
      {
        id: "a",
        label: "Make the change immediately — the person in the room wins.",
      },
      {
        id: "b",
        label:
          "Stay warm, confirm the approved plan, and escalate if they still push.",
      },
      {
        id: "c",
        label: "Refuse flatly and cite the run-of-show.",
      },
      {
        id: "d",
        label: "Ignore the request after they’ve asked twice.",
      },
    ],
  },
  {
    id: "corp_pre_doors",
    prompt:
      "You’re set with 20 minutes before doors. What are you most likely doing?",
    options: [
      { id: "a", label: "Relaxing nearby until go time." },
      { id: "b", label: "On my phone since the build is done." },
      {
        id: "c",
        label: "Running a final cue-to-cue and confidence-monitor check.",
      },
      {
        id: "d",
        label:
          "Walking sightlines, cable covers, and a last gain / slide check.",
      },
    ],
  },
  {
    id: "corp_new_hire",
    prompt:
      "A newer teammate is clearly lost on a simple patch. What do you do?",
    options: [
      { id: "a", label: "Tell them to read the plot and figure it out." },
      { id: "b", label: "Answer in one sentence and move on." },
      {
        id: "c",
        label: "Walk them through it so they can do it next time.",
      },
      { id: "d", label: "Take over the task so it gets done faster." },
    ],
  },
  {
    id: "corp_mistake",
    prompt:
      "You realize a cue list typo could misfire a walk-in look. What do you do?",
    options: [
      {
        id: "a",
        label: "Fix it quietly and only mention it if someone asks.",
      },
      {
        id: "b",
        label: "See if it actually causes a problem first.",
      },
      {
        id: "c",
        label:
          "Own it, correct it if there’s time, and flag the lead appropriately.",
      },
      {
        id: "d",
        label: "Tell the client mid-build exactly what you messed up.",
      },
    ],
  },
  {
    id: "corp_compliment",
    prompt: "At the end of the day, which compliment would mean the most?",
    options: [
      { id: "a", label: "“The slides looked incredible.”" },
      { id: "b", label: "“Audio was perfect all day.”" },
      { id: "c", label: "“Best tech team we’ve worked with.”" },
      {
        id: "d",
        label:
          "“You made the whole program feel effortless and took care of us.”",
      },
    ],
  },
];

const WEDDING_QUESTIONS: ApplyAssessmentQuestion[] = [
  {
    id: "wed_stranger_ask",
    prompt:
      "A couple you’re not even working with stops you after a reception to ask for production advice. What’s your instinct?",
    options: [
      {
        id: "a",
        label: "Point them to our website and keep moving.",
      },
      {
        id: "b",
        label: "Give a quick answer if I have a second to spare.",
      },
      {
        id: "c",
        label: "Stop, actually listen, and help however I can.",
      },
      {
        id: "d",
        label: "Not really my job if I’m not working their event.",
      },
    ],
  },
  {
    id: "wed_long_week",
    prompt:
      "It’s a Saturday wedding at the end of a long week and you’re running on empty. How do you approach the night?",
    options: [
      {
        id: "a",
        label:
          "Once I’m on-site, it’s showtime — the couple deserves my best regardless of my week.",
      },
      {
        id: "b",
        label: "I’ll do the job well but stay a bit more low-key than usual.",
      },
      {
        id: "c",
        label: "I’ll let the room set the pace and follow their lead.",
      },
      {
        id: "d",
        label: "I’ll get through it cleanly without making mistakes.",
      },
    ],
  },
  {
    id: "wed_lost_guest",
    prompt:
      "While setting up, you notice an older guest standing alone, clearly unsure where to go. What do you do?",
    options: [
      {
        id: "a",
        label: "Keep setting up — guest wrangling isn’t really my role.",
      },
      { id: "b", label: "Wait to see if they ask someone for help." },
      {
        id: "c",
        label: "Point them toward a venue staff member.",
      },
      {
        id: "d",
        label: "Walk over, introduce myself, and see if I can help.",
      },
    ],
  },
  {
    id: "wed_bride_stress",
    prompt:
      "A bride walks up mid-reception and says, “Everything feels like it’s falling apart right now.” What’s your first move?",
    options: [
      {
        id: "a",
        label: "Tell her it’ll all work out and get back to my post.",
      },
      {
        id: "b",
        label: "Ask if there’s anything production-related she needs from me.",
      },
      { id: "c", label: "Suggest she find her coordinator." },
      {
        id: "d",
        label:
          "Give her my full attention, reassure her, and find out what I can take off her plate.",
      },
    ],
  },
  {
    id: "wed_banned_request",
    prompt:
      "A guest keeps pushing for something the couple specifically asked us not to do. How do you handle it?",
    options: [
      {
        id: "a",
        label: "Give in if enough people are asking.",
      },
      {
        id: "b",
        label: "Tell them straight up the couple banned it.",
      },
      {
        id: "c",
        label: "Ignore the request after they’ve asked twice.",
      },
      {
        id: "d",
        label:
          "Stay warm, thank them, and offer an alternative that still fits the plan.",
      },
    ],
  },
  {
    id: "wed_pre_intros",
    prompt:
      "Five minutes before introductions, you realize something in the setup isn’t working. What’s your first reaction?",
    options: [
      {
        id: "a",
        label:
          "Stay calm, isolate the problem, work the fix, and have a backup ready.",
      },
      {
        id: "b",
        label: "Start unplugging and restarting things until something works.",
      },
      {
        id: "c",
        label: "Flag the coordinator that introductions may need to slide.",
      },
      {
        id: "d",
        label: "Call for help and wait on instructions.",
      },
    ],
  },
  {
    id: "wed_timeline",
    prompt:
      "The coordinator tells you the timeline just moved up 20 minutes, out of nowhere. What do you do?",
    options: [
      {
        id: "a",
        label:
          "Confirm the new plan, quickly work out what’s affected, and adjust.",
      },
      {
        id: "b",
        label: "Explain I need more notice to shift the timeline.",
      },
      {
        id: "c",
        label: "Do exactly what I’m told without asking anything.",
      },
      {
        id: "d",
        label: "Say I’ll try, but can’t promise everything will be ready.",
      },
    ],
  },
  {
    id: "wed_call_time",
    prompt:
      "Your call time is 3:00 PM to start setup. What does that time actually mean to you?",
    options: [
      { id: "a", label: "I aim to arrive right around 3:00." },
      {
        id: "b",
        label: "Being 10–15 minutes behind is fine if there’s plenty of setup time.",
      },
      {
        id: "c",
        label:
          "I’ve built in enough travel buffer that being late would take something genuinely unexpected.",
      },
      {
        id: "d",
        label: "What matters is being ready before guests show up.",
      },
    ],
  },
  {
    id: "wed_compliment",
    prompt: "At the end of the night, which compliment would mean the most to you?",
    options: [
      { id: "a", label: "“The lighting looked incredible.”" },
      { id: "b", label: "“Everything ran on time.”" },
      { id: "c", label: "“Best production team we’ve ever had.”" },
      {
        id: "d",
        label:
          "“You made the whole night feel effortless and took care of us.”",
      },
    ],
  },
];

const GOLF_QUESTIONS: ApplyAssessmentQuestion[] = [
  {
    id: "golf_player_ask",
    prompt:
      "A player you’re not assigned to stops you between holes asking where the beverage cart went. What’s your instinct?",
    options: [
      {
        id: "a",
        label: "Point vaguely and keep moving — not my hole.",
      },
      {
        id: "b",
        label: "Give a quick answer if I know it, then get back to my station.",
      },
      {
        id: "c",
        label: "Help them get oriented or radio the right person.",
      },
      {
        id: "d",
        label: "Say I only handle production and leave it there.",
      },
    ],
  },
  {
    id: "golf_call_time",
    prompt:
      "Call time is 5:30 AM for a shotgun start. What does that mean to you?",
    options: [
      { id: "a", label: "I aim to arrive right around 5:30." },
      {
        id: "b",
        label: "Being 10–15 minutes behind is fine if the course looks quiet.",
      },
      {
        id: "c",
        label:
          "I’ve built enough travel buffer that being late would take something genuinely unexpected.",
      },
      {
        id: "d",
        label: "What matters is being ready before the first groups tee off.",
      },
    ],
  },
  {
    id: "golf_weather",
    prompt:
      "A squall line is 40 minutes out and sponsors still want the on-course activation running. What do you do?",
    options: [
      {
        id: "a",
        label:
          "Confirm the weather call with the lead, secure gear, and reset the plan with the client.",
      },
      {
        id: "b",
        label: "Keep everything live until rain actually hits.",
      },
      {
        id: "c",
        label: "Shut it all down immediately without looping anyone in.",
      },
      {
        id: "d",
        label: "Wait for someone else to decide — weather isn’t my call.",
      },
    ],
  },
  {
    id: "golf_sponsor_push",
    prompt:
      "A sponsor wants to move a contest hole mid-round after groups have already started. How do you handle it?",
    options: [
      {
        id: "a",
        label: "Move it immediately — the person asking is the client.",
      },
      {
        id: "b",
        label:
          "Stay warm, explain the player-flow risk, and escalate before relocating.",
      },
      {
        id: "c",
        label: "Refuse flatly and cite the original hole sheet.",
      },
      {
        id: "d",
        label: "Ignore the request after they’ve asked twice.",
      },
    ],
  },
  {
    id: "golf_gear_fail",
    prompt:
      "Your closest activation’s sound drops out with players already approaching. What’s your first move?",
    options: [
      {
        id: "a",
        label:
          "Stay calm, work the signal chain / power, and keep a backup path ready.",
      },
      {
        id: "b",
        label: "Unplug and restart everything until something works.",
      },
      {
        id: "c",
        label: "Tell the nearest players the hole is closed.",
      },
      {
        id: "d",
        label: "Call for help and wait on instructions before touching anything.",
      },
    ],
  },
  {
    id: "golf_pace",
    prompt:
      "A group is backed up at your challenge hole and looking frustrated. What are you most likely doing?",
    options: [
      {
        id: "a",
        label: "Stay on my phone until it’s clearly my turn to engage.",
      },
      {
        id: "b",
        label: "Wait quietly — pace of play isn’t production’s problem.",
      },
      {
        id: "c",
        label:
          "Greet them, keep energy up, and move the interaction efficiently so the hole clears.",
      },
      {
        id: "d",
        label: "Ask them to skip the activation to catch up.",
      },
    ],
  },
  {
    id: "golf_timeline",
    prompt:
      "The tournament director moves awards up 30 minutes with almost no notice. What do you do?",
    options: [
      {
        id: "a",
        label:
          "Confirm the new plan, map what’s affected, and reset cues with the team.",
      },
      {
        id: "b",
        label: "Explain that a change this size needs more lead time.",
      },
      {
        id: "c",
        label: "Do exactly what’s asked without flagging risk.",
      },
      {
        id: "d",
        label: "Say I’ll try, but can’t promise everything will be ready.",
      },
    ],
  },
  {
    id: "golf_damaged_gear",
    prompt:
      "A cart scrapes a piece of company equipment during hole moves. What do you do?",
    options: [
      {
        id: "a",
        label: "Report it right away with exactly what happened.",
      },
      {
        id: "b",
        label: "Try to fix or replace it before telling anyone.",
      },
      { id: "c", label: "Wait to see if it gets noticed." },
      {
        id: "d",
        label: "Mention something got bumped without details.",
      },
    ],
  },
  {
    id: "golf_compliment",
    prompt: "At the end of the day, which compliment would mean the most?",
    options: [
      { id: "a", label: "“The hole contests looked incredible.”" },
      { id: "b", label: "“Everything stayed on time.”" },
      { id: "c", label: "“Best golf production team we’ve used.”" },
      {
        id: "d",
        label:
          "“You made the whole tournament feel effortless and took care of players and sponsors.”",
      },
    ],
  },
];

export const APPLY_TRACKS: Record<ApplyTrackSlug, ApplyTrack> = {
  av: {
    slug: "av",
    roleInterest: "Audiovisual",
    label: "Audiovisual",
    shortLabel: "AV",
    blurb:
      "Run sound, lighting, and staging behind events that need to go off without a hitch.",
    assessmentTitle: "Event Technician Working Style Assessment",
    assessmentIntro:
      "A handful of real scenarios from setting up sound, lighting, and staging on-site. Answer with what you’d actually do — it helps us understand how you work under pressure and where to focus training.",
    questions: AV_QUESTIONS,
  },
  corporate: {
    slug: "corporate",
    roleInterest: "Corporate",
    label: "Corporate",
    shortLabel: "Corporate",
    blurb:
      "Conferences, launches, and summits — polish under pressure with executives in the room.",
    assessmentTitle: "Corporate Production Working Style Assessment",
    assessmentIntro:
      "Real moments from corporate programs in Northeast Florida. Pick the response closest to how you’d actually handle each one — there’s no perfect score to chase.",
    questions: CORPORATE_QUESTIONS,
  },
  wedding: {
    slug: "wedding",
    roleInterest: "Wedding & Social",
    label: "Wedding & Social",
    shortLabel: "Weddings",
    blurb:
      "Luxury weddings and social gatherings where guests and couples feel taken care of.",
    assessmentTitle: "Wedding & Social Working Style Assessment",
    assessmentIntro:
      "A quick set of real scenarios from weddings and social events — answer with what you’d actually do. It helps us understand your style and point you toward the right training.",
    questions: WEDDING_QUESTIONS,
  },
  golf: {
    slug: "golf",
    roleInterest: "Golf",
    label: "Golf",
    shortLabel: "Golf",
    blurb:
      "Tournaments, on-course activations, and awards — keep players and sponsors moving.",
    assessmentTitle: "Golf Event Working Style Assessment",
    assessmentIntro:
      "Real moments from golf tournaments and on-course production. Answer with what you’d actually do — it helps us understand your pace, judgment, and where training would help most.",
    questions: GOLF_QUESTIONS,
  },
  general: {
    slug: "general",
    roleInterest: "",
    label: "General",
    shortLabel: "General",
    blurb: "Office or another role that doesn’t fit the tracks above.",
    assessmentTitle: "General application",
    assessmentIntro:
      "Tell us a bit about yourself. No account needed — we’ll follow up by email.",
    questions: [],
  },
};

/** Featured department cards on /apply (excludes general). */
export const APPLY_FEATURED_TRACKS: ApplyTrack[] = [
  APPLY_TRACKS.av,
  APPLY_TRACKS.corporate,
  APPLY_TRACKS.wedding,
  APPLY_TRACKS.golf,
];

export function getApplyTrack(slug: string): ApplyTrack | null {
  if (!isApplyTrackSlug(slug)) return null;
  return APPLY_TRACKS[slug];
}
