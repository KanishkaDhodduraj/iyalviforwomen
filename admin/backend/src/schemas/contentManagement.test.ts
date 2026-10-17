import { describe, expect, it } from "vitest";
import { Review } from "../models/Review.js";
import { Reel } from "../models/Reel.js";
import { extractInstagramShortcode, instagramReelUrlSchema, reelCreateSchema, reelReorderSchema } from "./reel.js";

describe("Reel contract", () => {
  it("accepts only HTTPS Instagram reel and post links and extracts the shortcode", () => {
    expect(instagramReelUrlSchema.safeParse("https://www.instagram.com/reel/Ab_123/").success).toBe(true);
    expect(instagramReelUrlSchema.safeParse("https://www.instagram.com/p/Ab_123/").success).toBe(true);
    expect(extractInstagramShortcode("https://www.instagram.com/reel/Ab_123/?utm_source=admin")).toBe("Ab_123");
    for (const url of [
      "http://instagram.com/reel/Ab_123/",
      "https://instagram.com.evil.test/reel/Ab_123/",
      "https://evil.test/reel/Ab_123/",
      "https://user@instagram.com/reel/Ab_123/",
      "https://instagram.com:444/reel/Ab_123/",
    ]) {
      expect(instagramReelUrlSchema.safeParse(url).success).toBe(false);
    }
  });

  it("requires the defined reel fields and rejects duplicate reorder ids", () => {
    expect(reelCreateSchema.safeParse({
      title: "Spring edit",
      instagramUrl: "https://instagram.com/reel/Ab_123",
    }).success).toBe(true);
    expect(reelReorderSchema.safeParse({ ids: ["0123456789abcdef01234567", "0123456789abcdef01234567"] }).success).toBe(false);
  });

  it("enforces the Reel mongoose contract", async () => {
    const invalid = new Reel({ title: "Look", shortcode: "example", instagramUrl: "https://evil.test/reel/example" });
    const invalidErrors = await invalid.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(invalidErrors.instagramUrl).toBeDefined();
    const valid = new Reel({ title: "Look", shortcode: "Ab_123", instagramUrl: "https://instagram.com/reel/Ab_123" });
    await expect(valid.validate()).resolves.toBeUndefined();
    expect(valid.isActive).toBe(true);
    expect(valid.order).toBe(0);
    expect(Reel.schema.path("title")?.options.maxlength).toBe(120);
    expect(Reel.schema.path("order")?.options.min).toBe(0);
    expect(Reel.schema.path("order")?.options.max).toBe(1_000_000);
    expect(Reel.schema.indexes()).toEqual([[{ isActive: 1, order: 1 }, {}]]);
  });
});

describe("Review contract", () => {
  it("enforces user, rating, text length, and status fields", async () => {
    const missingUser = new Review({ rating: 5, text: "Lovely" });
    const missingUserErrors = await missingUser.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(missingUserErrors.user).toBeDefined();
    const invalidRating = new Review({ user: "0123456789abcdef01234567", rating: 6, text: "Lovely" });
    const invalidRatingErrors = await invalidRating.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(invalidRatingErrors.rating).toBeDefined();
    const tooLong = new Review({ user: "0123456789abcdef01234567", rating: 5, text: "x".repeat(501) });
    const tooLongErrors = await tooLong.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(tooLongErrors.text).toBeDefined();
    const invalidStatus = new Review({ user: "0123456789abcdef01234567", rating: 5, text: "Lovely", status: "visible" });
    const invalidStatusErrors = await invalidStatus.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(invalidStatusErrors.status).toBeDefined();
    const invalidMarkup = new Review({ user: "0123456789abcdef01234567", rating: 5, text: "<b>Lovely</b>" });
    const markupErrors = await invalidMarkup.validate().then(
      () => ({}),
      (error: { errors: Record<string, unknown> }) => error.errors,
    );
    expect(markupErrors.text).toBeDefined();
  });

  it("defaults new reviews to pending and allows optional product refs", async () => {
    const review = new Review({ user: "0123456789abcdef01234567", rating: 5, text: " Lovely " });
    await expect(review.validate()).resolves.toBeUndefined();
    expect(review.status).toBe("pending");
    expect(review.product).toBeUndefined();
    expect(review.text).toBe("Lovely");
    expect(Review.schema.indexes()).toEqual([
      [{ user: 1 }, {}],
      [{ product: 1 }, {}],
      [{ status: 1 }, {}],
    ]);
  });
});
