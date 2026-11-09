// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const push = vi.hoisted(() => ({ sendPushToUsers: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/push", () => push);

import { insertNotifications } from "./notify";

function client(error: { message: string } | null) {
  const insert = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ insert }));
  return { sb: { from } as unknown as SupabaseClient, insert, from };
}

const ROWS = [
  { userId: "u1", kind: "web_inquiry", title: "New inquiry", body: "Jane Smith", href: "/honeybook/projects/p1" },
  { userId: "u2", kind: "web_inquiry", title: "New inquiry", body: "Jane Smith", href: "/honeybook/projects/p1" },
];

beforeEach(() => {
  push.sendPushToUsers.mockClear();
});

describe("insertNotifications", () => {
  it("inserts the bell rows and sends one push per payload", async () => {
    const { sb, insert, from } = client(null);
    await insertNotifications(sb, ROWS);
    expect(from).toHaveBeenCalledWith("hub_notifications");
    expect(insert).toHaveBeenCalledWith([
      { user_id: "u1", kind: "web_inquiry", title: "New inquiry", body: "Jane Smith", href: "/honeybook/projects/p1" },
      { user_id: "u2", kind: "web_inquiry", title: "New inquiry", body: "Jane Smith", href: "/honeybook/projects/p1" },
    ]);
    expect(push.sendPushToUsers).toHaveBeenCalledTimes(1);
    expect(push.sendPushToUsers).toHaveBeenCalledWith(["u1", "u2"], {
      title: "New inquiry",
      body: "Jane Smith",
      href: "/honeybook/projects/p1",
    });
  });

  it("ignores an insert error by default, as before", async () => {
    const { sb } = client({ message: "permission denied for table hub_notifications" });
    await expect(insertNotifications(sb, ROWS)).resolves.toBeUndefined();
  });

  it("throws on an insert error with throwOnError, and sends no push", async () => {
    const { sb } = client({ message: "permission denied for table hub_notifications" });
    await expect(insertNotifications(sb, ROWS, { throwOnError: true })).rejects.toThrow(
      "hub_notifications insert failed: permission denied for table hub_notifications",
    );
    expect(push.sendPushToUsers).not.toHaveBeenCalled();
  });

  it("does nothing for no rows", async () => {
    const { sb, from } = client(null);
    await insertNotifications(sb, [], { throwOnError: true });
    expect(from).not.toHaveBeenCalled();
  });
});
