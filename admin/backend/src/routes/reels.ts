import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireCsrf, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { Reel } from "../models/Reel.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";
import { idSchema, reelCreateSchema, reelListQuerySchema, reelReorderSchema, reelUpdateSchema } from "../schemas/reel.js";

export const reelsRouter = Router();
const changeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

reelsRouter.get("/", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const { page, limit, isActive } = reelListQuerySchema.parse(request.query);
  const filter = isActive === undefined ? {} : { isActive: isActive === "true" };
  const [items, total] = await Promise.all([
    Reel.find(filter).sort({ order: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Reel.countDocuments(filter).exec(),
  ]);
  response.json({ items, page, limit, total });
});

reelsRouter.post("/", emptyQuery, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const input = reelCreateSchema.parse(request.body);
  const { instagramUrl, ...fields } = input;
  const item = await Reel.create({ ...fields, ...instagramUrl });
  await writeAudit(request, "create", "Reel", String(item._id));
  response.status(201).json({ item });
});

reelsRouter.patch("/reorder", emptyQuery, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const { ids } = reelReorderSchema.parse(request.body);
  const existing = await Reel.find({ _id: { $in: ids } }).select("_id").lean().exec();
  if (existing.length !== ids.length) return response.status(404).json({ error: "One or more reels were not found" });
  await Reel.bulkWrite(ids.map((id, order) => ({
    updateOne: { filter: { _id: id }, update: { $set: { order } } },
  })));
  await writeAudit(request, "reorder", "Reel", `${ids.length} reels`);
  response.json({ message: "Reels reordered" });
});

reelsRouter.patch("/:id", emptyQuery, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = reelUpdateSchema.parse(request.body);
  const { instagramUrl, ...fields } = input;
  const update = { ...fields, ...(instagramUrl ?? {}) };
  const item = await Reel.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean().exec();
  if (!item) return response.status(404).json({ error: "Reel not found" });
  await writeAudit(request, "update", "Reel", id);
  response.json({ item });
});

for (const [path, isActive] of [["activate", true], ["deactivate", false]] as const) {
  reelsRouter.post("/:id/" + path, emptyQuery, emptyBody, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const item = await Reel.findByIdAndUpdate(id, { $set: { isActive } }, { new: true, runValidators: true }).lean().exec();
    if (!item) return response.status(404).json({ error: "Reel not found" });
    await writeAudit(request, path, "Reel", id);
    response.json({ item });
  });
}

reelsRouter.delete("/:id", emptyBody, emptyQuery, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Reel.findByIdAndDelete(id).lean().exec();
  if (!item) return response.status(404).json({ error: "Reel not found" });
  await writeAudit(request, "delete", "Reel", id);
  response.json({ message: "Reel deleted" });
});
