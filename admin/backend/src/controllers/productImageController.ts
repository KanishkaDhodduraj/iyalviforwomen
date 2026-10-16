import type { RequestHandler } from "express";
import { z } from "zod";
import { writeAudit } from "../middleware/audit.js";
import { Product } from "../models/Product.js";
import {
  deleteImageAssetsWhenUnused,
  imageStorage,
  InvalidImageError,
} from "../services/imageStorage.js";

const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const keyParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  key: z.string().regex(/^[a-f\d-]{36}\.webp$/i),
}).strict();
const reorderBody = z.object({
  keys: z.array(z.string().regex(/^[a-f\d-]{36}\.webp$/i)).min(1).max(8),
  primaryKey: z.string().regex(/^[a-f\d-]{36}\.webp$/i),
}).strict();
const uploadFields = z.object({
  alt: z.union([z.string().max(200), z.array(z.string().max(200)).max(8)]).optional(),
}).strict();
const emptyQuery = z.object({}).strict();
const emptyBody = z.object({}).strict();

export const addProductImages: RequestHandler = async (request, response) => {
  const { id } = idParams.parse(request.params);
  emptyQuery.parse(request.query);
  const fields = uploadFields.parse(request.body);
  const files = request.files;
  if (!Array.isArray(files) || files.length === 0 || files.length > 8) {
    response.status(400).json({ error: "Upload between 1 and 8 images" });
    return;
  }
  const alts = fields.alt === undefined
    ? []
    : Array.isArray(fields.alt)
      ? fields.alt
      : [fields.alt];
  if (alts.some((alt: unknown) => typeof alt !== "string" || alt.length > 200)) {
    response.status(400).json({ error: "Invalid image description" });
    return;
  }
  const product = await Product.findById(id).exec();
  if (!product) {
    response.status(404).json({ error: "Product not found" });
    return;
  }
  if (product.images.length + files.length > 8) {
    response.status(400).json({ error: "A product can have at most 8 images" });
    return;
  }

  const stored = [];
  try {
    for (const [index, file] of files.entries()) {
      stored.push(await imageStorage.save(file.buffer, alts[index] ?? ""));
    }
    const hadPrimary = product.images.some((image) => image.isPrimary);
    product.images.push(...stored.map((image, index) => ({
      ...image,
      isPrimary: !hadPrimary && index === 0,
    })));
    await product.save();
  } catch (error) {
    await Promise.allSettled(stored.flatMap((image) => [
      imageStorage.delete(image.key),
      imageStorage.delete(image.thumbnailKey),
    ]));
    if (error instanceof InvalidImageError) {
      response.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
  await writeAudit(request, "add_images", "Product", id);
  response.status(201).json({ images: product.images });
};

export const reorderProductImages: RequestHandler = async (request, response) => {
  const { id } = idParams.parse(request.params);
  emptyQuery.parse(request.query);
  const input = reorderBody.parse(request.body);
  const product = await Product.findById(id).exec();
  if (!product) {
    response.status(404).json({ error: "Product not found" });
    return;
  }
  const imagesByKey = new Map(product.images.map((image) => [image.key, image]));
  if (
    input.keys.length !== product.images.length ||
    new Set(input.keys).size !== input.keys.length ||
    input.keys.some((key) => !imagesByKey.has(key)) ||
    !imagesByKey.has(input.primaryKey)
  ) {
    response.status(400).json({ error: "Image order does not match the product gallery" });
    return;
  }
  product.set("images", input.keys.map((key) => ({
    ...imagesByKey.get(key)!.toObject(),
    isPrimary: key === input.primaryKey,
  })));
  await product.save();
  await writeAudit(request, "reorder_images", "Product", id);
  response.json({ images: product.images });
};

export const deleteProductImage: RequestHandler = async (request, response) => {
  const { id, key } = keyParams.parse(request.params);
  emptyQuery.parse(request.query);
  emptyBody.parse(request.body ?? {});
  const product = await Product.findById(id).exec();
  if (!product) {
    response.status(404).json({ error: "Product not found" });
    return;
  }
  const image = product.images.find((item) => item.key === key);
  if (!image) {
    response.status(404).json({ error: "Image not found" });
    return;
  }
  product.images.splice(product.images.indexOf(image), 1);
  if (image.isPrimary && product.images.length) product.images[0]!.isPrimary = true;
  await product.save();
  await deleteImageAssetsWhenUnused([image]);
  await writeAudit(request, "delete_image", "Product", id);
  response.json({ images: product.images });
};
