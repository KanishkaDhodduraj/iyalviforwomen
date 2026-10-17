import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  imageStorage,
  InvalidImageError,
  shouldRejectImageUploadInProduction,
  type StoredImage,
} from "./imageStorage.js";

describe("local product image storage", () => {
  it("disables local uploads in production deployments", () => {
    expect(shouldRejectImageUploadInProduction("production")).toBe(true);
    expect(shouldRejectImageUploadInProduction("development")).toBe(false);
  });

  it("rejects content with a fake image extension and invalid magic bytes", async () => {
    const fakeJpegBuffer = Buffer.from("not an image");
    await expect(imageStorage.save(fakeJpegBuffer, "fake.jpg")).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("rejects images larger than 5 MB before processing", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(imageStorage.save(oversized, "large")).rejects.toThrow(
      "Each image must be 5 MB or smaller",
    );
  });

  it("saves sanitized webp files and removes them by safe storage key", async () => {
    const input = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const stored = (await imageStorage.save(input, " Product image ")) as StoredImage & {
      thumbnailKey: string;
    };
    expect(stored.key).toMatch(/^[a-f\d-]{36}\.webp$/i);
    expect(stored.thumbnailKey).toMatch(/^[a-f\d-]{36}-thumb\.webp$/i);
    expect(stored.publicId).toBe(stored.key);
    expect(stored.url).toBe(`/uploads/products/${stored.key}`);
    expect(stored.thumbnailUrl).toBe(`/uploads/products/${stored.thumbnailKey}`);
    expect(stored.alt).toBe("Product image");
    await Promise.all([
      imageStorage.delete(stored.key),
      imageStorage.delete(stored.thumbnailKey),
    ]);
    await expect(imageStorage.delete(`${randomUUID()}.jpg`)).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
