import { z } from "zod";

export const messageStatusSchema = z.enum(["new", "read", "resolved"]);

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(120).optional(),
  status: messageStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "name", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", path: ["to"], message: "Invalid date range" });
  }
});

export function buildMessageFilter(input: z.infer<typeof messageListQuerySchema>) {
  const filter: Record<string, unknown> = {};
  const clauses: Record<string, unknown>[] = [];
  if (input.search) {
    const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = new RegExp(escaped, "i");
    clauses.push({ $or: [{ name: search }, { email: search }, { subject: search }] });
  }
  if (input.status === "new") {
    clauses.push({
      $or: [
        { status: "new" },
        { status: { $exists: false }, isRead: false, isResolved: { $ne: true } },
      ],
    });
  } else if (input.status) {
    filter.status = input.status;
  }
  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from && { $gte: input.from }),
      ...(input.to && {
        $lte: new Date(new Date(input.to).setUTCHours(23, 59, 59, 999)),
      }),
    };
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

export function messageStatusUpdate(
  status: z.infer<typeof messageStatusSchema>,
  previousReadAt?: Date | null,
) {
  return {
    $set: {
      status,
      isRead: status !== "new",
      isResolved: status === "resolved",
      ...(status !== "new" && { readAt: previousReadAt ?? new Date() }),
    },
    ...(status === "new" && { $unset: { readAt: 1 } }),
  };
}

export function messageSort(sortBy: "createdAt" | "name" | "email" | "status", sortOrder: "asc" | "desc") {
  return { [sortBy]: sortOrder === "asc" ? 1 : -1 } as const;
}
