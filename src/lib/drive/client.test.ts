import { describe, expect, it } from "vitest";
import { parseDriveFolderId } from "./folder-id";

describe("parseDriveFolderId", () => {
  it("accepts a raw folder id", () => {
    expect(parseDriveFolderId("1AbCDefGhIjKLmnopQRstuVWxyz012345")).toBe(
      "1AbCDefGhIjKLmnopQRstuVWxyz012345",
    );
  });

  it("parses drive.google.com folder URLs", () => {
    expect(
      parseDriveFolderId(
        "https://drive.google.com/drive/folders/1AbCDefGhIjKLmnopQRstuVWxyz012345",
      ),
    ).toBe("1AbCDefGhIjKLmnopQRstuVWxyz012345");
    expect(
      parseDriveFolderId(
        "https://drive.google.com/drive/u/0/folders/1AbCDefGhIjKLmnopQRstuVWxyz012345?usp=sharing",
      ),
    ).toBe("1AbCDefGhIjKLmnopQRstuVWxyz012345");
  });

  it("rejects non-folder input", () => {
    expect(parseDriveFolderId("https://example.com/folders/abc")).toBeNull();
    expect(parseDriveFolderId("not a folder")).toBeNull();
    expect(parseDriveFolderId("")).toBeNull();
  });
});
