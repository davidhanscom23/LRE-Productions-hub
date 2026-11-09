import { describe, expect, it } from "vitest";
import {
  PROJECT_EMAIL_TEMPLATES,
  applyMergeFields,
  firstNameOf,
  parseRecipients,
  textToEmailHtml,
} from "./project-email";

const ctx = {
  firstName: "Ana",
  projectName: "Smith Wedding",
  eventDate: "June 5, 2027",
  location: "Ballroom",
  senderName: "David",
  projectLink: "https://hub.example/project/abc",
};

describe("project email", () => {
  it("merges fields and leaves unknown tokens", () => {
    expect(applyMergeFields("Hi {{first_name}} {{ project_name }} {{nope}}", ctx)).toBe("Hi Ana Smith Wedding {{nope}}");
  });
  it("drops the date phrase cleanly when there is no date", () => {
    expect(applyMergeFields("for X{{on_date}}.", { ...ctx, eventDate: "" })).toBe("for X.");
    expect(applyMergeFields("for X{{on_date}}.", ctx)).toBe("for X on June 5, 2027.");
  });
  it("every template merges with no leftover tokens", () => {
    for (const t of PROJECT_EMAIL_TEMPLATES) {
      expect(applyMergeFields(t.subject + t.body, ctx)).not.toMatch(/\{\{/);
    }
  });
  it("first name falls back", () => {
    expect(firstNameOf("Ana Maria Smith")).toBe("Ana");
    expect(firstNameOf("")).toBe("there");
  });
  it("escapes html and links urls", () => {
    const html = textToEmailHtml("a <b>\n\nsee https://x.co/y");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('<a href="https://x.co/y">');
  });
  it("parses recipients", () => {
    expect(parseRecipients("a@b.com; A@B.com, bad, c@d.org")).toEqual({
      valid: ["a@b.com", "c@d.org"],
      invalid: ["bad"],
    });
  });
});
