import { Router } from "express";
import multer from "multer";
import type { RequestHandler } from "express";
import { requireCsrf, requireRole } from "../middleware/auth.js";
import { deleteProductImage, addProductImages, reorderProductImages } from "../controllers/productImageController.js";
import { env } from "../config/env.js";
import { shouldRejectImageUploadInProduction } from "../services/imageStorage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8, fields: 8, parts: 20 },
});

const receiveImages: RequestHandler = (request, response, next) => {
  upload.array("images", 8)(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      response.status(status).json({
        error: status === 413 ? "Each image must be 5 MB or smaller" : "Invalid image upload",
      });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

const requireAvailableImageStorage: RequestHandler = (_request, response, next) => {
  if (shouldRejectImageUploadInProduction(env.NODE_ENV)) {
    response.status(503).json({ error: "Image storage not configured" });
    return;
  }
  next();
};

export const productImageRouter = Router();
productImageRouter.post(
  "/:id/images",
  requireRole("superadmin", "manager"),
  requireCsrf,
  requireAvailableImageStorage,
  receiveImages,
  addProductImages,
);
productImageRouter.patch(
  "/:id/images/order",
  requireRole("superadmin", "manager"),
  requireCsrf,
  reorderProductImages,
);
productImageRouter.delete(
  "/:id/images/:key",
  requireRole("superadmin", "manager"),
  requireCsrf,
  deleteProductImage,
);
