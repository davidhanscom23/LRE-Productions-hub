import { describe, expect, it } from "vitest";
import {
  canonicalCalendarUid,
  extractExternalEventId,
} from "./external-event-id";

describe("extractExternalEventId", () => {
  it("reads EVENTID uid forms", () => {
    expect(extractExternalEventId("EVENTID:146284")).toBe("146284");
    expect(extractExternalEventId("eventid:99@host")).toBe("99");
  });

  it("reads bare numeric uids", () => {
    expect(extractExternalEventId("146358")).toBe("146358");
    expect(extractExternalEventId("146358@planner.example.com")).toBe(
      "146358",
    );
  });

  it("reads DESCRIPTION Event ID lines and use_event URLs", () => {
    expect(
      extractExternalEventId("Client Name: Pat\nEvent ID: 146099\nVenue: Hall"),
    ).toBe("146099");
    expect(
      extractExternalEventId(
        "https://planner.example.com/clientlogon.asp?use_event=146297",
      ),
    ).toBe("146297");
    expect(extractExternalEventId("Event_ID: 142509")).toBe("142509");
  });

  it("canonicalizes", () => {
    expect(canonicalCalendarUid("146284")).toBe("EVENTID:146284");
  });
});
