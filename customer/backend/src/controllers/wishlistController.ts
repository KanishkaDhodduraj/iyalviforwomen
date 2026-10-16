import type { RequestHandler } from "express";
import { z } from "zod";

import { authUserId } from "../services/sessions.js";
import { Product } from "../models/Product.js";
import { Wishlist } from "../models/Wishlist.js";
import { HttpError } from "../middleware/errors.js";

export const productIdParams = z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
export const emptyBody = z.object({}).strict();

export const getWishlist: RequestHandler = async (request, response) => {
  const wishlist = await Wishlist.findOne({ user: authUserId(request) })
    .populate({ path: "products", match: { isActive: true, archived: { $ne: true } } })
    .lean()
    .exec();
  response.json({ products: wishlist?.products ?? [] });
};

export const addWishlistProduct: RequestHandler = async (request, response) => {
  const { productId } = productIdParams.parse(request.params);
  const product = await Product.exists({ _id: productId, isActive: true, archived: { $ne: true } }).exec();
  if (!product) throw new HttpError(404, "Product not found");
  const user = authUserId(request);
  await Wishlist.updateOne({ user }, { $addToSet: { products: product._id } }, { upsert: true }).exec();
  response.status(204).end();
};

export const removeWishlistProduct: RequestHandler = async (request, response) => {
  const { productId } = productIdParams.parse(request.params);
  await Wishlist.updateOne({ user: authUserId(request) }, { $pull: { products: productId } }).exec();
  response.status(204).end();
};
