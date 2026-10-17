import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireCsrf, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";
import {
  buildMessageFilter,
  messageListQuerySchema,
  messageSort,
  messageStatusSchema,
  messageStatusUpdate,
} from "../services/messages.js";

export const messagesRouter = Router();
const messagesRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const statusBody = z.object({ status: messageStatusSchema }).strict();
const noteBody = z.object({ adminNote: z.string().trim().max(3000) }).strict();

messagesRouter.use(messagesRateLimit);

messagesRouter.get("/unread-count", emptyQuery, emptyBody, async (request, response) => {
  const count = await ContactMessage.countDocuments({
    $or: [{ status: "new" }, { status: { $exists: false }, isRead: false }],
  }).exec();
  await writeAudit(request, "view_unread_message_count", "ContactMessage");
  response.json({ count });
});

messagesRouter.get("/", emptyBody, async (request, response) => {
  const query = messageListQuerySchema.parse(request.query);
  const filter = buildMessageFilter(query);
  const [items, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort(messageSort(query.sortBy, query.sortOrder))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    ContactMessage.countDocuments(filter).exec(),
  ]);
  await writeAudit(request, "list_contact_messages", "ContactMessage");
  response.json({ items, page: query.page, limit: query.limit, total });
});

messagesRouter.get("/:id", emptyQuery, emptyBody, async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await ContactMessage.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { status: "new" },
        { status: { $exists: false }, isRead: false, isResolved: { $ne: true } },
      ],
    },
    { $set: { status: "read", isRead: true, readAt: new Date() } },
    { new: true, runValidators: true },
  ).lean().exec() ?? await ContactMessage.findById(id).lean().exec();
  if (!item) return response.status(404).json({ error: "Contact message not found" });
  await writeAudit(request, "view_contact_message", "ContactMessage", id);
  response.json({ item });
});

messagesRouter.patch("/:id/status", emptyQuery, requireCsrf, async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { status } = statusBody.parse(request.body);
  const existing = await ContactMessage.findById(id).select("readAt").lean().exec();
  if (!existing) return response.status(404).json({ error: "Contact message not found" });
  const item = await ContactMessage.findByIdAndUpdate(
    id,
    messageStatusUpdate(status, existing.readAt),
    { new: true, runValidators: true },
  ).lean().exec();
  if (!item) return response.status(404).json({ error: "Contact message not found" });
  await writeAudit(request, `set_contact_message_${status}`, "ContactMessage", id);
  response.json({ item });
});

messagesRouter.patch("/:id/note", emptyQuery, requireCsrf, async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const { adminNote } = noteBody.parse(request.body);
  const item = await ContactMessage.findByIdAndUpdate(
    id,
    { $set: { adminNote } },
    { new: true, runValidators: true },
  ).lean().exec();
  if (!item) return response.status(404).json({ error: "Contact message not found" });
  await writeAudit(request, "update_contact_message_note", "ContactMessage", id);
  response.json({ item });
});

messagesRouter.delete("/:id", emptyQuery, emptyBody, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await ContactMessage.findByIdAndDelete(id).lean().exec();
  if (!item) return response.status(404).json({ error: "Contact message not found" });
  await writeAudit(request, "delete_contact_message", "ContactMessage", id);
  response.status(204).end();
});
