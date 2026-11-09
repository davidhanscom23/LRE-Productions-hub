import { describe, expect, it } from "vitest";
import {
  buildEmbedSnippet,
  directFormUrl,
  embedScriptUrl,
  embedSnippetProblems,
  normalizeOrigin,
} from "./share-snippet";

const ORIGIN = "https://hub.example.com";

describe("share snippet", () => {
  it("builds the one self-sizing snippet with the origin pinned on the container", () => {
    const snippet = buildEmbedSnippet(ORIGIN, "check-your-date");
    expect(snippet).toBe(
      '<div data-inquiry-form="check-your-date" data-inquiry-form-origin="https://hub.example.com"></div>\n' +
        '<script async src="https://hub.example.com/inquire/embed.js"></script>',
    );
    expect(embedSnippetProblems(snippet, ORIGIN, "check-your-date")).toEqual([]);
  });

  it("strips trailing slashes from the origin so URLs never get a double slash", () => {
    expect(normalizeOrigin("https://hub.example.com///")).toBe("https://hub.example.com");
    expect(directFormUrl("https://hub.example.com/", "book-partner-brand")).toBe(
      "https://hub.example.com/inquire/book-partner-brand",
    );
    expect(embedScriptUrl("https://hub.example.com/")).toBe("https://hub.example.com/inquire/embed.js");
    expect(buildEmbedSnippet("https://hub.example.com/", "abc")).not.toContain("//inquire");
  });

  it("escapes attribute values", () => {
    const snippet = buildEmbedSnippet('https://evil.example"><script>x()</script>', "abc");
    expect(snippet).not.toContain('"><script>x()');
    expect(snippet).toContain("&quot;&gt;&lt;script&gt;");
  });

  describe("embedSnippetProblems guard (planted bad snippets must fail)", () => {
    it("rejects a fixed-height iframe fallback", () => {
      const bad = `<iframe src="${ORIGIN}/inquire/abc?embed=1" height="900"></iframe>`;
      const problems = embedSnippetProblems(bad, ORIGIN, "abc");
      expect(problems).toContain("contains an iframe (fixed size)");
      expect(problems).toContain("sets a fixed height");
      expect(problems).toContain("does not load the hosted embed script");
    });

    it("rejects pasted inline script code", () => {
      const bad = `<div data-inquiry-form="abc" data-inquiry-form-origin="${ORIGIN}"></div><script>(function(){var f=document.createElement("iframe")})()</script>`;
      expect(embedSnippetProblems(bad, ORIGIN, "abc")).toContain("contains inline script code");
    });

    it("rejects a snippet that only relies on the script src for the origin", () => {
      const bad = `<div data-inquiry-form="abc"></div>\n<script async src="${ORIGIN}/inquire/embed.js"></script>`;
      expect(embedSnippetProblems(bad, ORIGIN, "abc")).toEqual(["does not pin the hub origin on the container"]);
    });
  });
});
