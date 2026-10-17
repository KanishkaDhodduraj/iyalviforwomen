import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Product } from "../models/Product.js";

const storageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../uploads/products");
const acceptedFormats = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileBytes = 5 * 1024 * 1024;

export function shouldRejectImageUploadInProduction(nodeEnv: string): boolean {
  return nodeEnv === "production";
}

export interface ImageStorage {
  save(buffer: Buffer, alt: string): Promise<StoredImage>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}

export interface StoredImage {
  url: string;
  key: string;
  publicId: string;
  thumbnailUrl: string;
  thumbnailKey: string;
  alt: string;
  isPrimary: boolean;
}

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

export class LocalDiskStorage implements ImageStorage {
  async save(buffer: Buffer, alt: string): Promise<StoredImage> {
    if (buffer.length > maxFileBytes) throw new InvalidImageError("Each image must be 5 MB or smaller");
    const { fileTypeFromBuffer } = await import("file-type");
    const detectedType = await fileTypeFromBuffer(buffer);
    if (!detectedType || !acceptedFormats.has(detectedType.mime)) {
      throw new InvalidImageError("Only JPEG, PNG, and WebP images are allowed");
    }

    const key = `${randomUUID()}.webp`;
    const thumbnailKey = `${randomUUID()}-thumb.webp`;
    await mkdir(storageDirectory, { recursive: true });
    try {
      await sharp(buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(this.resolveKey(key));
      await sharp(buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 400, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(this.resolveKey(thumbnailKey));
    } catch {
      await Promise.allSettled([this.delete(key), this.delete(thumbnailKey)]);
      throw new InvalidImageError("Image could not be processed");
    }

    return {
      url: this.urlFor(key),
      key,
      publicId: key,
      thumbnailUrl: this.urlFor(thumbnailKey),
      thumbnailKey,
      alt: alt.trim().slice(0, 200),
      isPrimary: false,
    };
  }

  async delete(key: string): Promise<void> {
    const path = this.resolveKey(key);
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  urlFor(key: string): string {
    this.resolveKey(key);
    return `/uploads/products/${encodeURIComponent(key)}`;
  }

  private resolveKey(key: string): string {
    if (!/^[a-f\d-]{36}(?:-thumb)?\.webp$/i.test(key)) {
      throw new InvalidImageError("Invalid image key");
    }
    const path = resolve(storageDirectory, key);
    if (!path.startsWith(`${storageDirectory}${sep}`)) {
      throw new InvalidImageError("Invalid image key");
    }
    return path;
  }
}

export const imageStorage: ImageStorage = new LocalDiskStorage();

export async function deleteImageAssetsWhenUnused(
  images: Array<{ key?: string | null; thumbnailKey?: string | null }>,
): Promise<void> {
  for (const image of images) {
    if (!image.key) continue;
    const stillReferenced = await Product.exists({ "images.key": image.key }).exec();
    if (stillReferenced) continue;
    await imageStorage.delete(image.key);
    if (image.thumbnailKey) await imageStorage.delete(image.thumbnailKey);
  }
}
