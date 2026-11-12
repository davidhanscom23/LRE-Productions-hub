/**
 * Guide to a smooth Speaker Experience. Public page at /speaker-guide that LRE
 * shares with event organizers so their speakers and presenters can read it.
 * Keep in sync with public/lre-speaker-av-guide.pdf. The research sources behind these tips are internal only, so they are not shown to clients.
 */

export const SPEAKER_GUIDE_PDF = "/lre-speaker-av-guide.pdf";

export const SPEAKER_GUIDE_INTRO = {
  kicker: "An LRE Productions guide for first-time & less experienced speakers",
  title: "Guide to a smooth Speaker Experience",
  lead: "Simple things you can do before you step on stage so the tech disappears and your message takes center stage.",
  body: "Thank you for sharing your expertise with the audience. On the day of the event, we are busy running sound, slides, and stage cues, so we rarely get a quiet moment to share what we have learned from watching hundreds of talks. This guide gathers the most common things that trip up speakers (and the easy fixes) so you can walk on stage relaxed and ready.",
};

export const FIVE_THINGS: { title: string; body: string }[] = [
  {
    title: "Hold the mic close, and keep it there.",
    body: "About 4 to 6 inches (a hand's width) from your mouth, aimed at your mouth. Do not let it drift down as you talk.",
  },
  {
    title: "Speak up, a little more than feels natural.",
    body: "A strong voice is easy for us to balance. A quiet voice forces us to turn you up, and that is what causes feedback.",
  },
  {
    title: "Send your slides early and check in 15 minutes before.",
    body: "Use 16:9 widescreen, large text, and bring any video files separately as a backup.",
  },
  {
    title: "Talk to the audience, not the screen.",
    body: "Your slides are cues, not a script. Have a plan for talking without them.",
  },
  {
    title: "Treat every mic as live.",
    body: "Until your tech takes it from you, assume everyone can hear you. That includes the restroom.",
  },
];

export type Callout = { title: string; body: string };
export type DoAvoid = { title: string; do: string[]; avoid: string[] };
export type Bullet = { lead?: string; text: string };

export const MIC_SECTION = {
  myth: {
    title: "Myth buster: feedback usually comes from being too quiet",
    body: "Many people think a loud voice causes that painful squeal. It is usually the opposite. When a speaker talks softly or lets the mic sink toward their belt, the audio engineer has to raise the volume, and the mic starts picking up the room and the loudspeakers. That loop is feedback. A tech can easily turn a strong voice down, but it is much harder to turn a quiet one up.",
  } satisfies Callout,
  handheld: {
    title: "Handheld microphone",
    do: [
      "Hold it about 4 to 6 inches from your mouth, pointed at your mouth like a flashlight shining in.",
      "Keep the same distance the whole time. Check in with yourself every few sentences.",
      "Turn your head, not the mic, when you address different parts of the room.",
      "Use a steady, projected, natural voice. Imagine speaking to someone in the back row.",
      "Stand away from the loudspeakers. They are often not where you expect, so ask your tech.",
      "Leave volume to us. We will adjust from the booth.",
    ],
    avoid: [
      "Letting the mic drift down to your chest or belly while you talk or gesture.",
      "Tapping or blowing into the mic to test it. Just start speaking at your normal distance.",
      "Covering or cupping the top of the mic with your hand.",
      "Swinging the mic around with your gestures. Steady volume beats a moving mic.",
      "Setting the mic down carelessly. It can make a loud bang and damage it.",
      "Opening with “Can everyone hear me?” We check that before you go on.",
    ],
  } satisfies DoAvoid,
  lav: {
    title: "Lavalier (clip-on) and headset microphones",
    do: [
      "Let your tech place it, then leave it alone. About mid-chest, roughly 6 to 8 inches below your chin.",
      "Speak at the same strong, clear level you would with a handheld.",
      "Wear something with a collar, placket, belt, or pocket for the clip and transmitter. Not sure? Ask us first.",
      "Wearing a dress with no pockets? Tell your tech. A belt pouch, lanyard, or a handheld mic are all easy options.",
      "Pull hair back and keep scarves away from the mic.",
    ],
    avoid: [
      "Bringing a lav to your mouth like a handheld. It will distort.",
      "Long necklaces, jangly bracelets, and lanyards or badges that bump the mic. Take your badge off before you are fitted.",
      "Adjusting the mic or the headset boom mid-talk, or brushing it with your hand.",
      "Walking away with it on. Return it to your tech after your session.",
    ],
  } satisfies DoAvoid,
  live: {
    title: "It is live until we say it is not",
    body: "Wireless mics have been known to broadcast restroom visits and private chats to a full room. Ask us to mute or remove your mic before any break, and assume it is on whenever it is on you. We typically fit lavs about 15 minutes before your session, so plan your restroom trip first.",
  } satisfies Callout,
};

export const SLIDES_SECTION = {
  before: {
    title: "Before you arrive",
    items: [
      { lead: "Send your deck early.", text: "We would love to open it, test it, and have it loaded before you walk in." },
      { lead: "Use 16:9 widescreen.", text: "A 4:3 slide on a widescreen display leaves black bars, and the reverse crops or squeezes your content." },
      { lead: "Use large, simple type.", text: "24 point or bigger is a common minimum, and fancy serif fonts can be hard to read when projected. If you use special fonts, embed them or send a PDF." },
      { lead: "PDF is safest for slides with no video or animation.", text: "If you have video or animation, send PowerPoint with fonts embedded and also bring any video or audio files separately as a backup." },
      { lead: "Plan to be offline on stage.", text: "Venue Wi-Fi is unpredictable. Record a short video of anything that needs the internet." },
      { lead: "Do your last-minute edits before check-in.", text: "Changing content right before you go on is the easiest way to break a deck we already tested." },
    ] satisfies Bullet[],
  },
  notes: {
    title: "Notes, clickers, and monitors",
    items: [
      { lead: "Ask what you will see on stage.", text: "Some rooms have a confidence monitor at your feet that shows your current slide, and sometimes the next one or your notes. Others do not. Knowing ahead of time changes how you rehearse." },
      { lead: "Speaker notes do not automatically appear on stage.", text: "If you rely on them, tell us in advance so we can plan for it. Better still, bring a short outline you can glance at." },
      { lead: "Use a clicker.", text: "It keeps you from walking back and forth to the laptop. Ask us what is provided, or bring your own. When you press it, you do not need to point it at the screen, the laptop, or the monitor." },
      { lead: "Do not take the clicker with you.", text: "The next speaker needs it. Hand it back to your tech." },
      { lead: "Do not turn your back to read the screen.", text: "If you need to see your slide, use the monitor in front of you, or glance quickly and turn back." },
    ] satisfies Bullet[],
  },
  supporting: {
    title: "Your slides are the supporting act",
    body: "Your audience reads faster than you speak, so reading slides aloud loses them quickly. Use the slide for a picture, a number, or a single phrase, and use your voice to explain why it matters. And try rehearsing one run-through with no slides at all. If a projector fails, you will be the calm one in the room.",
  } satisfies Callout,
};

export const DAY_OF_SECTION = {
  items: [
    { lead: "Arrive early and say hello.", text: "Find us at least 15 minutes before your session (earlier is better, and the day before is ideal for multi-day events). Speakers who introduce themselves tend to get the most personalized help, from tweaking sound for their voice to adjusting lighting." },
    { lead: "Walk the stage.", text: "Ask where the loudspeakers, monitors, and countdown timer are, where you should stand, and how far you can roam while wearing a wireless mic. (Wandering in front of loudspeakers or off the stage can cause feedback, so check with us before you head into the crowd.)" },
    { lead: "Do a real mic check.", text: "Speak at the same volume you will use on stage. Our audio team sets levels from your actual voice, so a whisper at check will not match your stage voice." },
    { lead: "Know your signal.", text: "Ask who will let you know if volume is off, such as a sound spotter in the audience or a nod from the booth." },
    { lead: "Ask about a backup.", text: "Know where the spare handheld is, just in case. It rarely gets used, and it is a comfort to know." },
    { lead: "Panels:", text: "Plan on roughly one mic for every two people, and hold it the same way you would on your own. For Q&A, wait for the mic runner so the whole room hears the question." },
  ] satisfies Bullet[],
  wrong: {
    title: "If something goes wrong on stage",
    items: [
      { lead: "Stay with your audience.", text: "Do not stare at the booth or turn your back while we fix it. Keep talking, tell a short story, or ask the room a question. Audiences are forgiving of a glitch and much less forgiving of silence." },
      { lead: "Do not keep fighting the equipment.", text: "If a clip or demo will not play, move on. We will signal you if we can fix it." },
      { lead: "Mic cut out?", text: "Keep talking and project. We will get a replacement out to you quickly." },
    ] satisfies Bullet[],
  },
  quickRef: {
    title: "Quick reference: what we see and what helps",
    rows: [
      ["Mic held at the chest or belly", "Keep it a hand's width from your mouth, aimed at your mouth"],
      ["Soft voice, trailing off at the end of sentences", "Project to the back row and finish your sentences strong"],
      ["Tapping the mic or asking “can you hear me?”", "Trust the sound check. Begin speaking at your regular distance"],
      ["Reading slides word for word", "One idea per slide. Use your voice for the story"],
      ["Slides that look different on the venue screen", "Send a 16:9 deck or PDF early, with fonts embedded"],
      ["Last-minute edits or live internet demos", "Finish edits before check-in and record any web demo as a video"],
      ["Walking off with the mic or clicker", "Hand both back to your tech after your session"],
      ["Wearing a mic into the restroom", "Ask us to mute or remove it before any break"],
    ] as [string, string][],
  },
};

export const CHECKLIST: { title: string; items: string[] }[] = [
  {
    title: "One week before",
    items: [
      "Send your slides (16:9, large text, fonts embedded or saved as PDF)",
      "Save video and audio files separately as a backup",
      "Ask the organizer: handheld, lav, or headset? Confidence monitor? Clicker provided?",
      "Rehearse once with no slides, and once holding something in your hand like a mic",
      "Plan your outfit: collar, belt, or pocket for the mic pack. Dress with no pockets? Tell us.",
    ],
  },
  {
    title: "On the day",
    items: [
      "Arrive early and introduce yourself to the AV team",
      "Walk the stage. Find the loudspeakers, monitors, and timer",
      "Do a mic check at your real speaking volume",
      "Remove your lanyard and big jewelry before being fitted",
      "Restroom stop before you are mic'd up",
      "Charge your laptop and pack your adapter, just in case",
    ],
  },
  {
    title: "On stage",
    items: [
      "Mic a hand's width from your mouth, steady distance",
      "Strong voice, finish every sentence",
      "Face the audience, glance at the monitor instead of turning to the screen",
      "If tech hiccups, keep talking. We have you.",
    ],
  },
  {
    title: "After your talk",
    items: [
      "Return the mic and clicker to your tech",
      "Ask to have the mic muted or removed before you head off",
      "Say thank you to the booth. We always notice, and we love it.",
    ],
  },
];
