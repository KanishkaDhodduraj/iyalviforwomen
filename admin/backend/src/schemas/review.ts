import { z } from "zod";
import { idSchema } from "./reel.js";

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  product: idSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
}).strict();
