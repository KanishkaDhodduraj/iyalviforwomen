import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireCsrf, requireRole } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { Review } from "../models/Review.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";
import { idSchema } from "../schemas/reel.js";
import { reviewListQuerySchema } from "../schemas/review.js";

export const reviewsRouter = Router();
const changeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

reviewsRouter.get("/", emptyBody, requireRole("superadmin", "manager"), async (request, response) => {
  const { page, limit, status, product, rating } = reviewListQuerySchema.parse(request.query);
  const filter = {
    ...(status && { status }),
    ...(product && { product }),
    ...(rating !== undefined && { rating }),
  };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate("user", "name email")
      .populate("product", "name slug")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    Review.countDocuments(filter).exec(),
  ]);
  response.json({ items, page, limit, total });
});

for (const [action, status] of [["approve", "approved"], ["reject", "rejected"]] as const) {
  reviewsRouter.post("/:id/" + action, emptyQuery, emptyBody, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const item = await Review.findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true }).lean().exec();
    if (!item) return response.status(404).json({ error: "Review not found" });
    await writeAudit(request, action, "Review", id);
    response.json({ item });
  });
}

reviewsRouter.delete("/:id", emptyBody, emptyQuery, changeRateLimit, requireCsrf, requireRole("superadmin", "manager"), async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const item = await Review.findByIdAndDelete(id).lean().exec();
  if (!item) return response.status(404).json({ error: "Review not found" });
  await writeAudit(request, "delete", "Review", id);
  response.json({ message: "Review deleted" });
});
