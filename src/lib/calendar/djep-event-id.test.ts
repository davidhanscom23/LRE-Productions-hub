import { describe, expect, it } from "vitest";
import {
  canonicalDjepCalendarUid,
  extractDjepEventId,
} from "./djep-event-id";

describe("extractDjepEventId", () => {
  it("reads EVENTID uid forms", () => {
    expect(extractDjepEventId("EVENTID:146284")).toBe("146284");
    expect(extractDjepEventId("eventid:99@host")).toBe("99");
  });

  it("reads bare numeric uids", () => {
    expect(extractDjepEventId("146358")).toBe("146358");
    expect(extractDjepEventId("146358@youreventplanningsite.com")).toBe(
      "146358",
    );
  });

  it("reads DESCRIPTION Event ID lines and use_event URLs", () => {
    expect(
      extractDjepEventId("Client Name: Pat\nEvent ID: 146099\nVenue: Hall"),
    ).toBe("146099");
    expect(
      extractDjepEventId(
        "https://youreventplanningsite.com/clientlogon.asp?use_event=146297",
      ),
    ).toBe("146297");
    expect(extractDjepEventId("Event_ID: 142509")).toBe("142509");
  });

  it("canonicalizes", () => {
    expect(canonicalDjepCalendarUid("146284")).toBe("EVENTID:146284");
  });
});
