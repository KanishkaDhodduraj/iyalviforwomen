import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireCsrf } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { AdminUser } from "../models/AdminUser.js";
import { Setting } from "../models/Setting.js";
import { emptyBody, emptyQuery } from "../middleware/validation.js";
import type { AdminRole } from "../middleware/auth.js";

export const settingsRouter = Router();
const settingsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();
const storeSchema = z.object({
  storeName: z.string().trim().min(1).max(100),
  supportEmail: z.string().trim().max(254).refine((email) =>
    email === "" || z.string().email().max(254).safeParse(email).success,
  ),
  supportPhone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/),
  whatsappNumber: z.string().trim().max(40).regex(/^[+\d\s().-]*$/),
  freeShippingThreshold: z.number().finite().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
}).strict();
const storeDefaults = {
  storeName: "Iyalvi",
  supportEmail: "",
  supportPhone: "",
  whatsappNumber: "",
  freeShippingThreshold: 999,
  lowStockThreshold: 5,
  currency: "INR",
};
export const storeSettingsWriteRoles: readonly AdminRole[] = ["superadmin", "manager"];
export function canEditStoreSettings(role: AdminRole): boolean {
  return storeSettingsWriteRoles.includes(role);
}
const requireStoreWriteAccess = (
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
) => {
  if (!request.admin || !canEditStoreSettings(request.admin.role)) {
    response.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
};

settingsRouter.use(settingsRateLimit);

settingsRouter.get("/profile", emptyQuery, emptyBody, async (request, response) => {
  const admin = await AdminUser.findById(request.admin!.id).select("name email").lean().exec();
  if (!admin) return response.status(404).json({ error: "Administrator not found" });
  await writeAudit(request, "view_profile", "AdminUser", String(admin._id));
  response.json({ profile: { name: admin.name ?? "", email: admin.email } });
});

settingsRouter.patch("/profile", emptyQuery, requireCsrf, async (request, response) => {
  const input = profileSchema.parse(request.body);
  const admin = await AdminUser.findByIdAndUpdate(
    request.admin!.id,
    { $set: input },
    { new: true, runValidators: true },
  ).select("name email").lean().exec();
  if (!admin) return response.status(404).json({ error: "Administrator not found" });
  await writeAudit(request, "update_profile", "AdminUser", String(admin._id));
  response.json({ profile: { name: admin.name ?? "", email: admin.email } });
});

settingsRouter.get("/store", emptyQuery, emptyBody, async (request, response) => {
  const store = await Setting.findById("store-settings").lean().exec();
  await writeAudit(request, "view_store_settings", "Setting", "store-settings");
  response.json({ store: { ...storeDefaults, ...store } });
});

settingsRouter.patch("/store", emptyQuery, requireCsrf, requireStoreWriteAccess, async (request, response) => {
  const input = storeSchema.parse(request.body);
  const store = await Setting.findOneAndUpdate(
    { _id: "store-settings" },
    { $set: input },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean().exec();
  await writeAudit(request, "update_store_settings", "Setting", "store-settings");
  response.json({ store: { ...storeDefaults, ...store } });
});
