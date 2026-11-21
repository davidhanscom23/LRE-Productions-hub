import { describe, expect, it } from "vitest";
import { formatTag, parseTagCode, tagUrl } from "./parse";

describe("parseTagCode", () => {
  it("reads bare digits and pads to four", () => {
    expect(parseTagCode("0001")).toBe("0001");
    expect(parseTagCode("12")).toBe("0012");
    expect(parseTagCode(" 0457 \n")).toBe("0457");
    expect(parseTagCode("12345")).toBe("12345");
  });

  it("reads the printed LRE forms", () => {
    expect(parseTagCode("LRE-0001")).toBe("0001");
    expect(parseTagCode("lre 0042")).toBe("0042");
    expect(parseTagCode("LRE Productions 0042")).toBe("0042");
    expect(parseTagCode("LRE#7")).toBe("0007");
  });

  it("reads a hub link", () => {
    expect(parseTagCode("https://hub.lreproductions.com/t/0001")).toBe("0001");
    expect(parseTagCode("hub.lreproductions.com/t/88/")).toBe("0088");
    expect(parseTagCode("https://hub.lreproductions.com/t/0001?x=1")).toBe("0001");
  });

  it("rejects anything that is not an LRE tag", () => {
    expect(parseTagCode("")).toBeNull();
    expect(parseTagCode("0000")).toBeNull();
    expect(parseTagCode("https://example.com/product/123")).toBeNull();
    expect(parseTagCode("SN-A1B2C3")).toBeNull();
    expect(parseTagCode("1234567")).toBeNull();
    expect(parseTagCode("012345678905")).toBeNull();
  });
});

describe("tagUrl / formatTag", () => {
  it("builds the link the QR holds", () => {
    expect(tagUrl("0001")).toBe("https://hub.lreproductions.com/t/0001");
    expect(tagUrl("0001", "http://localhost:3000/")).toBe("http://localhost:3000/t/0001");
  });
  it("round-trips", () => {
    expect(parseTagCode(tagUrl("0310"))).toBe("0310");
  });
  it("formats for people", () => {
    expect(formatTag("0001")).toBe("LRE 0001");
    expect(formatTag(null)).toBe("No tag");
  });
});
