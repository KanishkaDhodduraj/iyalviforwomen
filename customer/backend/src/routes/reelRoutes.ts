import { Router } from "express";

import { listActiveReels } from "../controllers/reelController.js";
import { publicReadRateLimit } from "../middleware/rateLimit.js";

export const reelRouter = Router();
reelRouter.use(publicReadRateLimit);
reelRouter.get("/", listActiveReels);
