import { describe, expect, it } from "vitest";
import {
  applyPipelineColumnOrder,
  countProjectsByStageLabel,
  formatPipelineStageLabel,
  normalizePipelineStage,
  groupProjectsByStage,
  pipelineStageMatchKey,
  movePipelineColumn,
  orderedPipelineStages,
} from "@/lib/pipeline/pipeline-board";

describe("formatPipelineStageLabel", () => {
  it("title-cases underscore enums", () => {
    expect(formatPipelineStageLabel("_RETAINER_PAID_")).toBe("Retainer Paid");
    expect(formatPipelineStageLabel("_PLANNING_")).toBe("Planning");
    expect(formatPipelineStageLabel("_CLOSED_")).toBe("Closed");
  });

  it("maps known variants to canonical hints", () => {
    expect(formatPipelineStageLabel("_PROPOSAL_SENT_")).toBe("Proposal Sent");
    expect(formatPipelineStageLabel("proposal_sent")).toBe("Proposal Sent");
    expect(formatPipelineStageLabel("Booked")).toBe("Booked");
  });

  it("handles empty", () => {
    expect(formatPipelineStageLabel("")).toBe("(no stage)");
    expect(formatPipelineStageLabel("  ")).toBe("(no stage)");
  });
});

describe("pipelineStageMatchKey", () => {
  it("equates underscore and spaced forms", () => {
    expect(pipelineStageMatchKey("_PROPOSAL_SENT_")).toBe(
      pipelineStageMatchKey("Proposal Sent"),
    );
  });
});

describe("orderedPipelineStages", () => {
  it("keeps hints first and appends extras as pretty labels", () => {
    const cols = orderedPipelineStages([
      "_RETAINER_PAID_",
      "Inquiry",
      "Booked",
    ]);
    expect(cols[0]).toBe("Inquiry");
    expect(cols).toContain("Booked");
    expect(cols).toContain("Retainer Paid");
    // Retainer Paid is a default board column, so it sits before the other hints.
    expect(cols.indexOf("Retainer Paid")).toBeLessThan(
      cols.indexOf("Booked"),
    );
  });

  it("starts with the default board columns in order", () => {
    const cols = orderedPipelineStages(["Booked", "Mystery"]);
    expect(cols.slice(0, 7)).toEqual([
      "Inquiry",
      "Proposal Sent",
      "Contract Sent",
      "Retainer Paid",
      "Paid in Full",
      "Completed",
      "Lost",
    ]);
    expect(cols).not.toContain("Not Booked");
  });

  it("no longer offers Booked or In Progress as stages", () => {
    const cols = orderedPipelineStages([]);
    expect(cols).not.toContain("Booked");
    expect(cols).not.toContain("In Progress");
  });

  it("maps the removed Not Booked stage to Lost", () => {
    expect(normalizePipelineStage("Not Booked")).toBe("Lost");
    expect(normalizePipelineStage("_NOT_BOOKED_")).toBe("Lost");
    expect(normalizePipelineStage("Completed")).toBe("Completed");
    expect(normalizePipelineStage("")).toBe("");
  });

  it("puts Paid in Full between Retainer Paid and Completed", () => {
    const cols = orderedPipelineStages(["_PAID_IN_FULL_", "Completed", "_RETAINER_PAID_"]);
    expect(cols.indexOf("Retainer Paid") + 1).toBe(cols.indexOf("Paid in Full"));
    expect(cols.indexOf("Paid in Full") + 1).toBe(cols.indexOf("Completed"));
  });

  it("does not duplicate proposal variants", () => {
    const cols = orderedPipelineStages(["_PROPOSAL_SENT_", "Proposal Sent"]);
    expect(cols.filter((c) => /proposal/i.test(c))).toHaveLength(1);
    expect(cols).toContain("Proposal Sent");
  });
});

describe("groupProjectsByStage", () => {
  it("bins projects into columns including empty stages", () => {
    const cols = orderedPipelineStages(["Inquiry"]);
    const map = groupProjectsByStage(
      [
        { id: "1", stage: "Inquiry" },
        { id: "2", stage: "" },
        { id: "3", stage: "Mystery" },
        { id: "4", stage: "_PROPOSAL_SENT_" },
      ],
      cols,
    );
    expect(map.get("Inquiry")?.map((p) => p.id)).toEqual(["1"]);
    expect(map.get("(no stage)")?.map((p) => p.id)).toEqual(["2"]);
    expect(map.get("Mystery")?.map((p) => p.id)).toEqual(["3"]);
    expect(map.get("Proposal Sent")?.map((p) => p.id)).toEqual(["4"]);
  });
});

describe("countProjectsByStageLabel", () => {
  it("merges underscore variants into one row", () => {
    const rows = countProjectsByStageLabel([
      { stage: "Booked" },
      { stage: "_PROPOSAL_SENT_" },
      { stage: "Proposal Sent" },
    ]);
    expect(rows).toEqual([
      ["Proposal Sent", 2],
      ["Booked", 1],
    ]);
  });
});

describe("applyPipelineColumnOrder", () => {
  it("reorders by preferred match keys and keeps leftovers", () => {
    const cols = ["Inquiry", "Proposal Sent", "Booked", "Completed"];
    expect(
      applyPipelineColumnOrder(cols, ["booked", "proposal sent", "mystery"]),
    ).toEqual(["Booked", "Proposal Sent", "Inquiry", "Completed"]);
  });

  it("returns columns unchanged when preferred is empty", () => {
    const cols = ["Inquiry", "Booked"];
    expect(applyPipelineColumnOrder(cols, null)).toEqual(cols);
    expect(applyPipelineColumnOrder(cols, [])).toEqual(cols);
  });
});

describe("movePipelineColumn", () => {
  it("moves a column before the target", () => {
    const cols = ["Inquiry", "Proposal Sent", "Booked", "Completed"];
    expect(movePipelineColumn(cols, "Booked", "Inquiry")).toEqual([
      "Booked",
      "Inquiry",
      "Proposal Sent",
      "Completed",
    ]);
  });

  it("is a no-op when from and to match", () => {
    const cols = ["Inquiry", "Booked"];
    expect(movePipelineColumn(cols, "Booked", "booked")).toEqual(cols);
  });
});
