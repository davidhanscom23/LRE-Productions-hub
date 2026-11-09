import { describe, expect, it } from "vitest";
import {
  attributionLines,
  buildConfirmationEmail,
  buildStaffEmail,
  cleanSubject,
  escapeHtml,
  fillMergeTags,
  firstNameOf,
  qualificationLines,
  withEmojiPrefix,
} from "./emails-core";

const brand = {
  name: "Vident Productions",
  phone: "904-571-9064",
  siteUrl: "https://example.com",
  legalLine: "Vident Productions, Inc.",
};

describe("escaping and subjects", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });

  it("keeps subjects on one line", () => {
    expect(cleanSubject("Hello\r\nBcc: victim@example.com")).toBe("Hello Bcc: victim@example.com");
    expect(cleanSubject("x".repeat(300))).toHaveLength(200);
  });

  it("adds the emoji prefix once", () => {
    expect(withEmojiPrefix("We got your request", "🎵🎵🎵")).toBe("🎵🎵🎵 We got your request");
    expect(withEmojiPrefix("🎵🎵🎵 We got your request", "🎵🎵🎵")).toBe("🎵🎵🎵 We got your request");
    expect(withEmojiPrefix("We got your request", null)).toBe("We got your request");
    expect(withEmojiPrefix("We got your request", "  ")).toBe("We got your request");
  });

  it("fills merge tags and first names", () => {
    expect(fillMergeTags("Thanks {{ first_name }}, {{BUSINESS_NAME}} got it", { businessName: "Partner Brand", firstName: "Ann" })).toBe(
      "Thanks Ann, Partner Brand got it",
    );
    expect(fillMergeTags("Hi {{first_name}}", { businessName: "B", firstName: null })).toBe("Hi there");
    expect(firstNameOf("  Ann   Marie Lee ")).toBe("Ann");
    expect(firstNameOf("")).toBeNull();
  });
});

describe("staff email", () => {
  const base = {
    formName: "Check Your Date",
    ending: "completed" as const,
    headline: "Ann Lee - Wedding on Saturday, May 15, 2027 (high fit)",
    contact: { name: "Ann Lee", email: "ann@example.com", phone: "904-555-0142" },
    qualification: qualificationLines({
      qualification: {
        date: { result: "available", checkedFor: "2027-05-15", message: "", checkedAt: "x" },
        location: { result: "risky", message: "", miles: 72.4, confidence: "high", query: "St. Augustine, FL", checkedAt: "x" },
      },
      score: 80,
      scoreLabel: "high",
      budgetLabel: "$1,500 - $2,500",
    }),
    answers: ["Full name: Ann Lee", "Notes: <b>loud</b> & proud"],
    attribution: { utm_source: "google", utm_medium: "cpc", page_url: "https://example.com/contact" },
    submittedAt: "Nov 4, 2026, 3:05 PM ET",
    hubLink: "https://hub.example.com/clients/abc",
  };

  it("lists contact, verdicts, answers, source and the hub link in plain text", () => {
    const email = buildStaffEmail(base);
    expect(email.subject).toBe("New website inquiry: Ann Lee - Wedding on Saturday, May 15, 2027 (high fit)");
    expect(email.text).toContain("Form: Check Your Date");
    expect(email.text).toContain("Email: ann@example.com");
    expect(email.text).toContain("Date: date open (Saturday, May 15, 2027)");
    expect(email.text).toContain("Location: travel fee zone, about 72 miles (St. Augustine, FL)");
    expect(email.text).toContain("Budget: $1,500 - $2,500");
    expect(email.text).toContain("Fit: high (score 80)");
    expect(email.text).toContain("Notes: <b>loud</b> & proud");
    expect(email.text).toContain("Source: google");
    expect(email.text).toContain("Open it in the Hub: https://hub.example.com/clients/abc");
  });

  it("escapes visitor values in the HTML body", () => {
    const email = buildStaffEmail(base);
    expect(email.html).toContain("&lt;b&gt;loud&lt;/b&gt; &amp; proud");
    expect(email.html).not.toContain("<b>loud</b>");
  });

  it("marks waitlist requests", () => {
    const email = buildStaffEmail({ ...base, ending: "waitlisted" });
    expect(email.subject.startsWith("Waitlist request:")).toBe(true);
    expect(email.text).toContain("join the waitlist");
  });
});

describe("confirmation email", () => {
  it("thanks the visitor, copies their answers, and never promises availability", () => {
    const email = buildConfirmationEmail({
      brand,
      name: "Ann Lee",
      subject: "We got your request, {{business_name}}",
      intro: "Thanks for reaching out. We will be in touch shortly.",
      emojiPrefix: null,
      answers: ["Event date: Saturday, May 15, 2027", "Venue or city: Casa <Monica>"],
    });
    expect(email.subject).toBe("We got your request, Vident Productions");
    expect(email.text.startsWith("Hi Ann,")).toBe(true);
    expect(email.text).toContain("Event date: Saturday, May 15, 2027");
    expect(email.text).toContain("call us at 904-571-9064");
    expect(email.text).toContain("Vident Productions, Inc.");
    expect(email.text.toLowerCase()).not.toMatch(/\bavailable\b|\bconfirmed\b|\bbooked\b/);
    expect(email.html).toContain("Casa &lt;Monica&gt;");
  });

  it("does not repeat the lead-in when the intro already has it", () => {
    const email = buildConfirmationEmail({
      brand,
      name: "Ann",
      subject: "We received your request",
      intro: "Thanks for reaching out! Here is a copy of what you sent us.",
      emojiPrefix: null,
      answers: ["Event date: Saturday, May 15, 2027"],
    });
    expect(email.text.match(/copy of what you sent/gi)).toHaveLength(1);
    const plain = buildConfirmationEmail({ ...{ brand, name: "Ann", subject: "S", emojiPrefix: null }, intro: "Thanks!", answers: ["A: b"] });
    expect(plain.text).toContain("Here is a copy of what you sent us:\n\nA: b");
  });

  it("falls back to a friendly greeting and the emoji prefix", () => {
    const email = buildConfirmationEmail({
      brand: { ...brand, phone: null },
      name: null,
      subject: "Thanks",
      intro: "",
      emojiPrefix: "🎵",
      answers: [],
    });
    expect(email.subject).toBe("🎵 Thanks");
    expect(email.text.startsWith("Hi there,")).toBe(true);
    expect(email.text).toContain("If anything needs a change, just reply to this email.");
  });
});

describe("attribution lines", () => {
  it("labels known keys in a fixed order", () => {
    expect(attributionLines({ referrer: "https://google.com", utm_source: "google" })).toEqual([
      "Source: google",
      "Came from: https://google.com",
    ]);
    expect(attributionLines({})).toEqual([]);
  });
});
