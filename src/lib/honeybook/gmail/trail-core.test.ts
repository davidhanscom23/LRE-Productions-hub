import { describe, expect, it } from "vitest";
import {
  dropRepeatedActions,
  identifyingParticipants,
  isInboxChaseAction,
  isMarketplaceRelay,
  isRestatedConflict,
  marketplaceName,
  normalizeNote,
  notLeadSenderKey,
} from "@/lib/honeybook/gmail/trail-core";

describe("marketplace relay addresses", () => {
  it("recognises relay domains and subdomains", () => {
    expect(isMarketplaceRelay("yourfriends@gigsalad.com")).toBe(true);
    expect(isMarketplaceRelay("noreply@mail.theknot.com")).toBe(true);
    expect(isMarketplaceRelay("jane@gmail.com")).toBe(false);
    expect(isMarketplaceRelay("x@notgigsalad.com")).toBe(false);
  });

  it("keeps only addresses that can identify a client", () => {
    expect(identifyingParticipants(["a@gigsalad.com", "jane@gmail.com"])).toEqual(["jane@gmail.com"]);
    expect(identifyingParticipants(["a@gigsalad.com"])).toEqual([]);
  });
});

describe("marketplaceName", () => {
  it("gives a clean display name for relay senders", () => {
    expect(marketplaceName("yourfriends@gigsalad.com")).toBe("GigSalad");
    expect(marketplaceName("x@mail.theknot.com")).toBe("The Knot");
    expect(marketplaceName("jane@gmail.com")).toBeNull();
  });
});

describe("notLeadSenderKey", () => {
  it("remembers a real prospect address, lowercased", () => {
    expect(notLeadSenderKey(" Risa@NinjaNation.com ")).toBe("risa@ninjanation.com");
  });
  it("never remembers relays, Vident staff, or blanks", () => {
    expect(notLeadSenderKey("yourfriends@gigsalad.com")).toBeNull();
    expect(notLeadSenderKey("kallie@videntproductions.com")).toBeNull();
    expect(notLeadSenderKey("")).toBeNull();
    expect(notLeadSenderKey(null)).toBeNull();
  });
});

describe("to-do filters", () => {
  it("flags check-the-inbox chores", () => {
    expect(isInboxChaseAction("Check the GigSalad inbox for a reply")).toBe(true);
    expect(isInboxChaseAction("Monitor messages on the platform")).toBe(true);
    expect(isInboxChaseAction("Send the revised quote to Jane")).toBe(false);
  });

  it("flags restated date/location/budget conflicts", () => {
    expect(isRestatedConflict("Confirm and update the project date to Dec 5")).toBe(true);
    expect(isRestatedConflict("Book the DJ")).toBe(false);
  });
});

describe("dropRepeatedActions", () => {
  const note = (body: string, needs_action: boolean) => ({ body, needs_action });

  it("normalizes case and punctuation", () => {
    expect(normalizeNote("  Reply, to Jane! ")).toBe("reply to jane");
  });

  it("drops to-dos that are already open", () => {
    const out = dropRepeatedActions([note("Reply to Jane.", true)], ["reply to jane"]);
    expect(out).toEqual([]);
  });

  it("drops duplicates within one batch but keeps non-actions", () => {
    const out = dropRepeatedActions(
      [note("Summary", false), note("Call venue", true), note("call venue!", true), note("Summary", false)],
      [],
    );
    expect(out.map((r) => r.body)).toEqual(["Summary", "Call venue", "Summary"]);
  });
});
