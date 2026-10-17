import { describe, expect, it } from "vitest";
import {
  buildMessageFilter,
  messageListQuerySchema,
  messageStatusUpdate,
} from "./messages.js";

describe("admin message filtering and updates", () => {
  it("escapes client search text and combines it with status filters", () => {
    const query = messageListQuerySchema.parse({ search: "a.*[b", status: "new" });
    const filter = buildMessageFilter(query);
    const clauses = filter.$and as Array<{ $or: Array<Record<string, unknown>> }>;
    const searchClause = clauses[0]!.$or;
    const searchPattern = searchClause[0]!.name as RegExp;

    expect(searchPattern.source).toBe("a\\.\\*\\[b");
    expect(searchPattern.test("aZZb")).toBe(false);
    expect(clauses[1]!.$or).toEqual([
      { status: "new" },
      { status: { $exists: false }, isRead: false, isResolved: { $ne: true } },
    ]);
  });

  it("validates date range and caps page size at fifty", () => {
    expect(messageListQuerySchema.parse({ page: "2", limit: "50" })).toMatchObject({ page: 2, limit: 50 });
    expect(messageListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(messageListQuerySchema.safeParse({
      from: "2026-10-18",
      to: "2026-10-17",
    }).success).toBe(false);
    const datedFilter = buildMessageFilter(messageListQuerySchema.parse({ to: "2026-10-17" }));
    expect((datedFilter.createdAt as { $lte: Date }).$lte.toISOString()).toBe("2026-10-17T23:59:59.999Z");
  });

  it("updates message status and read tracking consistently", () => {
    const oldReadAt = new Date("2026-10-01T00:00:00.000Z");
    expect(messageStatusUpdate("resolved", oldReadAt)).toEqual({
      $set: { status: "resolved", isRead: true, isResolved: true, readAt: oldReadAt },
    });
    expect(messageStatusUpdate("new")).toEqual({
      $set: { status: "new", isRead: false, isResolved: false },
      $unset: { readAt: 1 },
    });
  });
});
