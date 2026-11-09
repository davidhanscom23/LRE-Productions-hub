import { describe, expect, it } from "vitest";
import { SLUG_MAX_LENGTH, asciiFold, isValidSlug, slugFromName } from "./slug";

describe("isValidSlug", () => {
  it("accepts lowercase words joined by single dashes, 3..60 characters", () => {
    for (const s of ["check-your-date", "book-partner-brand", "abc", "a1b", "get-a-quote", "a".repeat(60)]) {
      expect(isValidSlug(s)).toBe(true);
    }
  });

  it("rejects everything the DB CHECK rejects", () => {
    for (const s of ["ab", "a".repeat(61), "Check", `a${"-".repeat(2)}b`, "-abc", "abc-", "a_b", "a b", "embed.js", "", "über"]) {
      expect(isValidSlug(s)).toBe(false);
    }
    expect(isValidSlug(null as unknown as string)).toBe(false);
  });
});

describe("slugFromName", () => {
  it("makes readable slugs from form names", () => {
    expect(slugFromName("Check Your Date")).toBe("check-your-date");
    expect(slugFromName("Book Partner Brand")).toBe("book-partner-brand");
    expect(slugFromName("Get a Quote")).toBe("get-a-quote");
    expect(slugFromName("Acme Events's Form")).toBe("acme-eventss-form");
    expect(slugFromName("Quinceañera & Sweet 16")).toBe("quinceanera-sweet-16");
    const dd = "-".repeat(2);
    expect(slugFromName(`  ${dd}Weird__Name${dd}  `)).toBe("weird-name");
  });

  it("always returns a valid slug, even for short or empty names", () => {
    expect(slugFromName("Q")).toBe("form-q");
    expect(slugFromName("AV")).toBe("form-av");
    expect(slugFromName("")).toBe("form");
    expect(slugFromName("!!!")).toBe("form");
    expect(slugFromName("🎉🎉")).toBe("form");
    expect(slugFromName(undefined as unknown as string)).toBe("form");
  });

  it("caps long names at 60 characters without a trailing dash", () => {
    const s = slugFromName("Wedding and Corporate Event Entertainment Inquiry Form For Northeast Florida Venues");
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(s.endsWith("-")).toBe(false);
    expect(isValidSlug(s)).toBe(true);
  });

  it("output always passes isValidSlug (fuzz)", () => {
    const alphabet = "aZ09 -_.!?&'’éñßø\t\n/\\()🎉";
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      const len = Math.floor(rand() * 90);
      let name = "";
      for (let j = 0; j < len; j++) name += alphabet[Math.floor(rand() * alphabet.length)];
      const slug = slugFromName(name);
      expect(isValidSlug(slug), `${JSON.stringify(name)} -> ${slug}`).toBe(true);
    }
  });
});

describe("asciiFold", () => {
  it("strips accents and folds special letters", () => {
    expect(asciiFold("Café Ñandú ß Øresund Łódź")).toBe("Cafe Nandu ss Oresund Lodz");
    expect(asciiFold(42 as unknown as string)).toBe("");
  });
});
