import { describe, expect, it } from "vitest";

/**
 * Lightweight pure checks for task event normalization / open-state helper.
 * Full ingest needs the service client; covered via webhook smoke + My Week UI.
 */
import { honeyBookTaskIsOpen } from "@/lib/types/honeybook-tasks";
import type { HoneyBookTask } from "@/lib/types/honeybook-tasks";

function task(partial: Partial<HoneyBookTask>): HoneyBookTask {
  return {
    id: "1",
    external_id: "t1",
    title: "Follow up",
    due_date: null,
    status: "open",
    assignee_email: "a@b.com",
    assignee_name: "",
    assignee_profile_id: null,
    project_id: null,
    client_id: null,
    project_name: "",
    notes: "",
    source_event: "task.created",
    hub_done: false,
    hub_done_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("honeyBookTaskIsOpen", () => {
  it("is open when HoneyBook open and not hub-done", () => {
    expect(honeyBookTaskIsOpen(task({}))).toBe(true);
  });

  it("is closed when HoneyBook done", () => {
    expect(honeyBookTaskIsOpen(task({ status: "done" }))).toBe(false);
  });

  it("is closed when locally marked done", () => {
    expect(honeyBookTaskIsOpen(task({ hub_done: true }))).toBe(false);
  });
});
