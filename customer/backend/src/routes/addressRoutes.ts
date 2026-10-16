import { Router } from "express";
import {
  addressBody,
  addressIdParams,
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  updateAddress,
} from "../controllers/addressController.js";
import { emptyBody } from "../controllers/wishlistController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

export const addressRouter = Router();
addressRouter.use(requireAuth);
addressRouter.get("/", validateRequest({ query: emptyBody }), listAddresses);
addressRouter.post("/", validateRequest({ body: addressBody }), createAddress);
addressRouter.get("/:id", validateRequest({ params: addressIdParams }), getAddress);
addressRouter.patch("/:id", validateRequest({ params: addressIdParams, body: addressBody.partial() }), updateAddress);
addressRouter.delete("/:id", validateRequest({ params: addressIdParams, body: emptyBody }), deleteAddress);
